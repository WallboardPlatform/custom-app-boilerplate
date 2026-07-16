# Services

`src/services/service.abstract.ts` is protected. App services extend it, live under `src/services/*.service.ts`, and must be registered in `src/services.ts`.

## Choose The Smallest Tool

| Need | Use |
|------|-----|
| Pure one-off transform | Utility or component-local helper |
| Reusable stateless domain logic | Service |
| Reusable reactive lifecycle logic | Custom hook |
| Shared reactive descendant state | Custom context |
| Local UI state | Signal/store in component |

Services may read current `this.settings()` and `this.dataSources()` when a method runs, but should not own render-driving signals, DOM nodes, or mutable page state. Keep datasource normalization pure and testable whenever DI adds no value.

```ts
@singleton()
export class AgendaService extends Service {
	constructor() {
		super('AgendaService');
	}

	public normalize(value: unknown): AgendaItem[] {
		return normalizeAgenda(value);
	}

	override onDestruct(): void {
		// Release only resources owned by this service.
	}
}
```

The base provides logger, metadata, settings, datasource accessors, and lifecycle methods. Override `onConstruct`/`onDestruct` only when needed and always release owned subscriptions/connections. Resolve services in components through `useService()`; do not access the DI container directly.

Avoid services for DOM manipulation, SDK event subscriptions handled by hooks, or state that must trigger rendering.
