# Wayfinding custom apps

[Wayfinding Studio](https://wayfinding.wallboard.info) authors `.wbwayfinding` projects and publishes portable `.wbmap` packages. A custom app owns the visitor shell around that package; it does not own a second map renderer.

## Ownership boundary

| Owner | Responsibility |
|---|---|
| `.wbwayfinding` source | Venue hierarchy, authored geometry, routes, map materials, labels, imagery, cameras, presentation defaults, and localized voice guidance |
| Published `.wbmap` | Immutable visitor runtime package consumed by the app |
| Canonical viewer | Package loading, the authored 2D and 3D scenes, selection, animated authored 2D route preview, standard/step-free route resolution, complete exploded journey, camera sequence, and speech lifecycle |
| Custom-app shell | Branding, destination discovery, touch controls, detail panels, accessibility choices, datasource overlays, and kiosk session reset |
| Wallboard datasource | Optional live operational data keyed to stable published destination IDs |

The viewer is a small displayer extracted from the Wayfinding Studio Preview implementation. Its source is maintained with the renderer in the Wayfinding Editor repository and built with `npm run build:viewer`. A custom app vendors the generated browser artifact and declarations so its upload ZIP remains self-contained. Never edit that generated artifact by hand or reproduce its scene, route, camera, or speech logic in application components.

The existing wayfinding examples and standalone renderer utilities in this repository are legacy material. They are not implementation authority for new work and will be replaced by a promoted canonical example after the viewer boundary is proven. In particular, do not copy their Atlas view, per-step cards, or Next/Back journey state.

## Required visitor experience

New visitor apps use one coherent journey model:

1. Explore the authored site in its ordinary 2D map or normal 3D scene and use the directory.
2. Select a destination and reveal its authored route on the active 2D map with Preview's animation.
3. Start the complete 3D route with one visitor action.
4. Show the complete route across the site and every route-relevant floor in exploded 3D.
5. Run the route-wide camera sequence and read the trip's authored guidance in the selected language.
6. Offer **Replay** and **End route**. Replay restarts the camera and narration; it does not pretend to track physical progress.

Ordinary single-map 2D exploration remains a first-class view and must not be confused with Atlas. Do not add Atlas 2D, Next/Previous controls, per-step instruction cards, or simulated physical progress. A fixed kiosk cannot know where a visitor has walked. Reduced-motion preferences may suppress decoration, but they must not remove the essential route reveal or route-wide camera feedback.

## Viewer contract

The vendored module exposes a framework-neutral factory:

```ts
const viewer = createWayfindingViewerFromArchive(container, archive, {
	language: 'en',
	originId,
	profile: 'standard',
	onSelection,
	onStateChange,
	onUnavailable,
});
```

The returned controller owns these operations:

```ts
viewer.showSite();
viewer.setDimension('2d'); // or '3d' while exploring
viewer.previewRoute({ kind: 'destination', id: destinationId });
viewer.startJourney({ kind: 'destination', id: destinationId });
viewer.replay();
viewer.setLanguage(language);
viewer.setOrigin(originId);
viewer.setProfile('standard' | 'step-free');
viewer.speakGuidance();
viewer.stopGuidance();
viewer.resetCamera();
viewer.destroy();
```

Treat the exact declaration shipped beside the artifact as authoritative. The shell marks its map stage with `data-wayfinding-stage`; panels that projected labels must avoid use `data-wayfinding-overlay`. The shell may size and frame the stage, but it must not restyle map polygons, materials, artwork, labels, route geometry, or camera values.

Replacing the venue must normally require only a new published `.wbmap` asset and matching datasource IDs. It must not require application renderer changes.

## Spoken guidance

A package may contain one localized narration per origin-to-destination trip:

```ts
voiceGuidance?: Array<{
	destinationId: string;
	originId: string;
	text: Record<string, string>;
}>;
```

Speech is triggered by **Start 3D route** and **Replay**, uses only the visitor-selected language, and stops on mute, route end, destination change, or component teardown. The animated 2D route preview remains silent. If that language has no authored entry, remain silent. Do not synthesize directions from labels, fall back to another language, or speak automatically while browsing.

The written destination and route summary remain available because signage hardware may not expose an audio path.

## Datasource overlays

Live data is an overlay, not part of the map package. Bind a TABLE datasource containing records keyed by `destinationId`:

```ts
interface DestinationStatus {
	destinationId: string;
	status?: 'open' | 'busy' | 'closed' | 'unavailable';
	waitMinutes?: number;
	message?: string;
	updatedAt?: string;
}
```

Normalize only the documented datasource shape. Ignore unknown destination IDs. A live update may change badges, availability, waiting time, and supporting copy, but must not rebuild the WebGL scene, mutate authored map styling, or replace the published route graph. If routing availability is added later, define that as a separate explicit viewer input and test rerouting behavior.

Datasource contracts require synthetic templates and preview fixtures; see [datasource-contracts.md](datasource-contracts.md).

## Artifacts

| Artifact | Purpose | Delivery rule |
|---|---|---|
| `*.wbwayfinding` | Editable Studio source | Keep outside the app ZIP; never hand-edit a published package instead |
| `*.wbmap` | Portable visitor runtime | Package as a declared app resource |
| Viewer artifact + declarations | Canonical map runtime | Generate from the Editor source and vendor unchanged |
| Custom-app ZIP | Installable visitor experience | Contains the map and viewer runtime, never the editable source |

A v2 `.wbmap` contains the manifest, project/presentation data, graph, destinations, level artwork/scenes, and assets. Existing public schemas and loaders remain package-compatibility references, but custom-app UI code should consume the canonical viewer rather than assembling those pieces itself.

## Acceptance gates

A production wayfinding app must prove:

- the supplied `.wbmap` loads without reconstructing or overriding its visual configuration;
- site browsing, selection with animated authored 2D route reveal, complete exploded 3D route reveal, route-wide camera, replay, route end, standard and step-free profiles;
- spoken guidance starts and restarts from visitor actions and is cancelled on every lifecycle boundary;
- datasource updates change only the intended overlay without recreating the scene;
- touch and keyboard operation, focus visibility, session reset, long text, empty/invalid data, theme contrast, and no overflow at the target kiosk size;
- console cleanliness, WebGL lifecycle cleanup, modern production output, Chrome 49 output, package asset validation, and accepted visual review.

Promote a new maintained example only after these gates pass against a real authored map. The example may omit its venue asset when licensing or size makes that appropriate, but its harness must make the required package injection explicit and retain a deterministic fixture for validation.
