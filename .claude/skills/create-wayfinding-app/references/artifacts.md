# Wayfinding Artifacts

## `map.svg`

- Root: minimum 1240x720, stable viewBox, no transforms.
- Root groups: `Base`, then one or more level groups.
- Each level contains, in order: `TransitionPoints`, `LocationPoints`, `RoutePoints`, `Icons`, `Legends`, `Locations`, `Walls`.
- Location shapes use stable IDs. Point circles use globally unique IDs and `data-location-id` for location nodes.
- Keep base artwork visually useful; overlays must not wash it out.

## `route-graph.json`

Validate against `schemas/wayfinding-route-graph.schema.json`.

- Nodes own coordinates, level, kind, and location mapping.
- Edges own explicit adjacency, direction, route kind, accessibility, and optional measured metres.
- Cross-floor edges use transition nodes and `stairs`, `elevator`, or `escalator` kinds.
- Prefer a small intentional graph over dense proximity meshes. Add a node at every real junction and bend required for route shape.

## Destination `TABLE`

Minimum: `id`, `name`, `category`, `description`, `accessible`, `routeable`.

Add only useful fields: `shortName`, aliases/keywords, `floor`, `hours`, `status`, `statusDetail`, image/file reference, CTA label/target, and localized values. IDs must match SVG location shapes and graph location nodes.

## Review

- Verify every routeable destination from each installed kiosk start.
- Verify standard and step-free profiles separately.
- Inspect long edges, crossings without nodes, high-degree nodes, closed routes, and floor transitions.
- Compare the visual map to the source at the real kiosk dimensions.
- Record uncertain OCR, entrances, route topology, and missing operational metadata as review items instead of guessing.
