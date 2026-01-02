# Gaze Guard - Development Standards & Best Practices

This document outlines the industry-standard rules, architectural guidelines, and best practices for the **Gaze Guard** Chrome Extension.

## 1. Extension Architecture (Manifest V3)
- **Service Worker**: Use `background.js` as a Service Worker (not a persistent background page). Ensure it is event-driven and handles lifecycle events gracefully.
- **Content Scripts**: Keep content scripts (`content.js`) lightweight. They interact directly with the DOM. Heavy logic should be minimized or offloaded if possible, though strict CSP often requires local processing for ML models.
- **Permissions**: Follow the "Principle of Least Privilege". Only request permissions absolutely necessary (`activeTab`, `storage`, `scripting`, etc.).
- **Resources**: All external libraries (TensorFlow.js, NSFWJS) and models MUST be bundled locally in `libs/` and `models/`. Do not rely on CDNs to ensure offline functionality and pass store reviews.

## 2. Code Quality & Style
- **JavaScript**: Use modern ES6+ syntax (Arrow functions, Async/Await, Const/Let).
- **Formatting**: Code should be consistently formatted.
  - **Indentation**: 2 spaces.
  - **Quotes**: Single quotes preferred for JS, Double quotes for JSON/HTML.
  - **Semicolons**: Always use semicolons.
- **Linting**: (Recommended) Use ESLint with a standard config (e.g., `eslint:recommended` or `airbnb-base`) to catch errors early.
- **Comments**: Document complex logic, especially the `IntersectionObserver` and TensorFlow model loading handling.

## 3. Performance & Optimization
- **Image Processing**:
  - **IntersectionObserver**: NEVER scan the entire page at once. Only process images as they enter the viewport.
  - **MutationObserver**: Efficiently watch for dynamic content changes without blocking the main thread.
  - **Debouncing/Throttling**: Debounce rapid events to prevent UI jank.
- **Model Management**:
  - Load the model once and reuse it.
  - Use the `tfjs-backend-wasm` backend for better performance on CPU-bound devices if WebGL is unstable or unavailable, but prefer WebGL for speed.
  - Ensure memory cleanup (dispose tensors) using `tf.tidy()` or manual `.dispose()` to prevent memory leaks in the browser tab.

## 4. Security & Privacy
- **Local Processing**: ABSOLUTELY NO image data should leave the user's browser. All inference must happen on-device.
- **Content Security Policy (CSP)**: Strictly adhere to the manifest's CSP. No `unsafe-eval` (except for WASM if strictly necessary and allowed).
- **Data Storage**: Store user preferences (sensitivity, toggle state) in `chrome.storage.local` or `chrome.storage.sync`. Do not store sensitive user data.

## 5. Git Workflow & Version Control
- **Commits**: Use [Conventional Commits](https://www.conventionalcommits.org/) format.
  - `feat: add new blur filter`
  - `fix: resolve memory leak in worker`
  - `docs: update installation steps`
- **Branching**: Use feature branches (`feature/my-feature`) and PRs to `main`.
- **Versioning**: Follow Semantic Versioning (Major.Minor.Patch) in `package.json` and `manifest.json`.

## 6. Build & Release
- **Clean Builds**: The release package (`.zip`) MUST exclude development files:
  - `node_modules/`
  - `.git/`
  - `.DS_Store`
  - `scripts/`
  - `package.json` / `package-lock.json`
- **Versioning Sync**: Ensure `version` in `manifest.json` matches `package.json` before building.

## 7. Version Update
Once you write the whole code, do proper versioning updates in the `package.json` and `manifest.json`