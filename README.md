---
sidebar_position: 1
---

# Wallboard Application Boilerplate

This guide shows you how to install and start WB Application Boilerplate.
Clone the public repository from [WallboardPlatform/custom-app-boilerplate](https://github.com/WallboardPlatform/custom-app-boilerplate).

### Node.js Version: `24.9.0`

Make sure you installed the required NodeJS version before trying to install the Boilerplate project!  
The required NodeJS version is `24.9.0` which can be downloaded from [**here**](https://nodejs.org/en/blog/release/v24.9.0).

---

## Installation

1. Clone the boilerplate:
```bash
    git clone https://github.com/WallboardPlatform/custom-app-boilerplate.git
    cd custom-app-boilerplate
```
2. Configure the public Wallboard SDK package and install dependencies:
```bash
    npm run setup
```
   The setup script uses public npm for normal packages. For `wallboard-app-sdk`, it prefers the anonymous Wallboard Nexus tarball and automatically falls back to a GitHub Release asset when Nexus is not reachable from the current environment.
3. Optional: copy the sample config file if you need a fixed zip output directory or MinIO upload:
```bash
    cp config.json.sample config.json
```
   For the normal local zip workflow, `config.json` is not required. The build reads app name and version from `src/editor-assets/properties.json` and writes the zip to Desktop when `zipOutput` is not configured.

To pin a specific SDK version instead of the latest available one:
```bash
    npm run setup:sdk -- --version 2.0.85
    npm install --registry=https://registry.npmjs.org/
```

The default GitHub fallback asset is published at:

```text
https://github.com/WallboardPlatform/custom-app-boilerplate/releases/download/wallboard-app-sdk-2.0.85/wallboard-app-sdk-2.0.85.tgz
```

Optional setup overrides:

| Variable | Purpose |
|----------|---------|
| `WALLBOARD_SDK_REGISTRY` | Override the preferred SDK npm registry. |
| `WALLBOARD_APP_SDK_VERSION` | Pin the SDK version without passing `--version`. |
| `WALLBOARD_APP_SDK_FALLBACK_VERSION` | Override the GitHub fallback version used when requested version is `latest`. |
| `WALLBOARD_APP_SDK_FALLBACK_URL` | Override the GitHub fallback tarball URL. |
| `WALLBOARD_APP_SDK_FALLBACK_SHA256` | Override the fallback checksum verification value. |

---

## Important Steps Before Running

### Production widget guidance

Before building an app, create the prompt-to-project contract described in [`docs/system/generation-brief.md`](docs/system/generation-brief.md) and run `npm run validate:brief`. After implementation, `npm run validate:project` proves that the project matches the accepted contract. Then follow [`docs/system/widget-best-practices.md`](docs/system/widget-best-practices.md) and [`docs/system/app-identity-and-delivery.md`](docs/system/app-identity-and-delivery.md). For data-bound apps, also read [`docs/system/datasource-contracts.md`](docs/system/datasource-contracts.md) before choosing or generating a datasource structure.

### Configuration (config.json)

`config.json` is optional for local zip builds. Create it only when you need these properties:

- **`id` property:**  
  Set your unique widget/application ID. This is used for MinIO uploads and identification.

- **`minio` property:** *(Only for Wallboard systems which are runs in Docker environment)*  
  Configure MinIO settings if you want automatic uploads after build:

- **`zipOutput` property:** *(Optional)*  
  Set the path where zip files should be saved.  
  **By default, this property is empty**, and the zip output will be saved to your **Desktop** folder.

```json
  {
    "id": "your-widget-id",
    "minio": {
      "host": "your-minio-host",
      "port": 9000,
      "useSSL": true,
      "accessKey": "your-minio-access-key",
      "secretKey": "your-minio-secret-key",
      "bucket": "your-minio-bucket-name"
    },
    "zipOutput": "C:/path/to/output"
  }
```

### Update app name  
  Ensure that the app name in `src/editor-assets/properties.json` is unique compared to other applications in your Wallboard system.

### Preserve app version

`name` plus `version` identifies the custom app runtime. When fixing or rebuilding an app that will replace an existing upload, keep `properties.json.version` unchanged. Change it only for a deliberately incompatible major variant, and upload that variant as a separate app so existing content keeps resolving its original runtime.

### Environment Variables

The build process supports the following environment variables:

- **`SIMPLE_OUTPUT=true`** - Enables simple console output (useful for CI/CD environments)
- **`DISABLE_MINIO_UPLOAD=true`** - Skips MinIO upload even if configured
- **`DO_APPLICATION_ZIP=true`** - Creates a zip archive after build completion

You don't need to configure these environment variables if you are using one of the pre-written package scripts.

---

## How to Run

### Local visual preview

Edit `preview/fixture.ts` with representative settings and datasource values, then start the preview:

```bash
npm run dev:preview
```

Open `http://127.0.0.1:5173/preview/`. The preview runs the real application entry point inside an isolated Wallboard-like surface. Use the presets or enter the exact target zone dimensions; the iframe keeps the native widget size and is only visually scaled to fit the browser.

Run the automated viewport pass before packaging:

```bash
npx playwright install chromium
npm run validate:visual
```

This captures full HD, wide/low, landscape, portrait, and square screenshots in `preview/output/`. It fails on runtime errors, horizontal or vertical overflow, or visible elements outside the assigned zone. Define `previewScenarios` in `preview/fixture.ts` for empty, long-label, odd-count, last-page, and other materially different states. Inspect every screenshot because automated checks cannot judge hierarchy, density, typography, or unused space.

### Examples and charts

Materialize a thin example overlay into an isolated directory:

```bash
npm run example:materialize -- kpi-operations ../kpi-operations
```

An explicit target must be a new or empty directory. Omitting it uses the replaceable generated path under `.tmp/examples/`.

See [`examples/README.md`](examples/README.md) for the overlay contract, [`docs/system/datasource-contracts.md`](docs/system/datasource-contracts.md) for data-bound widgets, and [`docs/system/charting.md`](docs/system/charting.md) for Chart.js and optional ECharts guidance.

Run the complete acceptance and delivery workflow for an example with:

```bash
npm run example:accept -- restaurant-menu
```

For a finished materialized app, run `npm run deliver -- <output-directory>`.

### Development Builds

Development builds include detailed logging and are optimized for debugging:

- **Standard Development Build**:
```bash
    npm run build:development
```

- **Development Build with Zip**:
```bash
    npm run build:development:zip
```

---

### Production Builds

Production builds are optimized for performance with minimal logging:

- **Standard Production Build**:
```bash
    npm run build:production
```

- **Production Build with Zip**:
```bash
    npm run build:production:zip
```

- **Production Build with Package Validation**:
```bash
    npm run validate:package
```

---

## Build Process Overview

The build process consists of multiple steps:

1. **Modern Build** - Vite builds the modern JavaScript bundle
2. **Copy Assets** - Editor assets are copied to the dist folder
3. **Chrome 49 Build** - Legacy browser support bundle is created by `webpack`
4. **MinIO Upload** *(optional)* - Files are uploaded to MinIO if configured and available
5. **Zip Creation** *(optional)* - Archive is created if `DO_APPLICATION_ZIP=true`

### Build Outputs

After a successful build, you'll find:

- `dist/` - Main build output directory
  - `assets/` - Application assets and bundles
    - `app.js` - Modern browser bundle
    - `app-chrome-49.js` - Legacy browser bundle
  - `editor-assets/` - Editor configuration files
    - `config.json` - Config file used by Wallboard system (it is created from *src/editor-assets/properties.json*)
    - `icon.png` - Application icon (it is created from *src/editor-assets/icon.png*)
    - `placeholder.png` - Placeholder icon (it is created from *src/editor-assets/placeholder.png*)
    - `...` - Other files and folders from the `editor-assets` folder.

If zip creation is enabled, you'll also get a zip file named `{app-name}_{version}.zip` in your configured output location or Desktop.

---

## Difference between Production and Development Build

### Development Mode
When you build your application in *Development* mode, the `LoggerService` logs are displayed in the browser console to help you with debugging and tracking events. 
This is useful for developers to monitor application behavior in real-time, as all log messages are outputted regardless of their severity.

### Production Mode
When you build your application in *Production* mode, the logging is typically more restrictive to improve performance and avoid exposing sensitive information. 
In this case, the `LoggerService` or `createLogger` factory function will only output logs that are equal to or above the pre-configured minimum log level. (*INFO*)

## Code Quality

### Linting

Check your code for issues:
```bash
npm run lint
```

Automatically fix linting issues:
```bash
npm run lint:fix
```

### Code Formatting

Format your code with Prettier:
```bash
npm run prettify
```
