# Configuration

## Synchronization Contract

Every functional editor setting must agree across:

```text
properties.json -> ConfigValues -> Settings -> settings.ts
-> preview/fixture.ts -> generation-brief.json
```

Keep preview defaults independent from the mapper so mismatches are detectable. Every slider and other regression-prone visual control needs `previewSettingEffects` evidence against the rendered element.

## Root Properties

| Property | Meaning |
|----------|---------|
| `name`, `version` | Runtime identity; version is an integer string/number |
| `interactive` | Enables touch/click interaction in displayer |
| `size` | Default/primary pixel surface, e.g. `{"width":"1280px","height":"720px"}` |
| `properties` | Editor controls/groups |
| `resourceList` | Every runtime file the displayer caches |
| `externalCommands` | Optional command definitions |

Every emitted `dist/assets/*` file must appear in `resourceList`. Import local media statically so its URL resolves from the app bundle; do not use `new URL(..., import.meta.url)` in components. Cache listing and correct URL resolution are separate requirements.

Editor wizards and layout editors are opt-in under `templates/editor-assets/`. Copy only a referenced template into `src/editor-assets/`; package validation rejects unused editor bundles.

## Setting Types

| Type | Runtime shape | Key fields |
|------|---------------|------------|
| `text`, `textArea` | string | `property`, `default` |
| `number`, `slider` | number | `property`, `default`, `min`, `max`, `step` |
| `checkbox` | boolean | `property`, `default` |
| `select` | selected value | `property`, `default`, `options[{label,value}]` |
| `color` | string | `property`, `default` |
| `file`, `folder` | platform selection | `property`; `file` uses a base `fileType` such as `video` or `pdf`; `folder` requires the matching `_folder` suffix such as `video_folder` or `pdf_folder` or the legacy editor will not render a picker |
| `dataPicker` | datasource binding | `property` |
| `button` | custom action | `property`, `customSettingsUrl` |
| `fontFamily`, `fontSize`, `fontStyle`, `fontColor` | grouped font object | `propertyContainer` |
| `group` | visual nesting | `properties` |
| `dividerLine`, `dividerLineWithText` | visual only | label as applicable |

Functional controls require `label`, `type`, and `property` (font controls use `propertyContainer`). Add concise tooltips only where the decision is unclear.

## Custom Settings Editors

Use a `button` with `customSettingsUrl` when structured app-owned content or layout cannot be edited safely in the property sidebar:

```json
{
	"label": "Edit content",
	"property": "contentEditor",
	"type": "button",
	"customSettingsUrl": "/editor-assets/custom-settings-editor/index.html"
}
```

The editor page runs inside Wallboard and communicates with its parent window:

| Direction | `messageType` | Payload |
|---|---|---|
| Editor -> Wallboard | `customWidget_requestCustomProperties` | none |
| Wallboard -> editor | n/a | current configuration, including `configValues` |
| Editor -> Wallboard | `customWidget_saveCustomProperty` | `customPropertyValue: {configValues}` |

Preserve the complete received `configValues` object when saving; update only the property owned by the custom editor. Accept messages only from `window.parent`. The Wallboard host origin varies, so outgoing messages use `"*"`.

Use `templates/editor-assets/custom-settings-editor/` as the small starter. The existing layout editor is for apps that actually need its layout-builder model, not a default dependency.

**Ownership rule:** datasource for shared/dynamic/external data; custom editor for complex bundled state manually owned by this app; normal properties for simple settings.

## Mapping

Normalize and clamp values in `src/settings.ts`; components consume only mapped `Settings`.

```ts
const numberSetting = (value: unknown, fallback: number, min: number, max: number): number => {
	const numeric: number = typeof value === 'number' && Number.isFinite(value) ? value : fallback;

	return Math.min(max, Math.max(min, numeric));
};
```

For a static app, `Config` may contain only `configValues`. Data-bound examples add typed datasource keys/values as required; follow `datasource-contracts.md`.

## Theme Presets

Color-driven apps normally expose `themePreset: dark | light | custom` and resolve a full semantic palette in `settings.ts` with `src/utils/theme.ts`.

- New placements use the editor's intended preset default.
- Replacement apps map missing/unknown preset values to `custom`, preserving existing explicit colors.
- Curated presets replace every background, surface, text, divider, track, and status color.
- Keep manual swatches in the same first-level group as `themePreset`. Apply the `custom` visibility condition to every color control. Do not create a nested `Custom colors` group: the legacy editor may show its label without rendering its children.

## Visibility Conditions

Controls can depend on other values. Keep groups first-level; nested property groups are not reliably supported by the legacy editor.

```json
{
	"label": "Background",
	"type": "color",
	"property": "backgroundColor",
	"visibilityConditions": {
		"conditions": [
			{ "id": "#1", "type": "EQUALS", "value": "custom", "dependsOn": "themePreset" }
		],
		"rule": "#1"
	}
}
```

Combine IDs with `&&`, `||`, and parentheses, e.g. `(#1&&#2)||#3`. IDs are unique and begin with `#`; currently documented comparison type is `EQUALS`.

## External Commands

Declare commands in `externalCommands`, then handle them with `useExternalCommandListener()`:

```json
{
	"command": "set_page",
	"label": "Set page",
	"parameters": [
		{ "parameter": "page", "label": "Page", "type": "number" }
	]
}
```

Parameter types are `boolean`, `text`, or `number`. Keep command state instance-local and validate parameter values before use.
