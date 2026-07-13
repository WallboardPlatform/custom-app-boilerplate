# Charting

Use charts only when they improve comparison, trend, composition, or threshold reading. A large number with a clear delta is better than a decorative chart.

## Library Choice

| Need | Library | Rule |
|------|---------|------|
| KPI trends, line/bar/doughnut charts, compact dashboards | Chart.js | Default; already included and production-proven in Wallboard apps. |
| Treemaps, heatmaps, maps, dense multi-axis or advanced interaction | Apache ECharts | Optional; install per app and tree-shake imports. |

Do not import either library's all-in-one entry in production examples. Chart.js is tree-shakeable, so register only required controllers, elements, scales, and plugins. ECharts should use `echarts/core`, selected charts/components, and one renderer.

Chart.js is already installed. Add ECharts only when selected: `npm install echarts --save`.

Official references: [Chart.js integration](https://www.chartjs.org/docs/latest/getting-started/integration), [Chart.js responsive charts](https://www.chartjs.org/docs/latest/configuration/responsive.html), [ECharts imports](https://echarts.apache.org/handbook/en/basics/import/), [ECharts sizing](https://echarts.apache.org/handbook/en/concepts/chart-size/).

## Wallboard Contract

- Give the canvas/chart a dedicated `position: relative` parent with explicit flex-derived width and height.
- For Chart.js use `responsive: true`, `maintainAspectRatio: false`, and disable animation for signage unless animation is requested.
- Destroy chart instances in `onCleanup`.
- Resize ECharts after container changes and dispose it in `onCleanup`.
- Keep labels and legends outside the plot when they compete with the primary value.
- Test no-data, one-point, long-label, dense-series, wide/low, portrait, and default states.
- Keep colors setting-driven and ensure series remain distinguishable without relying on red/green alone.
