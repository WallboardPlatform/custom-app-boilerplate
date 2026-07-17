# Capability Roadmap

Promote a candidate only when it adds reusable mechanics not already proven by a maintained example. User references and explicit concepts still lead visual design.

| Candidate | Data/media contract | Reuse before invention | Promotion gate |
|-----------|---------------------|------------------------|----------------|
| Product catalog | `TABLE` products; optional File System image binding | Table normalization, media fallback, grouping, bounded pages | Price/availability/localization variants, missing media, long SKUs/names, category changes, live update |
| Hall of fame | `TABLE` people/achievements; optional File System portraits | Recognition media handling and editorial text safety | Add a distinct timeline/filter/spotlight mechanic; otherwise keep it a generated project, not another maintained example |
| Weather | Verified Wallboard weather integration; packaged icon fallback only when required | Existing weather request/data services and production condition vocabulary | Confirm a supported custom-app binding first; do not fetch vendor APIs directly or duplicate provider credentials |
| PDF display/control | Supported bridge to the legacy PDF widget | PDF.js worker; document/viewport/dimension caches; lazy pages; real-scroll `requestAnimationFrame`; bounded preload refresh | Expose/reuse the player path, then prove long documents, fit modes, vertical/horizontal scroll, pause/rewind, zoom, cleanup, and legacy devices; never bundle an independent PDF stack by default |

`veszprem-wayfinding` now proves reference-led SVG interaction, production-compatible proximity graph construction, Dijkstra routing, route reset, off-map destinations, and a clearly named editable destination table.
