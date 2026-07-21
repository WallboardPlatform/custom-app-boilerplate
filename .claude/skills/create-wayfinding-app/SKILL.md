---
name: create-wayfinding-app
description: Create or repair a Wallboard interactive wayfinding custom app from a PDF, floor-plan image, map screenshot, SVG, or existing point-based map. Use when the request involves destination search, routes, floors, accessibility, map metadata, location details, kiosk navigation, or converting a supplied venue map into an uploadable Wallboard app.
---

# Create Wayfinding App

Build an interactive map whose guidance strength matches confirmed evidence. Every project needs visual `map.svg` plus an editable destination `TABLE`; add `walkable-mask.json` and `route-graph.json` only for independently certifiable routing. Treat the supplied reference and accepted use case as art direction; an equivalent redraw is allowed when it serves the visitor better.

## Workflow

1. Read `AGENTS.md`, `docs/system/wayfinding.md`, the supplied source, and only the other task-relevant system docs.
2. Resolve kiosk surface, current-location policy, floors, languages, required accessibility modes, data ownership, and delivery. Ask only when an unknown changes the map or graph materially.
3. Copy `templates/wayfinding-project.json` to the project. Choose target guidance (`directory`, `highlight`, `directional`, or `route`), explicit fallback policy, evidence status, and one visual mode:
   - **Source overlay by default:** retain useful supplied artwork under vector hit areas; add routes only when separately certified.
   - **Schematic:** simplify geometry when distance readability matters more than fidelity.
   - **Exact vector:** trace when reliable geometry is required and available.
   - **Calibrated isometric:** retain useful 3D artwork over a separately authored and projected 2D spatial model.
4. Run `npm run wayfinding:assess -- --project wayfinding-project.json`. Do not build route UI unless the assessment permits it. A polished highlight/directional product is the required fallback for uncertain raster topology.
5. Create the generation brief and pass `npm run validate:brief` before app implementation.
6. Author the artifacts using [references/artifacts.md](references/artifacts.md). Audit existing SVGs with `npm run wayfinding:audit-source -- --svg <map.svg> --report-dir <directory>` before migration. Treat exported legacy anchors as proposals and legacy point clouds as evidence, never topology.
7. Use `npm run wayfinding:workbench` to load/export the project assessment and review map evidence. For raster/PDF or audited SVG route candidates, confirm the independent mask, place graph anchors at reviewed approaches, and draw/classify explicit corridor edges. Generated centre lines stay proposed; inspect every destination entrance side plus each crossing, door, and transition class over the source. Color extraction may miss paths hidden by map artwork. Preserve supplied public landmark metadata; use fictional representative values only for invented samples, and never commit confidential records.
8. Annotate each interactive SVG target with a stable `id`, `data-wayfinding-location-id`, and optional `data-wayfinding-level`. Listed-only rows may omit SVG geometry; route-eligible destinations require both a hit target and graph anchor. Keep route nodes and edges exclusively in the graph; do not duplicate them as invisible SVG circles.
9. For route projects, validate and generate the QA dashboard/overlay:

```bash
npm run wayfinding:validate -- --svg map.svg --graph route-graph.json --walkable-mask walkable-mask.json --destinations destinations.json --start <location-id> --route-to <representative-location-id> --report-dir wayfinding-report
```

10. Fix every error. Inspect the graph overlay and representative routes; resolve or explicitly review warnings. Use `--strict` only when warnings must also fail delivery; never invent accessibility or operational facts to obtain a warning-free report. Rendering alone is not route proof.
11. Build the assessed mode. Every mode provides search/filter, strong target highlighting, selected-location details, reset, and an app-owned keyboard when text input is used. Add `You are here` and relative direction only with confirmed origin/orientation; add `WayfindingGraph`, unreachable states, and step-free routing only when assessed.
12. Test default, target highlight, long metadata, empty, reset, and live datasource update states. Add route, step-free, floor transition, and closure scenarios only when those capabilities exist. Complete normal visual review and delivery.

## Non-Negotiable

- Use native location annotations. Use explicit edges only for assessed route projects; the SVG structure and coordinate space follow the accepted source and design.
- Never use route as the universal default. Directory, highlight, and directional guidance are first-class sellable modes.
- Require an independently confirmed walkable mask for generated v2 centerlines. AI/OCR/image-analysis proposals and self-review are not confirmation.
- Require a confirmed kiosk/current-location id for route certification. Keep accessibility unknown unless the source or reviewer verifies it.
- Place a location node at its walkable entrance/approach, not its polygon centroid.
- Keep location nodes as leaf entrances; never route through an unrelated destination. Name and classify crossings, doors, stairs, elevators, and escalators explicitly.
- Keep mutable names, descriptions, hours, images, status, localization, and CTA content in the destination TABLE.
- Derive map presence from reviewed SVG geometry and route eligibility from the graph. Keep off-map or intentionally unreachable destinations listed-only; never let mutable TABLE data grant routing.
- Model stairs/elevators/escalators and accessibility on graph edges. Use stable edge IDs for closures and rerouting.
- Preserve source labels/icons unless replacement is needed for interaction, localization, theming, or readability. Do not mandate inpainting.
- Do not embed arbitrary HTML, scripts, event handlers, credentials, customer records, or live customer URLs in SVG/metadata.
- Do not ship unresolved disconnected destinations, unexplained edge crossings, backtracking/detour warnings, high-degree shortcuts, or unreviewed graph warnings. Connectivity alone is not route proof.

## Deliver

Return the uploadable app ZIP and separate source ZIP, plus `wayfinding-project.json`, `map.svg`, destination contract/template, and installation/binding notes. Route projects also include the confirmed walkable mask, graph, validation report, and graph overlay.
