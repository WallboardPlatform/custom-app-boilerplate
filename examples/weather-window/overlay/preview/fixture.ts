import type { PreviewFixture, PreviewScenario, PreviewSettingEffect } from './fixture.types';

interface WeatherFixtureOptions {
	city?: string;
	country?: string;
	condition?: string;
	temperature?: string | number;
	backgroundUrl?: string;
	includeMedia?: boolean;
	forecastCount?: number;
}

const iconDataUri = (tone: 'clear' | 'cloud' | 'rain'): string => {
	const color = tone === 'clear' ? '#ffc95c' : tone === 'rain' ? '#81e6dd' : '#f7f3e8';
	const rain = tone === 'rain'
		? '<path d="M27 71 19 84M49 71 41 84M71 71 63 84" stroke="#81e6dd" stroke-width="6" stroke-linecap="square"/>'
		: '';
	const cloud = tone === 'clear'
		? '<circle cx="50" cy="50" r="23" fill="#ffc95c"/>'
		: `<path d="M23 67h54a17 17 0 0 0-3-33 27 27 0 0 0-50 8 13 13 0 0 0-1 25Z" fill="${color}"/>`;

	return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${cloud}${rain}</svg>`)}`;
};

const forecastSeed = [
	{ day: 'Sunday', text: 'Clearing skies', code: 32, high: 25, low: 16, tone: 'clear' as const },
	{ day: 'Monday', text: 'Bright intervals', code: 30, high: 26, low: 17, tone: 'cloud' as const },
	{ day: 'Tuesday', text: 'Light afternoon rain', code: 11, high: 23, low: 15, tone: 'rain' as const },
	{ day: 'Wednesday', text: 'Calm and partly cloudy', code: 29, high: 24, low: 14, tone: 'cloud' as const },
	{ day: 'Thursday', text: 'Clear and settled', code: 32, high: 27, low: 17, tone: 'clear' as const }
];

const createWeather = (options: WeatherFixtureOptions = {}): Record<string, unknown> => {
	const includeMedia = options.includeMedia !== false;
	const count = options.forecastCount ?? 5;
	const forecast = [
		{
			date: '2026-07-18',
			day: 'Saturday',
			translatedDay: 'Today',
			text: options.condition ?? 'Light rain showers',
			translatedText: options.condition ?? 'Light rain showers',
			code: 11,
			high: 22,
			low: 15,
			highParsed: '22°',
			lowParsed: '15°',
			iconImageSrc: includeMedia ? iconDataUri('rain') : ''
		},
		...forecastSeed.slice(0, Math.max(0, count - 1)).map((day, index) => ({
			date: `2026-07-${String(index + 19).padStart(2, '0')}`,
			day: day.day.slice(0, 3),
			translatedDay: day.day,
			text: day.text,
			translatedText: day.text,
			code: day.code,
			high: day.high,
			low: day.low,
			highParsed: `${day.high}°`,
			lowParsed: `${day.low}°`,
			iconImageSrc: includeMedia ? iconDataUri(day.tone) : ''
		}))
	];

	return {
		astronomy: { sunrise: '05:04', sunset: '20:37' },
		atmosphere: { humidity: '68', visibility: '10' },
		description: 'Synthetic preview weather supplied by the local platform mock.',
		forecastDate: 'Updated 06:30',
		backgroundImageSrc: includeMedia ? options.backgroundUrl ?? '/preview/weather-assets/budapest-riverside.jpg' : '',
		iconImageSrc: includeMedia ? iconDataUri('rain') : '',
		item: {
			condition: {
				code: '11',
				temp: String(options.temperature ?? 21),
				tempParsed: options.temperature ?? '21°',
				text: options.condition ?? 'Light rain showers',
				translatedText: options.condition ?? 'Light rain showers'
			},
			forecast
		},
		location: {
			city: options.city ?? 'Budapest',
			country: options.country ?? 'Hungary',
			latitude: '47.4979',
			longitude: '19.0402',
			postal: '',
			region: ''
		},
		searchKey: `${options.city ?? 'Budapest'},${options.country ?? 'HU'}`,
		timezone: 'Europe/Budapest',
		units: { distance: 'km', pressure: 'hPa', speed: 'km/h', temperature: 'C' },
		wind: { direction: 'NW', speed: '18' },
		windDirectionParsed: 'Northwest',
		windSpeedParsed: '18 km/h'
	};
};

const baseConfig: Record<string, unknown> = {
	cityCode: 'Budapest',
	countryCode: 'HU',
	displayName: '',
	temperatureUnit: 'C',
	languageCode: 'en-US',
	forecastDays: 4,
	backgroundType: 'Ocean_and_Rocky_Coast',
	motionPreset: 'subtle'
};

