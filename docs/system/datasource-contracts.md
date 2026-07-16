# Datasource Contracts

Choose the datasource contract before implementing a data-bound widget. The visual layer may change freely; the runtime must consume one explicit, typed contract.

## Selection Order

| Priority | Condition | Contract |
|----------|-----------|----------|
| 1 | User supplies a schema or representative payload | Use it exactly, with an explicit field mapping. Prefer `TABLE` when the payload is row-compatible. |
| 2 | Request clearly targets a built-in Wallboard source | Reuse that source contract. Normalize documented provider variants at one application boundary. |
| 3 | Data is user-maintained or can be expressed as records | Generate an internal `TABLE` contract. This is the default fallback. |
| 4 | Data is inherently hierarchical and flattening would lose required meaning | Use `CUSTOM` and document why `TABLE` is insufficient. |
| 5 | No runtime data changes are needed | Keep the widget static and omit the datasource picker. |

Do not choose `CUSTOM` because the input arrived as JSON. Menus, price lists, departures, inventory, directories, queues, leaderboards, and most dashboards are tables even when their source is a photo, spreadsheet, API response, or prompt.

## Built-In Contracts

| Request | Preferred contract | Runtime rule |
|---------|--------------------|--------------|
| RSS, news, social or article feed | Wallboard Feed | Consume the integrated feed shape; do not generate a parallel table schema. |
| Meetings, room schedules, agendas backed by Google, Microsoft, or iCalendar | Wallboard Calendar | Normalize supported provider payloads into one typed event model. |
| Existing datasource named by the user | Existing schema | Inspect schema and representative data before coding. Never infer fields from the datasource name. |

Add other built-in contracts only after verifying their current platform payload. A domain label alone is not proof that a built-in contract exists.

## Multiple Existing Bindings

Use `bindings[]` when one app intentionally consumes independently configured sources. Do not create a synthetic aggregate merely to fit a single datasource picker.

```json
{
  "contractVersion": 1,
  "bindings": [
    {
      "property": "marketData",
      "dataPickerType": "any",
      "source": {
        "contract": "EXISTING",
        "sampleData": "sample-datasource.json",
        "samplePath": "market"
      },
      "delivery": {
        "suggestedDatasourceName": "Market Data",
        "quickEditEligible": false
      }
    }
  ]
}
```

Rules:

- Declare every `dataPicker` exactly once. A missing or duplicate binding fails validation.
- Keep one shared, sanitized `sample-datasource.json`; `samplePath` selects each source's representative value.
- Declare top-level `"sampleDataClassification": "synthetic"`. Validation rejects missing classification, Wallboard environment URLs, production-shaped IDs, non-reserved email/URL hosts, and non-sentinel credentials.
- Use `EXISTING` only for a supplied and inspected runtime shape. Normalize provider differences at one typed application boundary.
- Preserve independent bindings when sources have different ownership, refresh cadence, credentials, or structure.
- Never publish live datasource IDs, customer IDs, private payloads, or storage URLs in examples or delivery templates.

## Table Contract

Generated table data uses Wallboard's native internal datasource shape:

```json
{
  "TableName": {
    "header": { "column": "string" },
    "rows": [{ "column": "value" }],
    "connectors": {}
  }
}
```

Rules:

- Use stable ASCII field names and user-facing values in the requested language.
- Add explicit numeric order columns when display order matters.
- Keep display strings such as formatted prices as `string` when values may contain units, ranges, or labels.
- Use `boolean` for availability and visibility instead of deleting temporarily unavailable records.
- Flatten repeated entities into rows. Group them in the widget using keys such as `section` and `sectionOrder`.
- Keep datasource IDs out of source code and generated artifacts.

## Binding Type Is Different

`structureType` describes backend datasource storage. `dataPickerType` controls editor binding and output processing; they are not interchangeable.

| `dataPickerType` | Use |
|------------------|-----|
| `any` | App receives the full selected value and owns bounded normalization. This is the proven default in production custom apps. |
| `anyWithFilter` | User must select/filter one collection and the app is verified against that processed output. |
| `table` | Specialized built-in table-widget processing. Do not select it merely because the datasource `structureType` is `TABLE`. |

## Generated Artifacts

A custom-schema example or deliverable includes:

| File | Purpose |
|------|---------|
| `generation-brief.json` | Accepted request and evidence contract; its datasource bindings must match this contract and `properties.json`. |
| `datasource-contract.json` | Generator metadata: one binding or `bindings[]`, source contracts, columns, accepted runtime shapes, and empty-state behavior. Not uploaded to Wallboard. |
| `sample-datasource.json` | Importable native data for generated sources, or a sanitized representative bundle for existing bindings. |
| `preview/fixture.ts` | Uses the same sample contract and adds boundary scenarios. |
| App zip | Contains the contract and template under `editor-assets/`, but no datasource ID. |
| `delivery-manifest.json` | Connects app identity, zip, binding property, sidecars, and quick-edit eligibility. |

For `TABLE`, accept only documented wrappers at the application boundary: native `{TableName:{header,rows,connectors}}`, the selected table object `{header,rows,connectors}`, or a processed row array. Do not recursively search arbitrary JSON for a plausible array.

## Handoff

Uploading the app zip does not yet create or select a datasource. A data-bound delivery includes:

1. App zip for a Wallboard super administrator to upload, enable, and assign as described in `widget-best-practices.md`.
2. `sample-datasource.json` for creating or importing the internal datasource through the available Wallboard UI or API.
3. The binding property name or names from `datasource-contract.json` so the installed app can be connected to every datasource.
4. A live-edit check: change one datasource row and confirm that the placed app updates without rebuilding or changing its app version.

`npm run deliver -- <output-directory>` also embeds the contract and template in the zip for the planned customer-facing provisioning flow. Until that platform flow exists, datasource creation remains a separate operation and does not need to happen through MCP. For a verified built-in Feed or Calendar contract, bind the existing integrated datasource instead of creating the sample table.

## Validation

Test unbound, empty, invalid-row, long-value, maximum-row, odd-group, last-page, and live datasource-update states as applicable. Unbound may show representative sample content. A bound but empty or invalid datasource must show an explicit empty/error state, never silently replace customer data with samples.

Run `npm run validate:examples` to verify contract artifacts against each example's data picker and sample data.
Every example containing a datasource picker must declare a contract. Materialized data-bound projects validate the copied root contract and sample, so rerun the command after changing either artifact.
