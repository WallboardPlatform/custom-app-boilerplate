# Reusable Capabilities

Reuse these mechanics without inheriting an example's visual language.

| Need | Capability | Evidence/reference |
|------|------------|--------------------|
| Bounded primary text | `useAutoFitText`, `src/utils/text-fit.ts` | Long-text scenario; minimum size and ink checks |
| Theme presets | `resolveTheme`, `mixHexColors`, `readableTextColor` | Setting effect plus light/dark/custom scenarios |
| Rich text/SVG | `src/utils/sanitize.ts` | Malicious/unsupported markup test |
| Wrapped datasource arrays | `extractArrayAtPaths` | Direct, serialized, documented wrapper fixtures |
| Pagination/uneven final page | `paginate`, `pageAt` | Odd, maximum, and final-page scenarios |
| Rotation/timers | Instance-local signal + timer + `onCleanup` | Behavior test for movement, completion, update, teardown |
| Charts | Chart.js selective imports; ECharts only for advanced needs | `charting.md`; no/one/dense data and cleanup |
| Packaged assets | Static import plus `resourceList` | Broken-media scenario and package validation |
| Built-in data | FEED/CALENDAR normalization and independent multi-source composition | `newsroom-spotlight`, `live-agenda`, `civic-venue-pulse` |
| Editable general data | TABLE contract and synthetic template | `airport-departures`, `restaurant-menu` |

## Selection Rules

- Normalize only documented wrappers/paths; do not recursively choose the first array in an unknown object.
- Balance pages when a sparse final page harms signage composition. Keep full pages when chronological batching or user expectations require it.
- A datasource update should preserve the active page/animation when still valid; normalize its index only when page count shrinks.
- Dynamic text policy is per semantic surface. Auto-fit primary bounded text, wrap meaningful prose/headings, ellipsize only accepted secondary loss, and marquee only requested moving content.
- Derive every semantic surface from the active theme tokens. Use `mixHexColors` for legacy-safe tones and `readableTextColor` for text on configurable accents; never combine preset text with fixed dark surfaces.
- Missing, empty, invalid, maximum, odd, long-text, broken-media, last-page, and live-update states are capabilities to design and test, not one shared layout.
- Examples prove techniques. The prompt/reference/domain still determines hierarchy, palette, density, geometry, media treatment, and pagination style.
