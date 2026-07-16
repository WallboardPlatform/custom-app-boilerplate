# Wallboard Custom App Agents

Build production Wallboard widgets, not demo pages. Start with:

1. `docs/claude/workflow.md`
2. `docs/system/generation-brief.md`
3. `docs/system/widget-best-practices.md`
4. Only the topic docs needed by the task:

| Need | Read |
|------|------|
| Data binding | `datasource-contracts.md` |
| Settings/editor schema | `configuration.md`, `interfaces.md` |
| SolidJS/component structure | `solidjs-patterns.md`, `components.md` |
| Hooks, services, contexts, stores | matching system doc |
| CSS/layout | `styling.md` |
| Charts | `charting.md` |
| Reusable mechanics | `capabilities.md` |
| Packaging/replacement | `app-identity-and-delivery.md` |

`README.md` is the setup and command reference. Do not preload unrelated system docs.

## Non-Negotiable

- Never edit `src/index.tsx`, `src/contexts/system/`, `src/hooks/system/`, `src/services/service.abstract.ts`, or the reset/mixin files under `src/styles/`. `src/styles/animation.css` is the app keyframe extension point.
- Put app UI in `src/components/wb-app/`; add app-specific components, hooks, services, interfaces, and utilities only in their established custom locations.
- Keep HTML/CSS compatible with Chromium 56 and produce the Chrome 49 bundle. TypeScript is transpiled; CSS is not fully backported.
- Scope DOM work, timers, observers, subscriptions, and mutable state per widget instance; clean all resources on destroy.
- Preserve `properties.json` name and version for compatible replacement uploads. A deliberate incompatible version is a separate app and must be identified as such. New apps start at version `1`.
- Preserve the supplied scaffold: do not replace `package.json`, `package-tools/`, validators, preview harness, or delivery scripts. Implement the app in the existing source/preview/config surfaces and finish with the repository's `npm run deliver` workflow.
- Use only fictional representative data in source, fixtures, templates, placeholders, screenshots, and archives. Never retain customer records, URLs, IDs, credentials, timestamps, or exact operational values.

## Request Contract

Before implementation, create `generation-brief.json` and pass `npm run validate:brief`.

- Resolve `fixed`, `bounded`, or `adaptive` placement. If placement materially changes the design and is unknown, ask the user.
- User references, brand assets, and explicit concepts lead. Examples teach mechanics, not palette, card grammar, headers, or pagination style.
- Declare every important variable text surface and its `auto-fit`, `wrap`, `ellipsis`, or `marquee` strategy, readable limit, fallback, and stress scenario.
- Use coordinated Dark, Light, and Custom themes for color-driven apps unless the accepted direction calls for a different scheme. Presets resolve the entire semantic palette; show manual swatches only in Custom mode.
- Prefer built-in `FEED` or `CALENDAR` when requested data matches them. Otherwise use an explicit user contract, then editable `TABLE`; use `CUSTOM` only when a table would lose necessary structure.
- Keep independent existing datasources as independent bindings and refresh lifecycles.

## Implementation Contract

- Map each functional editor property across `properties.json`, `ConfigValues`, `Settings`, `settings.ts`, `preview/fixture.ts`, and the generation brief.
- Every slider and regression-prone visual control needs executable `previewSettingEffects` evidence.
- Normalize datasource variants once at the boundary; render one typed model. Provide stable loading, empty, invalid, broken-media, maximum-content, long-text, odd-count, last-page, and live-update states where relevant.
- Root layout fills its surface, starts transparent unless a panel is intentional, and contains all overflow. Use flexbox, measured ratio classes, and bounded CSS variables rather than viewport assumptions.
- Use `useAutoFitText` for bounded single-line primary text that must remain complete. Use wrapping, line limits, pagination, or accepted ellipsis elsewhere. Preserve descender and baseline ink with safe line-height and vertical padding.
- Never ellipsize essential identity, direction, safety, accessibility, or action text on a declared target surface. Reallocate columns, stack fields, wrap, paginate, or change the ratio composition before losing it.
- Import packaged media statically and list every emitted runtime asset in `resourceList`; never build component media URLs with `new URL(..., import.meta.url)`.
- Use Chart.js by default for normal charts; import only required modules, size the parent explicitly, disable unnecessary signage animation, and destroy instances.

## Evidence And Delivery

1. Add realistic primary surfaces and named stress scenarios to `preview/fixture.ts`; app-specific motion/timing belongs in `preview/*.spec.ts`.
2. Run `npm run measure:visual` after the first representative render. Inspect the report and screenshots, then set measured coverage thresholds with regression margin.
3. Run `npm run validate:project` and `npm run validate:visual`.
4. Run `npm run prepare:visual-review`. Inspect every screenshot at real dimensions, complete `preview/visual-review.json`, revise/rerun when needed, then pass `npm run validate:visual-review`.
5. Run `npm run deliver -- <output-directory>`. Return the upload ZIP and separate sanitized source ZIP. `_UNVERIFIED` browserless artifacts are handoff-only and not upload-ready.

For installation, explain that a new app must be uploaded, enabled, and assigned to the editor customer (or left unassigned for all customers). Data-bound apps also require datasource creation/selection and binding on current Wallboard versions.
