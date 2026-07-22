# Wayfinding

Generate the strongest guidance justified by available evidence. Every project needs an interactive visual map and editable destination data; walkable space and a route graph are optional artifacts used only when routing is independently certifiable. A plausible line, connected graph, or structurally valid SVG is not proof of usable routing.

## Guidance Decision

Copy `templates/wayfinding-project.json`, record only known/reviewed facts, validate it against `schemas/wayfinding-project.schema.json`, then run:

```bash
npm run wayfinding:assess -- --project wayfinding-project.json
```

`redrawn-equivalent` additionally requires `source.referenceContract` and `source.fidelityReview`. The assessment validates their schemas, source/candidate hashes, one comparison per level, every frozen invariant, reviewer independence, and zero unresolved findings. This prevents an internally consistent but spatially unrelated redraw from passing route checks.

| Mode | Visitor experience | Required confirmed evidence |
|------|--------------------|-----------------------------|
| Directory | Search, categories, destination details | Destination metadata |
| Highlight | Directory plus strong target spotlight while preserving the visitor's map context | Metadata + destination anchors |
| Directional | Highlight target and `You are here`; show relative direction without implying a walkable path | Highlight + current-location anchors + orientation |
| Route | Draw a traversable path from the installed kiosk/start | Metadata, destination/current anchors, entrance approaches, graph topology, independent walkable space; transitions for multi-level maps |

If the target mode is not certified, deliver the highest allowed fallback only when `allowFallback` is explicit. Never represent a straight line, arrow, or animated trail as a walking route. A strong highlight experience is a valid product mode, not a failed route.

Confirmed evidence requires a named review method. AI inference and image segmentation remain `proposed` until overlay, source-authority, field, or customer review. Confirmed walkable space must declare independence from route topology; a graph-derived corridor envelope cannot certify the graph.

## Source Decision

| Mode | Use when | Output |
|------|----------|--------|
| Source overlay (classic) | Supplied map is branded, detailed, or expensive to redraw; highlight is the primary job | Original raster/PDF render under vector hit areas; route overlay only when separately certified |
| Redrawn equivalent (route-first) | A print-oriented source obscures corridors, crossings, entrances, or touch targets | Standardized signage map with explicit walkable geometry, entrances, zones, landmarks, and interactive layers |
| Schematic | Distance readability and simple navigation matter more than exact geometry | Simplified vector landmarks, corridors, zones, and labels |
| Calibrated isometric | Supplied 3D artwork is valuable but is not a route coordinate plane | Separate 2D topology projected into the visual layer after calibration |

Do not inpaint source labels/icons by default. Remove them only when they must become dynamic, localized, themeable, or independently interactive.

`equivalentRedrawAllowed` means the supplied image is a semantic reference, not a mandatory rendering. Prefer a clean equivalent or schematic map when it improves legibility, localization, maintainability, or spatial clarity. Preserve authoritative geometry and customer identity; do not preserve raster defects merely for pixel fidelity.

Print maps are normally highlight sources, not route models. For route-first delivery, redraw into a standardized 2D signage profile while carrying forward the accepted brand, landmark language, and authoritative spatial relationships. Preserve measured proportions within a project-defined tolerance; target at most 1% deviation only when the source itself provides survey-grade geometry. If it does not, record the uncertainty instead of claiming false precision.

The redraw must expose walkable corridors, legal crossings, doors, stairs, elevators, level transitions, destination entrances, and current-position orientation as separate reviewable semantics. The original remains a comparison reference. A future 3D or isometric presentation should consume the same canonical 2D topology and a calibrated visual projection; never route directly in perspective screen coordinates.

## Ownership

| Artifact | Owns | Must not own |
|----------|------|--------------|
| `map.svg` | Base artwork, location hit areas, level geometry, stable IDs | Mutable public copy, live status, route nodes or inferred topology |
| `walkable-mask.json` | Independently reviewed traversable space in map coordinates | Route topology, destination copy, or inferred accessibility |
| `route-graph.json` | Nodes, explicit edges, floor transitions, accessibility, optional measured distances | Destination descriptions or presentation |
| destination `TABLE` | Name, aliases, description, category, floor, hours, image, status, accessibility, keywords, CTA | SVG geometry or graph edges |
| `wayfinding-project.json` | Source class, presentation strategy, target/fallback mode, evidence status and review provenance | Geometry, destination copy, or unreviewed claims |

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
- Connect every route-eligible location graph node at its entrance. Destinations without reviewed geometry remain listed-only; the editable TABLE cannot grant route eligibility.
- Keep location nodes as leaf entrances; a route through an unrelated destination is a topology defect.
- Represent crossings, doors, stairs, elevators, and escalators as named edges. Do not replace them with a visual shortcut.
- Model cross-floor edges as `stairs`, `elevator`, or `escalator`; set accessibility per edge.
- Keep stable edge IDs so live closures and external commands can disable edges and reroute.
- Prefer authored `distanceMeters`; otherwise calibrate `mapRatio` and label distances approximate.

