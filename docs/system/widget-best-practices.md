# Widget Best Practices

Use this before designing or editing a Wallboard custom app. These rules are about production widget behavior, not repository setup.

## Rendering Contract

| Rule | Practice |
|------|----------|
| Fill the assigned area | Root component uses `width: 100%`, `height: 100%`, `min-width: 0`, `min-height: 0`, and `overflow: hidden`. |
| Default transparent | Keep the widget background transparent unless the app needs its own panel. If a panel is useful, expose background and opacity settings. |
| Honor the surface contract | Implement the accepted `fixed`, `bounded`, or `adaptive` strategy. Do not spend design quality on unsupported aspect ratios or assume unknown ones are supported. |
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

Responsiveness follows the accepted surface strategy. A fixed LED strip should be exceptional on that strip; a bounded app should cover its declared placement family; only an adaptive app must remain intentionally composed across unknown ratios. If placement is ambiguous, ask before design work begins.

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

### Single hero elements

Clocks, countdowns, QR codes, counters, and one-value KPI tiles have nothing useful to stack in a tall zone. Treat the hero and its supporting metadata as one composition instead of leaving a card-sized element in the center.

| Ratio | Composition |
|-------|-------------|
| Wide/low | Keep the hero centered and readable; place short metadata in bounded side regions so the strip feels intentional. |
| Tall | Let the hero use vertical structure, such as stacked hour/minute or value/unit groups; anchor metadata above and below. |
| Compact | Remove secondary labels before shrinking the hero below signage readability. |
| Square/landscape | Keep one dominant value and distribute supporting metadata at stable edges. |

Use `ResizeObserver` to derive a small set of ratio classes and one bounded root scale from both measured width and height. Keep flexbox responsible for distribution. Do not independently guess every font size, use browser viewport units, or continuously rebuild the DOM. See `examples/single-hero-clock` for the maintained static pattern.

## Legacy CSS Safety

The production build targets Chrome 56 CSS, but it cannot safely rewrite every modern layout feature. Keep source styles compatible with the legacy Chromium target required by the boilerplate.

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

Run `npm run validate:legacy` after changing app styles. The delivery workflow runs this automatically and rejects the unsupported features listed above before packaging.

## Visual Design

| Rule | Practice |
|------|----------|
| Canvas-friendly | The widget should look good on top of user-designed content. Avoid heavy default panels unless requested. |
| Coordinated themes | Color-driven apps should expose curated `Dark`, `Light`, and `Custom` presets by default. Presets must change the full semantic palette together; do not expect users to assemble a coherent scheme one color at a time. |
| Clear hierarchy | One primary message/value, then secondary metadata. |
| No boilerplate visuals | Replace default icon, placeholder, sample wizard text, and sample content before packaging. |
| No decorative excess | Avoid UI that looks like a landing page. Signage widgets must be readable and purposeful. |
| Reference first | User images, existing brand language, and explicit concepts outrank example styling. Preserve their recognizable composition unless the user asks for reinterpretation. |
| Examples teach mechanics | Reuse engineering patterns from examples without copying their palette, cards, header, accent rail, or pagination treatment by default. |

Design freedom exists inside the production constraints. When no visual direction is supplied, author a domain-specific composition and record its signature choices in `generation-brief.json`; do not fall back automatically to a dark dashboard with a top accent and repeated cards.

Theme presets are implementation support, not a visual style guide. Derive both curated palettes from the accepted reference, brand, and domain. For replacement uploads, map an absent or unknown preset to `Custom` so existing explicit color settings remain unchanged; use the editor property's default to select the intended preset for new placements.

The standard editor property schema does not rewrite sibling color values when a preset select changes. Put manual color controls in a `Custom colors` group with a `visibilityConditions` rule for `themePreset === "custom"`; otherwise preset users see stale swatches that are not active. Curated presets must also replace every semantic surface, divider, track, and status color. Avoid dark-specific translucent literals outside the resolved palette because they frequently destroy contrast in the light preset.

Choose pagination for the content and viewing distance. Valid treatments include a numeric counter, progress rail, section labels, dots for a small fixed set, an animated transition with no persistent indicator, or no pagination when all content fits. A top-right `1 / N` counter is not the default.

### Typography ink safety

DOM box containment does not prove that glyphs are intact. Fonts can paint descenders such as `g`, `j`, `p`, `q`, and `y` outside a tight line box while `scrollHeight` still reports no overflow. This is common when `line-height: 1` is combined with `overflow: hidden` or `clip`.

- Leave vertical ink clearance through a safer line height or explicit top/bottom padding on clipped text.
- Validate representative labels containing ascenders, capitals, punctuation, accents, and descenders.
- Do not repair a title by hiding more overflow; inspect its computed font size, line height, box height, and padding.
- Treat the shared text-ink failure as a real layout defect. It reports the selector, rendered text, measured ink buffer, and required buffer.

For a variable single-line title or hero value with a bounded box, `useAutoFitText` is the default practice. Select the largest fitting font size from an explicit minimum and maximum, watch the displayed value, and retain a safe line height plus bottom padding. The hook observes the rendered element with the SDK-compatible `ResizeObserver` environment. Do not apply it blindly to paragraphs, intentional multi-line headings, table cells, or every repeated list item; those need explicit wrapping, line limits, safe line boxes, and pagination where appropriate. Auto-fit is not a replacement for flex layout or responsive tiers, and DOM scroll dimensions do not describe every font's painted glyph bounds. Record every important variable-length surface and its strategy in `generation-brief.json#dynamicText`; a long-content evidence scenario is mandatory.

