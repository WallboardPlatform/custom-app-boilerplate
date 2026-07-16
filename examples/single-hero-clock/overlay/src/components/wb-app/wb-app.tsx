import { createMemo, createSignal, onCleanup, onMount, Show } from 'solid-js';
import type { Accessor, JSX, Setter } from 'solid-js';

import { useClock } from '@hooks/custom/useClock';
import { useSettings } from '@hooks/system/useSettings';

import type { Settings } from '@interfaces/application.interface';
import type { ClockDimensions, ClockLayout, ClockValue } from '@interfaces/clock.interface';

import { colorWithOpacity } from '@utils/clock';

import style from '@components/wb-app/wb-app.module.scss';

const getLayout = (dimensions: ClockDimensions): ClockLayout => {
	const ratio: number = dimensions.width / Math.max(dimensions.height, 1);

	if (dimensions.width <= 420 || dimensions.height <= 220) {
		return 'compact';
	}

	if (ratio >= 3) {
		return 'ultra-wide';
	}

	if (ratio <= 0.75) {
		return 'tall';
	}

	if (ratio <= 1.2) {
		return 'square';
	}

	return 'standard';
};

const getHeroSize = (dimensions: ClockDimensions, layout: ClockLayout, fontScale: number): number => {
	let baseSize: number;

	if (layout === 'tall') {
		baseSize = Math.min(dimensions.width * 0.52, dimensions.height * 0.23);
	} else if (layout === 'ultra-wide') {
		baseSize = Math.min(dimensions.height * 0.48, dimensions.width * 0.13);
	} else if (layout === 'compact') {
		baseSize = Math.min(dimensions.width * 0.18, dimensions.height * 0.38);
	} else if (layout === 'square') {
		baseSize = Math.min(dimensions.width * 0.2, dimensions.height * 0.3);
	} else {
		baseSize = Math.min(dimensions.width * 0.17, dimensions.height * 0.36);
	}

	return Math.max(34, Math.round(baseSize * (fontScale / 100)));
};

export default (props: { hostElement: HTMLDivElement }): JSX.Element => {
	const settings: Accessor<Settings> = useSettings();
	const clock: Accessor<ClockValue> = useClock(settings);
	const [dimensions, setDimensions]: [Accessor<ClockDimensions>, Setter<ClockDimensions>] = createSignal<ClockDimensions>({
		width: 1280,
		height: 720
	});
	const layout: Accessor<ClockLayout> = createMemo((): ClockLayout => getLayout(dimensions()));
	const heroSize: Accessor<number> = createMemo((): number => {
		return getHeroSize(dimensions(), layout(), settings().fontScale);
	});
	const themeStyle: Accessor<JSX.CSSProperties> = createMemo((): JSX.CSSProperties => ({
		'--wb-single-hero-clock-accent': settings().accentColor,
		'--wb-single-hero-clock-background': colorWithOpacity(settings().backgroundColor, settings().backgroundOpacity),
		'--wb-single-hero-clock-hero-size': `${heroSize()}px`,
		'--wb-single-hero-clock-meta-size': `${Math.max(11, Math.round(heroSize() * 0.12))}px`,
		'--wb-single-hero-clock-text': settings().textColor
	}));

	onMount((): void => {
		const updateDimensions = (width: number, height: number): void => {
			setDimensions({ width: Math.round(width), height: Math.round(height) });
		};
		const initialBounds: DOMRect = props.hostElement.getBoundingClientRect();
		const resizeObserver: ResizeObserver = new ResizeObserver((entries: ResizeObserverEntry[]): void => {
			const entry: ResizeObserverEntry | undefined = entries[0];

			if (entry) {
				updateDimensions(entry.contentRect.width, entry.contentRect.height);
			}
		});

		updateDimensions(initialBounds.width, initialBounds.height);
		resizeObserver.observe(props.hostElement);

		onCleanup((): void => resizeObserver.disconnect());
	});

	return (
		<div
			class={`wb-single-hero-clock-root ${style['wb-app']}`}
			classList={{
				'wb-single-hero-clock--compact': layout() === 'compact',
				'wb-single-hero-clock--square': layout() === 'square',
				'wb-single-hero-clock--standard': layout() === 'standard',
				'wb-single-hero-clock--tall': layout() === 'tall',
				'wb-single-hero-clock--ultra-wide': layout() === 'ultra-wide'
			}}
			data-epoch-second={clock().epochSecond}
			data-layout={layout()}
			data-timezone={clock().timezone}
			data-timezone-valid={clock().timezoneValid}
			style={themeStyle()}
		>
			<div class="wb-single-hero-clock-frame">
				<header class="wb-single-hero-clock-location">
					<span>LOCAL TIME</span>
					<strong title={settings().locationLabel}>{settings().locationLabel}</strong>
				</header>

				<main class="wb-single-hero-clock-hero">
					<div class="wb-single-hero-clock-time">
						<div class="wb-single-hero-clock-primary">
							<span class="wb-single-hero-clock-hours">{clock().hours}</span>
							<i aria-hidden="true">:</i>
							<span class="wb-single-hero-clock-minutes">{clock().minutes}</span>
						</div>
						<Show when={settings().showSeconds}>
							<small class="wb-single-hero-clock-seconds">{clock().seconds}</small>
						</Show>
						<Show when={clock().period}>
							<small class="wb-single-hero-clock-period">{clock().period}</small>
						</Show>
					</div>
				</main>

				<footer class="wb-single-hero-clock-meta">
					<Show when={settings().showDate}>
						<strong class="wb-single-hero-clock-date">{clock().date}</strong>
					</Show>
					<Show when={settings().showZone}>
						<span class="wb-single-hero-clock-zone">{clock().timezone}</span>
					</Show>
				</footer>
			</div>
		</div>
	);
};
