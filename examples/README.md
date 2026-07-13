# Examples

Examples are thin overlays on the current boilerplate, not copied projects. This keeps build tooling, SDK setup, preview behavior, and packaging rules in one source of truth.

Each example contains:

```text
examples/<id>/
|- example.json      # description and base files to remove
`- overlay/          # files copied over a clean boilerplate materialization
```

| Example | Capability | Verified states |
|---------|------------|-----------------|
| `kpi-operations` | KPI cards, responsive Chart.js trend, target progress | Default, wide/low, portrait, square, empty, long labels |

Reference screenshots live beside each example under `screenshots/`.

Materialize without changing this worktree:

```bash
npm run example:materialize -- <id> <target-directory>
cd <target-directory>
npm install
npm run validate:visual
npm run validate:package
```

An example is accepted only when its default and named scenarios pass, every screenshot is inspected, packaged assets pass validation, and its zip works after a real Wallboard upload.
