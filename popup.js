document.addEventListener('DOMContentLoaded', async () => {
  const thresholdSlider = document.getElementById('threshold');
  const thresholdValue = document.getElementById('threshold-value');
  const saveBtn = document.getElementById('save-btn');
  const status = document.getElementById('status');
  let currentSettings = { enabled: true, threshold: 0.5, categories: ['Porn', 'Hentai', 'Sexy'], disabledDomains: [] };
  
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
      thresholdSlider.value = currentSettings.threshold;
      thresholdValue.textContent = Math.round(currentSettings.threshold * 100) + '%';
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
    const settings = {
      enabled: true,
      threshold: parseFloat(thresholdSlider.value),
      categories: currentSettings.categories,
      disabledDomains: currentSettings.disabledDomains
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

  loadSettings();
});
