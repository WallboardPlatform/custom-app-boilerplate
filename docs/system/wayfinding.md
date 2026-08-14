# Wayfinding Custom Apps

Wayfinding Studio owns map authoring, publishing, and the canonical visitor renderer. A custom app owns the surrounding kiosk experience. Do not rebuild map rendering, route animation, camera behavior, or speech inside an app.

## Artifact boundaries

| Artifact | Owner | Purpose |
|----------|-------|---------|
| `.wbwayfinding` | Wayfinding Studio | Editable project source; keep outside the upload package unless a delivery explicitly requests it |
| `.wbmap` | Wayfinding Studio | Published runtime package with authored geometry, presentation, routes, origins, and voice guidance |
| Wayfinding viewer artifact | Wayfinding Studio | Versioned mini-displayer: JavaScript, declarations, and checksum manifest |
| `wayfinding` capability | This repository | Checksum-pinned viewer plus map-agnostic lifecycle harness |
| Custom-app ZIP | Generated app | Kiosk shell, one venue-specific `.wbmap`, datasource integration, and settings |
| Mobile companion | Custom UI Platform | Anonymous installable PWA that resolves the published kiosk package and resumes semantic route state |

Never hand-edit a `.wbmap`, reconstruct it from loose diagnostics, or copy Preview internals into an individual app. Republish from Studio when the map changes.

## Add the harness

```bash
npm run capability:add -- wayfinding
```

The capability materializes `src/capabilities/wayfinding` and records `wayfinding` in `package.json.wallboardCapabilities`. It contains:

- the exact versioned Editor viewer release;
- a manifest whose hashes must match the JavaScript and declaration files;
- `WayfindingHarnessController`, which owns load/reload/destroy and stale-load protection;
- `WayfindingViewport`, a Solid mount component;
- public catalog, state, target, profile, speaker, and map-source types;
- versioned QR handoff encoding plus public custom-app and `.wbmap` resolution.

The Editor viewer artifact is one release unit. Never update only its JavaScript, declaration, version, or manifest.

## Experience contract

The canonical flow is:

1. Load ordinary authored 2D exploration.
2. Selecting a destination calls `previewRoute(target)` and immediately animates the complete authored route in 2D.
3. A deliberate visitor action calls `startJourney()`. The harness starts the complete exploded 3D journey, camera motion, and spoken guidance.
4. `replay()` repeats the 3D route and optional speech; `reset()` returns to the authored site view.

Do not add Atlas mode, manual Next/Back journey stepping, or prose step cards. These are not part of the visitor contract. Normal 2D and 3D exploration remain available outside an active journey.

Reduced-motion treatment may simplify decorative shell motion, but it must not remove essential route reveal or camera feedback.

## Minimal Solid integration

```tsx
import mapUrl from './assets/venue.wbmap';
import {
	WayfindingViewport,
	type WayfindingHarness,
	type WayfindingHarnessSnapshot
} from './capabilities/wayfinding';

let harness: WayfindingHarness | undefined;

<WayfindingViewport
	source={mapUrl}
	onHarness={(instance) => { harness = instance; }}
	options={{
		dimension: '2d',
		onSnapshot: (snapshot: WayfindingHarnessSnapshot) => {
			// Compose directory and details from snapshot.catalog.
		},
		resolveTargetAvailability: (target) => ({
			available: destinationStatus(target.id) !== 'closed'
		})
	}}
/>;
```

Map sources can be imported URLs, `ArrayBuffer`, `Uint8Array`, or async factories. Calling `load()` again safely replaces the current map; a late result from an older request cannot replace the newer viewer.

## Ownership rules

The published map is authoritative for:

- geometry, floor alignment, buildings, rooms, doors, connectors, origins, and labels;
- colors, fills, opacity, artwork, icons, photos, and authored camera settings;
- route graph, route styling, 2D reveal, exploded-floor layout, and journey camera;
- languages, destination metadata, and spoken-guidance text.

The custom app may own:

- kiosk composition, panels, typography, buttons, filters, and accessibility controls;
- directory search and destination detail presentation;
- theme settings for the shell only;
- visitor-selected origin, language, standard/step-free profile, mute, replay, and reset;
- operational datasource overlays that do not rewrite the map.

## Datasource overlay

Use stable `destinationId` values as the join key. A TABLE can supply availability, wait time, status text, or a temporary note. Pass availability through `resolveTargetAvailability`; do not mutate map destinations, route topology, materials, labels, or geometry.

Unknown datasource rows are ignored. Missing rows leave the map destination available. Live updates should update shell state without recreating the map viewer.

## Mobile handoff and public map delivery

The kiosk may encode a route with `createWayfindingHandoffUrl()`. The link contains only semantic, versioned state: Wallboard server origin, custom-app name and version, packaged map path, origin, destination, profile, language, and an optional datasource ID. It must never contain `/apps/widgets/` or another resolved storage path.

The mobile companion resolves the package at open time through `GET /public-api/custom-app/resolve?appId=<name>&version=<version>`, validates that every returned resource remains on the selected Wallboard origin, selects exactly one packaged `.wbmap`, and downloads that public resource. This indirection lets Wallboard change the physical app root without invalidating QR codes. HTTPS is mandatory except for localhost development.

Publishing the kiosk package makes its resource list and bundled `.wbmap` anonymously downloadable. Treat the runtime package as public presentation data: do not include `.wbwayfinding` authoring sources, credentials, private datasource values, or secrets. A datasource handoff carries only its public ID; the mobile companion fetches current values from the public datasource endpoint. Mobile implementations should cache the last successfully validated `.wbmap` for venue-level offline fallback, while resolving online first so republished app versions remain authoritative.

## Example and validation

`examples/wayfinding-kiosk` is the canonical consumer. Its compact synthetic `.wbmap` is generated by Studio and exists only to keep the public example deterministic; replace it with the venue's published package in real work.

Its `mobileAppUrl` setting points the QR action at the Custom UI Platform companion. Deployments may replace that URL, but should keep the shared handoff contract and resolver rather than inventing venue-specific query strings or copying map assets into the PWA.

Use two validation lanes:

- Fast: harness lifecycle with an injected fake viewer, checksum materialization, and compact package inspection.
- Full: materialize the canonical kiosk, run behavior and visual review with the real viewer bundle, build the Chrome 49 package, and verify the delivery ZIP after every renderer or shell change.

The compact fixture is test evidence, not a visual template and not a production venue map.
