# Wayfinding Artifacts

## Editable `.wbwayfinding`

Validate with `schemas/wayfinding-studio-project.schema.json`. It is the single authoring source for assets, floors, semantic layers, route graph, destination baseline, and delivery evidence.

- Embed optional backgrounds/logos/icons as assets.
- Keep stable IDs across edits.
- Keep AI/import output `proposed`; only reviewers confirm it.
- Model each installed screen as an `origin` with floor, point, facing, and language.
- Pair transitions across floors with a shared `connectionId`.

## Runtime export

`wayfinding:studio:export` generates:

- `floors/<floor-id>.svg` with Background, Walkable, Obstacles, Locations, Doors, POIs, Origins, Transitions, Labels, Icons, Logos groups;
- `route-graph.json` with explicit topology and semantic-node relations;
- `destinations-datasource.json` in Wallboard TABLE shape;
- `manifest.json` and `validation.json`.

SVG target geometry owns stable map presence. Graph location nodes own route eligibility. TABLE rows own mutable public copy.

The manifest declares requested `targetMode` and assessed `deliveryMode`. Draft projects remain saveable, but runtime export requires structural validity and sufficient confirmed evidence. A non-route fallback exports an empty graph by design; never infer route support from graph data left in the editable project.

## Existing standalone artifacts

The Studio can import existing evidence/project, graph, walkable-mask, and destination JSON while projects migrate. Audit an existing SVG before trusting it:

```bash
npm run wayfinding:audit-source -- --svg map.svg --report-dir wayfinding-source-audit
```

Point clouds and extracted anchors remain proposals. Use `npm run wayfinding:validate` for standalone SVG/graph deliveries.
