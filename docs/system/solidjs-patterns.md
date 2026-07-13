# SolidJS Patterns

SolidJS uses fine-grained reactivity, which is fundamentally different from React's virtual DOM diffing.
Understanding this difference is critical - React patterns will break SolidJS performance and could cause unexpected behavior or infinite loops.

## CRITICAL: This Is NOT React

SolidJS components run **once**. Signals and memos update **only the specific DOM nodes** that depend on them.
React patterns like "re-render the component when state changes" do not apply here.

**Key differences:**
- Components are `setup` functions, not render functions
- Signals track dependencies automatically - no dependency arrays needed
- Accessing a signal (calling it) inside a reactive context creates a subscription
- createEffect is for side effects, NOT for derived state

---

## Naming Conventions

### Signals and Reactive Values
Use `...SIG` suffix for signals and reactive accessors to make reactivity visible:

```typescript
const [tickSIG, setTickSIG] = createSignal<number>(0);
const [isLoadingSIG, setIsLoadingSIG] = createSignal<boolean>(false);

const settingsSIG: Accessor<Settings> = useSettings();
const dataSourcesSIG: Accessor<DataSources> = useDataSources();
```

### Memos (Computed Values)
Use `...SIG` suffix for memos as they are also reactive accessors:

```typescript
const processedDataSIG: Accessor<Data[]> = createMemo((): Data[] => {
  return rawDataSIG().filter((item: Data): boolean => item.active);
});

const isVisibleSIG: Accessor<boolean> = createMemo((): boolean => {
  return settingsSIG().Navigation.enabled && dataLoadedSIG();
});
```

### Stores
Use `...Store` suffix for SolidJS stores:

```typescript
const [stateStore, setStateStore] = createStore<AppState>({ items: [], loading: false });
const [formStore, setFormStore] = createStore<FormData>({ name: '', email: '' });
```

---

## createMemo vs createEffect

This is the **most common mistake**. Use the wrong one and you get infinite loops or broken reactivity.

### createMemo - For Derived/Computed Values

Use `createMemo` when you need a **value derived from other reactive values**:

```typescript jsx
// CORRECT - derived value
const cellHeightSIG: Accessor<string> = createMemo((): string => {
  const height: number = containerHeightSIG();
  const rowCount: number = pageContentSIG().length;
  const gap: number = settingsSIG().Table.gap.vertical;

  if (height > 0 && rowCount > 0) {
    const totalGap: number = gap * (rowCount - 1);
    return `${(height - totalGap) / rowCount}px`;
  }

  return '100%';
});

// CORRECT - filtered/transformed data
const visiblePagesSIG: Accessor<number[]> = createMemo((): number[] => {
  const current: number | undefined = currentPageSIG();
  const total: number | undefined = pageCountSIG();

  if (current === undefined || total === undefined) {
    return [];
  }

  return calculateVisiblePages(current, total);
});
```

### createEffect - For Side Effects Only

Use `createEffect` when you need to **perform an action** in response to reactive changes:

```typescript
// CORRECT - side effect: calling a service method
createEffect((): void => {
  if (settingsSIG()) {
    pageManager.loadContents();
  }
});

// CORRECT - side effect: API call
createEffect((): void => {
  const folder: string | undefined = settingsSIG()?.Image?.folder?.folder;

  if (folder) {
    void apiMethods.getFilesFromFolder(folder)
      .then((files: string[]): void => {
        utils.lookupFolder(files);
        setFolderPreloadedSIG(true);
      });
  }
});

// CORRECT - side effect: DOM manipulation outside SolidJS
createEffect((): void => {
  if (containerRef) {
    containerRef.scrollTop = 0;
  }
});
```

### WRONG Patterns

```typescript
// WRONG - using createEffect for derived state
createEffect((): void => {
  const filtered = dataSIG().filter(item => item.active);
  setFilteredDataSIG(filtered);  // Creates extra signal, causes re-runs
});

// CORRECT - use createMemo instead
const filteredDataSIG: Accessor<Data[]> = createMemo((): Data[] => {
  return dataSIG().filter((item: Data): boolean => item.active);
});

// WRONG - computing value in effect then storing it
createEffect((): void => {
  const height = containerSIG() / rowsSIG();
  setCellHeightSIG(height);  // Unnecessary indirection
});

// CORRECT - compute directly in memo
const cellHeightSIG: Accessor<number> = createMemo((): number => {
  return containerSIG() / rowsSIG();
});
```

