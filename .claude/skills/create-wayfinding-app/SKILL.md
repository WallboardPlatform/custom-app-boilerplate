---
name: create-wayfinding-app
description: Create or repair a Wallboard interactive wayfinding custom app from a PDF, floor-plan image, map screenshot, SVG, or existing point-based map. Use when the request involves destination search, routes, floors, accessibility, map metadata, location details, kiosk navigation, or converting a supplied venue map into an uploadable Wallboard app.
---

# Create Wayfinding App

Build four independent artifacts: visual `map.svg`, confirmed `walkable-mask.json`, canonical `route-graph.json`, and editable destination `TABLE`. Treat the supplied reference and accepted use case as art direction; examples provide mechanics only.

## Workflow

1. Read `AGENTS.md`, `docs/system/wayfinding.md`, the supplied source, and only the other task-relevant system docs.
2. Resolve kiosk surface, current-location policy, floors, languages, required accessibility modes, data ownership, and delivery. Ask only when an unknown changes the map or graph materially.
3. Choose and record one visual mode:
   - **Hybrid by default:** retain the supplied artwork under vector hit areas/routes.
   - **Schematic:** simplify geometry when distance readability matters more than fidelity.
   - **Exact vector:** trace when reliable geometry is required and available.
4. Create the generation brief and pass `npm run validate:brief` before app implementation.
5. Author the artifacts using [references/artifacts.md](references/artifacts.md). Audit existing SVGs with `npm run wayfinding:audit-source -- --svg <map.svg> --report-dir <directory>` before migration. Treat exported legacy anchors as proposals and legacy point clouds as evidence, never topology.
6. For raster/PDF or audited SVG sources, use `npm run wayfinding:workbench`: confirm the independent mask, place routeable destination anchors at reviewed approaches, and draw/classify explicit corridor edges. Generated centre lines stay proposed; inspect every destination entrance side plus each crossing, door, and transition class over the source. Color extraction may miss paths hidden by map artwork. Preserve supplied public landmark metadata; use fictional representative values only for invented samples, and never commit confidential records.
7. Annotate each interactive SVG target with a stable `id`, `data-wayfinding-location-id`, and optional `data-wayfinding-level`. Listed-only rows may omit SVG geometry; routeable rows require both a hit target and graph anchor. Keep route nodes and edges exclusively in the graph; do not duplicate them as invisible SVG circles.
8. Validate and generate the QA dashboard/overlay:

```bash
npm run wayfinding:validate -- --svg map.svg --graph route-graph.json --walkable-mask walkable-mask.json --destinations destinations.json --start <location-id> --route-to <representative-location-id> --report-dir wayfinding-report
```

9. Fix every error. Inspect the graph overlay and representative routes; resolve or explicitly review warnings. Use `--strict` only when warnings must also fail delivery; never invent accessibility or operational facts to obtain a warning-free report. Rendering alone is not route proof.
10. Build the app with `WayfindingGraph`. Provide search/filter, an app-owned keyboard when text input is used, selected-location details, route reset, unreachable/off-map states, and step-free routing when requested.
11. Test default, selected route, long metadata, empty, unreachable, step-free, floor transition, reset, and live datasource update states that apply. Complete normal visual review and delivery.

## Non-Negotiable

- Use native location annotations and explicit edges. The SVG structure and coordinate space follow the accepted source and design.
- Require an independently confirmed walkable mask for generated v2 centerlines. AI/OCR proposals are not confirmation.
- Require a confirmed kiosk/current-location id for route certification. Keep accessibility unknown unless the source or reviewer verifies it.
- Place a location node at its walkable entrance/approach, not its polygon centroid.
- Keep location nodes as leaf entrances; never route through an unrelated destination. Name and classify crossings, doors, stairs, elevators, and escalators explicitly.
- Keep mutable names, descriptions, hours, images, status, localization, and CTA content in the destination TABLE.
- Mark off-map or intentionally unreachable destinations `routeable: false`; never draw an invented route.
- Model stairs/elevators/escalators and accessibility on graph edges. Use stable edge IDs for closures and rerouting.
- Preserve source labels/icons unless replacement is needed for interaction, localization, theming, or readability. Do not mandate inpainting.
- Do not embed arbitrary HTML, scripts, event handlers, credentials, customer records, or live customer URLs in SVG/metadata.
- Do not ship unresolved disconnected destinations, unexplained edge crossings, backtracking/detour warnings, high-degree shortcuts, or unreviewed graph warnings. Connectivity alone is not route proof.

## Deliver

Return the uploadable app ZIP and separate source ZIP, plus `map.svg`, `walkable-mask.json`, `route-graph.json`, destination contract/template, validation report, graph overlay, and installation/binding notes.
