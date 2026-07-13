# Widget Best Practices

Use this before designing or editing a Wallboard custom app. These rules are about production widget behavior, not repository setup.

## Rendering Contract

| Rule | Practice |
|------|----------|
| Fill the assigned area | Root component uses `width: 100%`, `height: 100%`, `min-width: 0`, `min-height: 0`, and `overflow: hidden`. |
| Default transparent | Keep the widget background transparent unless the app needs its own panel. If a panel is useful, expose background and opacity settings. |
| No fixed canvas assumptions | Do not design only for `1920x1080`, `16:9`, or the default size in `properties.json`. Widgets can be tiny, wide, tall, square, or fullscreen. |
| Stable layout | Hover states, changing text, loading states, and empty states must not resize the root layout unexpectedly. |
| Contained overflow | Text, images, lists, and tables must wrap, truncate, scroll, paginate, or scale intentionally. Never let content spill outside the widget. |

Root style baseline:

```scss
.wb-app {
  @include reset-styles();
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: transparent;
}
```

## Responsiveness

| Situation | Required behavior |
|-----------|-------------------|
| Small widget | Prioritize the main value/message, hide secondary decoration, reduce spacing. |
| Wide widget | Use horizontal layout only when content remains readable; otherwise keep a centered compact composition. |
| Tall widget | Stack sections and preserve visual hierarchy. |
| Unknown aspect ratio | Use percentages, flexbox, `min-width: 0`, `min-height: 0`, and media queries. |
| Text-heavy content | Use explicit line limits, wrapping, truncation, or paging. |

Avoid viewport-based sizing for widget internals. Size relative to the widget container, not the browser window.

## Legacy CSS Safety

CSS is not transpiled. Keep styles compatible with the legacy Chromium target required by the boilerplate.

| Avoid | Prefer |
|-------|--------|
| CSS grid | Flexbox |
| `gap` in flex layouts | Margins on children |
| `aspect-ratio` | Percentage wrappers or calculated dimensions in code |
| `clamp()`, `min()`, `max()` | Media queries and explicit breakpoints |
| Container queries | Root classes based on measured dimensions |
| `backdrop-filter` | Solid or semi-transparent backgrounds |
| `color-mix()` | Precomputed colors or settings |
| Modern viewport units (`dvh`, `svh`, `lvh`) | `%`, `px`, or classic `vh` only when unavoidable |

If unsure about CSS support, use the simpler option.

## Visual Design

| Rule | Practice |
|------|----------|
| Canvas-friendly | The widget should look good on top of user-designed content. Avoid heavy default panels unless requested. |
| Settings-driven theme | Expose primary color, text color, background, and key visibility toggles when relevant. |
| Clear hierarchy | One primary message/value, then secondary metadata. |
| No boilerplate visuals | Replace default icon, placeholder, sample wizard text, and sample content before packaging. |
| No decorative excess | Avoid UI that looks like a landing page. Signage widgets must be readable and purposeful. |

## Settings

Create settings that map to real user decisions. Do not expose every CSS property.

Good settings:
- Content text, labels, and values.
- Colors and optional background/panel visibility.
- Duration, speed, page size, or rotation mode when the app animates or paginates.
- Data source picker and field mapping when the app uses external data.
- Empty-state message when missing data is expected.

Bad settings:
- Internal implementation switches.
- Dozens of spacing controls.
- Raw JSON unless the app is explicitly technical.
- Settings that do not change visible behavior.

Every property in `src/editor-assets/properties.json` must be mapped in `src/settings.ts` and typed in `src/interfaces/application.interface.ts`.

## Data And Empty States

| Case | Required behavior |
|------|-------------------|
| No datasource selected | Render a clear configured fallback or empty state. |
| Datasource returns no rows | Show an empty state, not a broken layout. |
| Missing field | Use a fallback label/value and keep rendering. |
| Invalid media URL | Hide media or show a configured fallback. |
| API error | Keep the last good state when possible, otherwise show a quiet error state. |
| Loading | Use a stable placeholder that does not resize the widget. |

Do not let a missing datasource produce a blank widget unless blank is the explicit user requirement.

## Multi-Instance Safety

Multiple instances of the same custom app can run on one page.

Required:
- Scope DOM queries to `props.hostElement` or component refs.
- Generate instance-local IDs when IDs are needed.
- Store timers, intervals, observers, and subscriptions per instance.
- Clean up timers, listeners, observers, and subscriptions on destroy.
- Avoid module-level mutable state unless it is immutable configuration.

Avoid:
- Global element IDs such as `id="root-panel"`.
- `document.querySelector()` without scoping.
- Shared counters, caches, or selected state across instances.
- Unbounded polling or animation loops.

## Editor vs Displayer

| Mode | Behavior |
|------|----------|
| Editor | Helpful fallbacks are allowed. Show missing configuration clearly. Keep controls predictable. |
| Displayer | Output should be stable, quiet, and production-looking. Avoid debug text and noisy errors. |

Never rely on editor-only behavior for the displayer. Test the display output as a standalone widget surface through the build output or emulator only when debugging is necessary.

## Performance

Signage devices may be low-powered and long-running.

Do:
- Keep dependencies small.
- Prefer CSS transforms and opacity for animations.
- Debounce frequent updates.
- Cap rendered list sizes or paginate.
- Reuse computed values with SolidJS memos when needed.
- Clean up resources on destroy.

Avoid:
- Large DOM trees for data tables.
- Frequent polling without user-configurable interval.
- Layout-heavy animation of width, height, top, or left.
- Large base64 assets inside source files.
- Console debug logs in production output.

## Build Checklist

Before returning a zip:

- `src/editor-assets/properties.json` has unique `name` and correct `version`.
- `src/editor-assets/icon.png` and `placeholder.png` are app-specific.
- Root background is transparent unless intentionally configured otherwise.
- Layout behaves at small, wide, tall, and default sizes.
- Empty, loading, and invalid-data states render cleanly.
- All settings are typed and mapped.
- No unscoped global DOM selectors or shared mutable state.
- `npm run lint` passes.
- `DISABLE_MINIO_UPLOAD=true SIMPLE_OUTPUT=true npm run build:production:zip` passes.
- Zip contains `assets/app.js`, `assets/app-chrome-49.js`, and `editor-assets/config.json`.
