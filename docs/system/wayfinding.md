# Wayfinding

Wayfinding Studio is the canonical editor for Wallboard maps. A project can publish a polished searchable map without routing; once a route network exists, publishing requires it to be safe and complete.

## Artifact lifecycle

| Artifact | Purpose | Rule |
|----------|---------|------|
| `*.wbwayfinding` | Editable Studio source | Save, archive, and hand off. Never load directly in a visitor app. |
| `*.wbmap` | Portable published map | Regenerate after every accepted project change. Never hand-edit. |
| Custom-app ZIP | Installable visitor experience containing a `.wbmap` | Build and validate through the normal delivery workflow. |

`*.wbwayfinding` uses `format: "wallboard-wayfinding-studio"` and `formatVersion: 1`. No earlier Studio format is supported. `schemas/wayfinding-studio-project.schema.json` is the file contract.

`*.wbmap` is a ZIP containing:

```text
manifest.json
map.json
routes/graph.json
data/destinations.json
floors/<floor-id>.svg
floors/<floor-id>.scene.json
assets/*
```

The manifest derives capabilities from published content:

```ts
interface WayfindingCapabilities {
  routing: boolean;
  stepFreeRouting: boolean;
}
```

No target-mode, fallback-mode, evidence ledger, migration payload, or painted-mask compatibility data belongs in the v1 contract.

## Project model

| Section | Owns |
|---------|------|
| `assets` | Floor backgrounds, symbols, brand marks, and destination photos |
| `floors` | Canvas bounds, scale, camera, and semantic map elements |
| `destinations` | Searchable visitor content, categories, translations, status, and media relations |
| `graph` | Route topology, geometry, accessibility, and generated/manual ownership |
| `defaults` | Shared visual presentation defaults |

Semantic floor elements:

| Type | Purpose |
|------|---------|
| `location` | Room or area polygon and optional destination relation |
| `door` | Public entrance associated with a location |
| `poi` | Point-shaped destination or amenity |
| `walkable` | Reviewed pedestrian space used by route generation and validation |
| `obstacle` | Non-traversable region inside pedestrian space |
| `origin` | Installed screen position, facing, and default language |
| `transition` | Paired stairs, elevator, or escalator connection |
| `label` | Independent presentation text |
| `icon` | Semantic, theme-aware symbol |
| `logo` | Brand artwork whose native colors are preserved |

Stable IDs are mandatory. Geometry and editor state are separate: saved projects contain authored content, not selection, hover, open panels, preview journeys, or diagnostic-layer state.

## Studio architecture

The application is organized by product capability, not by generic component type:

| Module | Owns |
|--------|------|
| `features/map` | Map workspace composition and object browser |
| `features/routing` | Route workflow, readiness, geometry diagnostics, journey model, and network inspectors |
| `features/directory` | Destination content, languages, and categories |
| `features/assets` | Reusable media and image decoding |
| `features/appearance` | Project presentation controls |
| `features/preview` | Ephemeral simulation session, directory, destination detail, and shared presentation scene |
| `features/publishing` | Runtime validation and `.wbmap` publication |
| `canvas` | Camera, rendering, hit testing, authoring, keyboard, drag, and pointer interaction controllers |
| `editor-core` | Persistent document commands, history, selection-independent state, graph synchronization, and route generation |

Feature barrels are the public application boundary. Canvas interaction controllers stay independent from rendering so hit testing, gestures, and authored transactions can evolve without turning the stage component into a second state store.

## Studio workflow

Run:

```bash
npm run wayfinding:studio
```

1. Create a project and add floors.
2. Upload optional floor artwork. The image is a visual reference, not topology.
3. In **Map**, author locations, pedestrian space, obstacles, doors, POIs, origins, transitions, labels, icons, and logos.
4. In **Route edit**, build a network from reviewed vector pedestrian space and linked doors.
5. Inspect the proposed build diff before replacing generated topology. Manual nodes and edges are preserved.
6. Use **Preview** to test the same presentation scene and journey model consumed by the published runtime.
7. Save the editable project and publish a `.wbmap`.

The editor autosaves a recovery draft. File-handle saving and portable **Save as** remain separate, explicit actions.

## Routing contract

Route generation is a staged transformation:

1. normalize vector pedestrian space;
2. subtract obstacles and apply clearance;
3. extract corridor/open-area centerlines;
4. build deterministic topology;
5. connect origins, transitions, POIs, and valid public entrances;
6. prune non-semantic branches without destroying required connectivity;
7. simplify only when every replacement segment remains valid;
8. score, diagnose, and validate the result;
9. present a build diff before replacement.

Rules:

- Location nodes terminate at a valid linked door, never at an arbitrary polygon centroid.
- Door candidates must align with the location boundary and connect to pedestrian space.
- A route segment must not cross a location, obstacle, wall, or unauthorised region.
- Logical path geometry stays independent from rounded visual presentation.
- Generated topology has explicit `authoringOwnership: "generated"`.
- Hand-authored corrections have explicit `authoringOwnership: "manual"` and survive rebuilds.
- Cross-floor transitions share a `connectionId`; accessibility is explicit.
- Step-free routing excludes inaccessible edges.
- Distance and walking time appear only when `unitsPerMeter` is calibrated.
- A route network with any edge must connect every routeable destination from every origin before publishing.
- A project with no graph edges remains a valid searchable map without turn-by-turn directions.

The shared `WayfindingGraph` owns standard/step-free shortest paths and disabled-edge rerouting.

## Preview and published presentation

Editor Preview and the visitor runtime consume the same presentation-scene model:

- 2D semantic rooms, walkable space, obstacles, doors, POIs, origins, transitions, labels, symbols, and routes;
- 3D extrusions, authored camera, billboard labels/media, and destination emphasis;
- one ephemeral preview session for origin, destination, profile, language, filters, active journey, and diagnostic layers;
- adaptive map-first directory and destination details;
- actionable unreachable states with stale guidance cleared immediately.

The 3D switch is shown only when the active project passes geometry, camera, contrast, label, and performance readiness.

## Assets

- Backgrounds preserve source artwork.
- Symbols are semantic and may adapt to theme.
- Logos preserve brand identity.
- Photos belong to destination details unless explicitly placed as map media.
- Map media uses center-based placement, scale, and rotation.
- File inputs are hidden behind accessible upload controls with validation, preview, metadata, replace, and remove actions.

## AI-assisted authoring

AI may propose a project using the exact v1 schema. AI-created semantic elements use:

```json
{ "status": "proposed", "provenance": "ai-draft" }
```

AI may propose geometry but must not silently assert entrances, orientation, accessibility, or route correctness. Human review occurs in Studio.

## Validation

Run:

```bash
npm run test:wayfinding
npm run test:wayfinding-studio
```

Acceptance requires:

- schema-valid v1 project and published package;
- no duplicate/orphan IDs or missing assets;
- valid destination, entrance, floor, and media relations;
- standard and step-free route simulation from every origin;
- deterministic complex-fixture coverage for branches, loops, obstacles, narrow corridors, disconnected space, multiple doors, cross-floor transitions, and manual corrections;
- no route segment crossing prohibited geometry;
- browser workflow tests for build confirmation, diagnostics, preview, save/open, and publish;
- visual inspection at the supported editor and signage viewport matrix;
- no overlap, clipping, invisible controls, focus failures, console errors, or stale preview state.

`examples/spatial-wayfinding` is the maintained mechanics reference for consuming a `.wbmap`; it demonstrates the package contract without prescribing a visual style.
