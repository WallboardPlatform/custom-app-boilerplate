# Contexts

System providers under `src/contexts/system/` are protected. Their fixed hierarchy is:

```text
ApplicationProvider -> DIProvider -> InterceptorProvider -> WbApp
```

| Provider | Role | Access through |
|----------|------|----------------|
| Application | SDK config/settings/datasource streams | `useSettings`, `useConfig`, `useDataSources` |
| DI | service and metadata resolution/lifecycle | `useService`, `getMetadata` |
| Interceptor | displayer media-cache coordination | `useInterceptor` |

Do not modify, duplicate, extend, or manually mount system providers.

## Custom Contexts

Create `src/contexts/custom/<feature>.context.tsx` only for shared reactive feature state across unrelated descendants. Prefer props for parent-child data, a custom hook for reusable local behavior, and a service for stateless domain logic.

A custom context must:

1. Define a typed value interface.
2. Use an undefined default and a companion `src/hooks/custom/use<Feature>.ts` that throws outside the provider.
3. Own loading/error state when it performs async work.
4. Clean timers, subscriptions, listeners, and observers.
5. Mount inside `WbApp`, never `src/index.tsx`.

```tsx
export interface RotationContextValue {
	page: Accessor<number>;
	next: () => void;
}

export const RotationContext: Context<RotationContextValue | undefined> = createContext();

export const RotationProvider: ParentComponent = (props): JSX.Element => {
	const [page, setPage] = createSignal<number>(0);
	const value: RotationContextValue = { page, next: (): void => setPage((current): number => current + 1) };

	return <RotationContext.Provider value={value}>{props.children}</RotationContext.Provider>;
};
```

Keep pure transformations outside the provider so they can be tested directly.
