# Stores

Prefer local signals, memos, and custom hooks. Use a SolidJS store only for structured reactive state with partial updates that is shared within one widget instance.

```ts
const [stateStore, setStateStore] = createStore<RotationState>({ page: 0, paused: false });

setStateStore('page', (page: number): number => page + 1);
```

- Keep the store inside a component/hook/context unless immutable module scope is proven safe across multiple instances.
- Name by domain, not implementation (`rotationStore`, not `globalStore`).
- Use `unwrap(store)` only when a non-reactive snapshot is required by an external API; normal reads should remain reactive.
- Put pure transitions/calculations in utilities and release resources outside the store through lifecycle owners.