---

## Explicit Dependency Tracking with on()

Use `on()` wrapper to make dependencies explicit and control when effects run.
This is useful when you want to react to specific signals while reading others without tracking them.

### Single Dependency

```typescript
import { createEffect, on } from 'solid-js';

// Only react to datasource changes - pass the accessor directly
createEffect(on(
  dataSourcesSIG,
  (dataSources: DataSources, prevDataSources: DataSources): void => {
    pageManager.loadContents();
  },
  { defer: true }
));
```

**Note:** When you need to track a nested property, wrap it in an arrow function:

```typescript
// Track specific nested property
createEffect(on(
  (): unknown => dataSourcesSIG()?.myDataset?.value,
  (value: unknown, prevValue: unknown): void => {
    if (value) {
      processData(value);
    }
  },
  { defer: true }
));
```

### Multiple Dependencies (Array Syntax)

When you need to react to multiple specific signals:

```typescript
import { createEffect, on } from 'solid-js';

// React to both settings AND datasources changes
createEffect(on(
  [settingsSIG, dataSourcesSIG],
  ([settings, dataSources]: [Settings, DataSources], [prevSettings, prevDataSources]: [Settings, DataSources]): void => {
    // Runs when EITHER dependency changes
    // Both current and previous values are provided as arrays
    pageManager.loadContents();
  },
  { defer: true }
));
```

### The defer Option

**`defer: true`:**
- Effect does NOT run on initial mount
- Only runs when dependencies **change** after mount
- Use when initial setup is handled elsewhere

**`defer: false` (default):**
- Effect runs immediately with initial values
- Use when this effect IS your initialization logic

---

## Ignoring Dependencies with untrack()

Use `untrack()` to read reactive values **without** creating a dependency.
The effect will NOT re-run when untracked values change.

```typescript
import { createEffect, untrack } from 'solid-js';

createEffect((): void => {
  // This WILL trigger re-runs when dataSourcesSIG changes
  const data: DataSources = dataSourcesSIG();

  // This will NOT trigger re-runs when settingsSIG changes
  const settings: Settings = untrack((): Settings => settingsSIG());

  // Process data using settings, but only re-run when data changes
  processData(data, settings);
});
```

### Common Use Cases for untrack()

**Reading configuration without tracking:**
```typescript
createEffect((): void => {
  const items: Item[] = itemsSIG();  // Track this

  // Don't re-run effect when these change - just use current values
  const pageSize: number = untrack((): number => settingsSIG().pageSize);
  const sortOrder: string = untrack((): string => settingsSIG().sortOrder);

  displayItems(items, pageSize, sortOrder);
});
```

**Initial values that won't update:**
```typescript
export default function Component(props: { initialValue: number }): JSX.Element {
  // Props with "initial" or "default" prefix are typically meant to be read once
  const startValue: number = untrack((): number => props.initialValue);
  const [valueSIG, setValueSIG] = createSignal<number>(startValue);

  // ...
}
```

### on() vs untrack() - When to Use Which

| Scenario                                    | Use                             |
|---------------------------------------------|---------------------------------|
| React to specific signals only              | `on([dep1, dep2], ...)`         |
| Read a value without tracking inside effect | `untrack(() => signal())`       |
| Skip initial run, only react to changes     | `on(dep, ..., { defer: true })` |
| Complex effect with mixed tracking needs    | Combine both                    |

**Combined example:**
```typescript
// Only react to dataSourcesSIG changes, read settings without tracking
createEffect(on(
  dataSourcesSIG,
  (data: DataSources): void => {
    // Read settings but don't track - won't re-run when settings change
    const format: string = untrack((): string => settingsSIG().dateFormat);
    formatAndDisplay(data, format);
  },
  { defer: true }
));
```

---

## Lifecycle Hooks

### onMount - One-Time Setup

Use for setup that should happen **once** when the component mounts:

