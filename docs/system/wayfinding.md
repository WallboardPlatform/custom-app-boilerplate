# Wayfinding

Generate wayfinding as a visual map, explicit route graph, and editable destination table. A structurally valid SVG is not proof of usable routing.

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
| `map.svg` | Base artwork, location hit areas, level geometry, stable IDs, legacy point groups | Mutable public copy, live status, inferred topology |
| `route-graph.json` | Nodes, explicit edges, floor transitions, accessibility, optional measured distances | Destination descriptions or presentation |
| destination `TABLE` | Name, aliases, description, category, floor, hours, image, status, accessibility, keywords, CTA | SVG geometry or graph edges |

Location points represent walkable entrances/approach points, not polygon centroids. Keep `locationId` explicit in graph nodes and `data-location-id` on generated SVG circles. Plain SVG `label` remains a legacy fallback; the table is authoritative when present.

## SVG Contract

Follow the [Wallboard SVG map structure](https://docs.wallboard.us/docs/content-editing/widgets/custom-apps/map/map_svg_creation/): `Base`, then each level with these direct groups in order:

1. `TransitionPoints`
2. `LocationPoints`
3. `RoutePoints`
4. `Icons`
5. `Legends`
6. `Locations`
7. `Walls`

Use globally unique IDs, a minimum 1240x720 coordinate space, and no `transform` attributes. Create polygons only for interactive destinations/zones required by the accepted use case.

## Routing

- New generated maps require explicit graph edges. Global proximity inference is legacy compatibility only.
- Sample centerlines into nodes only as needed for route shape; topology comes from edges, not point density.
- Connect every routeable location at its entrance. Mark off-map/non-routeable destinations explicitly.
- Model cross-floor edges as `stairs`, `elevator`, or `escalator`; set accessibility per edge.
- Keep stable edge IDs so live closures and external commands can disable edges and reroute.
- Prefer authored `distanceMeters`; otherwise calibrate `mapRatio` and label distances approximate.

The shared `WayfindingGraph` supports standard and step-free shortest paths plus disabled edges. `createLegacyProximityGraph` exists only for existing point-only maps.

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
npm run wayfinding:sync-svg -- --svg authoring-map.svg --graph route-graph.json --out map.svg
npm run wayfinding:validate -- --svg map.svg --graph route-graph.json --destinations destinations.json --start lobby --route-to auditorium --report-dir wayfinding-report --strict
```

The report must show zero errors. Inspect `wayfinding-debug.svg` and representative routes at actual kiosk size. Review warnings for long edges, high-degree nodes, edge crossings without junctions, missing metadata, and inaccessible destinations without a step-free route. Do not accept a map from XML/render success alone.

For legacy audits, replace `--graph` with `--legacy-sensitivity <px>`. Use the installed app sensitivity when known; otherwise compare candidate values only to expose failure modes. Never tune sensitivity merely until all destinations become reachable: a denser shortcut mesh is not safer topology. Legacy audits leave step-free coverage unknown and always fail `--strict`, so they cannot certify delivery. A real kiosk start is required for certification; do not silently choose one.

## Delivery

Deliver the app ZIP plus:

- synchronized `map.svg`;
- canonical `route-graph.json`;
- destination datasource contract and synthetic template;
- validation report and graph overlay;
- screenshots of the default, selected route, long metadata, unreachable, step-free, and reset states.
