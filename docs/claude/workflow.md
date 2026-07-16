# Generation Workflow

## 1. Discover

- Read `AGENTS.md`, the prompt, supplied images/data, and relevant source files.
- Inspect existing components, settings, interfaces, fixture, and editor properties before changing them.
- Read only task-relevant system docs. Verify documentation against source when they disagree.

## 2. Resolve Decisions

- Confirm or infer audience, primary message, placement family, data source, visual direction, and delivery mode.
- Ask only when surface or data ambiguity would materially change the result. Record safe assumptions.
- Choose `fixed`, `bounded`, or `adaptive`; examples are engineering references, never automatic style templates.

## 3. Freeze The Brief

Create `generation-brief.json` with identity, surfaces, data bindings, settings, dynamic-text policies, states, behaviors, assets, visual direction, and review risks. Run:

```bash
npm run validate:brief
```

Do this before editing implementation artifacts.

## 4. Implement

- Keep platform infrastructure unchanged and follow existing SolidJS/SCSS patterns.
- Build the visual hierarchy from the accepted reference/domain before adding controls or edge states.
- Normalize data at the boundary, keep settings synchronized across all representations, and use reusable project capabilities for themes, sanitization, text fitting, charts, assets, and cleanup.
- Add named preview scenarios as each materially different state is implemented; add behavior tests for timing, rotation, interaction, and teardown.

## 5. Visual Review Loop

1. Render the exact primary surface first, then every declared surface and stress scenario.
2. Inspect screenshots against the prompt, references, `visualDirection`, and `visualReview`.
3. Check distance readability, hierarchy, density, theme contrast, full essential text, accepted secondary prefixes/descenders, edge padding, unused space, partial pages, broken media, and sameness with repository examples.
4. Revise composition and behavior, not thresholds, when a defect appears.
5. Run `npm run measure:visual` only after a representative render; set coverage thresholds from measured evidence plus regression margin.
6. Repeat until screenshots are intentional, then run `npm run validate:project` and `npm run validate:visual`.
7. Run `npm run prepare:visual-review`, record the completed inspection in `preview/visual-review.json`, and pass `npm run validate:visual-review`.

Automated checks cannot judge visual quality. Passing overflow and coverage checks never replaces screenshot inspection. The review fingerprint follows reachable app source, app-specific fixtures/tests, editor assets, and contracts, so unrelated unused boilerplate changes do not stale accepted evidence.

## 6. Deliver

Run:

```bash
npm run deliver -- <output-directory>
```

This executes identity, brief/project, datasource, lint, script typecheck, visual, legacy, build, and asset gates; then writes the upload ZIP, sanitized source ZIP, manifest, brief, and datasource sidecars. Inspect ZIP contents and installation notes before handoff.

Browserless `deliver:unverified` is a transfer path only. Normal delivery must pass in a browser-capable environment before upload.
