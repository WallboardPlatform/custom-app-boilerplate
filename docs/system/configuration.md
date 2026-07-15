# Configuration

## App Configuration Flow
1. Raw config from Wallboard editor (`src/editor-assets/properties.json`)
2. `ConfigValues` interface (`src/interfaces/application.interface.ts`)
3. `settings.ts` mapper function transforms to typed `Settings`
4. Components access via `useSettings()` hook (REACTIVE ACCESSOR)

## Root-level Configuration

The `properties.json` file contains these root-level properties:

| Property           | Type      | Description                                                               |
|--------------------|-----------|---------------------------------------------------------------------------|
| `interactive`      | `boolean` | Whether the app supports user interaction in the displayer                |
| `size`             | `object`  | Default dimensions of the widget                                          |
| `properties`       | `array`   | Array of settings definitions (see App Settings section)                  |
| `resourceList`     | `array`   | Runtime files the editor/displayer must cache                             |
| `externalCommands` | `array`   | Commands that can be triggered externally (see External Commands section) |

### Size Configuration

Defines the default widget dimensions:

```json
{
  "size": {
    "width": "512px",
    "height": "512px"
  }
}
```

### Interactive Mode

When `interactive` is set to `true`, the app can receive and respond to user interactions in the displayer mode. This enables touch events, clicks, and other user inputs.

```json
{
  "interactive": true
}
```

### Resource List

Specifies additional files to include in the build output:

```json
{
  "resourceList": [
    "assets/app.js",
    "assets/app-chrome-49.js"
  ]
}
```

Every file emitted under `dist/assets/` must be listed. Static media needs both parts:

1. Import it statically, for example `import mark from './mark.png'`, so Vite anchors the URL to the loaded app script.
2. Add the emitted path, for example `assets/index.png`, to `resourceList` so the displayer caches it.

Do not use `new URL('./mark.png', import.meta.url)` for packaged runtime media. Custom apps execute inside `/displayer`, where a deferred URL evaluation can incorrectly request `/displayer/mark.png`.

Run `npm run validate:package` after every production build. It validates generation/project contracts, legacy CSS, emitted resources, cache-list entries, and editor PNG integrity before accepting the package.

## App Settings

The base project is static-first: `src/editor-assets/` contains only assets referenced by its settings. Popup wizards and the layout editor are opt-in templates under `templates/editor-assets/`; copy only the required template into `src/editor-assets/` and reference its URL from `properties.json`. Package validation rejects unreferenced editor-asset directories so unused minified bundles cannot leak into the ZIP.

The apps settings is defined inside the `properties.json`, under the `properties` key as an array.

### Adding new settings

To add a new setting for the app, create a new object inside the properties array, with these basic properties:
- label - Only for visual, but required nonetheless
- type - Defining the type, required
- property - Required for all non-visual settings
- tooltip - Only for visual for all non-visual settings, not always required, but preferred to have

For every functional setting:

1. Declare it in `src/editor-assets/properties.json`.
2. Add its raw editor shape to `ConfigValues` in `src/interfaces/application.interface.ts`.
3. Add its normalized runtime shape to `Settings` in the same interface file.
4. Map and clamp its default in `src/settings.ts`.
5. Put a representative value in `preview/fixture.ts`.
6. Prove slider behavior with `previewSettingEffects`; also add effect evidence for other controls whose visible result could silently stop working.
7. Add the setting and optional effect ID to `generation-brief.json`, then run `npm run validate:project`.

Keep these representations explicit. Do not generate preview defaults from the mapper: independent values expose mismatches between editor defaults, runtime fallbacks, and test fixtures.

#### Types of settings

| Type in config        | Description                                                                                 | Type in coding        |
|-----------------------|---------------------------------------------------------------------------------------------|-----------------------|
| `text`                | Single-line text input                                                                      | `string`              |
| `textArea`            | Multi-line text input                                                                       | `string`              |
| `number`              | Numeric input                                                                               | `number`              |
| `slider`              | Slider input                                                                                | `number`              |
| `checkbox`            | Boolean checkbox                                                                            | `boolean`             |
| `select`              | Dropdown selection                                                                          | `string`, `boolean`   |
| `color`               | Color picker                                                                                | `string`              |
| `file`                | File picker                                                                                 | `string`              |
| `folder`              | Folder picker                                                                               | `string`              |
| `dataPicker`          | Data source picker                                                                          | `string`              |
| `button`              | Custom settings button                                                                      | `unknown`             |
| `fontFamily`          | Font family selector                                                                        | `string`              |
| `fontSize`            | Font size selector                                                                          | `number`              |
| `fontStyle`           | Font style selector (bold, italic, underline)                                               | `object`              |
| `fontColor`           | Font color picker                                                                           | `string`              |
| `group`               | Property grouping, visual grouping of other properties, no effects for the app working      | -                     |
| `dividerLine`         | Visual separator, visible only inside the editor, no effects for the app working            | -                     |
| `dividerLineWithText` | Visual separator with label, visible only inside the editor, no effects for the app working | -                     |


