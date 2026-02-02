let model = null;
let settings = { enabled: true, threshold: 0.5, categories: ['Porn', 'Hentai', 'Sexy'], disabledDomains: [] };
const srcVerdicts = new Map();
const analysisQueue = [];
let isAnalyzing = false;
let backendReady = false;
let scanIntervalId = null;
let intersectionObserver = null;
let domObserver = null;
let isProcessing = false;
let queueProcessingTimeout = null;
let persistentVerdicts = {}; // Cache from storage

// NudeNet Configuration
const MODEL_URL = chrome.runtime.getURL('models/nudenet/model.json');
// Classes based on default NudeNet model
const NUDE_CLASSES = [2, 3, 4, 6, 14]; // Exposed parts (Buttocks, Breast, Genitalia, Anus)
const SEXY_CLASSES = [0, 5, 13, 15, 16, 17]; // Covered parts/Suggestive (Belly, Covered Genitalia/Breast/Buttocks)

// Load persistent cache immediately
chrome.storage.local.get(['imageVerdicts'], (result) => {
  if (result.imageVerdicts) {
    persistentVerdicts = result.imageVerdicts;
    // Populate Map for fast lookup
    Object.keys(persistentVerdicts).forEach(key => {
      srcVerdicts.set(key, persistentVerdicts[key]);
    });
  }
});

function saveVerdict(key, isUnsafe) {
  if (!key) return;
  
  // Update local cache
  persistentVerdicts[key] = isUnsafe;
  
  // Persist to storage (debounced could be better, but direct set is safe for single keys in small volume)
  // For high volume, we rely on the fact that we only classify new images
  chrome.storage.local.set({ imageVerdicts: persistentVerdicts });
}

async function loadModel() {
  if (model) return model;
  try {
    if (typeof tf === 'undefined') {
      console.error('TensorFlow.js not loaded');
      return null;
    }
    
    await ensureTfReady();
    model = await tf.loadGraphModel(MODEL_URL);
    
    // Warmup
    const dummy = tf.zeros([1, 320, 320, 3]);
    const result = await model.executeAsync(dummy);
    if (Array.isArray(result)) {
      result.forEach(t => t.dispose());
    } else {
      result.dispose();
    }
    dummy.dispose();
    
    console.log('NudeNet model loaded');
  } catch (e) {
    console.error('Failed to load NudeNet model', e);
  }
  return model;
}

async function ensureTfReady() {
  if (backendReady) return;
  if (typeof tf !== 'undefined') {
    // Enable production mode for performance
    if (typeof tf.enableProdMode === 'function') tf.enableProdMode();
    
    // Set WASM paths and backend
    try {
      if (tf.wasm && typeof tf.wasm.setWasmPaths === 'function') {
        tf.wasm.setWasmPaths(chrome.runtime.getURL('libs/'));
      }
      
      // Explicitly set backend and wait
      if (typeof tf.setBackend === 'function') {
        await tf.setBackend('wasm');
        console.log('TensorFlow.js backend set to WASM');
      } else {
        console.warn('tf.setBackend not available, skipping backend selection');
      }
    } catch (e) {
      console.warn('Failed to set WASM backend, attempting fallback to CPU', e);
      try {
        await tf.setBackend('cpu');
        console.log('TensorFlow.js backend set to CPU');
      } catch (cpuError) {
        console.error('Failed to set CPU backend', cpuError);
      }
    }

    if (typeof tf.ready === 'function') {
      await tf.ready();
    }
  }
  backendReady = true;
}

