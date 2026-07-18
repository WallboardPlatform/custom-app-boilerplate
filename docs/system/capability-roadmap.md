# Capability Roadmap

Promote a candidate only when it adds reusable mechanics not already proven by a maintained example. User references and explicit concepts still lead visual design.

| Candidate | Data/media contract | Reuse before invention | Promotion gate |
|-----------|---------------------|------------------------|----------------|
| Product catalog | Promoted: editable `TABLE` products + independent File System images | `product-catalog` proves filename-stem lookup, platform cache, offline media preview, fallback, bounded transition, and live update | Extend generated projects for localization/category variants; do not turn the example into a universal catalog |
| Hall of fame | `TABLE` people/achievements; optional File System portraits | Recognition media handling and editorial text safety | Not promoted: overlaps `recognition-mosaic`. Promote only with a distinct timeline/filter/spotlight mechanic |
| Weather | Promoted: SDK `useWeather`/`WeatherService`; no datasource binding | `weather-window` proves platform refresh/cache ownership, defensive normalization, location-keyed preview, missing-media fallback, initial failure, and last-good stale state | Extend generated projects for device location or alternate compositions; never call vendor APIs or own credentials |
| PDF display/control | Blocked: SDK exposes no legacy PDF renderer/action bridge | Legacy `PdfWidgetComponent`, PDF.js 2.3.200 worker, document/dimension caches, lazy pages, real-scroll loop | Expose the production bridge first. Then prove long docs, fit/scroll/zoom/actions/cleanup; do not bundle an independent PDF stack |

`veszprem-wayfinding` now proves reference-led SVG interaction, production-compatible proximity graph construction, Dijkstra routing, route reset, off-map destinations, and a clearly named editable destination table.
