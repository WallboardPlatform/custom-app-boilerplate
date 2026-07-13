# Interfaces

Interfaces define the shape of data structures used throughout the application.
The main interface file is `src/interfaces/application.interface.ts` which contains core type definitions.

**IMPORTANT: Always check existing interfaces before creating new ones.
Extend or modify existing interfaces when possible instead of duplicating definitions.**
DO NOT TOUCH existing core interfaces structure-wise:
- Config
- DataSourceValue
- DataSources
- DatasourceKey
- DataPickerValues
Only add new property fields to them if needed by the following:

## File Organization

### Where to Put Interfaces

| Interface Type                 | Location                         | Example                        |
|--------------------------------|----------------------------------|--------------------------------|
| Settings-related               | `application.interface.ts`       | `Settings`, `FontSettings`     |
| Config-related                 | `application.interface.ts`       | `Config`, `ConfigValues`       |
| DataSource-related             | `application.interface.ts`       | `DataSourceKey`, `DataSources` |
| Component-specific data models | Separate file by concern         | `table.interface.ts`           |
| Service response types         | Same file as service or separate | `api-response.interface.ts`    |

### Directory Structure

```
src/interfaces/
  application.interface.ts    # Core app interfaces (ALWAYS check this first)
  table.interface.ts          # Example: Table-specific interfaces
  chart.interface.ts          # Example: Chart-specific interfaces
```

## Core Interfaces in application.interface.ts

### Config

The raw configuration object received from the Wallboard platform. This is the unprocessed data.

```typescript
export interface Config {
  configValues: ConfigValues;
  dataPickerValues: DataPickerValues;
  datasourceIds: Record<DataSourceKey, string | number | undefined>;
}
```

### ConfigValues

Raw configuration values from the editor panel. Property names match the editor field IDs.

```typescript
export interface ConfigValues {
  wbKeyboardEnabled: boolean;
  txtField?: string;
  sampleSlider: number;
  // Add properties matching your properties.json field IDs (each objects "property" field)
}
```

**When to modify:** When you add new fields to `editor-assets/properties.json`, add corresponding properties here with the exact field ID as the property.

### Settings

The transformed, developer-friendly settings object. Accessed via `useSettings()` hook.

```typescript
export interface Settings {
  keyboardEnabled?: boolean;
  text?: string;
  slider?: number;
  font?: {
    family: string;
    size: number;
    style: string;
    weight: string;
    color: string;
    decoration: string;
  };
  // Add your cleaned-up, well-named properties here
}
```

**When to modify:** When you need new settings in your components. Always use clear, descriptive property names.

**IMPORTANT:** The mapping between `ConfigValues` and `Settings` happens in `src/settings.ts`.
When you add properties to both interfaces, you MUST also update the mapper function.

### DataSourceKey

Defines available data source identifiers. This is a union type of string literals.

```typescript
export type DataSourceKey = 'myDataset' | 'secondDataset';
```

**When to modify:** When you add or remove data sources in `editor-assets/properties.json`.

### DataPickerValues

Values for each data source, keyed by `DataSourceKey`.

```typescript
export interface DataPickerValues {
  myDataset?: unknown;
  secondDataset?: unknown;
}
```

**When to modify:** When you change `DataSourceKey`, update this interface to match.

### DataSourceValue

Generic wrapper for data source values with optional ID.

```typescript
export interface DataSourceValue<T = unknown> {
  id?: string | null;
  value?: T;
}
```

**When to modify:** NEVER. This is a generic type used by the SDK.

## Creating Separate Interface Files

Create a separate interface file when:
- The interface is complex with many nested types
- Multiple components use the same data structure
- The interface is not related to settings/config

### Example: table.interface.ts

```typescript
// src/interfaces/table.interface.ts

export interface Table {
  header: TableHeader[];
  rows: TableRow[];
}

export interface TableHeader {
  label: string;
  width?: string;
  sortable?: boolean;
}

export interface TableRow {
  id: string;
  cells: TableCell[];
  selected?: boolean;
}

export interface TableCell {
  value: string | number;
  formatted?: string;
  style?: TableCellStyle;
}

export interface TableCellStyle {
  backgroundColor?: string;
  textColor?: string;
  textAlign?: 'left' | 'center' | 'right';
}
```

### Importing from separate files

```typescript
import type { Table, TableRow } from '@interfaces/table.interface';
```

## Best Practices

1. **Descriptive names**: Use clear names like `TableHeaderSettings` instead of `THS`
2. **Export everything**: Always export interfaces that might be used elsewhere
3. **Group related types**: Keep related interfaces in the same file
