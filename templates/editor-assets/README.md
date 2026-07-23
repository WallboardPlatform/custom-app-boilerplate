# Optional Editor Assets

These editor-only modules are opt-in. Copy only the module an app actually uses into `src/editor-assets/`, then reference its entry point from `properties.json`.

| Module | Required configuration |
|---|---|
| `custom-settings-editor` | A `button` property with `customSettingsUrl: "/editor-assets/custom-settings-editor/index.html"`; replace the starter property name and form with the app-specific editor |
| `layout-editor` | A property with `customSettingsUrl: "/editor-assets/layout-editor/index.html"` plus the matching runtime layout implementation |
| `popup-wizard` | `initWizard.url: "/editor-assets/popup-wizard/index.html"` |
| `dblClickWizard` | `dblClickWizard.url: "/editor-assets/dblClickWizard/index.html"` |

Unreferenced editor-asset directories fail package validation. Generated apps and materialized examples do not carry this `templates/` directory.
