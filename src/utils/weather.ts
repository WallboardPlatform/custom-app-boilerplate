import type { Forecast, WeatherData } from 'wallboard-app-sdk';

export type WeatherTone = 'clear' | 'cloud' | 'fog' | 'rain' | 'snow' | 'storm' | 'neutral';

export interface NormalizedWeatherDay {
	key: string;
	day: string;
	condition: string;
	high: string;
	low: string;
	iconUrl: string;
	tone: WeatherTone;
}

export interface NormalizedWeather {
	location: string;
	country: string;
	condition: string;
	temperature: string;
	iconUrl: string;
	backgroundUrl: string;
	tone: WeatherTone;
	forecast: NormalizedWeatherDay[];
	details: {
		humidity: string;
		visibility: string;
		wind: string;
		sunrise: string;
		sunset: string;
	};
	updatedAt: string;
}

export interface NormalizeWeatherOptions {
	displayName?: string;
	forecastDays?: number;
	skipCurrentForecast?: boolean;
}

const text = (value: unknown): string => {
	return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
};

const withSuffix = (value: unknown, suffix: string): string => {
	const normalized = text(value);

	if (!normalized) {
		return '';
	}

	return normalized.includes(suffix) ? normalized : `${normalized}${suffix}`;
};

export const formatWeatherTemperature = (value: unknown, fallback: unknown = ''): string => {
	const normalized = text(value) || text(fallback);

	if (!normalized) {
		return '--';
	}

	if (/[°º]|\b[CF]\b/i.test(normalized)) {
		return normalized.replace(/\s*([°º])\s*/g, '$1');
	}

	const numeric = Number(normalized);

	return Number.isFinite(numeric) ? `${Math.round(numeric)}°` : normalized;
};

export const weatherToneFor = (condition: unknown, code: unknown): WeatherTone => {
	const label = text(condition).toLowerCase();
	const numericCode = Number(code);

	if (/thunder|storm|tornado|hurricane|squall/.test(label) || [0, 1, 2, 3, 4, 37, 38, 39, 45, 47].includes(numericCode)) {
		return 'storm';
	}

	if (/snow|sleet|ice|flurr/.test(label) || [5, 6, 7, 13, 14, 15, 16, 41, 42, 43, 46].includes(numericCode)) {
		return 'snow';
	}

	if (/rain|drizzle|shower/.test(label) || [8, 9, 10, 11, 12, 35, 40].includes(numericCode)) {
		return 'rain';
	}

	if (/fog|mist|haze|smok|dust/.test(label) || [19, 20, 21, 22].includes(numericCode)) {
		return 'fog';
	}

	if (/cloud|overcast/.test(label) || [26, 27, 28, 29, 30, 44].includes(numericCode)) {
		return 'cloud';
	}

	if (/clear|sun|fair/.test(label) || [31, 32, 33, 34, 36].includes(numericCode)) {
		return 'clear';
	}

	return 'neutral';
};

const normalizeForecastDay = (day: Forecast, index: number): NormalizedWeatherDay => {
	const condition = text(day.translatedText) || text(day.text) || 'Forecast';
	const dayLabel = text(day.translatedDay) || text(day.day) || text(day.date) || `Day ${index + 1}`;

	return {
		key: `${text(day.date) || dayLabel}-${index}`,
		day: dayLabel,
		condition,
		high: formatWeatherTemperature(day.highParsed, day.high),
		low: formatWeatherTemperature(day.lowParsed, day.low),
		iconUrl: text(day.iconImageSrc),
		tone: weatherToneFor(condition, day.code)
	};
};

export const normalizeWeather = (
	data: WeatherData | undefined,
	options: NormalizeWeatherOptions = {}
): NormalizedWeather | undefined => {
	if (!data?.condition && !data?.location && !data?.forecast?.length) {
		return undefined;
	}

	const condition = text(data.condition?.translatedText) || text(data.condition?.text) || 'Current conditions';
	const configuredDays = Number.isFinite(options.forecastDays) ? Number(options.forecastDays) : 4;
	const forecastLimit = Math.min(5, Math.max(1, Math.round(configuredDays)));
	const forecast = (data.forecast ?? [])
		.slice(options.skipCurrentForecast === false ? 0 : 1)
		.slice(0, forecastLimit)
		.map(normalizeForecastDay);
	const location = text(options.displayName) || text(data.location?.city) || 'Local weather';
	const windSpeed = text(data.wind?.speedParsed)
		|| [text(data.wind?.speed), text(data.units?.speed)].filter(Boolean).join(' ');
	const windDirection = text(data.wind?.directionParsed) || text(data.wind?.direction);

	return {
		location,
		country: text(data.location?.country) || text(data.location?.region),
		condition,
		temperature: formatWeatherTemperature(data.condition?.tempParsed, data.condition?.temp),
		iconUrl: text(data.images?.icon),
		backgroundUrl: text(data.images?.background),
		tone: weatherToneFor(condition, data.condition?.code),
		forecast,
		details: {
			humidity: withSuffix(data.atmosphere?.humidity, '%'),
			visibility: [text(data.atmosphere?.visibility), text(data.units?.distance)].filter(Boolean).join(' '),
			wind: [windDirection, windSpeed].filter(Boolean).join(' / '),
			sunrise: text(data.astronomy?.sunrise),
			sunset: text(data.astronomy?.sunset)
		},
		updatedAt: text(data.forecastDate)
	};
};
