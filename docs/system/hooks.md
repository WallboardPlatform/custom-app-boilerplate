# Hooks

Files under `src/hooks/system/` are protected SDK bridges. Import them; do not modify, move, or duplicate them.

| Hook | Use |
|------|-----|
| `useSettings()` | Primary reactive accessor for mapped editor settings |
| `useDataSources()` | Reactive accessor for all bound datasource values |
| `useConfig()` | Raw configuration only when mapped settings/data are insufficient |
| `useExternalCommandListener()` | Declared Wallboard commands with automatic cleanup |
| `useSensorEventListener()` | Every incoming sensor event in the displayer, with automatic cleanup |
| `useService()` | Resolve a class registered in `src/services.ts` |
| `getMetadata()` | SDK factories and logging |
| `useInterceptor()` | Rare direct media-cache coordination in displayer mode |
| `getApplicationState()` | Internal foundation; normally use a higher-level hook |
| `useAutoFitText()` | Bounded single-line variable primary text; `ResizeObserver` with a legacy dimension-polling fallback |
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

## Sensor Events

`useSensorEventListener(callback, options?)` delivers **every** sensor event the displayer receives - hardware sensors, MQTT/UDP/HTTP bridges, backend-sent events, and events emitted by other apps - before the content's own sensor actions run. Deciding what to react to is the widget's job; the hook never filters by event name.

```tsx
import { useSensorEventListener } from '@hooks/system/useSensorEventListener';
import type { SensorEvent } from '@hooks/system/useSensorEventListener';

useSensorEventListener((sensorEvent: SensorEvent): void => {
	if (sensorEvent.event !== 'motion') {
		return;
	}

	setPresence(String(sensorEvent.value) === '1');
}, { ignoreOwn: true });
```

- Payload is `{ id?: string; event?: string; value?: unknown }`. `id` is the sensor identifier (or the emitting app instance), `value` stays `unknown` because app-emitted events may carry any JSON value. Malformed payloads are dropped before the callback.
- **Echo.** `IApiService.triggerSensorEvent()` stamps the event with this app instance's id, so an app receives its own events back. Pass `{ ignoreOwn: true }` to skip them; the default delivers everything.
- **Availability.** Displayer only, and the device needs a sensor-capable license (Premium/Broadcaster). In the editor and on clients without the bridge the hook is inert: no callback, no throw, and the returned disposer is a no-op. Design a working default state for that case.
- **Instances.** Every widget instance registers its own listener and receives every event; deduplicate per instance if that matters.
- The returned disposer also runs on `onCleanup`; call it manually only to stop listening early.

Test it in the preview with `__wallboardPreview.pushSensorEvent()`, and reproduce the degraded path with the `sensorSource: 'unavailable'` platform fixture or the `?sensorSource=unavailable` preview query:

```ts
await page.evaluate((): void => {
	window.__wallboardPreview.pushSensorEvent({ id: 'X001A', event: 'motion', value: '1' });
});
```

## Custom Hooks

Create `src/hooks/custom/use<Name>.ts` for reusable reactive logic, combined system hooks, memoized transformations, or lifecycle-managed timers/listeners. Keep one-off logic in its component and stateless domain logic in utilities/services.

Rules:

- Prefix `use` and return a typed object/accessor.
- Compose system hooks rather than reading platform globals.
- Use `onCleanup` for every owned resource.
- Avoid hiding datasource normalization or large visual components inside hooks.
- Prefer pure exported helpers beside a hook when behavior can be tested without SolidJS lifecycle.