// Helper to run detection on an image element
async function detect(imageElement) {
  if (!model) await loadModel();
  if (!model) throw new Error('Model not loaded');

  let tensor = null;
  let resized = null;
  let expanded = null;
  let predictions = null;
  
  try {
    // Create tensor from image
    tensor = tf.browser.fromPixels(imageElement);
    
    // Resize to 320x320 (NudeNet default/optimized size)
    // bilinear interpolation is faster than bicubic
    resized = tf.image.resizeBilinear(tensor, [320, 320]);
    
    // Cast to float and expand dims to [1, 320, 320, 3]
    // resized is already float32 from resizeBilinear usually, but let's be safe
    
    // NudeNet expects 0-255 float inputs usually.
    expanded = resized.toFloat().expandDims(0);
    
    // Execute model
    predictions = await model.executeAsync(expanded);
    
    // Parse results
    // Output depends on model. default-f16 usually has:
    // [boxes, scores, classes] or similar order.
    // We need to check the output tensors.
    // Based on signature:
    // output1: boxes (filtered_detections...TensorArrayGatherV3:0) [batch, 300, 4]
    // output2: scores (filtered_detections...TensorArrayGatherV3:0) [batch, 300]
    // output3: classes (filtered_detections...TensorArrayGatherV3:0) [batch, 300]
    
    // executeAsync returns array of tensors if multiple outputs.
    // The order in the array matches the order in model.json 'outputs' if we don't specify names?
    // Actually it's better to inspect the result.
    
    let boxesT, scoresT, classesT;
    
    if (Array.isArray(predictions)) {
      // We need to identify which is which.
      // Usually heuristics: shape [N, 300, 4] is boxes. [N, 300] is scores/classes.
      // Classes are usually Int or Float (check values). Scores are 0-1.
      
      for (const t of predictions) {
        const shape = t.shape;
        if (shape.length === 3 && shape[2] === 4) {
          boxesT = t;
        } else if (shape.length === 2 && shape[1] === 300) {
          // Could be scores or classes.
          // We can check data later, or assume based on index if stable.
          // Let's rely on checking data range or signature names if possible?
          // TFJS executeAsync can return a map if we provide input map? No, it returns array or tensor.
          // Let's store them and differentiate by values.
        }
      }
      
      // If we can't identify by shape (since scores and classes have same shape), we might need to rely on order.
      // Signature order: output2 (scores), output1 (boxes), output3 (classes).
      // BUT keys in JSON are unordered.
      // However, usually the output array from executeAsync is sorted by output name string.
      // output1 (boxes), output2 (scores), output3 (classes).
      // Let's assume this for now.
      
      // Better heuristic:
      // Boxes: [1, 300, 4]
      // Scores: [1, 300], values 0..1
      // Classes: [1, 300], values 0..17 (integers)
      
      // We will read data.
    }
    
    // To be safe, let's just get the data and analyze.
    const results = await Promise.all(predictions.map(t => t.data()));
    
    let scores, classes;
    
    // Find arrays
    for (let i = 0; i < predictions.length; i++) {
      const shape = predictions[i].shape;
      const data = results[i];
      
      if (shape.length === 3 && shape[2] === 4) {
        // Boxes, ignore
      } else if (shape.length === 2 && shape[1] === 300) {
        // Check if values look like probabilities (0-1) or classes (>1 possible)
        // Classes are 0-17. Scores are 0-1.
        // If we see value > 1, it's classes.
        // If all values <= 1, it COULD be classes (0 or 1) or scores.
        // But scores are usually floats. Classes are integers.
        // Check if data is Int32Array (classes) or Float32Array (scores).
        
        if (data instanceof Int32Array || (data.some(v => v > 1.0))) {
          classes = data;
        } else {
          scores = data;
        }
      }
    }
    
    // Fallback if we couldn't identify (e.g. all classes are 0 or 1, and floats)
    if (!classes && !scores && predictions.length >= 3) {
        // Assume standard order: boxes, scores, classes (or similar)
        // Actually, let's look at the signature names again.
        // output1: boxes
        // output2: scores
        // output3: classes
        // If sorted by name: output1, output2, output3.
        // predictions[0] = boxes
        // predictions[1] = scores
        // predictions[2] = classes
        
        // Let's try this fallback.
        if (predictions[1].shape[1] === 300) scores = results[1];
        if (predictions[2].shape[1] === 300) classes = results[2];
    }
    
    if (!scores || !classes) return [];
    
    const detected = [];
    for (let i = 0; i < scores.length; i++) {
      if (scores[i] > 0.4) { // Pre-filter low confidence
        const cls = Math.round(classes[i]);
        let className = null;
        
        if (NUDE_CLASSES.includes(cls)) className = 'Porn';
        else if (SEXY_CLASSES.includes(cls)) className = 'Sexy';
        
        if (className) {
           // Use Hentai as alias if needed, but for now map to Porn/Sexy
           detected.push({ className, probability: scores[i] });
        }
      }
    }
    
    return detected;

  } finally {
    if (tensor) tensor.dispose();
    if (resized) resized.dispose();
    if (expanded) expanded.dispose();
    if (predictions) {
       if (Array.isArray(predictions)) predictions.forEach(t => t.dispose());
       else predictions.dispose();
    }
  }
}


