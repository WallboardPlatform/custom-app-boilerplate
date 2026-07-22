# AI Draft Contract

AI output is a `.wbwayfinding` proposal for correction in Wayfinding Studio.

1. Preserve the supplied source; do not overwrite or crop away evidence.
2. Record each floor and optional background asset.
3. Propose semantic locations, doors, POIs, walkable areas, obstacles, origins, transitions, labels, icons, logos, and graph edges only when visible or explicitly described.
4. Set every generated semantic element to `status: proposed`, `provenance: ai-draft`.
5. Keep unknown doors, orientation, accessibility, transition pairing, and route restrictions absent or visibly unresolved.
6. Keep mutable public copy in `destinations`; use synthetic values for examples.
7. Validate schema and open in Studio. Never self-promote proposed elements to confirmed.

Background generation may simplify visual noise, but must preserve room/building count, adjacency, entrance sides, transitions, and recognizable proportions. When that cannot be demonstrated, retain the source as background and author only the overlay.
