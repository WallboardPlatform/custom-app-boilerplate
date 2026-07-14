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
| `surfaces` | At least four realistic sizes; exactly one `primary` matching `properties.json`; include portrait and square fallbacks |
| `data` | `static` with no bindings, or `bound` with every data picker mapped to its contract |
| `settings` | Exactly one purpose for every non-datasource editor property |
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
- A behavior uses exactly one evidence source:
  - `{"scenario":"last-page"}` for a state proven by the shared visual suite.
  - `{"testFile":"preview/behavior.spec.ts"}` for app-specific motion, timing, or interaction assertions.
- Every app-specific `preview/*.spec.ts` file must be referenced by at least one behavior.
- Asset paths must stay inside the project. Datasource assets must name a declared binding; setting assets must name real editor properties.

## Workflow

1. Translate the prompt, images, supplied data, and user decisions into the brief.
2. Resolve blocking ambiguity before implementation. Record non-blocking assumptions.
3. Choose datasource contracts and editor settings.
4. Define realistic surfaces, edge states, and observable behavior evidence.
5. Run `npm run validate:brief`, then implement the accepted plan.
6. Run `npm run validate:project` and resolve every project synchronization failure.
7. Inspect screenshots using `visualReview.intent` and `visualReview.focus`, not only mechanical pass/fail results.
8. Deliver the ZIP, manifest, generation brief, and datasource sidecars together.

Gold-standard briefs live in `examples/*/generation-brief.json`.
