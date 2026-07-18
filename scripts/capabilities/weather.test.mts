import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { WeatherData } from 'wallboard-app-sdk';

import { formatWeatherTemperature, normalizeWeather, weatherToneFor } from '../../src/utils/weather.js';

const weatherData: WeatherData = {
	astronomy: { sunrise: '05:04', sunset: '20:37' },
	atmosphere: { humidity: '68', visibility: '10' },
	condition: { code: '11', temp: '21', tempParsed: 21, text: 'Showers', translatedText: 'Light rain showers' },
	forecastDate: '2026-07-18 06:30',
	forecast: [
		{ code: 11, date: '2026-07-18', day: 'Sat', translatedDay: 'Today', high: 24, low: 16, highParsed: '24 C', lowParsed: 16, text: 'Rain' },
		{ code: 32, date: '2026-07-19', day: 'Sun', translatedDay: 'Sunday', high: 27, low: 17, highParsed: '27°', lowParsed: '17', text: 'Sunny', translatedText: 'Clear and sunny', iconImageSrc: '/cached/sun.svg' },
		{ code: 26, date: '2026-07-20', day: 'Mon', high: 25, low: 18, text: 'Cloudy' }
	],
	images: { background: '/cached/background.jpg', icon: '/cached/rain.svg' },
	location: { city: 'Budapest', country: 'Hungary', latitude: '', longitude: '', postal: '', region: '' },
	units: { distance: 'km', pressure: 'hPa', speed: 'km/h', temperature: 'C' },
	wind: { direction: 'NW', directionParsed: 'Northwest', speed: '18', speedParsed: '18 km/h' }
};

void describe('weather normalization', (): void => {
	void it('normalizes mixed SDK field types and skips the current forecast day by default', (): void => {
		const normalized = normalizeWeather(weatherData, { forecastDays: 4 });

		assert.equal(normalized?.temperature, '21°');
		assert.equal(normalized?.details.humidity, '68%');
		assert.equal(normalized?.details.visibility, '10 km');
		assert.equal(normalized?.details.wind, 'Northwest / 18 km/h');
		assert.equal(normalized?.forecast.length, 2);
		assert.equal(normalized?.forecast[0].day, 'Sunday');
		assert.equal(normalized?.forecast[0].high, '27°');
		assert.equal(normalized?.forecast[0].low, '17°');
	});

	void it('uses explicit display names and condition-aware tones without inventing data', (): void => {
		const normalized = normalizeWeather(weatherData, { displayName: 'North Pier', forecastDays: 1 });

		assert.equal(normalized?.location, 'North Pier');
		assert.equal(normalized?.tone, 'rain');
		assert.equal(normalized?.forecast[0].tone, 'clear');
		assert.equal(normalizeWeather(undefined), undefined);
	});

	void it('formats numeric temperatures while preserving localized formatted strings', (): void => {
		assert.equal(formatWeatherTemperature(20.6), '21°');
		assert.equal(formatWeatherTemperature('18 °C'), '18°C');
		assert.equal(formatWeatherTemperature(undefined, 'n/a'), 'n/a');
		assert.equal(weatherToneFor('Heavy thunderstorms', ''), 'storm');
	});
});
