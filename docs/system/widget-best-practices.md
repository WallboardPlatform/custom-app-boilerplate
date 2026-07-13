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
| One clipping surface | When the app has a panel, put its background, `border-radius`, and `overflow: hidden` on the same full-size element. Nested rounded backgrounds can expose square corners through sub-pixel differences. |

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

### Data tables and reader boards

| Risk | Required practice |
|------|-------------------|
| Few rows in a tall zone | Use a column layout with a fixed header and `flex: 1 1 auto` body. Let visible rows share available height or paginate; do not leave the table compressed at the top. |
| Wide/low zone | Keep the visual surface full-size, but center a bounded content region when spreading columns across the full width would weaken grouping. Reduce secondary metadata before reducing primary values. |
| Clipped final column | Give every flex child `min-width: 0`. Add edge padding and use intentional column bases; truncate secondary text with ellipsis. |
| Header metadata collision | Make title and metadata independently shrinkable with `min-width: 0`; truncate the secondary item first. |
| Fixed small typography | Use measured container size tiers or a bounded root scale exposed through CSS variables. Do not use browser viewport units as a proxy for widget size. |

For equal-height table rows, use a flex column body and `flex: 1 1 0` on each visible row. Bound the content region using a readable measure or a user-facing scale setting, not a hard-coded canvas width. When the whole composition must scale together, derive one bounded ratio from the observed root and a reference design size; do not calculate unrelated font sizes per element.

The SDK includes a `ResizeObserver` compatibility layer. When flexbox and fixed breakpoints are insufficient, observe the root element, assign a small/wide/tall size class, and drive a limited set of CSS variables from that class. Keep the layout deterministic and avoid continuous resize-driven DOM rebuilding.

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

Normalize variable datasource wrappers once at the application boundary, then render a single typed row shape. Accept documented array or serialized forms defensively, but do not spread ad hoc shape checks through visual components.

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

## Packaged Assets

| Rule | Practice |
|------|----------|
| Resolve from the app bundle | Use static imports for local images and media. Do not use `new URL(..., import.meta.url)` inside components. |
| Cache every emitted asset | Add every file under `dist/assets/` to `properties.json.resourceList`. |
| Validate the package | Run `npm run validate:package`; a successful Vite build alone does not prove that media loads in the displayer. |

`resourceList` and URL resolution solve different problems. Cache-listing an image does not repair a bundle that requests `/displayer/index.png`.

## Visual Validation

1. Put representative settings and datasource values in `preview/fixture.ts`.
2. Set the intended default dimensions in `properties.json`, then run `npm run dev:preview` and inspect the app-default surface.
3. Define named `previewScenarios` for every materially different state: empty, maximum content, odd item count, last page, longest labels, and error fallback as applicable. Use `advanceTimeMs` for rotating states.
4. Run `npm run validate:visual`. It reads the app-default dimensions from `properties.json`, checks full HD, `1536x432` wide/low, landscape, portrait, square, and every named scenario.
5. Inspect every image in `preview/output/`. Automated checks catch runtime and boundary failures, not weak hierarchy or excessive empty space.
6. Iterate until the primary information remains readable and balanced at every required size, then build the zip.

Do not validate only in a convenient card-sized mock. The preview iframe must use the real widget dimensions; scaling the iframe visually is acceptable because it preserves its layout viewport.

Treat clipping as an application layout defect first: inspect flex bases, `min-width`, padding, and content width before blaming the editor viewport. Mark a deliberately off-canvas element with `data-preview-allow-overflow` only when overflow is part of the intended interaction; never use it to suppress clipped visible content.

## Build Checklist

Before returning a zip:

- `src/editor-assets/properties.json` has a unique `name`. Existing-app fixes preserve `version`; incompatible variants use a new version and a separate upload.
- `src/editor-assets/icon.png` and `placeholder.png` are app-specific.
- Unused sample wizard and layout-editor configuration and assets are removed from `properties.json` and `src/editor-assets/`.
- Root background is transparent unless intentionally configured otherwise.
- Layout behaves at small, wide, tall, and default sizes.
- Empty, loading, and invalid-data states render cleanly.
- `npm run validate:visual` passes and every generated screenshot has been inspected.
- All settings are typed and mapped.
- No unscoped global DOM selectors or shared mutable state.
- `npm run lint` passes.
- `npm run validate:package` passes.
- Zip contains `assets/app.js`, `assets/app-chrome-49.js`, and `editor-assets/config.json`.
