import { onCleanup } from 'solid-js';

import { createLogger } from 'wallboard-app-sdk';
import type { ILoggerService, Metadata, MetadataProvider } from 'wallboard-app-sdk';

import { getMetadata } from '@hooks/system/getMetadata';

/**
 * A single sensor event delivered by the displayer.
 *
 * Hardware sensors send `id`, `event` and `value` as strings. Events emitted by an
 * application through `IApiService.triggerSensorEvent()` may carry any JSON value,
 * therefore `value` stays `unknown` and must be narrowed before use.
 */
export interface SensorEvent {
	id?: string;
	event?: string;
	value?: unknown;
}

export interface SensorEventListenerOptions {
	/**
	 * Drop the events this application instance emitted itself through
	 * `IApiService.triggerSensorEvent()`. Defaults to `false`, so every event is delivered.
	 */
	ignoreOwn?: boolean;
}

interface SensorEventInteractionApi {
	addSensorEventListener?: (listener: (sensorEvent: unknown) => void) => void;
	removeSensorEventListener?: (listener: (sensorEvent: unknown) => void) => void;
}

interface SensorCapableScriptApi {
	interaction?: SensorEventInteractionApi;
}

const noopDispose = (): void => undefined;

/**
 * Resolves the displayer's sensor bridge.
 *
 * The bridge is a displayer-only global. The editor, the preview in editor mode and clients
 * without the feature simply do not expose it, so a missing bridge is expected, not an error.
 */
function resolveInteractionApi(): SensorEventInteractionApi | undefined {
	const scriptApi: SensorCapableScriptApi | undefined = (
		window as unknown as { customScriptAPI?: SensorCapableScriptApi }
	).customScriptAPI;

	const interaction: SensorEventInteractionApi | undefined = scriptApi?.interaction;

	if (typeof interaction?.addSensorEventListener !== 'function') {
		return undefined;
	}

	return interaction;
}

/**
 * Reads a sensor identifier field. Only primitives carry meaning here, anything else is dropped
 * instead of being stringified into '[object Object]'.
 */
function toIdentifier(value: unknown): string | undefined {
	if (typeof value === 'string') {
		return value;
	}

	if (typeof value === 'number' || typeof value === 'boolean') {
		return String(value);
	}

	return undefined;
}

/**
 * Normalizes a raw bridge payload into a `SensorEvent`.
 *
 * Returns `undefined` for payloads that are not objects so a malformed event never reaches
 * the application callback.
 */
function normalizeSensorEvent(rawEvent: unknown): SensorEvent | undefined {
	if (!rawEvent || typeof rawEvent !== 'object' || Array.isArray(rawEvent)) {
		return undefined;
	}

	const source: Record<string, unknown> = rawEvent as Record<string, unknown>;
	const sensorEvent: SensorEvent = {};
	const id: string | undefined = toIdentifier(source.id);
	const event: string | undefined = toIdentifier(source.event);

	if (id !== undefined) {
		sensorEvent.id = id;
	}

	if (event !== undefined) {
		sensorEvent.event = event;
	}

	if (source.value !== undefined) {
		sensorEvent.value = source.value;
	}

	return sensorEvent;
}

/**
 * Hook to receive every sensor event reaching the displayer, with automatic cleanup.
 *
 * The callback is invoked for all incoming events - hardware sensors, MQTT/UDP/HTTP bridges,
 * events sent from the backend and events emitted by other applications - before the content's
 * own sensor actions are evaluated. Filtering is the widget's responsibility.
 *
 * Availability: displayer only, on a device with a sensor-capable license. In the editor and on
 * clients without the sensor bridge the hook stays inert: the callback is never called, nothing
 * is thrown, and the returned disposer is a no-op.
 *
 * @param callback Function to execute for every received sensor event
 * @param options Optional behaviour flags
 *
 * @returns Disposer that removes the listener. It also runs automatically on cleanup.
 *
 * @example
 * ```tsx
 * useSensorEventListener((sensorEvent) => {
 *   if (sensorEvent.event !== 'motion') {
 *     return;
 *   }
 *
 *   setPresence(String(sensorEvent.value) === '1');
 * }, { ignoreOwn: true });
 * ```
 */
export function useSensorEventListener(
	callback: (sensorEvent: SensorEvent) => void,
	options?: SensorEventListenerOptions
): () => void {
	const metadataProvider: MetadataProvider = getMetadata();
	const metadata: Metadata = metadataProvider.getMetadata();
	const logger: ILoggerService = createLogger(metadataProvider, 'useSensorEventListener', {
		disableLogs: metadata.build.disableSdkLogs
	});

	const interaction: SensorEventInteractionApi | undefined = resolveInteractionApi();

	if (!interaction) {
		logger.debug('Sensor events are unavailable, the displayer sensor bridge is not exposed.');

		return noopDispose;
	}

	let disposed: boolean = false;

	const platformListener = (rawEvent: unknown): void => {
		if (disposed) {
			return;
		}

		const sensorEvent: SensorEvent | undefined = normalizeSensorEvent(rawEvent);

		if (!sensorEvent) {
			logger.warn('Discarded a malformed sensor event.', rawEvent);

			return;
		}

		if (options?.ignoreOwn === true && sensorEvent.id === metadata.id) {
			return;
		}

		try {
			callback(sensorEvent);
		} catch (exception) {
			logger.error(
				`Sensor event listener failed! Event: '${String(sensorEvent.event)}' Exception: ${
					exception instanceof Error ? exception.message : String(exception)
				}`
			);
		}
	};

	interaction.addSensorEventListener?.(platformListener);

	const dispose = (): void => {
		if (disposed) {
			return;
		}

		disposed = true;

		try {
			interaction.removeSensorEventListener?.(platformListener);
		} catch (exception) {
			logger.warn(
				`Removing the sensor event listener failed! Exception: ${
					exception instanceof Error ? exception.message : String(exception)
				}`
			);
		}
	};

	// Auto cleanup on destroy
	onCleanup((): void => {
		dispose();
	});

	return dispose;
}