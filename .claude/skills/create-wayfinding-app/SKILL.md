---
name: create-wayfinding-app
description: Create or repair a Wallboard wayfinding app and its manual-first Wayfinding Studio project from customer maps, PDFs, images, SVGs, CAD renders, or AI drafts. Use for directories, highlights, routes, multiple floors, accessibility, kiosk origins, map metadata, and venue navigation.
---

# Create Wayfinding App

Produce a reviewable `.wbwayfinding` project first, then build the runtime app from its deterministic export. Do not attempt autonomous source-to-perfect-SVG reconstruction and do not treat visual plausibility as navigation proof.

## Workflow

1. Read `AGENTS.md`, `docs/system/wayfinding.md`, the source, and only relevant project docs.
2. Resolve installed screen/origin, facing direction, floors, languages, guidance target, accessibility, destination data ownership, and source constraints. Ask when an unknown changes geometry or topology.
3. Start from `templates/wayfinding-studio-project.json` or create a schema-valid draft using [references/ai-draft.md](references/ai-draft.md). Preserve the original source.
4. Choose background treatment: retain supplied artwork, manually simplify it, or generate a signage draft. Background pixels never own topology.
5. Run `npm run wayfinding:studio`. Add floors/backgrounds and author semantic locations, doors, POIs, walkable areas, obstacles, origins, transitions, labels, icons, and logos.
6. Treat every AI-created element as `status: proposed`, `provenance: ai-draft`. A reviewer corrects geometry and confirms facts in Studio.
7. Keep mutable destination copy in the embedded destination baseline and emitted Wallboard `TABLE`. Geometry and route eligibility stay package-owned.
8. For route mode, connect explicit graph edges to reviewed doors/approaches. Pair cross-floor transitions by `connectionId`; classify stairs/elevator/escalator and verified accessibility.
9. Simulate every routeable destination from every installed origin using standard and step-free profiles. Fix disconnected nodes, shortcuts, incorrect entrance sides, and floor transitions.
10. Set evidence/review status and assess the delivery mode. Keep incomplete work as an editable draft; use highlight/directional fallback when routing is not confirmed. Read `manifest.targetMode` and `manifest.deliveryMode` at runtime and never execute draft graph data after a downgrade.
11. Export deterministically:

```bash
npm run wayfinding:studio:export -- --project venue.wbwayfinding --output wayfinding-runtime
```

12. Build the app from the runtime floor SVGs, graph, and destination contract. Test search, multilingual keyboard, highlight, details, pan/zoom, floors, reset, long data, empty/unreachable states, and every assessed route behavior.

## Non-Negotiable

- Human-editable Studio output is required; AI is a draft accelerator.
- Never mark AI/image/OCR inference confirmed.
- Labels, icons, and logos use independent SVG layers.
- Location route nodes terminate at reviewed doors/approaches and remain leaf nodes.
- Mutable TABLE data cannot grant map presence or routing.
- No fake straight-line route, invented corridor, orientation, accessibility, door, or transition.
- Selection preserves visitor viewport; current and target markers remain obvious.
- Use synthetic representative example data; do not commit customer records or URLs.

## Deliver

Return the app/source ZIPs, editable `.wbwayfinding` project, runtime export, destination contract/template, setup notes, screenshots, and route evidence appropriate to the assessed mode.
