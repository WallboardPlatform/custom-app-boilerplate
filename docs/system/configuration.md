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

## Quick Edit

An optional `quickEdit` key marks a control as editable from the platform's Quick Editor, so a content author can change it without opening the designer.

```json
{
	"label": "Title",
	"type": "text",
	"property": "title",
	"default": "Your custom app",
	"quickEdit": { "label": "Title", "order": 10, "defaultEnabled": true }
}
```

`quickEdit: true` is shorthand for an empty declaration. Every field is optional:

| Field | Default | Meaning |
|-------|---------|---------|
| `label` | the control's own `label` | Caption shown in the Quick Editor. Free text, no translation pipeline. |
| `order` | declaration order | Ascending order within the widget. |
| `defaultEnabled` | `false` | Whether the toggle starts on for a **newly placed** tag. Already placed tags are never changed. |

Supported on `text`, `textArea`, `number`, `slider`, `checkbox` and `color`. `select`, `file`, `iconSelect`, `folder` and the `propertyContainer`-based font controls are not supported yet, and `group`, `button` and the dividers never will be — they carry no value. `dataPicker` needs nothing: an app's datasource binding is already re-pointable through the Quick Editor's base data path control.

The declaration only says what **may** be quick-edited. Whether it actually is stays a per-tag decision: the designer renders a `Quick editable` switch under each declared control, exactly like the built-in widgets. A slider appears as a plain number field, without its `min`/`max`/`step`.

Do not confuse this with `quickEditEligible` in `datasource-contract.json`, which is about editing the rows of a generated TABLE datasource.

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
