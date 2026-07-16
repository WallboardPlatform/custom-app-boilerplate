# Styling

`src/styles/_index.scss`, `mixin.scss`, `reset.scss`, and `styles.scss` are protected reset/global infrastructure. Component styles use colocated CSS modules; `src/styles/animation.css` is available when an app needs global keyframes.

## Component Pattern

```scss
.wb-panel {
	@include reset-styles();
	width: 100%;
	height: 100%;
	min-width: 0;
	min-height: 0;
}

:global(.wb-panel),
:global(.wb-panel) * {
	@include box-sizing();
}
```

```tsx
<section class={`wb-panel ${style['wb-panel']}`} classList={{ 'is-empty': isEmptySIG() }}>
```

The plain `wb-*` class supports preview/evidence selectors; the module class isolates styles. Use `:global(.wb-panel ...)` only inside the owning module.

## Dynamic Values

Put static declarations in SCSS. Pass settings and measured values through CSS custom properties on the root:

```tsx
const rootStyleSIG: Accessor<JSX.CSSProperties> = createMemo(() => ({
	'--app-accent': settings().accentColor,
	'--app-scale': String(layoutSIG().scale)
}));
```

Prefix variables by app/domain. Inline styles are acceptable for CSS variables and truly frame-by-frame values; avoid repeated static inline objects.

## Layout And Legacy Safety

- Use flexbox, margins, percentages, explicit breakpoints, and measured root classes.
- Avoid flex `gap`, CSS grid, `aspect-ratio`, `clamp/min/max`, container queries, `backdrop-filter`, `color-mix`, and modern viewport units.
- Every flex child containing variable text needs `min-width: 0`; vertical flex regions often need `min-height: 0`.
- Root and intentional panel clipping use one full-size element. Do not hide layout defects with deeper overflow layers.
- Put global app keyframes in `src/styles/animation.css`; reference them from component modules. Prefer transform/opacity animation and local transitions.

Run `npm run validate:legacy` after style changes. See `widget-best-practices.md` for surface, typography, and visual validation rules.
