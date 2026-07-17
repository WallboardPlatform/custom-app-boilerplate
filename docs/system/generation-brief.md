# Generation Brief

Create `generation-brief.json` before implementing a custom app. It is the machine-readable agreement between the user's request and the generated project. It records decisions; it does not prescribe visual implementation.

`npm run validate:brief` checks the standalone plan against [`schemas/generation-brief.schema.json`](../../schemas/generation-brief.schema.json) and its policy rules before implementation. `npm run validate:project` then checks the accepted brief against app identity, editor properties, datasource contracts, preview scenarios, behavior tests, and packaged assets. `npm run deliver -- <output-directory>` requires both phases to pass and preserves the brief as a delivery sidecar.

## Required Shape

| Field | Rule |
|------|------|
| `briefVersion` | `5` for new briefs; v3/v4 remain accepted for existing examples and packages |
| `request` | Non-empty `summary`, `audience`, and `primaryGoal` |
| `assumptions` | Explicit inferred or platform-default decisions; use `[]` only when none exist |
| `app` | `mode` is `new` or `replacement`; `name` and `version` match `properties.json` |
| `surfaceStrategy` | `fixed` for exact canvases, `bounded` for a known family of sizes, or `adaptive` for unknown placements; include the user or product rationale |
| `surfaces` | Lowercase kebab-case IDs; exactly one `primary` matching `properties.json`; every supported surface has minimum width/height content coverage |
| `data` | `static`, or mapped bindings with `read`/`write`/`read-write` access |
| `ownership` | One owner per concern: `locked` invariant, `setting` config, `datasource` durable data, `interaction` session, or `external-command` transition |
| `experience` | `passive` or `interactive`; the latter declares views, inputs, and reset |
| `outputs` | Datasource, sensor, or own-state outputs; writes match write-enabled bindings |
| `rendering` | `reflow`, or sized `fixed-canvas` with transparent/background letterbox |
| `motion` | `off`/`subtle`/`expressive`, techniques, and optional disable setting |
| `media` | `none`, or image/video source plus fit policy |
| `branding` | `none`, `settings`, `reference`, or `mcp-branding-kit` plus inputs |
| `presentation` | Required themes plus `sparse`, `balanced`, or `dense` information density |
| `settings` | Exactly one purpose for every non-datasource editor property; slider controls also reference executable `effect` evidence |
| `dynamicText` | Every important variable-length text surface declares its source, selectors, fit/wrap/ellipsis/marquee strategy, readable limits, fallback, rationale, and a stress scenario |
| `states` | Exactly one expectation for every named `previewScenario` |
| `behaviors` | Observable timing, motion, pagination, live-update, or interaction rules with scenario or test-file evidence |
| `assets` | Packaged, datasource-backed, or setting-provided assets; include icon and placeholder |
| `visualDirection` | Reference source, concise direction, at least two signature choices, and at least one specific pattern to avoid |
| `visualReview` | Intended composition plus at least two concrete screenshot-review risks |

## Surface Strategy

| Mode | Contract | Visual suite |
|------|----------|--------------|
| `fixed` | One or more exact production canvases; no fallback surfaces | Declared surfaces only |
| `bounded` | At least two representative sizes from a known placement family | Declared surfaces only |
| `adaptive` | At least four representative sizes including portrait and square | Declared surfaces plus standard fallback matrix |

If the request does not establish the intended placement, resolve whether this is a small widget, a fixed large status board, a bounded placement family, or a genuinely adaptive app before implementation. More responsiveness is not automatically better when it weakens the requested design.

## Dynamic Text Contract

Every important setting-, datasource-, or computed-text surface with unpredictable length belongs in `dynamicText`. One policy may cover multiple selectors only when they share the same strategy and fallback.

