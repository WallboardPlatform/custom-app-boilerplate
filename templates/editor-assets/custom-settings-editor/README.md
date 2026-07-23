# Custom Settings Editor Starter

Copy this directory to `src/editor-assets/custom-settings-editor/` only when the app needs a full-screen editor for complex bundled content or layout state.

1. Replace `PROPERTY_NAME` in `editor.js`.
2. Replace the JSON textarea with domain-specific controls.
3. Preserve the request/save message contract.
4. Reference `/editor-assets/custom-settings-editor/index.html` from a `button` property.

Prefer a datasource for shared, frequently updated, or externally managed data. Use this editor for app-owned structured state that does not fit the standard property sidebar.
