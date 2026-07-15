# Hooks

Hooks in this project provide reactive data access and lifecycle management for SolidJS components.
They bridge the gap between SDK services, contexts, and component logic.

## CRITICAL: Core Hooks Are Read-Only Infrastructure

The built-in hook files in `src/hooks/` are **foundational infrastructure** and must NEVER be:
- Modified
- Renamed
- Moved
- Deleted
- Duplicated

These hooks are tightly coupled with the core contexts and SDK architecture.
Any modification will break the reactive data flow throughout the application.

## When to Use Hooks

Use hooks when:
- Multiple components need the same reactive data source
- You need local reactive state without context overhead
- Logic cannot be placed in a service (services must not contain `createSignal`, `createStore`, or other SolidJS reactive primitives)
- You need automatic lifecycle cleanup (subscriptions, timers, listeners)

---

## Core Hooks Overview

### getApplicationState

**Purpose:** Returns the core `ApplicationState` from `ApplicationContext`.

**What it provides:**
- Direct access to RxJS observable streams (`config$`, `settings$`, `dataSources$`, `externalCommand$`)
- The `createExternalCommandListener` method
- The foundation for all other reactive hooks

**Why it exists:** Acts as the internal bridge between ApplicationContext and the reactive hooks. 
Other hooks (`useSettings`, `useConfig`, `useDataSources`) are built on top of this.

**Access via:** Direct import from `@hooks/getApplicationState`

**Usage:** Internal use only. If you think you need this hook directly, ask first - 
you probably need `useSettings()`, `useConfig()`, or `useDataSources()` instead.

---

### getMetadata

**Purpose:** Returns the `MetadataProvider` instance from the DI container.

**What it provides:**
- Application metadata (name, version, license, build info)
- Required parameter for SDK factory functions and components

**Why it exists:** Many SDK utilities require a `MetadataProvider` instance. This hook resolves it from the DI container 
so components do not need direct container access.

**Access via:** Direct import from `@hooks/getMetadata`

**When to use:**
- Creating loggers with `createLogger(metadata, 'ComponentName')`
- Passing to SDK components like `WbOverlay`, `WbErrorBoundary`
- Using SDK service factories

```typescript jsx
import { getMetadata } from '@hooks/getMetadata';
import { createLogger, MetadataProvider, WbOverlay } from 'wallboard-app-sdk';
import type { ILoggerService } from 'wallboard-app-sdk';

export default (): JSX.Element => {
  const metadata: MetadataProvider = getMetadata();
  const logger: ILoggerService = createLogger(metadata, 'MyComponent');

  return <>
    <WbOverlay metadata={metadata}>
      <p>Loading...</p>
    </WbOverlay>
  </>;
};
```

---

### useSettings

**Purpose:** Returns a reactive accessor for the mapped settings object.

**What it provides:**
- Reactive `Accessor<Settings>` that updates when settings change
- Settings transformed from raw config via `settings.ts` mapper

**Why it exists:** Components need reactive access to user-configured settings. This hook converts the SDK's RxJS observable to a SolidJS accessor.

**Access via:** Direct import from `@hooks/useSettings`

**IMPORTANT:** This is the primary hook for accessing any setting property. Always use this instead of `useConfig()` for settings access.

```typescript jsx
import { useSettings } from '@hooks/useSettings';
import type { Accessor } from 'solid-js';
import type { Settings } from '@interfaces/application.interface';

export default (): JSX.Element => {
  const settings: Accessor<Settings> = useSettings();

  return <>
    <div class={settings().theme}>
      <p>Language: {settings().language}</p>
      <p>Font size: {settings().fontSize}px</p>
    </div>
  </>;
};
```

---

### useConfig

**Purpose:** Returns a reactive accessor for the complete raw configuration object.

**What it provides:**
- Reactive `Accessor<Config>` with the unprocessed configuration
- Contains `configValues`, `dataPickerValues`, and `datasourceIds`

**Why it exists:** Provides access to the raw configuration before mapping. Useful for debugging or when you need unmapped values.

**Access via:** Direct import from `@hooks/useConfig`

**Note:** Prefer `useSettings()` for accessing settings. Use `useConfig()` only when you specifically need raw, unmapped configuration data.
Always ask first if you want to use this hook - might be better hooks to use.

```typescript jsx
import { useConfig } from '@hooks/useConfig';
import type { Accessor } from 'solid-js';
import type { Config } from '@interfaces/application.interface';

export default (): JSX.Element => {
  const config: Accessor<Config> = useConfig();

  createEffect((): void => {
    console.debug('Raw config values:', config().configValues);
    console.debug('Data picker values:', config().dataPickerValues);
  });

  return <></>;
};
```