| Strategy | Use | Required limit |
|----------|-----|----------------|
| `auto-fit` | Bounded single-line titles and hero values that must remain complete | `minimumFontSize` |
| `wrap` | Titles or descriptions where additional lines preserve meaning | `maximumLines` |
| `ellipsis` | Secondary text where documented information loss is acceptable | `maximumLines` |
| `marquee` | Continuous ticker content whose movement is part of the requested experience | At least one explicit limit |

`fallback` describes what happens after the primary strategy reaches its readable limit. Auto-fit must not shrink indefinitely; wrapping, pagination, a shorter alternate label, or explicitly accepted ellipsis must take over. `evidenceScenario` must use pathological but realistic content, and every declared selector must render in that scenario. The shared visual suite also verifies auto-fit containment and its minimum font size.

## Visual Direction

Use this priority order:

1. User-provided images, brand assets, and explicit concepts.
2. Accepted `visualDirection` choices and target surfaces.
3. Existing examples for implementation mechanics such as datasource normalization, legacy layout, timing, and packaging.
4. Agent-authored composition when no stronger direction exists.

Examples are not style templates. Do not inherit their palette, cards, header treatment, or pagination by default. `reference-led` direction must name the supplied reference. `signatureChoices` records what makes this app visually specific; `avoid` prevents a known generic fallback.

`instruction-led` means the user's explicit concept leads without a visual reference. `creative-led` leaves composition and art direction to the agent because no stronger direction exists. Legacy v3 briefs may contain `agent-authored`; new v4 briefs use `creative-led`.

## Presentation

Declare only themes the app must support. Color-driven apps normally use `dark`, `light`, and `custom`; a fixed branded experience may intentionally require one theme. Multiple themes require a `themePreset` editor property. Density describes the accepted information load, not a reusable visual style: `sparse` for one hero/message, `balanced` for mixed hierarchy, and `dense` for scan-heavy operational or tabular surfaces.

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
- The shared visual suite always renders every planned surface. It adds standard fallback dimensions only for `adaptive` briefs.
- A behavior uses exactly one evidence source:
  - `{"scenario":"last-page"}` for a state proven by the shared visual suite.
  - `{"testFile":"preview/behavior.spec.ts"}` for app-specific motion, timing, or interaction assertions.
- Every app-specific `preview/*.spec.ts` file must be referenced by at least one behavior.
- Every slider must have a `previewSettingEffects` entry referenced by its `settings[].effect`. Use the same mechanism for other controls whose visible effect is easy to regress, especially typography, media sizing, visibility, and color controls.
- Asset paths must stay inside the project. Datasource assets must name a declared binding; setting assets must name real editor properties.

## Workflow

1. Translate the prompt, images, supplied data, and user decisions into the brief. Treat references as design evidence, not optional inspiration.
2. Resolve blocking ambiguity about placement and visual direction before implementation. Record non-blocking assumptions.
3. Choose datasource contracts and editor settings.
4. Define realistic surfaces, edge states, dynamic-text policies, and observable behavior evidence.
5. Run `npm run validate:brief`, then implement the accepted plan.
6. Run `npm run measure:visual`, inspect its screenshots and coverage report, then update planned coverage with justified measured thresholds.
7. Run `npm run validate:project` and `npm run validate:visual`; resolve every synchronization or visual failure.
8. Inspect screenshots using `visualDirection`, `visualReview.intent`, and `visualReview.focus`. Review reference fidelity, typography ink clearance, hierarchy, density, and repetitive template patterns, not only mechanical pass/fail results.
9. Deliver the ZIP, manifest, generation brief, and datasource sidecars together.

Measurement mode skips only minimum-coverage assertions so the first baseline can be observed. Runtime errors, failed requests, overflow, broken media, behavior tests, and setting-effect assertions remain blocking. The generated report never edits the brief automatically; threshold choice remains an explicit design decision.

Gold-standard briefs live in `examples/*/generation-brief.json`.

Internal datasource outputs name a write-enabled binding and atomic operation. Editor writes are blocked.
