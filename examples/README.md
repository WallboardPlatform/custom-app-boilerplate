# Examples

Examples are thin overlays on the current boilerplate, not copied projects. This keeps build tooling, SDK setup, preview behavior, and packaging rules in one source of truth.

Each example contains:

```text
examples/<id>/
|- example.json      # description and base files to remove
|- generation-brief.json  # validated request, design, data, and evidence contract
|- datasource-contract.json  # optional generator metadata for data-bound examples
|- sample-datasource.json     # optional native Wallboard datasource data
`- overlay/          # files copied over a clean boilerplate materialization
```

| Example | Capability | Verified states |
|---------|------------|-----------------|
| `airport-departures` | Editable `TABLE` flight board, adaptive pagination, status hierarchy | Default, wide/low, portrait, square, empty, invalid rows, long labels, odd/maximum counts, row array, last page, live update |
| `kpi-operations` | Hierarchical `CUSTOM` contract, KPI cards, responsive Chart.js trend, target progress | Default, wide/low, portrait, square, empty, long labels, live update |
| `market-rotation-ticker` | Five existing bindings, heterogeneous response normalization, File System logo lookup, continuous marquee | 6000x136, standard layouts, empty, invalid prices, missing icons, short data, rotation completion, moving title |
| `restaurant-menu` | Photo-to-menu pattern, editable table contract, grouping and pagination | Default, wide/low, portrait, square, static, empty, bound-null, long labels, last page |

Reference screenshots live beside each example under `screenshots/`.

Materialize without changing this worktree:

```bash
npm run example:materialize -- <id> <target-directory>
cd <target-directory>
npm run setup
npm run validate:examples
npm run validate:visual
npm run validate:package
```

The explicit target must be new or empty. Run `npm run validate:examples` in the boilerplate before materialization and again in the materialized project after changing its contract or sample data. Files listed in `example.json.artifacts` are copied to the materialized project root but are not bundled into the app zip.

Run `npm run example:accept -- <id>` for the clean materialization, complete validation matrix, and delivery bundle. An example is accepted only when its default and named scenarios pass, every screenshot is inspected, packaged assets pass validation, datasource live updates work when applicable, and its zip works after a real Wallboard upload.

Every example includes a generation brief whose settings and evidence match the materialized app. An example may add `overlay/preview/*.spec.ts` for requirements that cannot be proven by the generic visual suite, such as continuous coverage, animation progress, or interaction timing.