```typescript
onMount((): void => {
  // DOM is ready, refs are available
  if (containerRef) {
    setContainerWidthSIG(containerRef.clientWidth);

    const resizeObserver = new ResizeObserver((entries: ResizeObserverEntry[]): void => {
      for (const entry of entries) {
        setContainerWidthSIG(entry.contentRect.width);
      }
    });

    resizeObserver.observe(containerRef);
    subscriptions.push(resizeObserver);
  }
});
```

### onCleanup - Resource Cleanup

**Always** clean up subscriptions, timers, observers, and event listeners:

```typescript
const subscriptions: (ResizeObserver | Subscription | (() => void))[] = [];

onMount((): void => {
  // Setup...
  subscriptions.push(resizeObserver);
  subscriptions.push(eventSubscription);
});

onCleanup((): void => {
  subscriptions.forEach((sub): void => {
    if ('disconnect' in sub) {
      sub.disconnect();  // ResizeObserver
    } else if ('unsubscribe' in sub) {
      sub.unsubscribe();  // RxJS Subscription
    } else {
      sub();  // Cleanup function
    }
  });
});
```

### When to Use createEffect Instead of onMount

If initialization depends on reactive values that might not be ready at mount:

```typescript
// If settings might be undefined at mount, use createEffect
createEffect(on(
  (): Settings | undefined => settingsSIG(),
  (settings: Settings | undefined): void => {
    if (settings) {
      initializeWithSettings(settings);
    }
  },
  { defer: false }  // Run immediately when settings become available
));
```

---

## Conditional Rendering

### Show - For Boolean Conditions

```typescript jsx
<Show
  when={isLoadingSIG()}
  fallback={<DataContent data={dataSIG()} />}
>
  <LoadingSpinner />
</Show>

<Show when={settingsSIG()?.Navigation.enableNavigation}>
  <WbNavigation />
</Show>
```

### Switch/Match - For Multiple Conditions

```typescript jsx
<Switch fallback={<DefaultView />}>
  <Match when={stateSIG() === STATE.loading}>
    <LoadingComponent />
  </Match>
  <Match when={stateSIG() === STATE.error}>
    <ErrorComponent error={errorSIG()} />
  </Match>
  <Match when={stateSIG() === STATE.ready}>
    <ReadyComponent data={dataSIG()} />
  </Match>
</Switch>
```

### NEVER Use Ternary Operators for JSX

```typescript jsx
// WRONG - breaks fine-grained reactivity
{isLoadingSIG() ? <Loading /> : <Content />}

// CORRECT
<Show when={isLoadingSIG()} fallback={<Content />}>
  <Loading />
</Show>
```

---

## List Rendering with For

Use `<For>` for reactive list rendering. It tracks by reference and only updates changed items:

```typescript jsx
<For each={itemsSIG()}>
  {(item: Item, index: Accessor<number>): JSX.Element => (
    <div data-index={index()}>
      <ItemComponent item={item} />
    </div>
  )}
</For>
```

### Nested For Loops

```typescript jsx
<For each={rowsSIG()}>
  {(row: unknown[], rowIndex: Accessor<number>): JSX.Element => (
    <div class="row" data-row={rowIndex()}>
      <For each={row}>
        {(cell: unknown): JSX.Element => (
          <CellComponent data={cell} />
        )}
      </For>
    </div>
  )}
</For>
```

---

## Async Data with createResource

For async operations that depend on reactive values:

```typescript jsx
const [tableData, { refetch }] = createResource(
  (): { settings: Settings; datasources: DataSources } => ({
    settings: settingsSIG(),
    datasources: datasourcesSIG()
  }),
  async (source): Promise<TableData> => {
    const response = await fetchTableData(source.settings, source.datasources);
    return response;
  },
  { initialValue: undefined }
);

// Use in JSX
<Show when={!tableData.loading} fallback={<Loading />}>
  <Table data={tableData()} />
</Show>
```

---

## RxJS Integration with from()

Convert RxJS Observables to SolidJS accessors using `from()`:

```typescript jsx
import { from } from 'solid-js';

// In component
const pageContentSIG: Accessor<unknown[] | undefined> = from(pageManager.pageContent$);
const currentPageSIG: Accessor<number | undefined> = from(pageManager.currentPage$);
const searchValueSIG: Accessor<string | undefined> = from(filters.searchValue$);

// Now use like any other signal
<Show when={pageContentSIG()?.length > 0}>
  <Content data={pageContentSIG()} />
</Show>
```