---

### useAutoFitText

**Purpose:** Fits bounded, variable single-line text to the largest whole-pixel font size inside an explicit range.

Use it for titles or hero values whose content is user- or datasource-controlled. Keep normal responsive CSS as the maximum-size authority; the hook reads the current computed font size, observes the element through `ResizeObserver`, and re-fits when the optional watched accessor changes.

```typescript jsx
const settings: Accessor<Settings> = useSettings();
const fitTitle = useAutoFitText({
  minFontSize: 18,
  maxFontSize: 38,
  widthOnly: true,
  watch: (): string => settings().title
});

return <h1 ref={fitTitle}>{settings().title}</h1>;
```

Do not apply it indiscriminately to every label. Flex layout, truncation, pagination, and responsive breakpoints remain the primary tools. A fitted element with `overflow: hidden` still needs safe `line-height` and vertical padding because DOM box dimensions do not guarantee glyph-ink clearance.

---

### useDataSources

**Purpose:** Returns a reactive accessor for all registered data sources.

**What it provides:**
- Reactive `Accessor<Record<string, DataSourceState>>` containing all data sources
- Each data source has `id` (string or null) and `value` (the actual data)

**Why it exists:** Data sources are external data bound to the widget (tables, lists, metrics). This hook provides reactive access to all bound data.

**Access via:** Direct import from `@hooks/useDataSources`

**Data source structure:**
```typescript
interface DataSourceState {
  id: string | null;  // Datasource ID (only in displayer mode)
  value: unknown;     // The actual data
}
```

```typescript jsx
import { useDataSources } from '@hooks/useDataSources';
import type { Accessor } from 'solid-js';
import type { DataSourceState } from 'wallboard-app-sdk';

export default (): JSX.Element => {
  const dataSources: Accessor<Record<string, DataSourceState>> = useDataSources();

  return <>
    <For each={Object.entries(dataSources())}>
      {([key, source]: [string, DataSourceState]): JSX.Element => (
        <div>
          <span>{key}: {source.id}</span>
          <pre>{JSON.stringify(source.value, null, 2)}</pre>
        </div>
      )}
    </For>
  </>;
};
```

---

### useService

**Purpose:** Resolves a service instance from the DI container.

**What it provides:**
- Type-safe service instance resolution
- Access to singleton services registered in `src/services.ts`

**Why it exists:** Services are managed through tsyringe DI. 
This hook provides a clean way to access services in components without direct container manipulation.

**Access via:** Direct import from `@hooks/useService`

**Prerequisite:** The service must be registered in `src/services.ts` before use.

```typescript jsx
import { useService } from '@hooks/useService';
import { DataService } from '@services/data.service';

export default (): JSX.Element => {
  const dataService: DataService = useService<DataService>(DataService);

  const handleFetch: () => void = (): void => {
    dataService.fetchData().subscribe({
      next: (data: unknown): void => {
        console.debug('Data received:', data);
      }
    });
  };

  return <>
    <button onClick={handleFetch}>Fetch Data</button>
  </>;
};
```

---

### useInterceptor

**Purpose:** Provides access to the URL/image interception system.

**What it provides:**
- `enabled`: Accessor for current interception state
- `setEnabled`: Toggle interception on/off
- `clearCache`: Clear all cached URLs
- `getCacheSize`: Get current cache entry count
- `isReady`: Check if interceptor is initialized
- `reprocessAll`: Force reprocess all elements

**Why it exists:** In displayer mode, media URLs need caching coordination. This hook exposes InterceptorContext controls to components.

**Access via:** Direct import from `@hooks/useInterceptor`

**Note:** Only active in displayer mode. In editor mode, operates as no-op. Rarely needed directly - ask before using.

```typescript jsx
import { useInterceptor } from '@hooks/useInterceptor';
import type { InterceptorContextInterface } from '@contexts/interceptor.context';

export default (): JSX.Element => {
  const { enabled, setEnabled, clearCache, getCacheSize }: InterceptorContextInterface = useInterceptor();

  return <>
    <div>
      <p>Cache size: {getCacheSize()}</p>
      <button onClick={(): void => setEnabled(!enabled())}>
        {enabled() ? 'Disable' : 'Enable'} Interceptor
      </button>
      <button onClick={clearCache}>Clear Cache</button>
    </div>
  </>;
};
```

---

### useExternalCommandListener

**Purpose:** Listens for external commands from the Wallboard platform.