function getElementKey(element) {
  if (element.tagName === 'IMG') {
    if (element.src && element.src.startsWith('data:')) {
      // Use the first 50 characters of data URI as key to avoid massive keys
      return element.src.substring(0, 50) + element.src.length;
    }
    // Google Images specific handling
    if (element.src && element.src.startsWith('https://encrypted-tbn0.gstatic.com')) {
      return element.src;
    }
    return element.currentSrc || element.src || '';
  }
  
  // Check computed style for background image if inline style is not present or empty
  // Optimization: AVOID getComputedStyle as it causes reflows. Only check inline styles.
  const bgImage = element.style.backgroundImage;
  
  if (bgImage && bgImage !== 'none') {
    const match = bgImage.match(/url\(['"]?(.*?)['"]?\)/);
    if (match) {
      const url = match[1];
      if (url.startsWith('data:')) {
        return url.substring(0, 50) + url.length;
      }
      return url;
    }
  }
  return '';
}

function isRenderable(element) {
  if (element.tagName === 'IMG') {
    if (!element.complete && (element.currentSrc || element.src)) return true;

    // Optimization: Use naturalWidth only. Accessing element.width forces reflow.
    const w = element.naturalWidth || 0;
    const h = element.naturalHeight || 0;
    return w >= 16 && h >= 16;
  }
  const rect = element.getBoundingClientRect();
  return rect.width >= 16 && rect.height >= 16;
}

function isSvgLikeElement(element) {
  if (!element || element.nodeType !== 1) return false;
  if (element.tagName === 'IMG') {
    const src = element.currentSrc || element.src || '';
    if (!src) return false;
    if (/\.svg(\?|$)/i.test(src)) return true;
    if (src.startsWith('data:image/svg+xml')) return true;
    return false;
  }
  
  // Optimization: Use inline style check instead of getComputedStyle
  const bgImage = element.style.backgroundImage;
  if (bgImage && bgImage !== 'none') {
    const match = bgImage.match(/url\(['"]?(.*?)['"]?\)/);
    if (match) {
      const url = match[1];
      if (/\.svg(\?|$)/i.test(url)) return true;
      if (url.startsWith('data:image/svg+xml')) return true;
    }
  }
  return false;
}

function markPending(element) {
  if (!element || !element.isConnected) return;
  if (!settings.enabled) return;
  if (element.classList.contains('gaze-guard-blur')) return;

  if (isSvgLikeElement(element)) {
    clearBlur(element);
    return;
  }

  const key = getElementKey(element);
  if (key && srcVerdicts.has(key) && srcVerdicts.get(key) === false) return;

  element.classList.add('gaze-guard-pending');
  element.classList.add('gaze-guard-pre-blur');
}

function clearPending(element) {
  if (!element || !element.isConnected) return;
  element.classList.remove('gaze-guard-pending');
  element.classList.remove('gaze-guard-pre-blur');
}

function stopAll() {
  if (scanIntervalId) {
    clearInterval(scanIntervalId);
    scanIntervalId = null;
  }

  if (queueProcessingTimeout) {
    clearTimeout(queueProcessingTimeout);
    queueProcessingTimeout = null;
  }

  analysisQueue.length = 0;
  isAnalyzing = false;
  isProcessing = false;

  if (intersectionObserver) {
    intersectionObserver.disconnect();
    intersectionObserver = null;
  }

  if (domObserver) {
    domObserver.disconnect();
    domObserver = null;
  }

  document.querySelectorAll('.gaze-guard-blur, .gaze-guard-pre-blur, .gaze-guard-pending').forEach(el => clearBlur(el));
}

function enqueueImage(element) {
  if (!settings.enabled) {
    clearBlur(element);
    return;
  }
  if (!element || !element.isConnected) return;

   if (isSvgLikeElement(element)) {
     clearBlur(element);
     const keySvg = getElementKey(element);
     if (keySvg) {
       srcVerdicts.set(keySvg, false);
       saveVerdict(keySvg, false);
     }
     return;
   }
  
  const key = getElementKey(element);
  if (key && srcVerdicts.has(key)) {
    const hasInappropriateContentCached = srcVerdicts.get(key);
    if (hasInappropriateContentCached) blurImage(element);
    else clearBlur(element);
    return;
  }
  
  analysisQueue.push(element);
  processQueue();
}

function clearBlur(img) {
  if (!img || !img.isConnected) return;

  img.classList.remove('gaze-guard-blur');
  img.classList.remove('gaze-guard-pending');
  img.classList.remove('gaze-guard-pre-blur');
  img.title = '';

  if (img.parentElement) {
    const overlay = img.parentElement.querySelector('.gaze-guard-overlay');
    if (overlay) overlay.remove();
  }
}

function ensureIntersectionObserver() {
  if (intersectionObserver) return;
  intersectionObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const target = entry.target;
      intersectionObserver.unobserve(target);
      
      const key = getElementKey(target);
      if (key && srcVerdicts.has(key)) {
        const hasInappropriateContentCached = srcVerdicts.get(key);
        if (hasInappropriateContentCached) blurImage(target);
        else clearBlur(target);
      } else {
        enqueueImage(target);
      }
    });
  }, { root: null, rootMargin: '2000px 0px', threshold: 0.01 });
}

function loadImageFromElement(element) {
  return new Promise((resolve, reject) => {
    try {
      // Create a completely new image element to avoid DOM/state issues
      const img = new Image();
      img.crossOrigin = 'anonymous'; // Important for CORS
      
      const handleLoad = () => {
        resolve(img);
      };

      const handleError = (err) => {
        reject(new Error('Image load failed'));
      };

      img.onload = handleLoad;
      img.onerror = handleError;

      // Get the correct source
      let src = '';
      if (element.tagName === 'IMG') {
        src = element.currentSrc || element.src;
      } else {
        const key = getElementKey(element);
        if (key) src = key;
      }

      if (!src) {
        reject(new Error('No image source found'));
        return;
      }

      if (src.startsWith('data:') || src.startsWith('blob:')) {
        img.src = src;
        return;
      }

      // Google Images specific handling for base64 placeholders
      if (src.startsWith('data:image/gif;base64') || src.includes('encrypted-tbn0.gstatic.com')) {
         img.src = src;
         return;
      }

      img.onload = handleLoad;
      img.onerror = () => {
        chrome.runtime.sendMessage({ action: 'fetchImage', url: src }, (response) => {
          if (response && response.dataUri) {
            img.onload = handleLoad;
            img.onerror = () => reject(new Error('Image load failed even with background fetch'));
            img.src = response.dataUri;
          } else {
            reject(new Error('Image load failed and background fetch failed'));
          }
        });
      };

      img.src = src;
    } catch (e) {
      reject(e);
    }
  });
}

function processQueue() {
  if (isAnalyzing || isProcessing) return;
  isAnalyzing = true;
  isProcessing = true;
  
  const run = async () => {
    try {
      // Model should be preloaded, but ensure it here just in case
      await ensureTfReady();
      if (!model) await loadModel();
      
      const BATCH_SIZE = 5; 
      const TIMEOUT_MS = 5000; // Increased timeout for NudeNet as it might be slower than MobileNet

      while (analysisQueue.length > 0) {
        // Process in batches
        const batch = [];
        while (batch.length < BATCH_SIZE && analysisQueue.length > 0) {
          batch.push(analysisQueue.shift());
        }

        await Promise.all(batch.map(async (element) => {
          if (!element || !element.isConnected) return;
          if (!isRenderable(element)) {
            clearPending(element);
            return;
          }

          if (isSvgLikeElement(element)) {
            clearBlur(element);
            const svgKey = getElementKey(element);
            if (svgKey) {
              srcVerdicts.set(svgKey, false);
              saveVerdict(svgKey, false);
            }
            return;
          }

          const key = getElementKey(element);
          if (key && srcVerdicts.has(key)) {
            const hasInappropriateContentCached = srcVerdicts.get(key);
            if (hasInappropriateContentCached) blurImage(element);
            else clearBlur(element);
            return;
          }
          
          try {
            // Load the actual image data for classification
            const imageToClassify = await loadImageFromElement(element);

            // Double check dimensions after load (in case it was incomplete before)
            if (imageToClassify.width < 16 || imageToClassify.height < 16) return;

            // Create a promise that rejects after timeout
            const predictionPromise = new Promise(async (resolve, reject) => {
              const timer = setTimeout(() => reject(new Error('Classification Timeout')), TIMEOUT_MS);
              try {
                const predictions = await detect(imageToClassify);
                clearTimeout(timer);
                resolve(predictions);
              } catch (e) {
                clearTimeout(timer);
                reject(e);
              }
            });

            const predictions = await predictionPromise;
            const hasInappropriateContent = predictions.some(prediction => 
              settings.categories.includes(prediction.className) && 
              prediction.probability >= settings.threshold
            );
            
            if (key) {
              srcVerdicts.set(key, hasInappropriateContent);
              saveVerdict(key, hasInappropriateContent);
            }
            
            if (hasInappropriateContent) blurImage(element);
            else clearBlur(element);
            
          } catch (error) {
            // Silence common errors that aren't critical
            if (error.message !== 'Timeout' && error.message !== 'Classification Timeout' && error.message !== 'Image load failed' && error.message !== 'No image source found') {
               console.warn('GazeGuard classification warning:', error.message || error);
            }
            // On error (CORS, timeout, etc), we fail open (don't blur)
            clearBlur(element);
            if (key) {
              srcVerdicts.set(key, false);
              saveVerdict(key, false);
            }
          }
        }));

        // Minimal delay for max speed while keeping UI responsive
        await new Promise(r => setTimeout(r, 5));

        if (typeof tf !== 'undefined' && typeof tf.nextFrame === 'function') {
          await tf.nextFrame();
        }
      }
      
    } catch (error) {
      console.error('Error in processQueue:', error);
    } finally { 
      isAnalyzing = false;
      isProcessing = false;
      
      if (analysisQueue.length > 0) {
        queueProcessingTimeout = setTimeout(processQueue, 100);
      }
    }
  };
  
  run();
}

function blurImage(img) {
  if (!img || !img.isConnected) return;

  if (isSvgLikeElement(img)) {
    clearBlur(img);
    const svgKey = getElementKey(img);
    if (svgKey) {
      srcVerdicts.set(svgKey, false);
      saveVerdict(svgKey, false);
    }
    return;
  }

  img.classList.remove('gaze-guard-pending');
  img.classList.remove('gaze-guard-pre-blur');
  img.classList.add('gaze-guard-blur');
  img.title = 'Click to unblur';
  
  // Add simple toggle functionality
  if (!img.dataset.gazeGuardClickAttached) {
    img.dataset.gazeGuardClickAttached = 'true';
    img.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (img.classList.contains('gaze-guard-blur')) {
        img.classList.remove('gaze-guard-blur');
        img.title = '';
      } else {
        img.classList.add('gaze-guard-blur');
        img.title = 'Click to unblur';
      }
    });
  }
}