**NOTE:** When proposing solutions, always prioritize hooks, contexts, or stores (see the documentation).
Avoid using RxJS Observables unless absolutely necessary.
If you believe RxJS is the best option, always ask for confirmation before using it.

---

## Props and Reactivity

### Accessing Props Reactively

Props in SolidJS are reactive. Access them in reactive contexts to maintain reactivity:

```typescript jsx
export default function MyComponent(props: { data: Accessor<Data[]> }): JSX.Element {
  // CORRECT - access in memo maintains reactivity
  const processedSIG: Accessor<ProcessedData[]> = createMemo((): ProcessedData[] => {
    return props.data().map(transform);
  });

  // CORRECT - access in JSX maintains reactivity
  return (
    <For each={props.data()}>
      {(item: Data): JSX.Element => <Item data={item} />}
    </For>
  );
}
```

### Destructuring Props - Be Careful

```typescript jsx
// WRONG - loses reactivity
export default function MyComponent(props: { count: Accessor<number> }): JSX.Element {
  const { count } = props;  // Destructured once at setup, never updates
  return <div>{count()}</div>;
}

// CORRECT - access props directly
export default function MyComponent(props: { count: Accessor<number> }): JSX.Element {
  return <div>{props.count()}</div>;
}
```

---

## Common Anti-Patterns

### DO NOT: Wrap Signals Unnecessarily

```typescript jsx
// WRONG
{() => signalSIG()}

// CORRECT
{signalSIG()}
```

### DO NOT: Create Objects/Arrays in Render

```typescript jsx
// WRONG - creates new object every access, breaks referential equality
<Component style={{ color: colorSIG() }} />

// CORRECT - use style prop directly or memoize
const styleSIG = createMemo(() => ({ color: colorSIG() }));
<Component style={styleSIG()} />

// BEST SOLUTION: use SolidJS style object syntax
<div style={{ color: colorSIG() }} />  // This is fine-grained in native elements
```

### DO NOT: Use React Hooks

```typescript
// WRONG - React patterns
const [state, setState] = useState(0);
useEffect(() => { /*...*/ }, [dep]);

// CORRECT - SolidJS primitives
const [stateSIG, setStateSIG] = createSignal(0);
createEffect(() => { /*...*/ });  // Dependencies tracked automatically
```

### DO NOT: Create Interfaces Inside Components

```typescript
// WRONG
export default function Component(): JSX.Element {
  interface ItemData {  // Don't define here
    id: string;
    name: string;
  }
  // ...
}

// CORRECT - move to interfaces file
// src/interfaces/item.interface.ts
export interface ItemData {
  id: string;
  name: string;
}
```

### DO NOT: Multiple Components in One File

```typescript
// WRONG - one file with multiple components
// components/my-component.tsx
function HelperComponent() { /*...*/ }
function AnotherHelper() { /*...*/ }
export default function MyComponent() { /*...*/ }

// CORRECT - each component in its own file
// components/helper/helper.tsx
// components/another-helper/another-helper.tsx
// components/my-component/my-component.tsx
```

---

## Summary Checklist

| Need | Use | NOT |
|------|-----|-----|
| Derived/computed value | `createMemo` | `createEffect` + `setSignal` |
| Side effect (API, DOM, service call) | `createEffect` | `createMemo` |
| One-time DOM setup | `onMount` | `createEffect` without deps |
| Cleanup resources | `onCleanup` | Nothing (memory leak!) |
| Boolean conditional render | `<Show>` | Ternary `? :` |
| Multi-case conditional | `<Switch>/<Match>` | Multiple ternaries |
| List rendering | `<For>` | `.map()` |
| RxJS Observable to accessor | `from()` | Manual subscription |
| Async data fetch | `createResource` | `createEffect` + `setSignal` |
| Explicit dependency tracking | `on(dep, ...)` or `on([deps], ...)` | Relying on auto-tracking |
| Read without tracking | `untrack(() => signal())` | Always tracking everything |
| Skip initial effect run | `on(dep, ..., { defer: true })` | Manual flags |
