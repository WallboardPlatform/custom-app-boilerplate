# Architecture

This document provides an in-depth architectural overview of Custom App development.
Understanding this architecture is essential for generating correct, maintainable code that integrates properly with the Wallboard platform.

---

## CRITICAL: Do Not Modify the Architecture

**The folder structure and file organization is fixed and must not be changed.**

Every folder and file has its designated place. When creating new code:
- **Do NOT create new folders** outside the established structure
- **Do NOT move or rename existing files**
- **Do NOT create files in arbitrary locations**

**Where to find placement rules:**
- Creating a **hook** → See `hooks.md` for exact location and pattern
- Creating a **service** → See `services.md` for exact location and pattern
- Creating a **context** → See `contexts.md` for exact location and pattern
- Creating a **component** → See `components.md` for exact location and pattern
- Creating an **interface** → See `interfaces.md` for exact location and pattern
- Adding **styles** → See `styling.md` for exact location and pattern
- Adding **settings** → See `configuration.md` for exact location and pattern

Each documentation file specifies:
- The exact folder where new files should be created
- The naming convention to follow
- The pattern/template to use
- What is read-only infrastructure vs. what can be customized

**Read-only infrastructure files (NEVER modify):**
- `src/index.tsx`
- `vite-env.d.ts`
- `src/contexts/application.context.tsx`
- `src/contexts/dependency-injection.context.tsx`
- `src/contexts/interceptor.context.tsx`
- `src/services/service.abstract.ts`
- All files in `src/hooks/` (except custom hooks in `src/hooks/custom/`)

---

## System Overview

Custom apps are frontend web applications that run inside the Wallboard platform.
They operate in two distinct environments:
- **Editor** - Content editing mode where all settings can be modified
- **Displayer** - Presentation mode where only internal state changes (data sources, selections, external commands)

The architecture consists of two main parts:
1. **wallboard-app-sdk** - Core library providing platform integration, services, and reactive state management
2. **Custom App (boilerplate)** - Your application built on top of the SDK

```
Wallboard Platform
       |
       v
+------------------+
| CustomWidgetAPI  |  <-- Platform bridge (window.CustomWidgetAPI)
+------------------+
       |
       v
+------------------+
| wallboard-app-sdk|  <-- SDK layer (Application, StateManager, Services)
+------------------+
       |
       v
+------------------+
| Custom App       |  <-- Your application (components, hooks, services)
+------------------+
```

---

## Initialization Flow

Understanding the initialization sequence is critical for knowing when certain APIs are available.

### 1. Platform Registration

When the app loads, `index.tsx` creates an `Application` instance:

```typescript
new Application({
    name: configJson.name,
    version: configJson.version,
    license: configJson.license,
    mode: import.meta.env.MODE,
    services: serviceClasses,
    render: application,
    settingsMapper: mapSettings
});
```

This registers `window.CustomWidget[appName].create()` and `.destroy()` methods that the platform calls.

### 2. Instance Creation

When Wallboard platform needs to display your widget:

```
Platform calls: window.CustomWidget['AppName_1.0.0'].create(selector, config, event$)
                                    |
                                    v
                    +----------------------------------+
                    | Application.create()             |
                    | - Creates child DI container     |
                    | - Registers core services        |
                    | - Registers app services         |
                    | - Creates StateManager           |
                    | - Calls render function          |
                    +----------------------------------+
```

### 3. Service Registration Order

Services are registered in this specific order (order matters for dependencies):

1. **MetadataProvider** - Singleton holding app metadata (id, name, version, license, build mode)
2. **EventInjectable** - Platform event observable (`event$`) for configuration changes
3. **SDKService** - Initializes polyfills, license validation, creates logger
4. **App Services** - Your custom services from `services.ts`

## Reactive Data Flow

Data flows through the system via RxJS observables converted to SolidJS accessors.

### Configuration Flow

