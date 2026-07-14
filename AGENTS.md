# AGENTS.md

Agent instructions for Wallboard custom app generation.

Before implementing a custom app:

1. Read `README.md`.
2. Read `CLAUDE.md`.
3. Read `docs/claude/workflow.md`.
4. Read all files in `docs/system/`, especially `docs/system/widget-best-practices.md`.

Core rules:

- Do not edit `src/index.tsx`.
- Build the user-facing widget in `src/components/wb-app/`.
- Keep the root widget responsive, isolated, and transparent by default.
- Keep CSS compatible with the legacy Chromium target described by the boilerplate docs.
- Map every editor property through `src/settings.ts` and `src/interfaces/application.interface.ts`.
- Keep `preview/fixture.ts` representative of the app's settings and datasource shape.
- Classify data-bound widgets using `docs/system/datasource-contracts.md`: explicit or built-in contract first, otherwise `TABLE`; use `CUSTOM` only when tabular data would lose required structure.
- For multiple independent existing sources, declare every picker in `bindings[]`, keep one sanitized sample bundle with per-binding `samplePath` values, and preserve the sources' separate refresh lifecycles.
- Add named preview scenarios for empty, maximum-content, odd-count, last-page, and long-label states that materially change layout.
- Put app-specific timing, animation, or interaction assertions in an additional `preview/*.spec.ts` file; keep the shared visual suite generic.
- Import packaged media statically (for example `import mark from './mark.png'`); never use `new URL(..., import.meta.url)` for runtime images.
- Preserve `properties.json.version` when rebuilding or fixing an existing app. A deliberate incompatible version is a separate app upload and must be called out to the user.
- Treat `properties.json` name plus version as the runtime identity. Never create a second Wallboard app record with the same identity; replacement builds go to the existing record.
- Run `npm run setup` before installing dependencies in a fresh clone.
- Use `npm run deliver -- <output-directory>` for final validation and delivery generation.
- Inspect every image in `preview/output/`; passing overflow checks does not prove that the composition is visually good.
- In the installation handoff, state that a newly created custom app must be uploaded, enabled, and assigned to the editor's customer (or left unassigned for all customers).

The final deliverable is the generated delivery directory. For a data-bound app, state that current Wallboard versions require datasource creation/import and binding even though the ZIP carries the future provisioning template.