function findAllImages(root) {
  const elements = [];
  
  // Helper to process a container (Document, ShadowRoot, or Element)
  const scanContainer = (container) => {
    // 1. Fast path: Find all IMG tags using native querySelectorAll
    const imgs = container.querySelectorAll('img');
    imgs.forEach(img => {
      if (!isSvgLikeElement(img)) elements.push(img);
    });

    // 2. Optimized Background Image Check & Shadow DOM
    const iframes = container.querySelectorAll('iframe');
    iframes.forEach(el => {
      try {
        const doc = el.contentDocument;
        if (doc && doc.body) {
          scanContainer(doc.body);
        }
      } catch (e) {
        // Cross-origin iframe, ignore
      }
    });
  };

  // If root itself is an element, check it first
  if (root.nodeType === 1) { // ELEMENT_NODE
    if (root.tagName === 'IMG' && !isSvgLikeElement(root)) {
      elements.push(root);
    } else if (root.style && root.style.backgroundImage && root.style.backgroundImage !== 'none' && !isSvgLikeElement(root)) {
      elements.push(root);
    }
    
    if (root.shadowRoot) scanContainer(root.shadowRoot);
    if (root.tagName === 'IFRAME') {
       try {
         const doc = root.contentDocument;
         if (doc && doc.body) scanContainer(doc.body);
       } catch(e) {}
    }
  }

  // Scan descendants
  scanContainer(root);
  
  return elements;
}

