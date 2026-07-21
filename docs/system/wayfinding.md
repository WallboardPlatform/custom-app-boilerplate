# Wayfinding

Generate wayfinding as visual map geometry, a confirmed walkable mask, an explicit route graph, and an editable destination table. A structurally valid SVG is not proof of usable routing.

## Source Decision

| Mode | Use when | Output |
|------|----------|--------|
| Hybrid (default) | Supplied map is branded, detailed, or expensive to redraw | Original raster/PDF render under vector hit areas and routes |
| Schematic | Distance readability and simple navigation matter more than exact geometry | Simplified vector landmarks, corridors, zones, and labels |
| Exact vector | Accurate geometry is required and the source supports reliable tracing | Vector base plus interactive layers |

Do not inpaint source labels/icons by default. Remove them only when they must become dynamic, localized, themeable, or independently interactive.

## Ownership

| Artifact | Owns | Must not own |
|----------|------|--------------|
| `map.svg` | Base artwork, location hit areas, level geometry, stable IDs | Mutable public copy, live status, route nodes or inferred topology |
| `walkable-mask.json` | Independently reviewed traversable space in map coordinates | Route topology, destination copy, or inferred accessibility |
| `route-graph.json` | Nodes, explicit edges, floor transitions, accessibility, optional measured distances | Destination descriptions or presentation |
| destination `TABLE` | Name, aliases, description, category, floor, hours, image, status, accessibility, keywords, CTA | SVG geometry or graph edges |

Graph location nodes represent walkable entrances/approach points, not polygon centroids. Keep `locationId` explicit in graph nodes. Annotate the corresponding SVG hit target with `data-wayfinding-location-id`; the table is authoritative for public copy.

## SVG Contract

- use any positive, stable `viewBox` suited to the source and accepted design;
- allow transforms, nested groups, raster backgrounds, and arbitrary visual layers;
- give every interactive target a unique SVG `id` and `data-wayfinding-location-id`;
- add `data-wayfinding-level` when the target belongs to a floor;
- wrap multipart geometry in one annotated group;
- keep route nodes and edges exclusively in `route-graph.json`.

Graph coordinates are always expressed in the root SVG viewBox coordinate system. Pointer and authoring tools must normalize transformed artwork into that coordinate space.

## Routing

- Generated maps require explicit graph edges.
- Sample centerlines into nodes only as needed for route shape; topology comes from edges, not point density.
- Connect every routeable location at its entrance. Mark off-map/non-routeable destinations explicitly.
- Keep location nodes as leaf entrances; a route through an unrelated destination is a topology defect.
- Represent crossings, doors, stairs, elevators, and escalators as named edges. Do not replace them with a visual shortcut.
- Model cross-floor edges as `stairs`, `elevator`, or `escalator`; set accessibility per edge.
- Keep stable edge IDs so live closures and external commands can disable edges and reroute.
- Prefer authored `distanceMeters`; otherwise calibrate `mapRatio` and label distances approximate.

The shared `WayfindingGraph` supports standard and step-free shortest paths plus disabled edges.

## Image/PDF Extraction

For an existing SVG, audit it before trusting or migrating any embedded points:

```bash
npm run wayfinding:audit-source -- --svg legacy-map.svg --report-dir wayfinding-source-audit
```

The audit reports duplicate IDs and executable content, migrates location geometry to native annotations, and exports proposed legacy location anchors. Legacy route-point clouds are evidence only: the audit never infers graph edges.

Use `npm run wayfinding:workbench` after rendering the accepted PDF/image to a stable map image or after auditing an existing SVG.

1. AI/OCR proposes destination IDs and metadata; never treat OCR as confirmed copy.
2. Sample representative walkable colors, extract the connected mask, then paint include/exclude corrections over crossings, doors, and false positives.
3. Place each routeable destination anchor at its reviewed entrance or walkable approach. Moving an anchor invalidates every connected edge review.
4. Draw explicit edges along visible corridors, or generate centerline proposals from the mask. Add bends where the source changes direction; classify traversal, direction, accessibility, and corridor width.
5. Review the source overlay, confirm the independent mask, then inspect and confirm each contained edge individually. There is no bulk topology confirmation.
6. Export mask, graph, and destination TABLE separately; validate the exported files before app integration.

Mask extraction and skeletons may propose topology but never certify it. Color extraction can miss valid paths hidden by labels, buildings, crossings, or other artwork; complete those semantics during overlay review. Indoor, outdoor, and mixed maps require different walkability semantics; entrances, junctions, edges, and accessibility remain reviewer decisions.

For a hand-authored graph, a graph-derived corridor envelope is useful only as a regression check. It is not an independent walkable mask and cannot certify the same graph that generated it; review every representative route over the source map.

## Metadata Updates

| Change | Workflow |
|--------|----------|
| Name, translation, description, category, hours, image, status, keywords, CTA | Quick-edit the destination TABLE; no geometry rebuild |
| `routeable` or destination visibility | Edit TABLE, then verify graph coverage if enabling routing |
| Stable ID, entrance/approach point, walkable space, floor, transition, closure topology | Reopen workbench, review/export geometry, rerun validation |

The workbench destination editor highlights the selected graph anchor and exports the native TABLE shape. It never rewrites map artwork from mutable public copy.

## Product Baseline

- Search, category filters, aliases, app-owned multilingual keyboard.
- Fixed or selectable "you are here", route reset, idle timeout, privacy-safe session state.
- Destination detail panel/modal with description, image, hours, accessibility, live status, and optional CTA.
- Pan/zoom, floor switch, transition indicators, legend, standard/step-free route modes.
- Dynamic closures, off-map state, unreachable state, and designed empty/loading failures.
- Optional sensor events and external commands for search, selection, route, reset, start, and target.
- Near-view touch targets and complete essential directions; do not sacrifice legibility to fit more destinations.

## Authoring And QA

The AI may propose visuals and extract OCR metadata, but ambiguous names, entrances, and corridor topology require an explicit review item. Never invent missing operational facts.

```bash
npm run wayfinding:validate -- --svg map.svg --graph route-graph.json --walkable-mask walkable-mask.json --destinations destinations.json --start lobby --route-to auditorium --report-dir wayfinding-report
```

The report must show zero errors. Inspect `wayfinding-debug.svg` and representative routes at actual kiosk size and multiple zoom centres. Cover every entrance side plus each crossing and transition class. Review warnings for backtracking, detours, long edges, high-degree nodes, edge crossings without junctions, missing metadata, and destinations whose accessibility is intentionally unknown. Use `--strict` only when the project requires a warning-free report; never invent facts to silence warnings. Do not accept connectivity or XML/render success alone.

## Delivery

Deliver the app ZIP plus:

- native annotated `map.svg`;
- confirmed `walkable-mask.json`;
- canonical `route-graph.json`;
- destination datasource contract and synthetic template;
- validation report and graph overlay;
- screenshots of the default, selected route, long metadata, unreachable, step-free, and reset states.
