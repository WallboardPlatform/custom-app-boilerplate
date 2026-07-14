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

The command runs identity, datasource, lint, visual, legacy bundle, and package-asset validation. It creates:

```text
<output-directory>/
|- <App_Name>_<version>.zip
|- delivery-manifest.json
|- datasource-contract.json   # data-bound apps only
`- sample-datasource.json     # data-bound apps only
```

Use a new directory or reuse the directory from the previous delivery of the same app. The command replaces known delivery files and fails rather than mixing a new manifest with unrelated or stale artifacts.

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