Type specific properties for each setting:

| Type in config        | default | min | max | step | properties | options | customSettingsUrl | fileType | propertyContainer |
|-----------------------|---------|-----|-----|------|------------|---------|-------------------|----------|-------------------|
| `text`                | yes     | no  | no  | no   | no         | no      | no                | no       | no                |
| `textArea`            | yes     | no  | no  | no   | no         | no      | no                | no       | no                |
| `number`              | yes     | yes | yes | yes  | no         | no      | no                | no       | no                |
| `slider`              | yes     | yes | yes | yes  | no         | no      | no                | no       | no                |
| `checkbox`            | yes     | no  | no  | no   | no         | no      | no                | no       | no                |
| `select`              | yes     | no  | no  | no   | no         | yes     | no                | no       | no                |
| `color`               | yes     | no  | no  | no   | no         | no      | no                | no       | no                |
| `file`                | no      | no  | no  | no   | no         | no      | no                | no       | no                |
| `folder`              | no      | no  | no  | no   | no         | no      | no                | yes      | no                |
| `dataPicker`          | no      | no  | no  | no   | no         | no      | no                | no       | no                |
| `button`              | no      | no  | no  | no   | no         | no      | yes               | no       | no                |
| `fontFamily`          | no      | no  | no  | no   | no         | no      | no                | no       | yes               |
| `fontSize`            | no      | no  | no  | no   | no         | no      | no                | no       | yes               |
| `fontStyle`           | no      | no  | no  | no   | no         | no      | no                | no       | yes               |
| `fontColor`           | no      | no  | no  | no   | no         | no      | no                | no       | yes               |
| `group`               | no      | no  | no  | no   | yes        | no      | no                | no       | no                |
| `dividerLine`         | no      | no  | no  | no   | no         | no      | no                | no       | no                |
| `dividerLineWithText` | no      | no  | no  | no   | no         | no      | no                | no       | no                |

Small description of each property, with examples:

| Type in config      | description                                                                                                                             | example value                                                                          |
|---------------------|-----------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------|
| `label`             | This is for visual only, it has no effect on the apps working, a small brief label hinting at the settings purpose                      | "Background color"                                                                     |
| `type`              | Defining the type of the setting, effecting how it appears and defines the domain of what the value of it can be                        | "color"                                                                                |
| `tooltip`           | This is for visual only, a small brief on hover tooltip                                                                                 | "Sets the cells background color"                                                      |
| `property`          | Defines the customConfig-s key, where the settings value will appear. This is the key that has to be mapped in the `settings.ts`        | tableCellBackgroundColor                                                               |
| `default`           | Defines the default value of the settings field                                                                                         | "#B00B69"                                                                              |
| `min`               | Defines the minimum value of the number related fields, works as a lower limit                                                          | 0                                                                                      |
| `max`               | Defines the maximum value of the number related fields, works as an upper limit                                                         | 100                                                                                    |
| `step`              | Defines the number related settings default step on its interval                                                                        | 1                                                                                      |
| `options`           | Defines the selectable options. Each option is an object that can be defined like this: `{ "label": "Best color", "value": "#B00B69" }` | [{ "label": "Best color", "value": "#B00B69" }, { "label": "White", "value": "#000" }] |
| `properties`        | An array containing other settings definitions.                                                                                         | [{ "label": "Layout Editor In Popup", "type": "dividerLineWithText" }]                 |
| `customSettingsUrl` | Defines the relative path where the popup `.html` is located                                                                            | "/editor-assets/mypopup/index.html"                                                    |
| `fileType`          | Defines the type of the requested file                                                                                                  | "image_folder"                                                                         |
| `propertyContainer` | Groups font-related properties under a common key in customConfig                                                                       | "sampleFont"                                                                           |

### Font Properties