The shared `WayfindingGraph` supports standard and step-free shortest paths plus disabled edges.

## Image/PDF Extraction

Before implementation, normalize the accepted source into stable per-level renders and write `source-understanding.json`. Describe the source before seeing the candidate: exterior footprint, asymmetric projections, voids, public circulation, entrances, route-relevant doors, stairs/elevators/escalators, destination adjacency, orientation, allowed simplifications, and unknown facts. Hash the original files and normalized renders. This description is the visual-semantic oracle used alongside the original image during independent review; it is not a substitute for looking at the source.

| Input | Extraction path | Required restraint |
|-------|-----------------|--------------------|
| Vector PDF/CAD/BIM/GIS | Preserve page coordinates; extract paths/text where useful; render stable comparison images | Do not flatten authoritative geometry into a guessed schematic merely because extraction is inconvenient |
| Raster/scan/photo | Correct crop/perspective, retain the untouched original, then propose walls/walkable areas with OCR/CV or manual tracing | Segmentation and OCR stay proposed until reviewed over the original; ask for scale, hidden connections, and inaccessible areas |
| Mixed/annotated source | Separate base geometry from customer markup and document which layer wins for each fact | Markup may change program labels without silently moving walls, doors, or transitions. Freehand outlines are semantic ownership evidence, not paths to trace; redraw clean geometry from the architectural source and mark unsupported extents provisional |

The display map may use a compact source-derived wall raster under semantic SVG zones when a full vector export is too large. The root coordinate system must still map explicitly to the normalized source, and the wall extraction must be reviewed as a candidate, not promoted because it was generated deterministically.

Clean a wall raster by removing furniture, labels, hatch, and isolated extraction noise while retaining the footprint, structural walls, public openings, stairs, elevators, voids, and route-relevant doors. If renovation markup is newer than the architectural plan, show its program zones as provisional overlays and keep them out of collision and routing geometry until a current plan or field survey confirms the partitions.

For an existing SVG, audit it before trusting or migrating any embedded points:

```bash
npm run wayfinding:audit-source -- --svg legacy-map.svg --report-dir wayfinding-source-audit
```

The audit reports duplicate IDs and executable content, migrates location geometry to native annotations, and exports proposed legacy location anchors. Legacy route-point clouds are evidence only: the audit never infers graph edges.

Classify the source before extraction:

| Source class | Typical first delivery | Route path |
|--------------|------------------------|------------|
| Clean 2D floor plan or mall directory | Highlight or reviewed route | Trace corridors, entrances, doors, and transitions |
| Illustrated tourist/campus map | Highlight or directional | Route only after a separate street/path model is confirmed; artwork colors are not topology |
| 3D/isometric directory | Highlight | Build a separate 2D topology and calibrate projection before any route overlay |
| CAD/BIM/GIS/vector network | Route candidate | Import authoritative geometry, then review entrances, restrictions, levels, and accessibility |
| Poor scan/photo or incomplete source | Redrawn equivalent highlight | Ask for missing spatial facts; do not infer a certified path from decoration |

Use `npm run wayfinding:workbench` after rendering the accepted PDF/image to a stable map image or after auditing an existing SVG. Load or complete `wayfinding-project.json` first: the assessment panel must show the permitted delivery mode before app behavior is chosen.

1. AI/OCR proposes destination IDs and metadata; never treat OCR as confirmed copy.
2. Sample representative walkable colors, extract the connected mask, then paint include/exclude corrections over crossings, doors, and false positives.
3. For route candidates, place each destination graph anchor at its reviewed entrance or walkable approach. Moving an anchor invalidates every connected edge review.
4. Draw explicit edges along visible corridors, or generate centerline proposals from the mask. Add bends where the source changes direction; classify traversal, direction, accessibility, and corridor width.
5. Review the source overlay, confirm the independent mask, then inspect and confirm each contained edge individually. There is no bulk topology confirmation.
6. Export mask, graph, and destination TABLE separately; validate the exported files before app integration.