When horizontally truncating descender-bearing text with `overflow: hidden`, provide at least `line-height: 1.16` or equivalent bottom clearance. The shared visual validator checks both total glyph-ink space and the clearance below the baseline; a tall box with all spare space above the baseline is still unsafe.

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

Mapping is not proof that a control works. Declare `previewSettingEffects` in `preview/fixture.ts` and compare the rendered result before and after a real `sendConfiguration` update. Every slider requires this executable evidence. Prefer bounding-box changes for size/spacing controls, computed styles for typography, and direct text/attribute changes for content or media controls.

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

Bundled fallback data, preview fixtures, datasource templates, placeholders, and source archives must be synthetic. Never copy customer names, employee names, external datasource URLs, record IDs, timestamps, or exact operational values into the repository or delivery artifacts. Preserve the source shape, field vocabulary, state coverage, and representative edge cases while replacing every identifying or operational value.

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

Never rely on editor-only behavior for the displayer. Test the display output as a standalone widget surface through the local preview and validated build output.

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
| Ship real editor images | `icon.png` and `placeholder.png` must be structurally valid PNG files with non-zero dimensions. |
| Validate the package | Run `npm run validate:package`; a successful Vite build alone does not prove that media loads in the displayer. |

`resourceList` and URL resolution solve different problems. Cache-listing an image does not repair a bundle that requests `/displayer/index.png`.

## Visual Validation

1. Put representative settings and datasource values in `preview/fixture.ts`.
2. Set fixture `readySelector` to a config-driven text element when SDK configuration settles after the preview root mounts. Do not add app-specific readiness logic to `visual.spec.ts`.
3. Set the intended default dimensions in `properties.json`, then run `npm run dev:preview` and inspect the app-default surface.
4. Define named `previewScenarios` for every materially different state: empty, maximum content, odd item count, last page, longest labels, and error fallback as applicable. Use `advanceTimeMs` for rotating states.
5. In behavior tests, use `window.__wallboardPreview.pushDatasource()` for live updates and `window.__wallboardPreview.destroy()` for teardown. Verify that charts, timers, and listeners are released; do not depend on SDK registration keys or mount-selector IDs.
6. Use `window.__wallboardPreview.pushConfiguration()` indirectly through `previewSettingEffects` to verify editor controls affect the rendered element, not only the mapper or fallback implementation.
7. Run `npm run measure:visual` after the first real render. Review its report and screenshots, then put measured content-coverage thresholds with regression margin on every planned surface and scenario. The metric uses visible text, media, charts, SVGs, and background images; empty structural boxes do not count.
8. Run `npm run validate:visual`. It checks every declared surface, every named scenario, declared setting effects, and text-ink safety. Adaptive apps also receive the standard full HD, wide-low, landscape, portrait, and square matrix.
9. Inspect every image in `preview/output/` at its real pixel dimensions and zoom into typography. Content coverage and ink checks are regression guards; automated checks still do not judge reference fidelity, hierarchy, composition, or overall legibility.
10. Iterate until the primary information remains readable and balanced at every required size, then build the zip.

Do not validate only in a convenient card-sized mock. The preview iframe must use the real widget dimensions; scaling the iframe visually is acceptable because it preserves its layout viewport.

Treat clipping as an application layout defect first: inspect flex bases, `min-width`, padding, and content width before blaming the editor viewport. Mark a deliberately off-canvas element with `data-preview-allow-overflow` only when overflow is part of the intended interaction; never use it to suppress clipped visible content.

## Build Checklist

Before returning a zip:

- `src/editor-assets/properties.json` has a unique `name`. Existing-app fixes preserve `version`; incompatible variants use a new version and a separate upload.
- `src/editor-assets/icon.png` and `placeholder.png` are app-specific.
- Editor wizards or layout editors exist only when their URLs are referenced by `properties.json`; copy needed starters from `templates/editor-assets/`.
- Root background is transparent unless intentionally configured otherwise.
- Layout behaves at every surface required by the accepted fixed, bounded, or adaptive strategy.
- Empty, loading, and invalid-data states render cleanly.
- `npm run validate:visual` passes and every generated screenshot has been inspected.
- All settings are typed and mapped.
- No unscoped global DOM selectors or shared mutable state.
- `npm run lint` passes.
- `npm run validate:legacy` passes.
- `npm run validate:package` passes.
- Zip contains `assets/app.js`, `assets/app-chrome-49.js`, `editor-assets/config.json`, `editor-assets/icon.png`, and `editor-assets/placeholder.png`.

## Installation Handoff

First apply the identity rules in `app-identity-and-delivery.md`. Creating a duplicate record with the same internal app name and version causes editor registration and public resource-resolution collisions.

Creating an app record and uploading its zip are not enough to expose it in the content editor. New custom app records are disabled by default.

1. Upload the zip to the intended custom app record.
2. Enable the app after the upload succeeds.
3. Assign the editor's current customer, or keep the customer assignment list empty to make the app available to all customers.
4. Reopen or reload the content editor so it downloads the updated custom app list.

If content already contains the app while it is disabled or unavailable to the selected customer, the editor cannot resolve its `customApp_*` widget service and may fail while requesting its editor template or context-menu inputs.