function scanImagesOnce() {
  const root = document.body || document.documentElement;
  if (!root) return;

  if (isPdfEnvironment()) {
    stopAll();
    return;
  }

  const elements = findAllImages(root);
  if (!elements.length) return;

  ensureIntersectionObserver();
  elements.forEach(el => {
    if (!el.isConnected) return;

    const key = getElementKey(el);
    if (key && srcVerdicts.has(key)) {
      const hasInappropriateContentCached = srcVerdicts.get(key);
      if (hasInappropriateContentCached) blurImage(el);
      else clearBlur(el);
      return;
    }

    markPending(el);
    intersectionObserver.observe(el);
  });
}

function startScanning() {
  scanImagesOnce();
  // MutationObserver handles dynamic content updates.
}

function observeDOM() {
  if (!settings.enabled) return;

  if (domObserver) domObserver.disconnect();

  domObserver = new MutationObserver(mutations => {
    if (isPdfEnvironment()) {
      stopAll();
      return;
    }
    if (window.gazeGuardMutationTimeout) {
      clearTimeout(window.gazeGuardMutationTimeout);
    }

    window.gazeGuardMutationTimeout = setTimeout(() => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) {
            const imagesInNode = findAllImages(node);
            imagesInNode.forEach(img => {
              ensureIntersectionObserver();
              markPending(img);
              intersectionObserver.observe(img);
            });
          }
        });
      });
    }, 100);
  });

  domObserver.observe(document.documentElement || document.body, {
    childList: true,
    subtree: true
  });
}

