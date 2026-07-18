import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import { installPlatformMock } from '../../preview/platform-mock.js';

type WeatherApi = {
	getWeatherData: (locations: Array<{ cityCode: string; countryCode: string }>) => Promise<Record<string, unknown>[]>;
	cacheFile: (url: string) => Promise<string>;
};

const previousWindow = globalThis.window;

afterEach((): void => {
	Object.defineProperty(globalThis, 'window', {
		configurable: true,
		value: previousWindow,
		writable: true
	});
});

void describe('preview weather platform mock', (): void => {
	void it('returns location-specific fixtures and deterministic fallbacks without network access', async (): Promise<void> => {
		Object.defineProperty(globalThis, 'window', {
			configurable: true,
			value: {},
			writable: true
		});

		const controller = installPlatformMock({
			weatherByLocation: {
				'BUD,HU': {
					searchKey: 'BUD,HU',
					location: { city: 'Budapest', country: 'HU' },
					item: { condition: { temperature: 24 }, forecast: [] }
				}
			}
		});

		const api = (window as unknown as { CustomWidgetAPI: WeatherApi }).CustomWidgetAPI;
		const result = await api.getWeatherData([
			{ cityCode: 'BUD', countryCode: 'HU' },
			{ cityCode: 'VIE', countryCode: 'AT' }
		]);

		assert.equal((result[0].location as Record<string, unknown>).city, 'Budapest');
		assert.equal(result[1].searchKey, 'VIE,AT');
		assert.equal((result[1].location as Record<string, unknown>).city, 'Preview City');
		assert.equal(await api.cacheFile('/weather/sun.svg'), '/weather/sun.svg');
		assert.deepEqual(controller.cachedUrls, ['/weather/sun.svg']);
	});

	void it('can model a location-specific platform failure', async (): Promise<void> => {
		Object.defineProperty(globalThis, 'window', {
			configurable: true,
			value: {},
			writable: true
		});

		installPlatformMock({ weatherErrorsByLocation: { 'BUD,HU': 'Weather service unavailable' } });
		const api = (window as unknown as { CustomWidgetAPI: WeatherApi }).CustomWidgetAPI;

		await assert.rejects(
			api.getWeatherData([{ cityCode: 'BUD', countryCode: 'HU' }]),
			/Weather service unavailable/
		);
	});
});
