# Interfaces

Check existing types before adding another model.

| Concern | Location |
|---------|----------|
| Raw editor values, mapped settings, datasource wrappers | `src/interfaces/application.interface.ts` |
| Domain rows/models shared by components | `src/interfaces/<domain>.interface.ts` |
| Small private implementation shape | Beside the owning utility/service when not reused |

Core roles:

```ts
export interface ConfigValues {
	title?: string;
}

export interface Settings extends Record<string, unknown> {
	title: string;
}

export interface DataSourceValue<T = unknown> {
	id?: string | null;
	value?: T;
}

export type DataSources = Record<string, DataSourceValue>;
```

- `ConfigValues` keys exactly match functional editor properties and represent raw optional values.
- `Settings` is normalized, named for runtime use, and returned by `settings.ts`.
- Add datasource key/picker types only when the app is data-bound; keep every picker consistent with `properties.json`, the contract, fixture, and generation brief.
- Do not alter the generic meaning of `DataSourceValue`/`DataSources`.
- Use descriptive exported PascalCase types; group related domain types in one file and import them with `import type`.
- Avoid duplicate interfaces and broad `any`; normalize unknown external data through type guards.
