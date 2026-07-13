# Contexts

SolidJS contexts provide a way to pass data through the component tree without manually passing props at every level.
In this project, contexts are bridges between the SDK, the DI container, and the component tree.

## CRITICAL: Core Contexts Are Read-Only Infrastructure

The three core context files in `src/contexts/` are **foundational infrastructure** and must NEVER be:
- Modified
- Renamed
- Moved
- Deleted
- Duplicated
- Extended with additional logic

These contexts are tightly coupled with `src/index.tsx` and the SDK's internal architecture.
Any modification will break the application initialization chain.

## Core Contexts Overview

### ApplicationContext (`application.context.tsx`)

**Purpose:** Exposes the SDK's `ApplicationState` to the entire component tree.

**What it provides:**
- RxJS observable streams for config, settings, data sources, and external commands
- Reactive state management bridged from the SDK's StateManager
- The foundation for all reactive hooks (`useSettings`, `useConfig`, `useDataSources`)

**Provider hierarchy position:** Outermost provider (wraps everything)

**Why it exists:** The SDK creates and manages `ApplicationState` internally. This context makes that state accessible to SolidJS components without direct SDK coupling.

**Access via:** `getApplicationState()` hook (internal use only - prefer `useSettings()`, `useConfig()`, `useDataSources()`)

---

### DIContext (`dependency-injection.context.tsx`)

**Purpose:** Exposes the tsyringe `DependencyContainer` to the component tree.

**What it provides:**
- Access to the DI container for resolving services
- Automatic service lifecycle management (`onConstruct`/`onDestruct` calls)
- MetadataProvider resolution

**Provider hierarchy position:** Second level (inside ApplicationProvider)

**Why it exists:** Services are registered and managed through tsyringe DI. This context allows components to resolve services without importing the container directly, maintaining clean dependency injection patterns.

**Access via:** `useService()` hook, `getMetadata()` hook

---

### InterceptorContext (`interceptor.context.tsx`)

**Purpose:** Provides URL/image caching coordination for displayer mode.

**What it provides:**
- Enable/disable interception control
- Cache management (clear, get size)
- Ready state tracking
- Force reprocess capability

**Provider hierarchy position:** Innermost core provider (inside DIProvider, wraps app content)

**Why it exists:** In displayer mode, media URLs need to be cached through the SDK's API service. This context coordinates between the SDK's InterceptorService and the component tree.

**Access via:** `useInterceptor()` hook

**Note:** Only active in displayer environment. In editor mode, it operates in no-op mode.

---

## Provider Hierarchy

The providers must be nested in this exact order (defined in `src/index.tsx`):

```
ApplicationProvider        <- SDK state (config, settings, datasources)
  DIProvider               <- DI container (services, metadata)
    InterceptorProvider    <- URL caching (displayer only)
      [Your Components]
```

This order matters because:
1. ApplicationProvider must be outermost - it provides the app state that DIProvider needs
2. DIProvider must wrap InterceptorProvider - InterceptorProvider needs to resolve SDK services
3. InterceptorProvider wraps your components - it needs to intercept media elements you render

---

## Creating Custom Contexts

When built-in hooks and services do not cover your needs, you can create custom contexts.
Place custom contexts in `src/contexts/custom` with descriptive names: `[feature].context.tsx`

### When to Create a Custom Context

Create a custom context when:
- Multiple unrelated components need shared reactive state
- The state involves complex data fetching with loading/error states
- The state is feature-specific and not suitable for a global store

Do NOT create a custom context when:
- A simple signal or store would suffice
- Only parent-child components need the data (use props)
- A custom hook can handle the logic without context
- You're duplicating what a built-in hook already provides

### Custom Context Pattern

Follow this structure based on the working pattern from the weather widget:

```typescript jsx
// src/contexts/custom/[feature].context.tsx
import { createContext, createSignal, createEffect, onMount, onCleanup } from 'solid-js';
import type { JSX, Context, Accessor } from 'solid-js';

import { getMetadata } from '@hooks/getMetadata';
import { useSettings } from '@hooks/useSettings';

import { createLogger, MetadataProvider } from 'wallboard-app-sdk';
import type { ILoggerService } from 'wallboard-app-sdk';

import { Settings } from '@interfaces/application.interface';

// 1. Define the context value interface
export interface FeatureContextValue {
  data: Accessor<FeatureData | undefined>;
  loading: Accessor<boolean>;
  error: Accessor<Error | null>;
  refetch: () => Promise<void>;
}

// 2. Create the context with undefined default
export const FeatureContext: Context<FeatureContextValue | undefined> = createContext<FeatureContextValue>();

// 3. Create the provider component
export function FeatureProvider(props: { children: JSX.Element }): JSX.Element {
  // Initialize SDK utilities
  const metadata: MetadataProvider = getMetadata();
  const logger: ILoggerService = createLogger(metadata, 'FeatureProvider');
  const settings: Accessor<Settings | undefined> = useSettings();

  // Create reactive state
  const [data, setData] = createSignal<FeatureData | undefined>(undefined);
  const [loading, setLoading] = createSignal<boolean>(false);
  const [error, setError] = createSignal<Error | null>(null);

  // Define data fetching logic
  const fetchData: () => Promise<void> = async (): Promise<void> => {
    const currentSettings: Settings | undefined = settings();

    if (!currentSettings) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Your data fetching logic here
      const result: FeatureData = await someAsyncOperation(currentSettings);
      setData(result);
      logger.info('Data fetched successfully');
    } catch (err) {
      logger.error('Failed to fetch data', err);
      setError(err as Error);
      setData(undefined);
    } finally {
      setLoading(false);
    }
  };

  // Lifecycle hooks
  onMount((): void => {
    logger.debug('FeatureProvider initialized');
  });

  onCleanup((): void => {
    logger.debug('FeatureProvider destroyed');
  });

  // React to settings changes
  createEffect((): void => {
    if (settings()) {
      void fetchData();
    }
  });

  // Build context value
  const value: FeatureContextValue = {
    data,
    loading,
    error,
    refetch: fetchData
  } as AnyData;

  return <>
    <FeatureContext.Provider value={value}>
      {props.children}
    </FeatureContext.Provider>
  </>
}
```

### Creating the Hook for Custom Context

Always create a corresponding hook in `src/hooks/custom` to access your custom context, if it doesn't exist yet, create it:

```typescript
// src/hooks/custom/useFeature.ts
import { useContext } from 'solid-js';

import { FeatureContext, FeatureContextValue } from '@contexts/feature.context';

export function useFeature(): FeatureContextValue {
  const context: FeatureContextValue | undefined = useContext(FeatureContext);

  if (!context) {
    throw new Error('useFeature must be used within FeatureProvider');
  }

  return context;
}
```

### Using Custom Contexts

Custom contexts should be placed inside `WbApp` component, NOT in `index.tsx`:

```typescript jsx
// src/components/wb-app/wb-app.tsx
import { FeatureProvider } from '@contexts/feature.context';

export default (props: { hostElement: HTMLDivElement }): JSX.Element => {
  return (
    <Show when={isAppInitialized()}>
      <FeatureProvider>
        <div class={`wb-app ${style['wb-app']}`}>
          <YourComponents />
        </div>
      </FeatureProvider>
    </Show>
  );
};
```

### Key Principles for Custom Contexts

1. **Naming:** Use `[Feature]Context` for the context and `[Feature]Provider` for the provider
2. **Interface first:** Always define `[Feature]ContextValue` interface
3. **Undefined default:** Create context with `createContext<T>()` (undefined default)
4. **Logger integration:** Use SDK's `createLogger` for consistent logging
5. **Error handling:** Include loading and error state in context value
6. **Hook creation:** Always create a companion hook with error throwing for missing context
7. **Placement:** Add provider in `wb-app.tsx`, not in `index.tsx`
8. **Settings reactivity:** Use `createEffect` to react to settings changes when needed
