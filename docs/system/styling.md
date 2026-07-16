# Styling

`src/styles/_index.scss`, `mixin.scss`, `reset.scss`, and `styles.scss` are protected reset/global infrastructure. Component styles use colocated CSS modules; `src/styles/animation.css` is available when an app needs global keyframes.

## Component Pattern

```scss
.app-root {
	@include reset-styles();
	display: flex;
	width: 100%;
	height: 100%;
	min-width: 0;
	min-height: 0;
}

.app-root,
.app-root * {
	@include box-sizing();
}
```

```tsx
<section class={style['app-root']} data-preview-id="customer-queue-root">
```

CSS module classes isolate app styles. Use app-owned `data-preview-id` attributes for stable preview/evidence selectors.

## Editor Style Isolation

Custom apps render inside the editor's shared document, not a shadow root. Host selectors can therefore match deliberately global app classes.

- Prefer CSS module classes for all styling.
- If a global class is necessary, prefix it with a unique app slug: `wb-restaurant-menu-category`, not `menu-category`, `card`, `title`, `content`, or `wb-app`.
- Prefix global keyframes and custom properties with the same app slug.
- Keep `:global(...)` inside the owning module and target only that app namespace.
- `reset-styles()` uses `all: initial`; explicitly restore a formatting context such as `display: block` or `display: flex` on every reset root.
- Add a behavior test that injects hostile rules for the generic class names the app might otherwise use and verifies every required page/state remains unchanged.

See `examples/restaurant-menu` for the namespace and hostile-host regression pattern.

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
