---
sidebar_position: 1
---

# Wallboard Application Boilerplate

This guide shows you how to install and start WB Application Boilerplate.  
You can download the **Boilerplate** for *Applications* from *Administrator* > *System Settings* (**2.1 UI!**) on your server.

### Node.js Version: `24.9.0`

Make sure you installed the required NodeJS version before trying to install the Boilerplate project!  
The required NodeJS version is `24.9.0` which can be downloaded from [**here**](https://nodejs.org/en/blog/release/v24.9.0).

---

## Installation

1. Extract [**wb-apps-boilerplate.rar**](https://apps.wallboard.info/app-boilerplate/wb-apps-boilerplate.rar)
2. **Request `.npmrc` file:**  
   To request a `.npmrc` file, contact **support@wallboard.info**. This file is needed to get access to the `wallboard-app-sdk`, which is required to start your app in our editor/displayer and to communicate with our system.
3. Paste your `.npmrc` file next to the **package.json** file.
4. Install the necessary dependencies:
```bash
    npm install
```
5. Copy the sample config file:
```bash
    cp config.json.sample config.json
```

---

## Important Steps Before Running

### Configuration (config.json)

Before running the application, you need to configure the following properties in `config.json`:

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

### Environment Variables

The build process supports the following environment variables:

- **`SIMPLE_OUTPUT=true`** - Enables simple console output (useful for CI/CD environments)
- **`DISABLE_MINIO_UPLOAD=true`** - Skips MinIO upload even if configured
- **`DO_APPLICATION_ZIP=true`** - Creates a zip archive after build completion

You don't need to configure these environment variables if you are using one of the pre-written package scripts.

---

## How to Run

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