# Gaze Guard

A Chrome extension that uses AI to detect and blur inappropriate images on web pages. Automatically blurs images with 50% or higher probability of containing Porn, Hentai, or Sexy content

## Features

- **AI-powered content detection**: Uses the NSFWJS TensorFlow.js model to analyze images
- **Smart blurring**: Automatically blurs images with 50% or higher probability of containing Porn, Hentai, or Sexy content
- **User control**: Adjustable sensitivity threshold and category selection
- **Privacy-focused**: All image analysis happens locally in your browser
- **Easy to use**: Simple toggle to enable/disable protection

## Installation

1. **Download the extension files** or clone this repository
2. **Open Chrome** and navigate to `chrome://extensions/`
3. **Enable Developer mode** (toggle in the top right)
4. **Click "Load unpacked"** and select the extension folder
5. **The extension icon** will appear in your Chrome toolbar

## Usage

1. **Click the extension icon** in your Chrome toolbar to open settings
2. **Enable protection** using the toggle switch
3. **Adjust sensitivity** (default: 50% threshold)
4. **Select categories** to blur (Porn, Hentai, Sexy)
5. **Save settings** and browse the web safely

## How it works

- **Local Processing**: The extension runs entirely in the browser using a local version of the **MobileNet V2** model via NSFWJS. No images are sent to external servers.
- **Image Detection**: 
  - Scans the page for `<img>` elements and elements with background images.
  - Uses `MutationObserver` to detect new images added to the page dynamically.
  - Uses `IntersectionObserver` to only process images when they scroll into view, optimizing performance.
- **Classification**: 
  - Images are converted to tensors and analyzed by the TensorFlow.js model.
  - The model outputs probability scores for 5 categories: Neutral, Drawing, Porn, Hentai, and Sexy.
- **Censoring Action**: 
  - If the probability for **Porn**, **Hentai**, or **Sexy** exceeds the user-defined threshold (default 50%), a blur filter is applied.
  - The blur is implemented using CSS classes (`gaze-guard-blur`).
  - Users can click blurred images to temporarily reveal them.

## Settings

- **Enable protection**: Toggle the extension on/off
- **Sensitivity threshold**: Adjust from 10% to 90% (default: 50%)
- **Categories**: Choose which content types to blur (Porn, Hentai, Sexy)

## Privacy

This extension respects your privacy:
- No data is collected or sent to external servers
- Image analysis happens entirely in your browser
- No browsing history is stored
- Settings are saved locally in Chrome storage

## Important Files & Structure

```
gaze-guard/
├── manifest.json              # Extension configuration and permissions
├── background.js              # Handles settings storage and CORS-bypassing for image fetching
├── content.js                 # Core logic: DOM scanning, image classification, and censoring
├── styles.css                 # CSS for the blur effect
├── popup.html/js/css          # Settings UI
├── libs/                      # Local dependencies
│   ├── nsfwjs.min.js          # NSFWJS library
│   └── tf.min.js              # TensorFlow.js library
└── models/                    # Pre-trained MobileNet V2 model files
    └── mobilenet_v2/          # Model weights and topology
```

### Model Details
We use the **MobileNet V2** model provided by NSFWJS. This model is:
- **Lightweight**: Optimized for running in the browser with low memory usage.
- **Fast**: Provides near real-time classification.
- **Accuracy**: Balanced trade-off between speed and accuracy for client-side filtering.

## License

This project uses the NSFWJS model which is open source. The extension code is provided as-is for educational and personal use.