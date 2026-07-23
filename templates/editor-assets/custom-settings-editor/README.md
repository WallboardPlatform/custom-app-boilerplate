# Custom Settings Editor Starter

Copy this directory to `src/editor-assets/custom-settings-editor/` only when the app needs a full-screen editor for complex bundled content or layout state.

1. Replace `PROPERTY_NAME` in `editor.js`.
2. Replace the sample `heading` and `sections` model with domain controls owned by the app.
3. Keep `normalizeValue()` defensive because existing uploads may contain old or malformed state.
4. Preserve the request/save message contract and the complete received `configValues` object.
5. Reference `/editor-assets/custom-settings-editor/index.html` from a `button` property.

Prefer a datasource for shared, frequently updated, or externally managed data. Use this editor for app-owned structured state that does not fit the standard property sidebar.

Run `npm run custom-editor:preview` to inspect the starter in a simulated Wallboard host. The harness is development-only and is not packaged into generated apps.
