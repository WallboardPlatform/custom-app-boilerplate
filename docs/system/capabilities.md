# Reusable Capabilities

Reuse these mechanics without inheriting an example's visual language.

| Need | Capability | Evidence/reference |
|------|------------|--------------------|
| Bounded primary text | `useAutoFitText`, `src/utils/text-fit.ts` | Long-text scenario; minimum size and ink checks; legacy resize fallback |
| Theme presets | `resolveTheme`, `mixHexColors`, `readableTextColor` | Setting effect plus light/dark/custom scenarios |
| Rich text/SVG | `src/utils/sanitize.ts` | Malicious/unsupported markup test |
| Wrapped datasource arrays | `extractArrayAtPaths` | Direct, serialized, documented wrapper fixtures |
| Pagination/uneven final page | `paginate`, `pageAt` | Odd, maximum, and final-page scenarios |
| Rotation/timers | Instance-local signal + timer + `onCleanup` | Behavior test for movement, completion, update, teardown |
| Charts | Chart.js selective imports; ECharts only for advanced needs | `charting.md`; no/one/dense data and cleanup |
| Packaged assets | Static import plus `resourceList` | Broken-media scenario and package validation |
| Built-in data | FEED/CALENDAR normalization and independent multi-source composition | `newsroom-spotlight`, `live-agenda`, `civic-venue-pulse` |
| Editable general data | TABLE contract and synthetic template | `airport-departures`, `restaurant-menu` |
| Interactive runtime | `createPageSession`, `createInternalDatasourceWriter`, preview external commands | Reset/timeout, displayer-only mutation, command and output tests |
| Touch text entry | Opt-in `keyboard` capability with controlled values and selectable layouts | `veszprem-wayfinding` proves Hungarian + English destination search; `pdf-document-workspace` proves document search |
| Authored rendering | Fixed-canvas, motion, and media helpers | Design-size fit, motion tokens/reduction, media fit/fallback |
| PDF documents | Opt-in `pdf` capability; PDF.js 2.3.200 is materialized only on request | `pdf-document-workspace`: multiple files, range/layout/fit, lazy pages, outline/search/link/annotation/form layers, zoom, auto-scroll, download, commands, cleanup |
| Video playback | Opt-in `video` capability; hls.js 0.7.9 is materialized only on request | `lumen-media-program`: direct file/folder/JSON playlist, cache, native MP4/WebM/HLS, poster/captions, autoplay/sound/fit/repeat/seek/retry, commands, telemetry, cleanup |
| Wayfinding routing | Hosted Wayfinding Studio publishes `.wbmap`; the app consumes `WayfindingGraph` and presentation data | `wayfinding.md`; standard/step-free paths, disabled edges, topology warnings |

Planned capability proofs and their promotion gates live in [capability-roadmap.md](capability-roadmap.md).

## Selection Rules

- Normalize only documented wrappers/paths; do not recursively choose the first array in an unknown object.
- Balance pages when a sparse final page harms signage composition. Keep full pages when chronological batching or user expectations require it.
- A datasource update should preserve the active page/animation when still valid; normalize its index only when page count shrinks.
- Dynamic text policy is per semantic surface. Auto-fit primary bounded text, wrap meaningful prose/headings, ellipsize only accepted secondary loss, and marquee only requested moving content.
- Derive every semantic surface from the active theme tokens. Use `mixHexColors` for legacy-safe tones and `readableTextColor` for text on configurable accents; never combine preset text with fixed dark surfaces.
- Missing, empty, invalid, maximum, odd, long-text, broken-media, last-page, and live-update states are capabilities to design and test, not one shared layout.
- Examples prove techniques. The prompt/reference/domain still determines hierarchy, palette, density, geometry, media treatment, and pagination style.
- Preview exposes datasources, actions, sensor events, and commands. Guard writes; editor mode returns `editor-blocked`.

## Opt-in capabilities

Capabilities are excluded from ordinary projects and builds. Add one explicitly:

```bash
npm run capability:add -- pdf
npm run capability:add -- video
npm run capability:add -- keyboard
```

The PDF capability expands its checksum-pinned runtime into `src/capabilities/pdf`. Keep `assets/pdf.worker.js` in `resourceList`; the runtime resolves it beside the loaded custom-app script in Wallboard and falls back to Vite's imported URL in local preview.

The video capability expands its checksum-pinned hls.js runtime into `src/capabilities/video`; MP4/WebM still use the native browser path. It cannot expose the platform native/external player, synchronized multi-screen playback, audio ducking, or proof-of-display registration through the current custom-app SDK. Never represent browser telemetry as platform proof-of-display.

The keyboard capability adds an app-owned touch keyboard without relying on the device OS or the legacy Angular User Input widget. Materialize it only for apps with text entry; choose requested language layouts and keep physical keyboard input available.
