# Wallboard Custom App Boilerplate

Public SolidJS boilerplate for uploadable Wallboard custom apps.

## Setup

Requirements: Node `24.9+` (preferred) or `22.22+`.

```bash
git clone https://github.com/WallboardPlatform/custom-app-boilerplate.git
cd custom-app-boilerplate
npm run setup
```

`setup` resolves the latest `wallboard-app-sdk` from anonymous Wallboard Nexus. If Nexus metadata or the download is unavailable, it selects the highest stable SDK version published in this repository's GitHub releases, ignoring drafts, prereleases, and unrelated releases. It verifies the tarball against GitHub's asset SHA-256 and prints the selected version and source. The mirror can lag Nexus until the new SDK is uploaded.

Setup saves an exact tarball URL in `package.json`; `npm install` updates the lockfile without deleting unrelated dependency pins. Use `npm ci` for repeatable builds of an existing app; running `npm run setup` again intentionally resolves the latest SDK again. Pin a version with:

```bash
npm run setup:sdk -- --version 2.0.109
npm install --registry=https://registry.npmjs.org/
```

Explicit versions use that exact version from Nexus or GitHub and fail if it is unavailable; they never switch to another release.

Optional setup variables: `WALLBOARD_SDK_REGISTRY`, `WALLBOARD_APP_SDK_VERSION`, and `WALLBOARD_APP_SDK_FALLBACK_VERSION` (overrides mirror discovery only for `latest`). A custom `WALLBOARD_APP_SDK_FALLBACK_URL` also requires an exact requested/fallback version and `WALLBOARD_APP_SDK_FALLBACK_SHA256`. Normal GitHub releases need no checksum configuration.

### Maintaining the SDK mirror

After a new stable SDK is published to Nexus:

1. Download its original `wallboard-app-sdk-<version>.tgz` from Nexus's `dist.tarball` URL and verify it against `dist.integrity`. Do not rebuild or repack it.
2. Create a draft release in this repository with tag `wallboard-app-sdk-<version>`, attach `wallboard-app-sdk-<version>.tgz`, then publish it as a normal release after the upload finishes. Retain existing versioned releases for pinned consumers.
3. Verify the uploaded tarball matches the Nexus package and its GitHub asset has a `sha256:` digest. Test discovery from a disposable app directory with `WALLBOARD_SDK_REGISTRY=http://127.0.0.1:9/ npm run setup:sdk` (Bash syntax), then run `npm install --registry=https://registry.npmjs.org/`.

New releases are discovered automatically: no setup-script version or checksum edits are needed. The repository's committed `package.json` and `package-lock.json` are separate tested dependency pins; update those together only when upgrading the SDK used by CI. GitHub mirror uploads are manual; there is no scheduled synchronization.

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
| Author and publish a wayfinding map | [Wayfinding Studio](https://wayfinding.wallboard.info) |
| Build a wayfinding custom app | [`docs/system/wayfinding.md`](docs/system/wayfinding.md), the opt-in `wayfinding` capability, and `examples/wayfinding-kiosk` |
| Prepare/promote maintained review | `npm run example:review:prepare -- <id>` / `npm run example:review:promote -- <id>` |
| Accepted delivery | `npm run deliver -- <output-directory>` |
| Browserless transfer | `npm run deliver:unverified -- <output-directory>` |
| Lint / fix | `npm run lint` / `npm run lint:fix` |
| Format TypeScript | `npm run prettify` |

The tracked-image review threshold is 10 MiB, not an absolute ceiling. A justified repository-level exception must raise `approvedBudgetMiB` in `image-budget-policy.json` and record why the additional visual evidence or source fidelity is worth the clone cost.

`deliver` creates an upload ZIP and a separate sanitized source ZIP plus manifest, brief, and datasource sidecars. Upload only the app ZIP. `_UNVERIFIED` packages have `uploadReady: false` and require normal delivery elsewhere.

Wayfinding uses distinct editable `.wbwayfinding`, published `.wbmap`, versioned mini-displayer, and accepted custom-app ZIP artifacts. Author and publish maps with [Wayfinding Studio](https://wayfinding.wallboard.info), then add the checksum-pinned `wayfinding` capability for the canonical viewer and map-agnostic lifecycle harness. See [`docs/system/wayfinding.md`](docs/system/wayfinding.md); `examples/wayfinding-kiosk` is the canonical consumer and its compact synthetic map is not a production venue asset.

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
