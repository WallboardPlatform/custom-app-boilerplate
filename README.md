# Wallboard Custom App Boilerplate

Public SolidJS boilerplate for uploadable Wallboard custom apps.

## Setup

Requirements: Node `24.9+` (preferred) or `22.22+`.

```bash
git clone https://github.com/WallboardPlatform/custom-app-boilerplate.git
cd custom-app-boilerplate
npm run setup
```

`setup` resolves `wallboard-app-sdk` from anonymous Wallboard Nexus and falls back to the matching GitHub release asset, then installs other packages from public npm. Pin a version with:

```bash
npm run setup:sdk -- --version 2.0.85
npm install --registry=https://registry.npmjs.org/
```

Optional setup variables: `WALLBOARD_SDK_REGISTRY`, `WALLBOARD_APP_SDK_VERSION`, `WALLBOARD_APP_SDK_FALLBACK_VERSION`, `WALLBOARD_APP_SDK_FALLBACK_URL`, and `WALLBOARD_APP_SDK_FALLBACK_SHA256`.

## Generation

Agents start with `AGENTS.md`. Before implementation:

```bash
npm run validate:brief
```

After implementation:

```bash
npm run validate:project
npm run measure:visual
npm run validate:visual
npm run prepare:visual-review
# inspect screenshots and complete preview/visual-review.json
npm run validate:visual-review
```

Preview: `http://127.0.0.1:5173/preview/` after `npm run dev:preview`. The iframe keeps the true widget viewport while the shell may scale it visually.

`measure:visual` writes `preview/output/coverage-report.json`; it does not edit the brief. Review screenshots, then set justified thresholds. `validate:visual` checks declared surfaces/scenarios, runtime errors, requests, overflow, media, setting effects, and text ink. Manual review still decides reference fidelity, hierarchy, density, typography, and unused space.

Browser lookup order: `WALLBOARD_PLAYWRIGHT_EXECUTABLE_PATH`, `WALLBOARD_PLAYWRIGHT_CHANNEL`, Playwright cache, installed Chrome/Edge. `PLAYWRIGHT_BROWSERS_PATH` supports shared caches.

## Examples

Examples are overlays on this boilerplate:

```bash
npm run example:materialize -- restaurant-menu ../restaurant-menu
npm run example:review:prepare -- restaurant-menu
npm run example:review:promote -- restaurant-menu
npm run example:accept -- restaurant-menu
```

The explicit target must be new or empty. See `examples/README.md`. Use examples for normalization, layout, chart, timing, test, and packaging techniques; do not copy their visual language by default. Git stores only one or two representative screenshots per example; CI retains full acceptance matrices.

Heavy, specialized runtimes are opt-in. Materialize the matching proof or add only the required capability:

```bash
npm run capability:add -- pdf
npm run capability:add -- video
```

Ordinary apps receive neither PDF.js nor hls.js.

## Commands

| Purpose | Command |
|---------|---------|
| Development build | `npm run build:development` |
| Production build | `npm run build:production` |
| Identity/brief/datasource/legacy/package gates | `npm run validate:package` |
| Repository example/tool tests | `npm run validate:examples` |
| Repository context/image budgets | `npm run validate:context-budget` / `npm run validate:image-budget` |
| Validate wayfinding | `npm run wayfinding:validate -- ...` |
| Assess wayfinding evidence/mode | `npm run wayfinding:assess -- --project wayfinding-project.json` |
| Prepare/promote maintained review | `npm run example:review:prepare -- <id>` / `npm run example:review:promote -- <id>` |
| Accepted delivery | `npm run deliver -- <output-directory>` |
| Browserless transfer | `npm run deliver:unverified -- <output-directory>` |
| Lint / fix | `npm run lint` / `npm run lint:fix` |
| Format TypeScript | `npm run prettify` |

`deliver` creates an upload ZIP and a separate sanitized source ZIP plus manifest, brief, and datasource sidecars. Upload only the app ZIP. `_UNVERIFIED` packages have `uploadReady: false` and require normal delivery elsewhere.

## Build Output

```text
dist/
|- assets/app.js
|- assets/app-chrome-49.js
`- editor-assets/
   |- config.json
   |- icon.png
   `- placeholder.png
```

Production uses INFO-level logging without source maps; development includes debug logging and source maps. The IIFE bundles isolate globals.

`properties.json` name plus integer version is runtime identity. Preserve both for compatible replacement uploads. Use a new name for a separate app; increment a version only for a deliberately incompatible separate upload.