Font-related types (`fontFamily`, `fontSize`, `fontStyle`, `fontColor`) use `propertyContainer` instead of `property`. This groups all font settings under a single object in the customConfig.

```json
{
  "type": "fontFamily",
  "propertyContainer": "sampleFont"
},
{
  "type": "fontSize",
  "propertyContainer": "sampleFont"
},
{
  "type": "fontStyle",
  "propertyContainer": "sampleFont"
},
{
  "type": "fontColor",
  "propertyContainer": "sampleFont"
}
```

This creates a `sampleFont` object in customConfig containing all the font properties.

### Visibility Conditions

Settings and groups can be conditionally shown or hidden based on other settings values using `visibilityConditions`.

Structure:
```json
{
  "visibilityConditions": {
    "conditions": [
      {
        "id": "#1",
        "type": "EQUALS",
        "value": true,
        "dependsOn": "someProperty"
      }
    ],
    "rule": "#1"
  }
}
```

#### Condition Properties

| Property   | Description                                                               |
|------------|---------------------------------------------------------------------------|
| `id`       | Unique identifier for the condition (e.g., "#1") has a hashmark as prefix |
| `type`     | Comparison type: `EQUALS`                                                 |
| `value`    | Value to compare against                                                  |
| `dependsOn`| Property name whose value is being checked                                |

#### Rules

The `rule` property defines how conditions are combined:
- Single condition: `"#1"`
- AND logic: `"#1&&#2"` (both conditions must be true)
- OR logic: `"#1||#2"` (either condition must be true)
- Complex: `"(#1&&#2)||#3"` (parentheses for grouping)

#### Example: Single Condition

Show a group only when a checkbox is enabled:

```json
{
  "label": "Advanced Settings",
  "type": "group",
  "properties": [...],
  "visibilityConditions": {
    "conditions": [
      {
        "id": "#1",
        "type": "EQUALS",
        "value": true,
        "dependsOn": "advancedEnabled"
      }
    ],
    "rule": "#1"
  }
}
```

#### Example: Multiple Conditions

Show a group only when checkbox is false AND select equals "none":

```json
{
  "visibilityConditions": {
    "conditions": [
      {
        "id": "#1",
        "type": "EQUALS",
        "value": false,
        "dependsOn": "btnSample"
      },
      {
        "id": "#2",
        "type": "EQUALS",
        "value": "none",
        "dependsOn": "sampleType"
      }
    ],
    "rule": "#1&&#2"
  }
}
```

## External Commands

External commands allow the widget to receive commands from external sources (e.g., other widgets, automation systems). These are defined in the `externalCommands` array.

### Command Structure

```json
{
  "externalCommands": [
    {
      "command": "command_identifier",
      "label": "Human Readable Label",
      "parameters": [...]
    }
  ]
}
```

| Property     | Type     | Required | Description                                      |
|--------------|----------|----------|--------------------------------------------------|
| `command`    | `string` | yes      | Unique identifier for the command                |
| `label`      | `string` | yes      | Human-readable name shown in the editor          |
| `parameters` | `array`  | no       | Optional array of parameters the command accepts |

### Parameter Structure

```json
{
  "parameter": "parameter_name",
  "label": "Parameter Label",
  "type": "boolean"
}
```

| Property    | Type     | Description                                |
|-------------|----------|--------------------------------------------|
| `parameter` | `string` | Identifier for the parameter               |
| `label`     | `string` | Human-readable label                       |
| `type`      | `string` | Data type: `boolean`, `text`, or `number`  |

### Examples

Command without parameters:
```json
{
  "command": "refresh_data",
  "label": "Refresh Data"
}
```

Command with boolean parameter:
```json
{
  "command": "toggle_visibility",
  "label": "Toggle Visibility",
  "parameters": [
    {
      "parameter": "show",
      "label": "Show Element",
      "type": "boolean"
    }
  ]
}
```

Command with text parameter:
```json
{
  "command": "set_filter",
  "label": "Set Filter",
  "parameters": [
    {
      "parameter": "filter_text",
      "label": "Filter Text",
      "type": "text"
    }
  ]
}
```

Command with number parameter:
```json
{
  "command": "set_page",
  "label": "Set Page Number",
  "parameters": [
    {
      "parameter": "page_number",
      "label": "Page Number",
      "type": "number"
    }
  ]
}
```

To handle external commands in the app, use the `useExternalCommandListener` hook. See the hooks documentation for details.
