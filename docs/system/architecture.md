# Architecture

## Runtime Model

A custom app is a SolidJS frontend registered through `wallboard-app-sdk`.

| Environment | Changes at runtime |
|-------------|--------------------|
| Editor | Settings, datasource mocks, selection, and interaction state |
| Displayer | Datasources, commands, and internal state; saved settings are stable until configuration changes |

Many instances can share one page. Each SDK `create()` call receives its own DI child container, state manager, host selector, and SolidJS tree. Keep DOM queries, IDs, timers, observers, subscriptions, caches, and mutable state instance-local.

## Protected And Extension Paths

| Path | Rule |
|------|------|
| `src/index.tsx` | Protected SDK registration/render entry; never edit |
| `src/contexts/system/` | Protected providers |
| `src/hooks/system/` | Protected platform hooks |
| `src/services/service.abstract.ts` | Protected service base |
| `src/styles/_index.scss`, `mixin.scss`, `reset.scss`, `styles.scss` | Protected reset/mixins/global infrastructure |
| `src/styles/animation.css` | App-wide keyframe extension point |
| `src/components/wb-app/` | App root and main UI |
| `src/components/wb-*/` | Optional app components |
| `src/hooks/custom/` | App-specific reactive hooks |
| `src/contexts/custom/` | Optional shared feature state |
| `src/services/*.service.ts` | Optional stateless domain services; register in `src/services.ts` |
| `src/interfaces/`, `src/utils/` | App models and pure helpers |

Do not move or rename protected files. Create only folders justified by the app.

## Initialization And Providers

`src/index.tsx` constructs `Application` with metadata, service classes, render function, and settings mapper. The SDK registers `window.CustomWidget[identity].create()` and `.destroy()`.

Creation flow:

```text
platform create -> child DI container -> metadata/SDK/app services
-> StateManager -> ApplicationProvider -> DIProvider -> InterceptorProvider
-> WbApp
```

The provider order is fixed because DI depends on application state and interception depends on DI services. Destruction tears down SolidJS, state subscriptions, service lifecycle hooks, and the child container.

## Reactive Flow

`properties.json` defines editor fields. `src/settings.ts` maps raw `ConfigValues` to runtime `Settings`.

```text
platform events -> StateManager debounce -> RxJS settings$/dataSources$
-> system hooks convert streams to SolidJS accessors -> components
```

Datasource-related events include `sendConfiguration`, `boundDataChanged`, `sendMockDatasources`, `sendMockDatasourceById`, and `sendDatasource`. Read them through `useDataSources()`; do not subscribe to platform globals directly.

Use:

- `useSettings()` for mapped settings.
- `useDataSources()` for bound values.
- `useConfig()` only for a raw configuration field not represented elsewhere.
- `useExternalCommandListener()` for declared commands.
- `useService()` for registered app services.
- `getMetadata()` for SDK factories such as logging.

Never call `window.CustomWidgetAPI` directly when an SDK hook/service exists.

## Root Component

`WbApp` receives `hostElement`; use it or component refs to scope DOM work.

```tsx
export default (props: { hostElement: HTMLDivElement }): JSX.Element => {
	const settings: Accessor<Settings> = useSettings();

	return (
		<div class={`wb-app ${style['wb-app']}`} data-ready={Boolean(props.hostElement)}>
			{settings().title}
		</div>
	);
};
```

## Build

Vite emits `dist/assets/app.js`; Webpack/Babel emits `app-chrome-49.js`. Editor assets include generated `config.json`, icon, placeholder, and declared sidecars. Bundles are IIFEs to avoid global collisions. Development includes debug logging/source maps; production uses INFO-level logging and no source maps.

Use SDK `createLogger` in components and the service base logger in services. Temporary timing uses `performance.now()`, not `Date.now()`.
