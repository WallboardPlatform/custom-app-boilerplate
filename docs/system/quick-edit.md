# Quick Edit

Quick Edit lets a content author change a placed custom app from the platform Quick Editor without opening the designer. Three parties take part:

| Who | Where | Does |
|-----|-------|------|
| App author | `properties.json` | Declares with `quickEdit` which controls **may** be overridden |
| Content author | Designer, closing `Quick Edit Settings` section | Switches each declared control on or off per placed tag |
| Quick Editor user | Quick Editor | Sets or clears the override; the displayer applies it |

The declaration is metadata: it adds no setting, needs no version bump and no backend change, and platform versions without Quick Edit support ignore the key. Declare controls a content author legitimately changes per placement (headline, colors, media, datasource); keep layout and behavior settings out of the Quick Editor.

## Declaration

```json
{
	"label": "Title",
	"type": "text",
	"property": "title",
	"default": "Your custom app",
	"quickEdit": { "label": "Title text", "order": 10, "defaultEnabled": true }
}
```

`"quickEdit": true` is shorthand for `{}`. Every field is optional.

| Field | Default | Meaning |
|-------|---------|---------|
| `label` | control `label`, then `property` | Caption of the designer switch and the Quick Editor field. Plain text, not translated. |
| `order` | index in the flattened `properties` list | Ascending sort of switches and fields. Give every declared control an explicit value or none of them; a shorthand control keeps its index and sorts before an explicit `10`. |
| `defaultEnabled` | `false` | Switch starts on for a newly placed tag only. Already placed tags keep their state. |
| `styleContainer` | none | `propertyContainer` name of the font controls styling this text. Adds a second field `<label> style` directly after it for color, size, bold, italic, and underline. Font family, line height, and alignment stay as authored. |

## Supported Controls

| `type` | Quick Editor field | Override value the app receives |
|--------|--------------------|---------------------------------|
| `text`, `textArea` | text input | string |
| `number` | number box; `min`/`max`/`step` are not carried | number, unbounded |
| `slider` | track with the declared `min`/`max`/`step`; `0`/`100`/`1` when absent | number within the bounds |
| `checkbox` | switch | boolean |
| `color` | color picker | string |
| `file` | thumbnail and picker filtered by `fileType` | absolute file URL, cached by the displayer like the app's own pick |
| `folder` | folder picker; `fileType` is not filtered yet | folder id string |
| `dataPicker` | datasource select | new rows through `useDataSources()`; the picker becomes an independent binding |

Declarations elsewhere are ignored silently: `select`, `iconSelect`, `button`, `group`, dividers, the four font controls (reachable only through `styleContainer`), and a `file` with `allowMultipleSelect: true`. A `dataPicker` field appears only once the content author has bound the picker; its switch is available before that.

## Placement And Sections

- Declare on root-level controls or on controls inside a first-level `group`. Deeper nesting is not scanned.
- The group `label` becomes the Quick Editor section; ungrouped controls share an unnamed section.
- A switch is hidden together with its control (`isHidden`, `visibilityConditions`).
- Declarations are re-read from the live app config every time the designer opens the content: a replacement upload that adds a declaration reaches existing tags; a removed declaration drops its switch, and the next designer save discards its stored override.

## Runtime

The override is written into the tag's `configValues` (a `dataPicker` override repoints the binding instead) and pushed to the running app as a configuration message, the same message the designer sends while editing. Nothing reloads. The app must therefore:

- Read values through `useSettings()` and `useDataSources()` inside reactive scope; never copy them into local state at mount.
- Keep normalizing and clamping in `src/settings.ts`. Text, number, and color arrive exactly as stored.
- Treat a `file` or `folder` override like the app's own pick: same value shape, same media caching rules.
- Add a `previewSettingEffects` entry for every quick-editable visual control. The preview's `pushConfiguration` uses the same message path as a Quick Edit override.

## Complete Example

```json
{
	"label": "Content",
	"type": "group",
	"properties": [
		{ "label": "Headline", "type": "text", "property": "headline", "default": "Welcome",
			"quickEdit": { "order": 10, "defaultEnabled": true, "styleContainer": "headlineFont" } },
		{ "type": "fontFamily", "propertyContainer": "headlineFont" },
		{ "type": "fontSize", "propertyContainer": "headlineFont" },
		{ "type": "fontColor", "propertyContainer": "headlineFont" },
		{ "label": "Body", "type": "textArea", "property": "body", "quickEdit": { "order": 20 } },
		{ "label": "Rotation seconds", "type": "slider", "property": "rotationSeconds", "default": 10, "min": 5, "max": 60, "step": 5, "quickEdit": { "order": 30 } },
		{ "label": "Show footer", "type": "checkbox", "property": "showFooter", "default": true, "quickEdit": { "order": 40 } },
		{ "label": "Logo", "type": "file", "property": "logo", "fileType": "image", "quickEdit": { "order": 50 } },
		{ "label": "Gallery", "type": "folder", "property": "gallery", "fileType": "image_folder", "quickEdit": { "order": 60 } },
		{ "label": "Rows", "type": "dataPicker", "property": "rows", "quickEdit": { "label": "Data source", "order": 70 } }
	]
}
```

Quick Editor result: one section `Content` with `Headline`, `Headline style`, `Body`, `Rotation seconds`, `Show footer`, `Logo`, `Gallery`, and `Data source`, in that order.

Not the same feature: `quickEditEligible` in `datasource-contract.json` marks a generated TABLE datasource whose rows are editable; see `datasource-contracts.md`.
