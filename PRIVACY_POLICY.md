# Gaze Guard – Privacy Policy

Last updated: 2025-12-25

Gaze Guard is a Chrome extension that helps you avoid unexpected explicit images while browsing. This Privacy Policy explains what data the extension accesses, how it is used, and what is not collected.

## 1. Overview

Gaze Guard is designed with privacy first:
- Image analysis runs locally in your browser using on-device AI.
- We do not collect, store, or sell your personal data.
- We do not use tracking, analytics, or ads inside the extension.

## 2. Data We Collect

### 2.1 No personal data collection

Gaze Guard does not collect:
- Your name, email address, or any contact information
- Your browsing history or URLs you visit
- Your search queries
- Your IP address or device identifiers
- The actual images or page content you see

We do not operate any backend server that receives or stores your browsing data.

### 2.2 Local extension settings

The extension saves the following preferences locally in Chrome storage:
- Whether protection is enabled or disabled
- Your sensitivity threshold (for example, 50%)
- Which content categories are blurred (Porn, Hentai, Sexy)
- Domains where you have disabled the extension

These values are stored only on your device, using Chrome’s storage API, so your preferences persist between sessions. They are not transmitted to us.

### 2.3 Local image verdict cache

To improve performance, Gaze Guard may store a small local cache that maps image sources, such as URLs or truncated data URIs, to a simple verdict:
- true: blurred
- false: not blurred

This cache:
- Is stored locally via chrome.storage.local
- Does not contain the image pixels
- Is not sent to any external server
- Is used only to avoid re-analyzing the same images on repeat visits

You can clear this cache at any time by removing the extension’s data or uninstalling the extension.

## 3. How We Process Data

### 3.1 On-device image analysis

Gaze Guard uses TensorFlow.js and NSFWJS entirely in your browser to classify images into categories such as Neutral, Drawing, Porn, Hentai, and Sexy.

- Images are read directly from the current page or fetched via the background script solely for classification.
- Classification results, probabilities, are used immediately to decide whether to blur an image.
- No image pixels, classification results, or URLs are transmitted to us.

### 3.2 Blur application

When an image is considered unsafe based on your settings:
- The extension applies CSS blur styles on the page.
- No additional data is stored beyond the minimal verdict cache described above.

## 4. Permissions and Their Use

Gaze Guard requests the following permissions.

### 4.1 activeTab

The activeTab permission is used only to allow the extension to operate on the page you are currently viewing after you interact with it, for example opening the popup or enabling protection. This is required to scan and blur images on the active tab. It is not used to access or store your broader browsing history.

### 4.2 storage

The storage permission is used to store:
- Your preferences: enabled state, threshold, categories, disabled domains
- The local image verdict cache

All data stored via storage is kept on your device and is not transmitted to external servers.

### 4.3 http://*/* and https://*/* host permissions

The http://*/* and https://*/* host permissions are required so the content script can run on pages you visit and apply blurring to images wherever you browse. The extension:
- Reads images and styles necessary to decide whether to blur them
- Does not modify the page beyond applying blur-related classes
- Does not send page content to any remote server

### 4.4 https://nsfwjs.com/* host permission

The https://nsfwjs.com/* host permission is used only to load or update AI model resources, if needed, from the NSFWJS project. The extension does not send any of your browsing data to nsfwjs.com.

## 5. Third-Party Libraries

Gaze Guard uses the following client-side libraries:
- TensorFlow.js, for running machine learning models in the browser
- NSFWJS, for classifying images into NSFW and SFW categories

These libraries run locally in your browser. We do not integrate any third-party analytics, advertising, or tracking scripts.

You may review the respective open-source projects for their own terms and licenses.

## 6. Children’s Privacy

Gaze Guard is intended to help create a safer browsing experience but is not specifically directed at children under 13. We do not knowingly collect any personal information from children. Because we do not collect user data, we have no way to identify or track individual users, including minors.

## 7. Data Retention and Deletion

All data stored by the extension, settings and local cache, resides in your browser’s storage. You can delete it at any time by:
- Disabling or uninstalling the extension
- Clearing site or extension data via your browser’s settings

We do not maintain any server-side copy of this data.

## 8. Changes to This Policy

We may update this Privacy Policy from time to time to reflect improvements or changes in the extension. When we do, we will update the Last updated date at the top of this document. Any significant change in how data is handled will be communicated via the extension listing or release notes.

## 9. Contact

If you have any questions about this Privacy Policy or how Gaze Guard handles data, you can contact the developer.

- Author: Touseef Ur Rehman
- Email: touseefibnkhalil@gmail.com
- GitHub: https://github.com/realtouseef

