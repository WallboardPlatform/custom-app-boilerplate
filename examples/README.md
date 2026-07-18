# Examples

Examples are thin overlays on the current boilerplate, not copied projects. This keeps build tooling, SDK setup, preview behavior, and packaging rules in one source of truth.

Use examples as engineering references, not visual templates. A user-supplied image, brand system, or explicit concept must lead the composition. Borrow normalization, legacy CSS, resize, pagination, chart, test, and packaging techniques without inheriting an example's palette, card grammar, header, accent rail, or page indicator by default.

Each example contains:

```text
examples/<id>/
|- example.json      # description and base files to remove
|- generation-brief.json  # validated request, design, data, and evidence contract
|- datasource-contract.json  # optional generator metadata for data-bound examples
|- sample-<source>-datasource.json  # optional native Wallboard datasource data; one clearly named file per independent source
|- screenshots/          # one or two representative reviewed renders
`- overlay/          # files copied over a clean boilerplate materialization
```

| Example | Capability | Verified states |
|---------|------------|-----------------|
| `airport-departures` | Editable `TABLE` flight board, adaptive pagination, status hierarchy | Default, wide/low, portrait, square, empty, invalid rows, long labels, odd/maximum counts, row array, last page, live update |
| `call-center-agent-status` | Existing flat agent feed, semantic state aliases, density-aware roster, segmented pagination | Mixed states, wide/low, portrait, square, empty, invalid rows, long labels, unknown state, uneven final page, live update |
| `campus-directory` | Editable `TABLE` wayfinding board, grouped routes, complete direction and accessibility text | Landscape, wide/low, portrait, square, empty, invalid rows, long essential fields, unequal groups, partial page, live update |
| `civic-venue-pulse` | Independent built-in `CALENDAR` + `FEED` bindings, provider normalization, overlap selection, coherent source fallbacks | Full HD, compact, Microsoft/Google/iCalendar, current/legacy feed, calendar-only, feed-only, empty, overlap, all-day, stale/broken media, long text, live updates |
| `factory-safety-questionnaire` | Interactive touch flow paired with `factory-safety-results-dashboard`; editable Questions table, bounded Results append, sensor output, external reset | Full HD, compact, identity, empty, long welcome/question/answers, complete submission, bounded write, remote reset |
| `factory-safety-results-dashboard` | Read-only pair for the questionnaire; derives KPIs, score distribution, and recent activity from the same Results table | Full HD, compact light, corporate IDs, empty, long title, row array, live recomputation |
| `kpi-operations` | Hierarchical `CUSTOM` contract, KPI cards, responsive Chart.js trend, target progress | Default, wide/low, portrait, square, empty, long labels, live update |
| `live-agenda` | Built-in `CALENDAR` integration, provider normalization, current-event progress, chronological timeline | Default, wide/low, portrait, square, Microsoft/Google, iCalendar, empty, all-day, long labels, live update |
| `manufacturing-andon` | Portrait production instrument, grouped lines, shape-and-text status markers, dense rotation | 1080 and 480 portrait, normal/stopped/unknown states, empty, invalid rows, long reasons, dense and partial pages, live update |
| `market-rotation-ticker` | Fixed 6000x136 surface, five existing bindings, heterogeneous response normalization, File System logo lookup, continuous marquee | 6000x136, empty, invalid prices, missing icons, short data, rotation completion, moving title |
| `museum-welcome` | Reference-led fixed Full HD poster, packaged artwork, deliberate negative space, non-dashboard composition | Default, alternate colors, missing/broken media, long title, minimal, transparent background |
| `newsroom-spotlight` | Built-in `FEED` integration, current/legacy RSS normalization, media fallback, timed editorial rotation | Default, wide/low, portrait, square, current feed, RSS parser/channel, empty, broken media, long labels, live update |
| `pharmacy-pickup-queue` | Fixed 480x270 queue surface, semantic service states, bounded overflow | Light/dark, empty, invalid rows, long labels, single/many tickets, row array, live update |
| `product-catalog` | Editable `TABLE` products plus independent File System image lookup, platform caching, editorial rotation, and designed media fallback | Full HD, wide/low, portrait, square, compact, long copy, missing/broken image, empty, final page, live update, motion off |
| `recognition-mosaic` | Photo-led editorial wall, packaged media, asymmetric layouts, designed fallbacks | Landscape, portrait, square, wide/low, light/dark, missing media, long copy, odd counts, partial page, live update |
| `restaurant-menu` | Photo-to-menu pattern, editable table contract, grouping and pagination | Default, wide/low, portrait, square, static, empty, bound-null, long labels, last page, motion off |
| `single-hero-clock` | Static single-hero pattern, timezone formatting, live timer, ResizeObserver ratio compositions | Default, ultra-wide, compact, portrait, square, minimal, invalid timezone, long label, timer teardown, live config update |
| `veszprem-wayfinding` | Supplied SVG map, production-compatible proximity graph and Dijkstra routing, touch directory, editable `TABLE` destinations | Full HD, compact, selected route, map click, off-map destination, light/dark/custom, empty, long labels/list, row array, live update, reset |
| `weather-window` | Platform weather service, defensive normalization, cached condition media, last-good stale fallback, ratio-specific editorial composition | Full HD, landscape, wide/low, portrait, square, long location/condition, missing media, short forecast, unavailable, stale update, motion off |

Each manifest names one or two `referenceScreenshots` committed under `screenshots/`. Full visual matrices are generated during acceptance and uploaded as CI artifacts; they are not stored in Git.

Materialize without changing this worktree:

```bash
npm run example:materialize -- <id> <target-directory>
cd <target-directory>
npm run setup
npm run validate:examples
npm run validate:visual
npm run prepare:visual-review
npm run validate:package
```

The explicit target must be new or empty. Run `npm run validate:examples` in the boilerplate before materialization and again in the materialized project after changing its contract or sample data. Files listed in `example.json.artifacts` are copied to the materialized project root but are not bundled into the app zip.

For maintained evidence, run `npm run example:review:prepare -- <id>`, inspect every image under `.tmp/review/<id>/preview/output`, complete its `visual-review.json`, then run `npm run example:review:promote -- <id>`. Promotion validates the current fingerprint and copies only the manifest's one or two representative screenshots while retaining review records for the full matrix.

Run `npm run example:accept -- <id>` for clean materialization, the complete validation matrix, and delivery bundle. An example is accepted only when its default and named scenarios pass, its promoted review is current, packaged assets pass validation, datasource live updates work when applicable, and its zip works after a real Wallboard upload.

Every example includes a standalone-valid generation brief whose settings and evidence also pass project synchronization against the materialized app. An example may add `overlay/preview/*.spec.ts` for requirements that cannot be proven by the generic visual suite, such as continuous coverage, animation progress, or interaction timing.

Repository checks cap tracked images at 10 MiB and report a 25,000-token advisory Markdown target. Promote only distinct capabilities; replace overlapping examples.