Mask extraction and skeletons may propose topology but never certify it. Color extraction can miss valid paths hidden by labels, buildings, crossings, or other artwork; complete those semantics during overlay review. Indoor, outdoor, and mixed maps require different walkability semantics; entrances, junctions, edges, and accessibility remain reviewer decisions.

For a hand-authored graph, a graph-derived corridor envelope is useful only as a regression check. It is not an independent walkable mask and cannot certify the same graph that generated it; review every representative route over the source map.

Visual review by the same model that proposed a route is diagnostic, not independent evidence. Automated image checks may reject obvious crossings and mask violations, but must not promote uncertain raster inference to `confirmed`.

For a redrawn equivalent, prepare `source-fidelity-review.json` from the template only after candidate screenshots exist. A different AI context, human reviewer, or customer must compare every level against the source render and every invariant in `source-understanding.json`. Passing graph/mask tests, render tests, or the normal app visual review does not satisfy this source-fidelity gate.

## Metadata Updates

| Change | Workflow |
|--------|----------|
| Name, translation, description, category, hours, image, status, keywords, CTA | Quick-edit the destination TABLE; no geometry rebuild |
| Destination visibility/listing | Edit TABLE; this cannot create map or route geometry |
| Stable ID, map hit area, entrance/approach point, route eligibility, walkable space, floor, transition, closure topology | Reopen workbench, review/export geometry, rerun assessment and validation |

The workbench destination editor highlights the selected graph anchor, reports its graph relationship as read-only, and exports the native TABLE shape. It never rewrites map artwork or grants route eligibility from mutable public copy.

## Product Baseline

- Search, category filters, aliases, app-owned multilingual keyboard.
- Fixed or selectable "you are here", venue-confirmed facing direction, route reset, idle timeout, privacy-safe session state.
- Destination detail panel/modal with description, image, hours, accessibility, live status, and optional CTA.
- Pan/zoom, floor switch, transition indicators, legend, standard/step-free route modes.
- Dynamic closures, off-map state, unreachable state, and designed empty/loading failures.
- Optional sensor events and external commands for search, selection, route, reset, start, and target.
- Near-view touch targets and complete essential directions; do not sacrifice legibility to fit more destinations.
- Keep the current-position marker visible and pulsing at rest; add a facing arrow only after venue orientation is confirmed.
- Highlight mode dims unselected regions, preserves the current viewport, pulses the target, fits `You are here` and the destination together, and shows a readable callout. Selecting a destination must not auto-pan or auto-zoom; movement is visitor-controlled.
- Directional mode uses relative orientation and semantic cues such as floor, zone, or wing. Show distance only when calibrated; do not draw a line that resembles a verified walking route.

## Authoring And QA

The AI may propose visuals and extract OCR metadata, but ambiguous names, entrances, and corridor topology require an explicit review item. Never invent missing operational facts.

```bash
npm run wayfinding:validate -- --svg map.svg --graph route-graph.json --walkable-mask walkable-mask.json --destinations destinations.json --start lobby --route-to auditorium --report-dir wayfinding-report
```

The report must show zero errors. Inspect `wayfinding-debug.svg` and representative routes at actual kiosk size and multiple zoom centres. Cover every entrance side plus each crossing and transition class. Review warnings for backtracking, detours, long edges, high-degree nodes, edge crossings without junctions, missing metadata, and destinations whose accessibility is intentionally unknown. Use `--strict` only when the project requires a warning-free report; never invent facts to silence warnings. Do not accept connectivity or XML/render success alone.

## Delivery

Deliver the app ZIP plus:

- assessed `wayfinding-project.json`;
- frozen `source-understanding.json` and independently completed `source-fidelity-review.json` for every redrawn equivalent;
- native annotated `map.svg`;
- destination datasource contract and synthetic template;
- screenshots of default, highlighted destination, long metadata, empty, and reset states.

Route projects also deliver confirmed `walkable-mask.json`, canonical `route-graph.json`, validation report, graph overlay, and selected/unreachable/step-free evidence that applies.
