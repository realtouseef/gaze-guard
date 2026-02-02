# Gaze Guard — AI Image Blur Extension

A Chrome extension that uses AI to detect and blur inappropriate images on web pages. Automatically blurs images containing explicit content using the NudeNet model.

## Features

- **AI-powered content detection**: Uses the NudeNet TensorFlow.js model (graph model) for accurate body part detection.
- **Smart blurring**: Automatically blurs images detected as Porn or Sexy.
- **User control**: Adjustable sensitivity threshold and category selection.
- **Privacy-focused**: All image analysis happens locally in your browser.
- **Easy to use**: Simple toggle to enable/disable protection.

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
4. **Select categories** to blur
5. **Save settings** and browse the web safely

## How it works

- **Local Processing**: The extension runs entirely in the browser using a local version of the **NudeNet** model via TensorFlow.js. No images are sent to external servers.
- **Image Detection**: 
  - Scans the page for `<img>` elements and elements with background images.
  - Uses `MutationObserver` to detect new images added to the page dynamically.
  - Uses `IntersectionObserver` to only process images when they scroll into view, optimizing performance.
- **Classification**: 
  - Images are resized and analyzed by the NudeNet object detection model.
  - The model detects specific body parts and classifies them into categories (e.g., Porn, Sexy).
- **Censoring Action**: 
  - If inappropriate content is detected with probability exceeding the threshold, a blur filter is applied.
  - The blur is implemented using CSS classes (`gaze-guard-blur`).
  - Users can click blurred images to temporarily reveal them.

## Settings

- **Enable protection**: Toggle the extension on/off
- **Sensitivity threshold**: Adjust from 10% to 90% (default: 50%)
- **Categories**: Choose which content types to blur
- **Privacy**: No data leaves your device.

## Important Files & Structure

```
gaze-guard/
├── manifest.json              # Extension configuration and permissions
├── background.js              # Handles settings storage and CORS-bypassing for image fetching
├── content.js                 # Core logic: DOM scanning, image classification, and censoring
├── styles.css                 # CSS for the blur effect
├── popup.html/js/css          # Settings UI
├── libs/                      # Local dependencies
│   └── tf.min.js              # TensorFlow.js library
└── models/                    # Pre-trained model files
    └── nudenet/               # NudeNet model weights and topology
```

## Model Details
We use the **NudeNet** model (optimized for TFJS). This model is:
- **Accurate**: Object detection based approach for identifying body parts.
- **Private**: Runs entirely in the browser.

## License

The extension code is provided as-is for educational and personal use.
