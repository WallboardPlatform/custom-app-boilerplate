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
		'--clock-accent': settings().accentColor,
		'--clock-background': colorWithOpacity(settings().backgroundColor, settings().backgroundOpacity),
		'--clock-hero-size': `${heroSize()}px`,
		'--clock-meta-size': `${Math.max(11, Math.round(heroSize() * 0.12))}px`,
		'--clock-text': settings().textColor
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
			class={`wb-app ${style['wb-app']}`}
			classList={{
				'clock--compact': layout() === 'compact',
				'clock--square': layout() === 'square',
				'clock--standard': layout() === 'standard',
				'clock--tall': layout() === 'tall',
				'clock--ultra-wide': layout() === 'ultra-wide'
			}}
			data-epoch-second={clock().epochSecond}
			data-layout={layout()}
			data-timezone={clock().timezone}
			data-timezone-valid={clock().timezoneValid}
			style={themeStyle()}
		>
			<div class="clock-frame">
				<header class="clock-location">
					<span>LOCAL TIME</span>
					<strong title={settings().locationLabel}>{settings().locationLabel}</strong>
				</header>

				<main class="clock-hero">
					<div class="clock-time">
						<div class="clock-primary">
							<span class="clock-hours">{clock().hours}</span>
							<i aria-hidden="true">:</i>
							<span class="clock-minutes">{clock().minutes}</span>
						</div>
						<Show when={settings().showSeconds}>
							<small class="clock-seconds">{clock().seconds}</small>
						</Show>
						<Show when={clock().period}>
							<small class="clock-period">{clock().period}</small>
						</Show>
					</div>
				</main>

				<footer class="clock-meta">
					<Show when={settings().showDate}>
						<strong class="clock-date">{clock().date}</strong>
					</Show>
					<Show when={settings().showZone}>
						<span class="clock-zone">{clock().timezone}</span>
					</Show>
				</footer>
			</div>
		</div>
	);
};