function isPdfEnvironment() {
  try {
    const href = (location && location.href) || '';
    const loweredHref = href.toLowerCase();
    if (loweredHref.endsWith('.pdf') || loweredHref.includes('.pdf?')) return true;
    if (document.contentType === 'application/pdf') return true;
    const body = document.body;
    if (body && body.classList && body.classList.contains('pdf-viewer')) return true;
    if (document.querySelector('embed[type="application/pdf"], object[type="application/pdf"]')) return true;
    if (document.querySelector('iframe[src$=".pdf"], iframe[src*=".pdf?"]')) return true;
  } catch {}
  return false;
}

function loadSettings(callback) {
  chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
    if (response) {
      settings = {
        enabled: typeof response.enabled === 'boolean' ? response.enabled : settings.enabled,
        threshold: typeof response.threshold === 'number' ? response.threshold : settings.threshold,
        categories: Array.isArray(response.categories) ? response.categories : settings.categories,
        disabledDomains: Array.isArray(response.disabledDomains) ? response.disabledDomains : settings.disabledDomains
      };
    }
    if (callback) callback();
  });
}

function start() {
  if (isPdfEnvironment()) return;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      startScanning();
    }, { once: true });
  }

  startScanning();
  observeDOM();
  loadModel();

  loadSettings(() => {
    const hostname = location.hostname;

    if (!settings.enabled) {
      stopAll();
      return;
    }

    if (Array.isArray(settings.disabledDomains) && settings.disabledDomains.includes(hostname)) {
      stopAll();
      return;
    }

    startScanning();
    observeDOM();
    loadModel();
  });
}

if (!window.__gazeGuardInit) {
  window.__gazeGuardInit = true;
  start();
}