```
properties.json (editor schema)
       |
       v
Platform Event: 'sendConfiguration'
       |
       v
StateManager.handleConfigurationChange()
       |
       v
Debounce (100ms)
       |
       v
settingsSubject.next() / dataSourcesSubject.next()
       |
       v
Observable streams (settings$, dataSources$)
       |
       v
SolidJS from() conversion in hooks
       |
       v
Accessor<Settings> / Accessor<DataSources>
       |
       v
Components via useSettings() / useDataSources()
```

### Data Source Flow

Data sources are external data bound to the widget. They come from multiple platform events:

| Event                    | Description                        |
|--------------------------|------------------------------------|
| `sendConfiguration`      | Data picker and config values      |
| `boundDataChanged`       | Single datasource update           |
| `sendMockDatasources`    | All mock datasources (editor mode) |
| `sendMockDatasourceById` | Single mock datasource             |
| `sendDatasource`         | Internal datasource update         |

All events go through debouncing before updating `dataSourcesSubject`.

---

## Platform Communication

### window.CustomWidgetAPI

The platform exposes the communication methods via `window.CustomWidgetAPI`.

**IMPORTANT** - Never use the objects methods directly. Use the SDK methods instead, to achieve the desired result.

### External Commands

Commands from Wallboard platform (e.g., "go to page 3") come through `externalCommand$`:

```typescript
useExternalCommandListener((command: IExternalCommandService): void => {
    const cmd: string = command.getCommand();
    const value: unknown = command.getParameter('value');

    if (cmd === 'setPageTo') {
        setCurrentPage(value as number);
    }
});
```

Commands are defined in `properties.json` under `externalCommands`.

---

### WbApp - The Root Component

`WbApp` is the entry point for your UI. It receives `hostElement` as a prop:

```typescript jsx
export default (props: { hostElement: HTMLDivElement }): JSX.Element => {
    const settings: Accessor<Settings> = useSettings();
    const dataSources: Accessor<DataSources> = useDataSources();

    return (
        <div class={`wb-app ${style['wb-app']}`}>
            {/* Your app content */}
        </div>
    );
};
```

**Never modify `index.tsx`** - it handles the SDK integration. Customize through `WbApp`.

---

## Build Output

### Development vs Production

| Aspect       | Development           | Production        |
|--------------|-----------------------|-------------------|
| Logging      | DEBUG level, colorful | INFO level, plain |
| Source maps  | Yes                   | No                |
| Minification | Yes                   | Yes (Terser)      |

### Output Files

```
dist/
  assets/
    app.js -> Main bundle (IIFE format, ES6 target with ESNext module)
    app-chrome-49.js -> Legacy bundle (IIFE format, Webpacked with babel for Chrome 49 from app.js)
  editor-assets/
    icon.png
    placeholder.png
    properties.json
```

### IIFE Format

The build outputs IIFE (Immediately Invoked Function Expression) to avoid global scope pollution:

```javascript
(function() {
    // Your app code, isolated
})();
```

---

## Lifecycle Summary

### Instance Lifecycle

```
Platform calls create() -> DI container created -> Services registered
         |
         v
StateManager initialized -> settings$, dataSources$ ready
         |
         v
render() called -> Providers mounted -> WbApp renders
         |
         v
[App running - reacts to settings/datasource/command changes]
         |
         v
Platform calls destroy() -> StateManager.destroy() -> subscriptions cleaned
         |
         v
SDKService.terminate() -> container cleared -> instance removed
```

### Service Lifecycle

```
registerAppServices() -> Service constructor runs
         |
         v
DIProvider.onMount() -> service.onConstruct() called
         |
         v
[Service available via useService()]
         |
         v
DIProvider.onCleanup() -> service.onDestruct() called
```

### Logging
If you want to log/warn/error something inside a component, create a logger from the `wallboard-app-sdk` with this pattern:
```typescript
const logger: ILoggerService = createLogger(metadata, 'ComponentName');
logger.info('Message', data);
```

If you want to log/warn/error something inside a service, use the `Service` parent class's logger.