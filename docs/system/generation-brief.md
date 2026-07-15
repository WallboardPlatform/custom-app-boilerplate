# Generation Brief

Create `generation-brief.json` before implementing a custom app. It is the machine-readable agreement between the user's request and the generated project. It records decisions; it does not prescribe visual implementation.

`npm run validate:brief` checks the standalone plan against [`schemas/generation-brief.schema.json`](../../schemas/generation-brief.schema.json) and its policy rules before implementation. `npm run validate:project` then checks the accepted brief against app identity, editor properties, datasource contracts, preview scenarios, behavior tests, and packaged assets. `npm run deliver -- <output-directory>` requires both phases to pass and preserves the brief as a delivery sidecar.

## Required Shape

| Field | Rule |
|------|------|
| `briefVersion` | `1` |
| `request` | Non-empty `summary`, `audience`, and `primaryGoal` |
| `assumptions` | Explicit inferred or platform-default decisions; use `[]` only when none exist |
| `app` | `mode` is `new` or `replacement`; `name` and `version` match `properties.json` |
| `surfaces` | At least four realistic sizes; lowercase kebab-case IDs; exactly one `primary` matching `properties.json`; include portrait and square fallbacks; set minimum width/height content coverage for every surface |
| `data` | `static` with no bindings, or `bound` with every data picker mapped to its contract |
| `settings` | Exactly one purpose for every non-datasource editor property; slider controls also reference executable `effect` evidence |
| `states` | Exactly one expectation for every named `previewScenario` |
| `behaviors` | Observable timing, motion, pagination, live-update, or interaction rules with scenario or test-file evidence |
| `assets` | Packaged, datasource-backed, or setting-provided assets; include icon and placeholder |
| `visualReview` | Intended composition plus at least two concrete screenshot-review risks |

## Data Binding Sources

| `source` | Allowed `contract` | Use |
|----------|--------------------|-----|
| `generated` | `TABLE`, justified `CUSTOM` | App delivery supplies the initial datasource template |
| `existing` | `EXISTING` | User supplied a real datasource shape; keep independent bindings separate |
| `built-in` | `FEED`, `CALENDAR` | Reuse a verified Wallboard integrated contract |

The brief, `datasource-contract.json`, and `properties.json` data pickers must declare the same binding properties and contracts.

## Evidence Rules

- Every `states[].scenario` must exist in `preview/fixture.ts`, and every named scenario must be documented by the brief.
- Surface and scenario IDs use lowercase kebab-case so URLs, test names, and screenshot paths remain portable.
- Every planned surface and named scenario must define integer `minimumContentCoverage.width` and `.height` percentages from `1` to `100`. Initial values are planning hypotheses only. After the first representative render, run `npm run measure:visual`, review `preview/output/coverage-report.json`, and replace them with measured baselines plus regression margin. Do not lower a threshold merely to silence a layout defect.
- The shared visual suite renders every planned surface at its declared dimensions, then adds standard fallback dimensions not already covered by the brief.
- A behavior uses exactly one evidence source:
  - `{"scenario":"last-page"}` for a state proven by the shared visual suite.
  - `{"testFile":"preview/behavior.spec.ts"}` for app-specific motion, timing, or interaction assertions.
- Every app-specific `preview/*.spec.ts` file must be referenced by at least one behavior.
- Every slider must have a `previewSettingEffects` entry referenced by its `settings[].effect`. Use the same mechanism for other controls whose visible effect is easy to regress, especially typography, media sizing, visibility, and color controls.
- Asset paths must stay inside the project. Datasource assets must name a declared binding; setting assets must name real editor properties.

## Workflow

1. Translate the prompt, images, supplied data, and user decisions into the brief.
2. Resolve blocking ambiguity before implementation. Record non-blocking assumptions.
3. Choose datasource contracts and editor settings.
4. Define realistic surfaces, edge states, and observable behavior evidence.
5. Run `npm run validate:brief`, then implement the accepted plan.
6. Run `npm run measure:visual`, inspect its screenshots and coverage report, then update planned coverage with justified measured thresholds.
7. Run `npm run validate:project` and `npm run validate:visual`; resolve every synchronization or visual failure.
8. Inspect screenshots using `visualReview.intent` and `visualReview.focus`, not only mechanical pass/fail results.
9. Deliver the ZIP, manifest, generation brief, and datasource sidecars together.

Measurement mode skips only minimum-coverage assertions so the first baseline can be observed. Runtime errors, failed requests, overflow, broken media, behavior tests, and setting-effect assertions remain blocking. The generated report never edits the brief automatically; threshold choice remains an explicit design decision.

Gold-standard briefs live in `examples/*/generation-brief.json`.
