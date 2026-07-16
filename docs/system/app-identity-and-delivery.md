# App Identity and Delivery

## Runtime Identity

Wallboard identifies a custom app by the values inside `src/editor-assets/properties.json`, not by the administrator-facing record name.

```text
customApp_<config.name>_<config.version>
```

| Change | `name` | `version` | Wallboard action |
|--------|--------|-----------|------------------|
| Visual, logic, settings, or data fix compatible with placed widgets | Preserve | Preserve | Upload to the existing app record. |
| Separate use case that must coexist | New unique name | Start at `1` | Create one new app record. |
| Deliberately incompatible app generation | Preserve | Increment integer | Create a separate app record and warn that existing placements are not migrated. |

Never create two app records with the same internal `name` and `version`. The editor keeps one generated widget type, while public resource resolution returns an arbitrary first match. Disabling a duplicate is not sufficient on servers where public resolution does not filter disabled records; remove the duplicate or update the original record.

Run `npm run validate:identity` before packaging. It validates the numeric version format required by the legacy editor and prints the exact runtime identity.

## Delivery Contract

Run:

```bash
npm run deliver -- <output-directory>
```

The command runs identity, generation-brief project synchronization, datasource, script typecheck, lint, visual, legacy bundle, and package-asset validation. It creates:

```text
<output-directory>/
|- <App_Name>_<version>.zip
|- <App_Name>_<version>_source.zip
|- delivery-manifest.json
|- generation-brief.json
|- visual-review.json
|- datasource-contract.json   # data-bound apps only
`- sample-datasource.json     # data-bound apps only
```

Use a new directory or reuse the directory from the previous delivery of the same app. The command replaces known delivery files and fails rather than mixing a new manifest with unrelated or stale artifacts.

`generation-brief.json` records the accepted contract. `visual-review.json` proves that every current screenshot was inspected against the current reachable app source, prompt/reference direction, readability, theme contrast, composition, text safety, assets, and example sameness. Both remain delivery sidecars, not app-ZIP files.

The source ZIP is a separate agent/developer handoff and must never be uploaded as the Wallboard app package. It contains the buildable project while excluding `.npmrc`, environment files, `config.json`, private keys, archives, dependencies, generated output, caches, preview screenshots, and the delivery directory. The manifest records its SHA-256 hash, file count, Git commit when available, and whether the working tree was clean. A dirty source archive remains complete, but its commit alone does not reproduce the local changes.

`deliver` always runs visual validation and rejects missing, incomplete, or stale visual-review evidence. Package-only diagnostics are not accepted delivery evidence; move the source ZIP to an environment with Playwright support and run `deliver` there instead of bypassing visual checks.

### Browserless handoff

If the current environment cannot run any browser, use:

```bash
npm run deliver:unverified -- <output-directory>
```

This runs every non-visual delivery gate and creates `<App_Name>_<version>_UNVERIFIED.zip` plus `<App_Name>_<version>_UNVERIFIED_source.zip`. Manifest version `3` records `acceptance.status: "unverified"`, `acceptance.uploadReady: false`, the missing visual evidence, and `validation.visual: false`. The names and manifest are deliberate guardrails: do not upload or describe these artifacts as accepted. Move the source ZIP to a browser-capable environment and run normal `deliver`; accepted manifests set `acceptance.status: "accepted"` and `acceptance.uploadReady: true`.

Browser resolution order is explicit executable path, explicit Playwright channel, Playwright cache, then installed Chrome/Edge. Configure `WALLBOARD_PLAYWRIGHT_EXECUTABLE_PATH`, `WALLBOARD_PLAYWRIGHT_CHANNEL`, or the standard `PLAYWRIGHT_BROWSERS_PATH` when automatic discovery is unsuitable.

For data-bound apps, the ZIP also contains:

```text
editor-assets/datasource-contract.json
editor-assets/datasource-template.json
```

Current Wallboard versions store these files but do not provision datasources from them. The human or API creates/imports generated sources or selects supplied existing sources, then binds every property named by the contract. A future customer-facing installer can consume the same packaged template and manifest to create generated datasources, bind existing ones, and expose eligible data through quick editing without changing the app contract.

## Installation Check

1. Ensure no existing app record has the same internal identity unless this is a replacement upload.
2. Upload to the existing record for replacements; otherwise create one record, upload, enable, and assign it.
3. For data-bound apps, create/import or select the required datasources and bind every declared property.
4. Edit one value and confirm the placed widget updates without rebuilding the ZIP or changing the app version.
