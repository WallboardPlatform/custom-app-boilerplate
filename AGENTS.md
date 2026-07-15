# AGENTS.md

Agent instructions for Wallboard custom app generation.

Before implementing a custom app:

1. Read `README.md`.
2. Read `CLAUDE.md`.
3. Read `docs/claude/workflow.md`.
4. Read all files in `docs/system/`, especially `docs/system/widget-best-practices.md`.
5. Create `generation-brief.json` and run `npm run validate:brief` before implementation. Run `npm run validate:project` after implementation to prove that the project still matches the accepted brief.

Core rules:

- Do not edit `src/index.tsx`.
- Treat `generation-brief.json` as the accepted request contract. Update it when the user changes identity, surface strategy, visual direction, data, settings, states, behavior, or assets.
- Resolve whether the app is `fixed`, `bounded`, or `adaptive` before implementation. Do not sacrifice the requested composition to unsupported aspect ratios.
- User-provided visual references and explicit brand direction outrank repository examples. Examples demonstrate engineering patterns, not a default Wallboard visual style.
- For color-driven apps, provide coordinated Dark and Light presets plus a Custom mode by default. Derive both presets from the accepted visual direction, and preserve missing legacy preset values as Custom on replacement uploads.
- Build the user-facing widget in `src/components/wb-app/`.
- Keep the root widget responsive, isolated, and transparent by default.
- Keep CSS compatible with the legacy Chromium target described by the boilerplate docs.
- Map every editor property through `src/settings.ts` and `src/interfaces/application.interface.ts`.
- Keep `preview/fixture.ts` representative of the app's settings and datasource shape.
- When adding a setting, update `properties.json`, `ConfigValues`, `Settings`, `settings.ts`, the preview fixture, and the generation brief together. Every slider needs linked `previewSettingEffects` evidence that changes the actual rendered element.
- Classify data-bound widgets using `docs/system/datasource-contracts.md`: explicit or built-in contract first, otherwise `TABLE`; use `CUSTOM` only when tabular data would lose required structure.
- For multiple independent existing sources, declare every picker in `bindings[]`, keep one sanitized sample bundle with per-binding `samplePath` values, and preserve the sources' separate refresh lifecycles.
- Add named preview scenarios for empty, maximum-content, odd-count, last-page, and long-label states that materially change layout.
- After the first representative render, run `npm run measure:visual`; review its report and give every planned surface and named scenario measured minimum content-coverage thresholds with regression margin.
- Put app-specific timing, animation, or interaction assertions in an additional `preview/*.spec.ts` file; keep the shared visual suite generic.
- Import packaged media statically (for example `import mark from './mark.png'`); never use `new URL(..., import.meta.url)` for runtime images.
- Preserve `properties.json.version` when rebuilding or fixing an existing app. A deliberate incompatible version is a separate app upload and must be called out to the user.
- Treat `properties.json` name plus version as the runtime identity. Never create a second Wallboard app record with the same identity; replacement builds go to the existing record.
- Run `npm run setup` before installing dependencies in a fresh clone.
- Use `npm run deliver -- <output-directory>` for final validation and delivery generation. Hand off both the upload ZIP and the separate sanitized source ZIP; never put source files inside the Wallboard upload package.
- `deliver:unverified` is a browserless transfer mechanism only. Its `_UNVERIFIED` artifacts are not upload-ready and must pass normal `deliver` elsewhere.
- Inspect every image in `preview/output/` at 100% or zoomed detail; passing overflow checks does not prove that the composition is visually good. Check descenders, baselines, reference fidelity, hierarchy, and repeated template patterns explicitly.
- Use `useAutoFitText` selectively for variable bounded titles and hero values. Keep safe line-height and vertical padding because box fitting does not prove glyph-ink clearance.
- In the installation handoff, state that a newly created custom app must be uploaded, enabled, and assigned to the editor's customer (or left unassigned for all customers).

The final deliverable is the generated delivery directory. For a data-bound app, state that current Wallboard versions require datasource creation/import and binding even though the ZIP carries the future provisioning template.
