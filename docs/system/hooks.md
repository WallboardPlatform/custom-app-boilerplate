# Hooks

Files under `src/hooks/system/` are protected SDK bridges. Import them; do not modify, move, or duplicate them.

| Hook | Use |
|------|-----|
| `useSettings()` | Primary reactive accessor for mapped editor settings |
| `useDataSources()` | Reactive accessor for all bound datasource values |
| `useConfig()` | Raw configuration only when mapped settings/data are insufficient |
| `useExternalCommandListener()` | Declared Wallboard commands with automatic cleanup |
| `useService()` | Resolve a class registered in `src/services.ts` |
| `getMetadata()` | SDK factories and logging |
| `useInterceptor()` | Rare direct media-cache coordination in displayer mode |
| `getApplicationState()` | Internal foundation; normally use a higher-level hook |
| `useAutoFitText()` | Bounded single-line variable primary text |
| SDK `useWeather(getMetadata())` | Platform-owned current conditions, forecast, refresh, and cached condition media; see `weather-window` |

## Auto-Fit Text

Use for a title or hero value that must remain complete inside a known box:

```tsx
const fitTitle = useAutoFitText({
	minFontSize: 18,
	maxFontSize: 52,
	widthOnly: true,
	watch: (): string => settings().title
});

return <h1 ref={fitTitle}>{settings().title}</h1>;
```

CSS remains the maximum-size authority. The hook resets the inline size, reads the computed maximum, observes the element with `ResizeObserver`, and picks the largest whole-pixel fit. It does not prove painted glyph clearance: keep safe line-height and vertical padding.

Do not apply auto-fit to paragraphs, intentional multiline headings, every table cell, or repeated list labels. Use wrap/line limits/pagination/ellipsis with explicit fallbacks there.

## Custom Hooks

Create `src/hooks/custom/use<Name>.ts` for reusable reactive logic, combined system hooks, memoized transformations, or lifecycle-managed timers/listeners. Keep one-off logic in its component and stateless domain logic in utilities/services.

Rules:

- Prefix `use` and return a typed object/accessor.
- Compose system hooks rather than reading platform globals.
- Use `onCleanup` for every owned resource.
- Avoid hiding datasource normalization or large visual components inside hooks.
- Prefer pure exported helpers beside a hook when behavior can be tested without SolidJS lifecycle.
