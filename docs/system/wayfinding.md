# Wayfinding

Wayfinding delivery is manual-first. Customer material or AI output may provide background artwork and proposed semantics, but a reviewer authors or confirms the navigable model in Wayfinding Studio. Do not promise automatic image/PDF-to-map reconstruction.

## Product Modes

| Mode | Visitor experience | Confirmed evidence |
|------|--------------------|-------------------|
| Directory | Search, categories, details | Destination metadata |
| Highlight | Directory plus target spotlight | Metadata + target geometry |
| Directional | Target, `You are here`, facing-aware cue | Highlight + origin + orientation |
| Route | Traversable path, floors, accessibility | Directional + doors + graph + walkable space + transitions |

`highlight` is the default for uncertain customer maps. A visually connected line is never route evidence. Assess delivery capability with the embedded `delivery` record or the standalone template:

```bash
npm run wayfinding:assess -- --project wayfinding-project.json
```

## Canonical Project

`*.wbwayfinding` is the editable source of truth, validated by `schemas/wayfinding-studio-project.schema.json`.

### V1 artifact lifecycle

| Artifact | Purpose | Rule |
|----------|---------|------|
| `*.wbwayfinding` | Canonical editable Studio project | Save, archive, and hand off this file. Never use it directly in the visitor runtime. |
| `*.wbmap` | Published portable map package | Regenerate it from the `.wbwayfinding` source after every accepted map change. Never hand-edit it. |
| Custom-app upload ZIP | Installable Wallboard app containing the published `.wbmap` | Build and validate it through the normal delivery workflow. This is the only artifact uploaded as the app. |

Loose export files and reports are diagnostics only. They are not runtime inputs or customer deliverables. `examples/spatial-wayfinding` (Northline) is the field-tested v1 mechanics reference for consuming a `.wbmap`; it demonstrates the package contract, 2D/3D visitor views, details, layers, multilingual search, selection, and routing without prescribing a visual style.

| Project section | Owns |
|-----------------|------|
| `assets` | Optional floor backgrounds, symbols, brand marks, and photos used while editing |
| `floors` | Coordinate size and semantic elements per floor |
| `destinations` | Baseline public copy and data structure |
| `graph` | Reviewed nodes, edges, accessibility, closures, floor transitions |
| `delivery` | Source class, target/fallback mode, evidence provenance and review |

Semantic floor elements:

| Type | Purpose |
|------|---------|
| `location` | Room/building polygon and optional destination relation |
| `door` | Reviewed entrance/approach; a routeable location terminates here |
| `poi` | Point destination or amenity |
| `walkable` / `obstacle` | Explicit authoring geometry and review aid |
| `origin` | Installed screen position, facing degrees, default language |
| `transition` | Paired stairs/elevator/escalator connection across floors |
| `label` / `icon` / `logo` | Independent presentation layers; `icon` is semantic and theme-tintable, while `logo` preserves a brand identity |

Stable IDs are mandatory. Geometry, doors, origins, and transitions stay in the package. A destination may own translated names/descriptions, categories, status, hours, contact details, one semantic symbol, one brand mark, and multiple photos. A `poi` is a point-shaped destination rather than a second metadata model. Mutable destination content may be bound to a Wallboard `TABLE`; mutable data cannot create geometry or route eligibility.

## Wayfinding Studio

Run:

```bash
npm run wayfinding:studio
```

Workflow:

1. Create/open a `.wbwayfinding` project.
2. Add floors and optional background artwork. Backgrounds may be customer-supplied, manually redrawn, or AI-produced; they are references, not topology.
3. In **Map**, draw and describe locations, walkable areas, obstacles, doors, POIs, origins, transitions, labels, icons, and logos. Use project settings for languages, categories, presentation defaults, and route appearance.
4. In **Route edit**, build the initial centerline from reviewed pedestrian space and linked doors, then inspect or adjust individual segments. Rebuilding replaces manual route edits and requires confirmation.
5. In **Route preview**, click a route-ready destination or choose it from the directory. Rooms without a linked public entrance are labeled unavailable instead of failing with an unexplained route error.
6. Give paired cross-floor transitions the same `connectionId`; set type and accessibility from verified venue facts. Confirm imported or AI-proposed semantics only after review.
7. Studio autosaves a recovery draft in IndexedDB. **Save** writes back to the opened file when the browser grants a file handle; **Save as** creates a portable copy. **Publish map** creates the `.wbmap` consumed by a custom app and never replaces the editable project.

`npm run wayfinding:workbench` remains an alias for the same Studio.

### Host boundary

Wayfinding Studio is the complete standalone authoring product and canonical editor for `.wbwayfinding`. It owns project/file lifecycle, floors, background and reusable assets, semantic geometry, route generation and repair, validation, recovery, and `.wbmap` publishing.

Keep the model, renderer, routing, and inspector logic host-neutral. A future Wallboard custom editor may embed a constrained host for editing an existing project property through the Wallboard message bridge, but it must not duplicate the full Studio or become the only way to author maps. Embedded editing excludes project creation, arbitrary file management, migration, and bulk asset workflows unless the host gains explicit platform support.

### 3D presentation

- Edit canonical geometry in **2D edit**; inspect the same floor with orbit, zoom, and pan in **3D preview** (`2`/`3`).
- A polygon may override fill color, opacity, and normalized visual height (`0` flat, `100` tallest). Height is presentation, not a physical measurement.
- **Save as default** stores the current camera per floor. Text, icons, and logos remain independent billboard layers rather than textures baked into extruded geometry.
- The optional 3D fields do not affect route topology. Runtime export includes structured floor elements, referenced assets, and camera state so an opt-in custom app can render the same scene.

