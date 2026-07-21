# Wayfinding Artifacts

## `wayfinding-project.json`

- Validate with `schemas/wayfinding-project.schema.json` and `npm run wayfinding:assess` before implementation.
- Record source class, presentation mode, target/fallback guidance, evidence provenance, and review method.
- `confirmed` always names a non-AI review method. Keep uncertain extraction `proposed`.
- A route-capable project declares confirmed walkable space independent from route topology.

## `map.svg`

- Root: positive stable viewBox; dimensions and internal structure follow the accepted design.
- Transforms, nested groups, raster backgrounds, and arbitrary visual layers are allowed.
- Each interactive target has a stable SVG `id`, `data-wayfinding-location-id`, and optional `data-wayfinding-level`.
- Wrap multipart hit geometry in one annotated group. Keep route nodes and edges out of the SVG.
- Keep base artwork visually useful; overlays must not wash it out.

## `route-graph.json`

Validate against `schemas/wayfinding-route-graph.schema.json`.

Omit this artifact for directory, highlight, and directional projects. Do not add a decorative straight line as a substitute.

- Nodes own coordinates, level, kind, and location mapping.
- Node coordinates use the root SVG viewBox coordinate system even when artwork is nested or transformed.
- Edges own explicit adjacency, direction, route kind, accessibility, and optional measured metres.
- Cross-floor edges use transition nodes and `stairs`, `elevator`, or `escalator` kinds.
- Location nodes are leaf entrances. Crossings, doors, stairs, elevators, and escalators use named edges rather than visual shortcuts.
- Prefer a small intentional graph over an unnecessarily dense mesh. Add a node at every real junction and bend required for route shape.

## `walkable-mask.json`

Omit this artifact when routing is not assessed. Highlight geometry belongs in `map.svg`, not in a fake walkable mask.

- Generate in the same root coordinate system as `map.svg`; bounds must match the SVG viewBox.
- Review connected traversable space against the visible source. Correct crossings, doors, false-positive background regions, and route margins explicitly.
- Color extraction can omit traversable paths obscured by labels or artwork; add reviewed semantic corrections before confirmation.
- Keep `reviewStatus: "proposed"` until a reviewer confirms the overlay. Only confirmed masks can certify generated centerlines.
- Derive centerlines from the mask, collapse junction clusters, and remove dangling branches not used by destination anchors.

## Destination `TABLE`

Minimum: `id`, `name`, `category`, `description`, `accessible`, `routeable`. Leave `accessible` empty/unknown until a source or reviewer verifies it.

Add only useful fields: `shortName`, aliases/keywords, `floor`, `hours`, `status`, `statusDetail`, image/file reference, CTA label/target, and localized values. IDs must match SVG location shapes and graph location nodes.

## Review

- Verify every routeable destination from each installed kiosk start.
- Verify standard and step-free profiles separately.
- Inspect long edges, crossings without nodes, high-degree nodes, closed routes, and floor transitions.
- Compare the visual map to the source at the real kiosk dimensions.
- Require every reviewed edge corridor to remain inside the independently confirmed walkable mask.
- Treat a graph-derived corridor envelope as regression evidence only; it cannot independently certify its source graph.
- Record uncertain OCR, entrances, route topology, and missing operational metadata as review items instead of guessing.
