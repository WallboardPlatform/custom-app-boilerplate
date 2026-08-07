# Wayfinding

[Wayfinding Studio](https://wayfinding.wallboard.info) authors and publishes portable venue maps. A project represents one site containing outdoor space, multiple buildings, independently aligned building levels, and optional standalone maps. Visitor apps consume only published `.wbmap` packages.

## Public compatibility contract

This repository is self-contained: the following files are sufficient to build and validate a Wayfinding custom app.

| Public source | Contract |
|---------------|----------|
| `schemas/wayfinding-studio-project.schema.json` | Editable v2 `.wbwayfinding` project |
| `schemas/wayfinding-route-graph.schema.json` | Stable graph nodes, edges, geometry, accessibility, and traversal |
| `src/utils/wayfinding-contract.ts` | Typed v2 authoring hierarchy and connector model |
| `src/utils/wayfinding.ts` | Graph types and standard/step-free pathfinding |
| `src/utils/wayfinding-presentation.ts` | Runtime presentation scene and collision-aware labels |
| `src/utils/wayfinding-guidance.ts` | Per-level guidance and transition instructions |
| `examples/spatial-wayfinding/overlay/src/interfaces/spatial-wayfinding.interface.ts` | Published runtime types |
| `examples/spatial-wayfinding/overlay/src/utils/wayfinding-map-package.ts` | v1/v2 `.wbmap` loader and normalization |
| `examples/spatial-wayfinding` | Complete 2D/3D consumer reference |

Any package-contract change must update the schema, types, loader, documentation, tests, and reference rendering in the same release cycle.

## Artifacts and compatibility

| Artifact | Purpose | Compatibility |
|----------|---------|---------------|
| `*.wbwayfinding` | Editable Studio source | New saves use `formatVersion: 2` |
| `*.wbmap` | Portable visitor runtime | Loader accepts v1 and v2; new publishing emits v2 |
| Custom-app ZIP | Installable visitor experience | Contains a published `.wbmap`, never editable source |

Opening a v1 editable project runs a one-way import: every old floor becomes a `standalone` level, existing transitions become connectors, and IDs, assets, destinations, graph geometry, cameras, and authored geometry remain intact. No building hierarchy is invented. The imported document requires **Save As**, so the original v1 file is not overwritten.

The runtime loader normalizes both package versions to `wallboard-wayfinding-runtime` v2. A v1 package becomes a set of standalone levels with no buildings or centralized connectors.

A v2 `.wbmap` is a ZIP containing:

```text
manifest.json
map.json
routes/graph.json
data/destinations.json
levels/<level-id>.svg
levels/<level-id>.scene.json
assets/*
```

The manifest derives capabilities from published content:

```ts
interface WayfindingCapabilities {
	routing: boolean;
	stepFreeRouting: boolean;
}
```

## Site, buildings, and levels

The v2 hierarchy is `Site → Buildings → Levels`.

| Model | Owns |
|-------|------|
| `siteLevelId` | Optional outdoor/campus level used as the conventional default visitor view |
| `buildings[]` | Visitor information, footprint relation, height, default level, entrances, and external-route preference |
| `levels[]` | Canvas, artwork, semantic elements, scale, camera, elevation, and optional site alignment |
| `connectors[]` | Logical entrances and vertical movement with positioned endpoints |
| `destinations[]` | Globally searchable building/floor content, categories, translations, status, and media |
| `graph` | Stable route topology; all graph nodes reference `levelId` |
| `presentation` | Building tap behavior and enabled combined overview modes |

Level roles:

- `site`: outdoor/campus map;
- `building-floor`: belongs to one building and has numeric level, elevation, and site alignment;
- `standalone`: valid unassigned or migrated map.

Each site building has a semantic `building` polygon linked by `footprintElementId`. It is the authoritative footprint for selection, hit testing, 3D massing, and interior entry. A building may remain a valid searchable/routable destination without indoor levels; routing then ends at its preferred or nearest external entrance.

Level alignment maps unrelated source coordinates onto the site:

```ts
interface WayfindingAlignment {
	siteLevelId: string;
	x: number;
	y: number;
	rotationDegrees: number;
	scale: number;
}
```

`elevationMeters` controls vertical placement independently of ordering. Combined views require complete, valid alignment for every displayed building floor.

## Semantic elements and connectors

Level elements include `building`, `location`, `door`, `poi`, `walkable`, `obstacle`, `origin`, `label`, `icon`, and `logo`. Imported standalone maps may retain legacy `transition` elements; new multi-level authoring uses `connectors[]`.

Connector kinds are `entrance`, `elevator`, `stairs`, `escalator`, and `ramp`.

- An entrance pairs a site endpoint with an interior endpoint.
- A vertical connector may span two or more levels of the same building.
- `accessible` belongs to the connector and participates in step-free routing.
- Entrance endpoints compile to graph `portal` edges.
- Vertical endpoints compile to graph `transition` edges.
- Logical route geometry remains separate per level while the journey remains continuous.

Connector endpoint IDs are stable. Cross-building vertical connectors, duplicate endpoints, missing levels, unpaired entrances, and invalid endpoint roles are contract errors.

## Authoring workflow

1. Create or assign the site level.
2. Draw/detect a building footprint and add visitor-facing information.
3. Add building floors or assign existing standalone levels.
4. Align each floor against the site with direct manipulation or numeric position, rotation, scale, and elevation controls.
5. Pair exterior/interior entrances, then add elevators, stairs, escalators, and ramps.
6. Author walkable space, obstacles, destinations, installed origins, and route topology on each active level.
7. Validate standard and step-free journeys in Preview.
8. Save the editable source and publish a v2 `.wbmap`.

Alignment is an isolated overlay workflow with adjacent-level ghosts, snapping, reset, and validation. Ordinary map editing affects only the active level. Editor-only state such as selection, panel layout, preview journey, diagnostics, and hover is never persisted in the project contract.

## Routing contract

Routing produces one journey across outdoor paths, selected entrances, internal corridors, and vertical connectors. Entrance selection considers total path cost, visitor profile, connector availability, and destination level.

Rules:

- Route generation derives topology only from reviewed vector walkable space and obstacles; source artwork is never treated as trusted topology.
- Location nodes terminate at linked public doors, never arbitrary polygon centroids.
- Segments must not cross locations, obstacles, walls, or unauthorized regions.
- Step-free routing rejects inaccessible entrances, stairs, and escalators.
- Generated topology uses `authoringOwnership: "generated"`; manual corrections use `"manual"` and survive rebuilds.
- Disabled edges and unavailable connectors participate in rerouting without changing the selected destination.
- Distance and walking time appear only when every route level has calibrated `unitsPerMeter`.
- A graph with edges must reach every routeable destination from every installed origin before publishing.
- A project without graph edges remains a valid searchable map without turn-by-turn guidance.

Instructions explicitly name the building, entrance or vertical connector, and target level. A fixed display cannot infer physical visitor progress, so progression between site, entrance, floor, and transition segments is visitor-controlled.

## Visitor presentation

The default view is the conventional 2D site map. Global search returns buildings and interior destinations grouped by building without requiring the visitor to enter first.

Building tap behavior is authored per project:

- `focus-actions` (default): one tap focuses the building and opens a touch-friendly card with **Explore inside** and **Directions**;
- `enter-immediately`: one tap opens the configured default level.

No visitor action depends on double-click. Building cards may show levels, destinations, accessibility, description, imagery, and whether an interior map is available.

Optional combined modes are independently enabled and quality-gated:

- `atlas-2d`: site plus only floors relevant to the selected building or active journey;
- `exploded-3d`: aligned building masses on the site, selected/route-relevant floor stacks, ghosted inactive floors, and emphasized active route segments.

The guided journey provides large **Next**, **Back**, **Overview**, and **Replay** controls. Switching between overview, building, and level scenes preserves the selected journey and saved camera state. Motion uses reduced-motion fallbacks.

### Spoken guidance

A published map may carry `voiceGuidance`: an entry per origin-to-destination trip, each holding the spoken directions keyed by language code.

```ts
voiceGuidance?: Array<{ destinationId: string; originId: string; text: Record<string, string> }>;
```

Consumer rules:

- Speak the entry for the visitor's chosen language. When that language has no entry, stay **silent** — do not substitute another language, because directions read in a language the visitor did not choose are worse than none.
- The field is optional and absent on packages published before it existed, so a consumer must work without it.
- Speech is visitor-triggered, never automatic. A signage device may have no audio path, so the written journey remains the primary surface and audio is an addition.

## Presentation assets

- Backgrounds preserve source artwork.
- Symbols are semantic and may adapt to theme.
- Logos preserve native brand colors.
- Photos belong to visitor details unless explicitly placed as map media.
- Map media uses center-based placement, scale, and rotation.
- A custom You are here image uses an asset with `kind: "marker"` referenced by `defaults.origin.markerAssetId`.
- The custom marker replaces the complete default artwork in 2D and 3D; consumers must not composite the old pin or center dot behind it.
- `defaults.origin.markerSize2d` (20–96 map units) and `markerSize3d` (28–120 map units) control independent maximum sides while preserving aspect ratio.
- The 3D marker remains upright and camera-facing; a separate ground/pulse beacon may remain visible.

## Validation and acceptance

Publishing rejects or clearly reports:

- missing or overlapping building footprints;
- floors assigned to missing buildings;
- unaligned building floors required by enabled combined views;
- missing, unpaired, or cross-building connector endpoints;
- buildings without routeable entrances;
- accessible destinations without an accessible building journey;
- invalid floor order/elevation and disconnected route segments;
- orphan IDs, missing assets, and invalid destination/geometry relations.

The maintained multi-building fixture is available as:

- editable source: `examples/spatial-wayfinding/source/multi-building-campus.wbwayfinding`;
- published package: `examples/spatial-wayfinding/overlay/src/assets/multi-building-campus.wbmap`.

It contains three buildings, three- and two-floor interiors, an unmapped building, multiple entrances, elevator, stairs, escalator, ramp, rotated/scaled floor sources, outdoor obstacles, and non-trivial routes.

Acceptance covers same-building, different-building, outdoor-to-indoor, indoor-to-outdoor, multi-floor, step-free, alternate-entrance, unmapped-building, disconnected, and unavailable-connector journeys. It also requires schema/package round trips, v1 loader compatibility, touch and keyboard operation, reduced motion, label collision, clipping, editor/runtime scene parity, performance, console cleanliness, modern builds, and Chrome 49 validation.

`examples/spatial-wayfinding` demonstrates the public mechanics without prescribing a visual style.
