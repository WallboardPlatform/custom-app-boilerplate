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
- Run `npm run setup` before installing dependencies in a fresh clone.
- Validate with `npm run lint` and `DISABLE_MINIO_UPLOAD=true SIMPLE_OUTPUT=true npm run build:production:zip`.

The final deliverable for a user is the generated zip path, not source files.