**What it provides:**
- Callback-based command listening
- Automatic cleanup on component unmount
- Access to command name and parameters

**Why it exists:** External commands allow the Wallboard platform to send instructions to widgets (e.g., "go to page 3", "refresh data").
This hook subscribes to these commands with proper lifecycle management.

**Access via:** Direct import from `@hooks/useExternalCommandListener`

**Command interface:**
```typescript
interface IExternalCommandService {
  getCommand(): string;
  getParameter(name: string): string | number | boolean | undefined;
  getParameters(): ExternalCommandParameters[];
}
```

```typescript jsx
import { useExternalCommandListener } from '@hooks/useExternalCommandListener';
import type { IExternalCommandService } from 'wallboard-app-sdk';

export default (): JSX.Element => {
  const [currentPage, setCurrentPage] = createSignal<number>(0);

  useExternalCommandListener((message: IExternalCommandService): void => {
    const cmd: string = message.getCommand();

    if (cmd === 'setPageTo') {
      const page: unknown = message.getParameter('value');
      if (typeof page === 'number') {
        setCurrentPage(page - 1);
      }
    } else if (cmd === 'nextPage') {
      setCurrentPage((prev: number): number => prev + 1);
    } else if (cmd === 'previousPage') {
      setCurrentPage((prev: number): number => Math.max(0, prev - 1));
    }
  });

  return <>
    <p>Current page: {currentPage()}</p>
  </>;
};
```

---

## Creating Custom Hooks

When built-in hooks do not cover your needs, create custom hooks in `src/hooks/custom/`.

### Directory Structure

```
src/hooks/
  getApplicationState.ts         # Built-in (DO NOT MODIFY)
  getMetadata.ts                 # Built-in (DO NOT MODIFY)
  useConfig.ts                   # Built-in (DO NOT MODIFY)
  useDataSources.ts              # Built-in (DO NOT MODIFY)
  useExternalCommandListener.ts  # Built-in (DO NOT MODIFY)
  useInterceptor.ts              # Built-in (DO NOT MODIFY)
  useService.ts                  # Built-in (DO NOT MODIFY)
  useSettings.ts                 # Built-in (DO NOT MODIFY)
  custom/                        # Custom hooks folder
    useCustomLogic.ts
    useFeatureState.ts
```

### When to Create a Custom Hook

Create a custom hook when:
- Multiple components need identical reactive logic
- You need to combine multiple built-in hooks with additional logic
- Complex calculations or transformations need memoization
- Subscription/listener setup needs reuse with automatic cleanup

Do NOT create a custom hook when:
- The logic is used in only one component (keep it in the component)
- A service can handle the logic (use service instead)
- You're just wrapping a single built-in hook without adding value

### Custom Hook Pattern

```typescript jsx
// src/hooks/custom/useCustomLogic.ts
import { createSignal, createEffect, onCleanup } from 'solid-js';
import type { Accessor } from 'solid-js';

import { useSettings } from '@hooks/useSettings';
import { useService } from '@hooks/useService';
import { MyService } from '@services/my.service';
import type { Settings } from '@interfaces/application.interface';

interface UseCustomLogicReturn {
  value: Accessor<string>;
  isLoading: Accessor<boolean>;
  refresh: () => void;
}

export function useCustomLogic(): UseCustomLogicReturn {
  const settings: Accessor<Settings> = useSettings();
  const myService: MyService = useService<MyService>(MyService);

  const [value, setValue] = createSignal<string>('');
  const [isLoading, setIsLoading] = createSignal<boolean>(false);

  createEffect((): void => {
    const currentSettings: Settings = settings();
    setValue(currentSettings.someProperty);
  });

  onCleanup((): void => {
    // Cleanup subscriptions, timers, etc.
  });

  const refresh: () => void = (): void => {
    setIsLoading(true);
    myService.fetchData().subscribe({
      next: (data: string): void => {
        setValue(data);
        setIsLoading(false);
      },
      error: (): void => {
        setIsLoading(false);
      }
    });
  };

  return {
    value,
    isLoading,
    refresh
  } as UseCustomLogicReturn;
}
```

### Key Principles for Custom Hooks

1. **Naming:** Always prefix with `use` (e.g., `useCustomLogic`, `useFeatureState`)
2. **Return type:** Define an interface for the return value
3. **Cleanup:** Use `onCleanup` for subscriptions, timers, and listeners
4. **Composition:** Build on top of built-in hooks when possible
5. **Type safety:** Use explicit TypeScript types for all parameters and returns
6. **Location:** Place in `src/hooks/custom/` folder, if it doesn't exist yet, create it
