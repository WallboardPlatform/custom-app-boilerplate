# SolidJS Patterns

SolidJS components execute once; reactive accessors update dependent DOM. Do not transplant React render-cycle patterns.

## Primitive Choice

| Need | Use | Avoid |
|------|-----|-------|
| Local value | `createSignal` | React `useState` |
| Derived value | `createMemo` | effect that sets another signal |
| Side effect | `createEffect` | memo with side effects |
| Explicit dependencies | `on(dep, callback, options)` | manual dependency flags |
| Read without tracking | `untrack(() => value())` | accidental subscriptions |
| One-time DOM setup | `onMount` | mount flags in effects |
| Cleanup | `onCleanup` | orphan timers/listeners |
| Boolean branch | `<Show>` | React-style `&&`/ternary for changing views |
| Multi-state branch | `<Switch>/<Match>` | nested ternaries |
| Reactive list | `<For>` | JSX `.map()` |

```tsx
const validItemsSIG: Accessor<Item[]> = createMemo((): Item[] => {
	return dataSIG().filter(isValidItem);
});

createEffect(on(dataSIG, (): void => {
	restartRotation();
}, { defer: true }));
```

Use `defer: true` when initialization is handled elsewhere and only later changes matter. Use `untrack` when an effect should react to one accessor while reading another's current value.

## Lifecycle

Create `ResizeObserver`, interval, listener, or RxJS subscription per instance and release it:

```ts
let observer: ResizeObserver | undefined;

onMount((): void => {
	observer = new ResizeObserver(handleResize);
	observer.observe(rootRef);
});

onCleanup((): void => {
	observer?.disconnect();
});
```

Use `performance.now()` for elapsed animation time. Datasource updates should not reset timers/animations unless the changed data invalidates the active state.

## Props And Rendering

- Access reactive props through `props.value`; setup-time destructuring can lose tracking.
- Call accessors (`valueSIG()`), including inside memos and JSX.
- Use `class`, `classList`, and SolidJS event handlers.
- Avoid creating new arrays/objects repeatedly in reactive JSX when a memo provides stable identity.
- Use `createResource` for reactive asynchronous fetches only when the app itself owns that fetch; normal Wallboard datasource values arrive through `useDataSources()`.
- Convert an existing RxJS stream with SolidJS `from()` only when no system hook already exposes it.

## Anti-Patterns

- React hooks, `className`, dependency arrays, and component re-render assumptions.
- Unbounded effects that read and write the same reactive state.
- Multiple significant components in one file.
- Interfaces declared inside components.
- Module-level mutable state shared by widget instances.
- Async/timer/observer work without cleanup.

Prefer pure utilities for normalization and formatting; SolidJS primitives should coordinate rendering, not hide domain logic.
