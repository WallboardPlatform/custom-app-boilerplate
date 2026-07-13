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
- Add named preview scenarios for empty, maximum-content, odd-count, last-page, and long-label states that materially change layout.
- Import packaged media statically (for example `import mark from './mark.png'`); never use `new URL(..., import.meta.url)` for runtime images.
- Preserve `properties.json.version` when rebuilding or fixing an existing app. A deliberate incompatible version is a separate app upload and must be called out to the user.
- Run `npm run setup` before installing dependencies in a fresh clone.
- Validate with `npm run lint`, `npm run validate:visual`, and `npm run validate:package`.
- Inspect every image in `preview/output/`; passing overflow checks does not prove that the composition is visually good.

The final deliverable for a user is the generated zip path, not source files.
