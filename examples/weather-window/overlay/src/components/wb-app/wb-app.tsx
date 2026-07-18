import {
	createEffect,
	createMemo,
	createSignal,
	For,
	onCleanup,
	onMount,
	Show,
	untrack
} from 'solid-js';
import type { Accessor, JSX } from 'solid-js';

import { getMetadata } from '@hooks/system/getMetadata';
import { useAutoFitText } from '@hooks/system/useAutoFitText';
import { useSettings } from '@hooks/system/useSettings';

import type { Settings } from '@interfaces/application.interface';

import { resolveMotion } from '@utils/motion';
import {
	normalizeWeather,
	type NormalizedWeather,
	type NormalizedWeatherDay
} from '@utils/weather';

import { useWeather } from 'wallboard-app-sdk';
import type { IWeatherService, WeatherData, WeatherSettings } from 'wallboard-app-sdk';

import style from '@components/wb-app/wb-app.module.scss';

type LayoutMode = 'landscape' | 'wide' | 'portrait' | 'compact';
type WeatherState = 'loading' | 'ready' | 'stale' | 'unavailable';

const REFRESH_INTERVAL_MS = 13 * 60 * 1000;

const layoutFor = (width: number, height: number): LayoutMode => {
	const ratio = height > 0 ? width / height : 1;

	if (ratio >= 2.45) {
		return 'wide';
	}

	if (ratio <= 0.82) {
		return 'portrait';
	}

	return width < 760 || height < 520 ? 'compact' : 'landscape';
};

const baseFontSizeFor = (width: number, height: number, layout: LayoutMode): number => {
	if (layout === 'wide') {
		return Math.min(22, Math.max(16, height / 24));
	}

	if (layout === 'portrait') {
		return Math.min(30, Math.max(18, Math.min(width / 36, height / 64)));
	}

	if (layout === 'compact') {
		return Math.min(20, Math.max(14, Math.min(width / 31, height / 31)));
	}

	return Math.min(30, Math.max(16, Math.min(width / 64, height / 36)));
};

const ForecastItem = (props: { day: NormalizedWeatherDay }): JSX.Element => {
	const fitCondition = useAutoFitText({
		minFontSize: 20,
		maxFontSize: 24,
		watch: (): string => props.day.condition
	});

	return (
		<article class="wb-weather-window-forecast-item" data-tone={props.day.tone}>
			<div class="wb-weather-window-forecast-heading">
				<strong class="wb-weather-window-forecast-day">{props.day.day}</strong>
				<Show when={props.day.iconUrl}>
					<img src={props.day.iconUrl} alt="" />
				</Show>
			</div>
			<div class="wb-weather-window-forecast-temperatures">
				<strong>{props.day.high}</strong>
				<span>{props.day.low}</span>
			</div>
			<p ref={fitCondition} class="wb-weather-window-forecast-condition">{props.day.condition}</p>
		</article>
	);
};

