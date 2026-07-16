# Claude Code Entry Point

Follow `AGENTS.md`; it is the authoritative agent contract. Use `docs/claude/workflow.md` for phases and its routing table for topic documentation. Do not read every system document unless the task needs every subsystem.

## Platform Facts

- A custom app is a SolidJS frontend registered through `wallboard-app-sdk` and rendered in Wallboard editor and displayer modes.
- Editor settings can change at runtime; the displayer also receives datasource and external-command updates.
- Multiple instances may share a page, so state and DOM work must be instance-local.
- `src/index.tsx` and system infrastructure are fixed; implement the widget under `src/components/wb-app/`.
- CSS/HTML must remain Chromium 56 compatible. Delivery includes modern and Chrome 49 bundles.

## Stack

TypeScript 5.9, SolidJS 1.9, Vite 7, Sass, RxJS, tsyringe, Wallboard App SDK 2.0.x, Chart.js 4.5, ESLint, Playwright, and Webpack for the legacy bundle.

## Commands

| Purpose | Command |
|---------|---------|
| Fresh setup | `npm run setup` |
| Plan validation | `npm run validate:brief` |
| Project synchronization | `npm run validate:project` |
| Interactive preview | `npm run dev:preview` |
| Measure coverage | `npm run measure:visual` |
| Visual suite | `npm run validate:visual` |
| Lint | `npm run lint` |
| Full package gates | `npm run validate:package` |
| Accepted delivery | `npm run deliver -- <output-directory>` |

Use `deliver:unverified` only to move work to a browser-capable environment. Never call its artifacts accepted or upload-ready.
