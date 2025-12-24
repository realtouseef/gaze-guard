document.addEventListener('DOMContentLoaded', async () => {
  const enabledCheckbox = document.getElementById('enabled');
  const disableDomainCheckbox = document.getElementById('disable-domain');
  const thresholdSlider = document.getElementById('threshold');
  const thresholdValue = document.getElementById('threshold-value');
  const saveBtn = document.getElementById('save-btn');
  const status = document.getElementById('status');
  let currentSettings = { enabled: true, threshold: 0.5, categories: ['Porn', 'Hentai', 'Sexy'], disabledDomains: [] };
  let currentDomain = null;
  
  const categoryCheckboxes = {
    'Porn': document.getElementById('category-porn'),
    'Hentai': document.getElementById('category-hentai'),
    'Sexy': document.getElementById('category-sexy')
  };
  
  function loadSettings() {
    chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
      if (response) {
        currentSettings = {
          enabled: typeof response.enabled === 'boolean' ? response.enabled : currentSettings.enabled,
          threshold: typeof response.threshold === 'number' ? response.threshold : currentSettings.threshold,
          categories: Array.isArray(response.categories) ? response.categories : currentSettings.categories,
          disabledDomains: Array.isArray(response.disabledDomains) ? response.disabledDomains : currentSettings.disabledDomains
        };
      }
      enabledCheckbox.checked = currentSettings.enabled;
      thresholdSlider.value = currentSettings.threshold;
      thresholdValue.textContent = Math.round(currentSettings.threshold * 100) + '%';
      Object.keys(categoryCheckboxes).forEach(key => {
        categoryCheckboxes[key].checked = currentSettings.categories.includes(key);
      });
      if (currentDomain) {
        const disabledForDomain = Array.isArray(currentSettings.disabledDomains) && currentSettings.disabledDomains.includes(currentDomain);
        disableDomainCheckbox.checked = disabledForDomain;
      }
    });
  }
  
  function showStatus(message, isError = false) {
    status.textContent = message;
    status.className = 'status ' + (isError ? 'error' : 'success');
    setTimeout(() => {
      status.textContent = '';
      status.className = 'status';
    }, 3000);
  }
  
  thresholdSlider.addEventListener('input', (e) => {
    thresholdValue.textContent = Math.round(e.target.value * 100) + '%';
  });
  
  saveBtn.addEventListener('click', async () => {
    const disabledDomainSet = new Set(currentSettings.disabledDomains || []);
    if (currentDomain) {
      if (disableDomainCheckbox.checked) disabledDomainSet.add(currentDomain);
      else disabledDomainSet.delete(currentDomain);
    }
    const settings = {
      enabled: enabledCheckbox.checked,
      threshold: parseFloat(thresholdSlider.value),
      categories: Object.keys(categoryCheckboxes).filter(key => 
        categoryCheckboxes[key].checked
      ),
      disabledDomains: Array.from(disabledDomainSet)
    };
    currentSettings = settings;
    
    chrome.runtime.sendMessage({ 
      action: 'updateSettings', 
      settings: settings 
    }, (response) => {
      if (response && response.success) {
        showStatus('Settings saved successfully!');
      } else {
        showStatus('Error saving settings', true);
      }
    });
  });
  
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs[0] && tabs[0].url) {
      try {
        const url = new URL(tabs[0].url);
        currentDomain = url.hostname;
      } catch {}
    }
    loadSettings();
  });
});
