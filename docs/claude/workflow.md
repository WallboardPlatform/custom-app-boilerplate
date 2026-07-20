# Generation Workflow

## 1. Discover

- Read `AGENTS.md`, the prompt, supplied images/data, and relevant source files.
- Inspect existing components, settings, interfaces, fixture, and editor properties before changing them.
- Read only task-relevant system docs. Verify documentation against source when they disagree.

## 2. Resolve Decisions

- Resolve audience, message, surface, viewing distance, ownership, interaction, data/access, outputs, cadence, art direction, themes, density, and delivery.
- Ask only when surface or data ambiguity would materially change the result. Record safe assumptions.
- Choose `fixed`, `bounded`, or `adaptive`; examples are engineering references, never automatic style templates.

## 3. Freeze The Brief

Create a v7 `generation-brief.json` using `docs/system/generation-brief.md`; v3-v6 remain valid for maintained apps. Run:

```bash
npm run validate:brief
```

Do this before editing implementation artifacts.

## 4. Implement

- Keep platform infrastructure unchanged and follow existing SolidJS/SCSS patterns.
- Build the visual hierarchy from the accepted reference/domain before adding controls or edge states.
- Normalize data at the boundary, keep settings synchronized across all representations, and use reusable project capabilities for themes, sanitization, text fitting, charts, assets, and cleanup.
- Meet the v6+ semantic font floors. Reduce density, remove secondary detail, or paginate before shrinking below them.
- Declare media ownership, platform caching, offline preview, and fallback. Use the shared bounded transition helper only when motion communicates a change.
- Add `video` only for authored playback apps. Prefer direct File System file/folder or an explicit playlist contract; preserve muted autoplay, bounded recovery, teardown, and real-media tests. Do not promise native/external player mode, synchronized screens, audio ducking, or proof-of-display through the current SDK.
- Add `keyboard` when a signage interaction requires text entry. Use the app-owned touch keyboard with requested layouts; never assume an OS keyboard or the legacy Angular User Input keyboard is available to a custom app.
- Enforce ownership. Interactive apps declare views, inputs, resets, and outputs; writes are displayer-only.
- Use the shared rotation lifecycle for timed pages; specialized continuous motion stays app-owned. Add behavior tests for timing, rotation, interaction, and teardown.

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