const defaultWeather = createWeather();
const viennaWeather = createWeather({ city: 'Vienna', country: 'Austria', condition: 'Clear and calm', temperature: '24°' });

const createFixture = (
	id: string,
	weather: Record<string, unknown> = defaultWeather,
	configOverrides: Record<string, unknown> = {},
	platformOverrides: Record<string, unknown> = {},
	readySelector = '.wb-weather-window-root[data-state="ready"]'
): PreviewFixture => ({
	id,
	readySelector,
	settleMs: 700,
	configValues: { ...baseConfig, ...configOverrides },
	dataPickerValues: {},
	datasourceIds: {},
	additionalConfig: { licenseType: null, mockDatasource: {}, style: {} },
	platform: {
		weatherByLocation: {
			'Budapest,HU': weather,
			'Vienna,AT': viennaWeather
		},
		...platformOverrides
	}
});

const previewFixture: PreviewFixture = createFixture('atlas-weather-window-preview');

export const previewScenarios: PreviewScenario[] = [
	{
		id: 'wide-low',
		fixture: createFixture('atlas-weather-window-wide'),
		viewport: { width: 1536, height: 432, background: 'dark' },
		minimumContentCoverage: { width: 96, height: 88 }
	},
	{
		id: 'portrait',
		fixture: createFixture('atlas-weather-window-portrait'),
		viewport: { width: 1080, height: 1920, background: 'dark' },
		minimumContentCoverage: { width: 91, height: 94 }
	},
	{
		id: 'square',
		fixture: createFixture('atlas-weather-window-square'),
		viewport: { width: 600, height: 600, background: 'dark' },
		minimumContentCoverage: { width: 92, height: 90 }
	},
	{
		id: 'long-location',
		fixture: createFixture(
			'atlas-weather-window-long-location',
			createWeather({ city: 'Saint-Germain-en-Laye Riverside District' }),
			{ displayName: 'Saint-Germain-en-Laye Riverside District' }
		),
		viewport: { width: 960, height: 540, background: 'dark' },
		minimumContentCoverage: { width: 94, height: 91 }
	},
	{
		id: 'long-condition',
		fixture: createFixture(
			'atlas-weather-window-long-condition',
			createWeather({ condition: 'Intermittent rain showers with bright intervals developing later' })
		),
		viewport: { width: 960, height: 540, background: 'dark' },
		minimumContentCoverage: { width: 94, height: 91 }
	},
	{
		id: 'missing-media',
		fixture: createFixture('atlas-weather-window-missing-media', createWeather({ includeMedia: false })),
		viewport: { width: 1920, height: 1080, background: 'dark' },
		minimumContentCoverage: { width: 94, height: 90 }
	},
	{
		id: 'short-forecast',
		fixture: createFixture('atlas-weather-window-short-forecast', createWeather({ forecastCount: 2 })),
		viewport: { width: 1920, height: 1080, background: 'dark' },
		minimumContentCoverage: { width: 94, height: 91 }
	},
	{
		id: 'unavailable',
		fixture: createFixture(
			'atlas-weather-window-unavailable',
			defaultWeather,
			{},
			{ weatherErrorsByLocation: { 'Budapest,HU': 'Preview weather service unavailable' } },
			'.wb-weather-window-root[data-state="unavailable"]'
		),
		viewport: { width: 1920, height: 1080, background: 'dark' },
		minimumContentCoverage: { width: 72, height: 68 }
	},
	{
		id: 'stale-update',
		fixture: createFixture(
			'atlas-weather-window-stale',
			defaultWeather,
			{},
			{ weatherErrorsByLocation: { 'Failure,ZZ': 'Preview refresh failed' } }
		),
		viewport: { width: 1920, height: 1080, background: 'dark' },
		minimumContentCoverage: { width: 94, height: 91 }
	},
	{
		id: 'motion-off',
		fixture: createFixture('atlas-weather-window-motion-off', defaultWeather, { motionPreset: 'off' }),
		viewport: { width: 1920, height: 1080, background: 'dark' },
		minimumContentCoverage: { width: 94, height: 91 }
	}
];

export const previewSettingEffects: PreviewSettingEffect[] = [
	{
		id: 'motion-preset',
		property: 'motionPreset',
		changedValue: 'off',
		selector: '.wb-weather-window-root',
		measurement: { type: 'attribute', name: 'data-motion-preset' },
		expectation: { type: 'change' }
	}
];

export default previewFixture;
