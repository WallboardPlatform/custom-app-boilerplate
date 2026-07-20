# Wayfinding Artifacts

## `map.svg`

- Root: positive stable viewBox; dimensions and internal structure follow the accepted design.
- Transforms, nested groups, raster backgrounds, and arbitrary visual layers are allowed.
- Each interactive target has a stable SVG `id`, `data-wayfinding-location-id`, and optional `data-wayfinding-level`.
- Wrap multipart hit geometry in one annotated group. Keep route nodes and edges out of the SVG.
- Keep base artwork visually useful; overlays must not wash it out.

## `route-graph.json`

Validate against `schemas/wayfinding-route-graph.schema.json`.

- Nodes own coordinates, level, kind, and location mapping.
- Node coordinates use the root SVG viewBox coordinate system even when artwork is nested or transformed.
- Edges own explicit adjacency, direction, route kind, accessibility, and optional measured metres.
- Cross-floor edges use transition nodes and `stairs`, `elevator`, or `escalator` kinds.
- Prefer a small intentional graph over an unnecessarily dense mesh. Add a node at every real junction and bend required for route shape.

## Destination `TABLE`

Minimum: `id`, `name`, `category`, `description`, `accessible`, `routeable`. Leave `accessible` empty/unknown until a source or reviewer verifies it.

Add only useful fields: `shortName`, aliases/keywords, `floor`, `hours`, `status`, `statusDetail`, image/file reference, CTA label/target, and localized values. IDs must match SVG location shapes and graph location nodes.

## Review

- Verify every routeable destination from each installed kiosk start.
- Verify standard and step-free profiles separately.
- Inspect long edges, crossings without nodes, high-degree nodes, closed routes, and floor transitions.
- Compare the visual map to the source at the real kiosk dimensions.
- Record uncertain OCR, entrances, route topology, and missing operational metadata as review items instead of guessing.
