# Components

## Placement

- Keep the app root in `src/components/wb-app/`.
- Add a `wb-*` component folder only when it isolates meaningful UI/behavior or is reused.
- One default component per file with a matching `.module.scss` file.
- Keep pure normalization/calculation helpers in `src/utils/` or a domain module; component-local handlers may stay inside the component.

```text
src/components/
|- wb-app/
|  |- wb-app.tsx
|  `- wb-app.module.scss
`- wb-status-row/
   |- wb-status-row.tsx
   `- wb-status-row.module.scss
```

## SolidJS Component Contract

- Receive props through `props`; do not destructure reactive props at component setup.
- Use `<For>` for reactive lists and `<Show>` or `<Switch>/<Match>` for conditional branches.
- Derived values use `createMemo`; effects perform side effects only.
- Put setup in `onMount` and release timers, observers, listeners, and subscriptions in `onCleanup`.
- Return `JSX.Element`; use refs or `props.hostElement` for scoped DOM work.
- Prefer native `class`, not React's `className`. Use `classList` for conditional state classes.

```tsx
export default (props: { items: Accessor<Item[]> }): JSX.Element => {
	const visibleSIG: Accessor<Item[]> = createMemo((): Item[] => props.items().filter(isVisible));

	return (
		<section class={`wb-list ${style['wb-list']}`}>
			<For each={visibleSIG()}>{(item: Item): JSX.Element => <WbRow item={item} />}</For>
		</section>
	);
};
```

## Organization

Use a predictable order when it helps scanning: refs, contexts/hooks/services, signals, memos/effects/lifecycle, handlers, render. Do not force ordering that makes dependencies harder to follow.

## Common Failures

| Failure | Correct pattern |
|---------|-----------------|
| React `useState`/`useEffect` | SolidJS signals/effects |
| JSX `.map()` on reactive lists | `<For>` |
| Ternary chains for reactive views | `<Show>` or `<Switch>` |
| Prop destructuring | `props.value` inside reactive context |
| Signal read without `()` | Call the accessor |
| Derived signal set inside effect | `createMemo` |
| Multiple helper components in one file | Split meaningful components |
| Unscoped `document.querySelector` | Component ref or `hostElement` |
| Local error boundary around every block | Handle expected errors; rely on root boundary for unexpected failures |

Do not split tiny static markup into components merely to satisfy a pattern; component boundaries should improve behavior, reuse, testing, or readability.