export default (props: { hostElement: HTMLDivElement }): JSX.Element => {
	let rootElement: HTMLDivElement | undefined;
	let resizeObserver: ResizeObserver | undefined;
	let refreshTimer: ReturnType<typeof setTimeout> | undefined;
	let requestSequence = 0;
	let refreshTick = 0;
	const refreshStart = performance.now();
	const settings: Accessor<Settings> = useSettings();
	const weatherService: IWeatherService = useWeather(getMetadata());
	const [layout, setLayout] = createSignal<LayoutMode>('landscape');
	const [rootFontSize, setRootFontSize] = createSignal(24);
	const [weatherData, setWeatherData] = createSignal<WeatherData>();
	const [weatherState, setWeatherState] = createSignal<WeatherState>('loading');
	const [backgroundFailed, setBackgroundFailed] = createSignal(false);
	const normalizedWeather = createMemo((): NormalizedWeather | undefined => normalizeWeather(weatherData(), {
		displayName: settings().displayName,
		forecastDays: settings().forecastDays
	}));
	const fitLocation = useAutoFitText({
		minFontSize: 32,
		maxFontSize: 128,
		watch: (): string => normalizedWeather()?.location ?? (settings().displayName || settings().cityCode)
	});
	const fitCondition = useAutoFitText({
		minFontSize: 20,
		maxFontSize: 54,
		watch: (): string => normalizedWeather()?.condition ?? ''
	});
	const motion = createMemo(() => resolveMotion(settings().motionPreset));
	const weatherRequestKey = createMemo((): string => [
		settings().cityCode,
		settings().countryCode,
		settings().temperatureUnit,
		settings().languageCode,
		settings().backgroundType
	].join('|'));
	const rootStyle = createMemo((): JSX.CSSProperties => ({
		'font-size': `${rootFontSize()}px`,
		'--wb-weather-window-motion-duration': `${motion().durationMs}ms`
	}));
	const weatherOptions = (): WeatherSettings => ({
		backgroundType: settings().backgroundType === 'none' ? undefined : settings().backgroundType,
		folder: 'Animated_Flat',
		fullDayNames: true,
		isForecast: true,
		languageCode: settings().languageCode,
		showCity: true,
		showUnit: true,
		unit: settings().temperatureUnit
	});

	const fetchWeather = async (): Promise<void> => {
		requestSequence += 1;
		const sequence = requestSequence;
		const currentSettings = settings();
		const hadWeather = Boolean(untrack(normalizedWeather));

		if (!hadWeather) {
			setWeatherState('loading');
		}

		try {
			const data = await weatherService.getCity(
				currentSettings.cityCode,
				currentSettings.countryCode,
				weatherOptions()
			);

			if (sequence !== requestSequence) {
				return;
			}

			setWeatherData(data);
			setBackgroundFailed(false);
			setWeatherState(normalizeWeather(data) ? 'ready' : 'unavailable');
		} catch {
			if (sequence !== requestSequence) {
				return;
			}

			setWeatherState(hadWeather ? 'stale' : 'unavailable');
		}
	};

	const scheduleRefresh = (): void => {
		refreshTick += 1;
		const nextAt = refreshStart + refreshTick * REFRESH_INTERVAL_MS;
		const delay = Math.max(0, nextAt - performance.now());

		refreshTimer = setTimeout((): void => {
			void fetchWeather();
			scheduleRefresh();
		}, delay);
	};

	onMount((): void => {
		if (rootElement) {
			const updateLayout = (): void => {
				if (!rootElement) {
					return;
				}

				const bounds = rootElement.getBoundingClientRect();
				const nextLayout = layoutFor(bounds.width, bounds.height);
				setLayout(nextLayout);
				setRootFontSize(baseFontSizeFor(bounds.width, bounds.height, nextLayout));
			};

			resizeObserver = new ResizeObserver(updateLayout);
			resizeObserver.observe(rootElement);
			updateLayout();
		}

		scheduleRefresh();
	});

	createEffect((): void => {
		if (weatherRequestKey()) {
			void fetchWeather();
		}
	});

	onCleanup((): void => {
		requestSequence += 1;
		resizeObserver?.disconnect();

		if (refreshTimer) {
			clearTimeout(refreshTimer);
		}
	});

	return (
		<div
			ref={(element): HTMLDivElement => rootElement = element}
			class={`wb-weather-window-root ${style['wb-app']}`}
			data-host-ready={Boolean(props.hostElement)}
			data-layout={layout()}
			data-motion-preset={settings().motionPreset}
			data-state={weatherState()}
			data-tone={normalizedWeather()?.tone ?? 'neutral'}
			style={rootStyle()}
		>
			<Show when={normalizedWeather()?.backgroundUrl && !backgroundFailed()}>
				<img
					class="wb-weather-window-background"
					src={normalizedWeather()?.backgroundUrl}
					alt=""
					onError={(): void => {
						setBackgroundFailed(true);
					}}
				/>
			</Show>
			<div class="wb-weather-window-color-field" />
			<header>
				<span class="wb-weather-window-kicker">ATLAS / LOCAL WEATHER</span>
				<span class="wb-weather-window-status">
					{weatherState() === 'stale' ? 'AWAITING UPDATE' : weatherState() === 'ready' ? 'LIVE CONDITIONS' : 'WEATHER SERVICE'}
				</span>
			</header>

			<Show
				when={normalizedWeather()}
				fallback={(
					<main class="wb-weather-window-unavailable">
						<span>{weatherState() === 'loading' ? 'READING LOCAL FORECAST' : 'TEMPORARILY UNAVAILABLE'}</span>
						<h1>{settings().displayName || settings().cityCode}</h1>
						<p>{weatherState() === 'loading' ? 'Connecting to the Wallboard weather service.' : 'The next scheduled update will retry automatically.'}</p>
						<div class="wb-weather-window-unavailable-footer">
							<span>LOOKUP / {settings().cityCode}, {settings().countryCode}</span>
							<span>AUTOMATIC RETRY ACTIVE</span>
						</div>
					</main>
				)}
			>
				{(weather): JSX.Element => (
					<>
						<main class="wb-weather-window-hero">
							<section class="wb-weather-window-place">
								<span>{weather().country || 'LOCAL OUTLOOK'}</span>
								<h1 ref={fitLocation} class="wb-weather-window-location">{weather().location}</h1>
								<div class="wb-weather-window-rule" />
							</section>

							<section class="wb-weather-window-current">
								<div class="wb-weather-window-temperature">{weather().temperature}</div>
								<div class="wb-weather-window-current-copy">
									<Show when={weather().iconUrl} fallback={<span class="wb-weather-window-icon-fallback">WX</span>}>
										<img src={weather().iconUrl} alt="" />
									</Show>
									<p ref={fitCondition} class="wb-weather-window-condition">{weather().condition}</p>
								</div>
							</section>

							<dl class="wb-weather-window-details">
								<Show when={weather().details.wind}><div><dt>Wind</dt><dd>{weather().details.wind}</dd></div></Show>
								<Show when={weather().details.humidity}><div><dt>Humidity</dt><dd>{weather().details.humidity}</dd></div></Show>
								<Show when={weather().details.visibility}><div><dt>Visibility</dt><dd>{weather().details.visibility}</dd></div></Show>
								<Show when={weather().details.sunrise}><div><dt>Sunrise</dt><dd>{weather().details.sunrise}</dd></div></Show>
								<Show when={weather().details.sunset}><div><dt>Sunset</dt><dd>{weather().details.sunset}</dd></div></Show>
							</dl>
						</main>

						<footer class="wb-weather-window-forecast">
							<div class="wb-weather-window-forecast-label">
								<span>FORECAST HORIZON</span>
								<small>{weather().updatedAt || 'AUTO REFRESH'}</small>
							</div>
							<div class="wb-weather-window-forecast-days" data-count={weather().forecast.length}>
								<For each={weather().forecast}>{(day): JSX.Element => <ForecastItem day={day} />}</For>
								<Show when={weather().forecast.length === 0}>
									<p class="wb-weather-window-no-forecast">Near forecast is not available yet.</p>
								</Show>
							</div>
						</footer>
					</>
				)}
			</Show>
		</div>
	);
};