Migrate an existing reviewed-artifact set into the canonical package:

```bash
npm run wayfinding:studio:migrate-svg -- --delivery wayfinding-project.json --svg map.svg --destinations destinations.json --background map.webp --output venue.wbwayfinding
```

Imported geometry is `proposed` by default. Add `--status confirmed` only when the supplied SVG geometry has already completed human review.

Publish the portable map:

```bash
npm run wayfinding:studio:export -- --project venue.wbwayfinding --output wayfinding-runtime
```

Primary output:

```text
wayfinding-runtime/<project-name>.wbmap
```

`.wbmap` is a ZIP package with `manifest.json`, `map.json`, `routes/graph.json`, `data/destinations.json`, per-floor SVG/scene files, and binary `assets/*`. JSON files reference package paths instead of carrying data URLs. Generated SVG groups are stable: `Background`, `Walkable`, `Obstacles`, `Locations`, `Doors`, `POIs`, `Origins`, `Transitions`, `Labels`, `Icons`, `Logos`. Routes remain structured graph data, not invisible SVG geometry. The additional loose files in the output directory are diagnostics for development and are not the custom-app contract.

The custom app treats the package as visitor content:

- 2D idle state hides location fills; hover/selection reveals a readable highlight.
- 3D keeps authored extrusions visible and strengthens the selected destination.
- symbols are semantic and theme-aware; brand marks preserve their artwork; photos appear in destination details.
- directory search, language, floor, category, and optional layer controls operate on the same destination model.
- authoring geometry and editor handles never appear in the visitor runtime.

`manifest.json` records both `targetMode` and evidence-assessed `deliveryMode`. When fallback is allowed and route evidence is incomplete, export may safely downgrade to directory/highlight/directional mode; its runtime graph is intentionally empty so an app cannot accidentally render an uncertified route. Studio project parsing remains structural, so an incomplete route draft can always be reopened and corrected.

## Background Strategy

Choose per source; do not force one reconstruction method:

| Source | Recommended authoring start |
|--------|-----------------------------|
| Branded/illustrated map | Keep as background; add reviewed hit geometry; default to highlight |
| Clean floor plan/CAD/vector | Render/extract a clean reference; manually author navigation semantics |
| Photo/skewed plan | Rectify before use; never treat image segmentation as confirmed geometry |
| Isometric/3D map | Keep useful artwork; author topology in a separate floor coordinate model |
| Poor/incomplete input | Produce a manual or AI draft background, then review against venue facts |

AI image generation is optional. It may simplify artwork or propose a signage-ready background, but must not silently change room count, adjacency, doors, entrances, transitions, or proportions. If it cannot preserve those facts, use the customer reference or a manually drawn background.

## Routing Rules

- Route graph coordinates use each floor's coordinate system.
- Location nodes are leaf entrances at reviewed doors/approaches, never polygon centroids or transit shortcuts.
- Add a node at every real junction and every bend needed for route shape.
- Cross-floor pairs become explicit stairs/elevator/escalator edges; set physical distance and accessibility.
- A step-free profile excludes inaccessible edges.
- Keep stable edge IDs so live closures can disable and reroute.
- Confirmed generated centre lines require an independently reviewed walkable mask. A graph-derived mask cannot certify its own graph.
- Validate every routeable destination from every installed origin and inspect each floor segment.

The shared `WayfindingGraph` provides standard/step-free shortest paths and disabled-edge rerouting.

## AI Draft Contract

AI may create a complete `.wbwayfinding` draft using the same schema as the Studio. Every AI-created semantic element must use:

```json
{ "status": "proposed", "provenance": "ai-draft" }
```

AI responsibilities:

- preserve the original source and record uncertain interpretation;
- propose a clean background only when useful;
- keep labels, icons, and logos independent from background artwork;
- propose locations, doors, POIs, origins, transitions, walkable regions, and graph edges;
- never mark geometry, routing, orientation, or accessibility confirmed;
- open the artifact in Studio for human correction and route simulation.

The AI output is an authoring accelerator, not the accepted map.

## Runtime App Baseline

- Search/category filters and an app-owned multilingual keyboard.
- Fixed or selectable origin, pulsing `You are here`, optional confirmed facing arrow.
- Strong target highlight and detail panel/modal.
- Visitor-controlled pan/zoom; selection must not force auto-zoom.
- Floor selector and transition instructions.
- Standard/step-free routes only when assessed and validated.
- Reset, idle timeout, unreachable/closed/off-map states, privacy-safe session state.
- Dynamic destination copy/status via `TABLE`; packaged geometry remains immutable at runtime.

## Validation

For a Studio project, run schema/model tests and export. For an existing standalone SVG/graph delivery, retain the detailed validator:

```bash
npm run wayfinding:validate -- --svg map.svg --graph route-graph.json --walkable-mask walkable-mask.json --destinations destinations.json --start lobby --route-to auditorium --report-dir wayfinding-report
```

Acceptance requires:

- no duplicate/orphan IDs or missing assets;
- every routeable destination terminates at a reviewed entrance;
- paired and correctly classified cross-floor transitions;
- standard and step-free simulation from every installed origin;
- route segments contained by confirmed walkable space when that evidence is used;
- source/site review of entrances, orientation, accessibility, and representative routes;
- real-kiosk visual tests for search, keyboard, pan/zoom, floor changes, highlight, route, reset, long data, empty, and unreachable states.

## Delivery

Deliver:

- uploadable custom-app ZIP and source ZIP;
- canonical editable `.wbwayfinding` project;
- published `.wbmap` generated from that project;
- destination datasource contract and synthetic template;
- screenshots and route evidence appropriate to the assessed mode.
