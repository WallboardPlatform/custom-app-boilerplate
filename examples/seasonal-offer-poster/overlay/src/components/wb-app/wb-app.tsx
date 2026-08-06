import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import type { Accessor, JSX } from 'solid-js';

import { useAutoFitText } from '@hooks/system/useAutoFitText';
import { useDataSources } from '@hooks/system/useDataSources';
import { useSettings } from '@hooks/system/useSettings';

import type { DataSources, Settings } from '@interfaces/application.interface';
import type { OfferRecord } from '@interfaces/offer-poster.interface';

import { calculateFixedCanvasFrame, fixedCanvasStyle } from '@utils/fixed-canvas';
import type { FixedCanvasFrame } from '@utils/fixed-canvas';

import { DESIGN_HEIGHT, DESIGN_WIDTH, headlineLines, nextOfferIndex, normalizeOffers } from '@utils/offer-poster';

import style from '@components/wb-app/wb-app.module.scss';

/**
 * A poster drawn once at 1920x1080 and scaled as a single block.
 *
 * Every other example in this portfolio reflows: it measures the surface and rearranges to suit.
 * This one deliberately does not. The composition is artwork an operator approved, so a surface of
 * the wrong shape gets a letterbox and the poster keeps its proportions. Reflowing here would
 * quietly produce something the customer never signed off, which on a promotional board is the
 * whole product.
 */
export default (props: { hostElement: HTMLDivElement }): JSX.Element => {
	const dataSources: Accessor<DataSources> = useDataSources();
	const settings: Accessor<Settings> = useSettings();
	const [offerIndex, setOfferIndex] = createSignal(0);
	const [surface, setSurface] = createSignal<{ height: number; width: number }>({ height: 1080, width: 1920 });

	const offers: Accessor<OfferRecord[]> = createMemo((): OfferRecord[] => {
		return normalizeOffers(dataSources().offerData?.value);
	});
	const offer: Accessor<OfferRecord | undefined> = createMemo((): OfferRecord | undefined => {
		const all: OfferRecord[] = offers();

		return all.length > 0 ? all[Math.min(offerIndex(), all.length - 1)] : undefined;
	});
	/*
	 * The headline is fitted within the authored block rather than allowed to push it.
	 *
	 * A fixed canvas cannot grow, so the choice is between shrinking the type and clipping words. On
	 * a price claim, clipping is the worse failure: a shopper cannot tell that a line is missing. The
	 * floor keeps the hierarchy intact, and copy that will not fit even at the floor is a copy
	 * problem the operator has to solve.
	 */
	const fitHeadline = useAutoFitText({
		minFontSize: 84,
		maxFontSize: 132,
		widthOnly: false,
		watch: (): string => offer()?.headline ?? ''
	});
	const frame: Accessor<FixedCanvasFrame> = createMemo((): FixedCanvasFrame => {
		return calculateFixedCanvasFrame(surface().width, surface().height, DESIGN_WIDTH, DESIGN_HEIGHT);
	});

	onMount((): void => {
		const element: HTMLDivElement = props.hostElement;
		const measure = (): void => {
			setSurface({ width: element.clientWidth, height: element.clientHeight });
		};

		measure();

		if (typeof ResizeObserver !== 'function') {
			const poll: number = window.setInterval(measure, 500);

			onCleanup((): void => window.clearInterval(poll));

			return;
		}

		const observer = new ResizeObserver((): void => measure());

		observer.observe(element);
		onCleanup((): void => observer.disconnect());
	});

	// One instance-local timer, restarted when the cadence setting changes.
	createEffect((): void => {
		const seconds: number = settings().rotationSeconds;
		const total: number = offers().length;

		if (total <= 1) {
			return;
		}

		const timer: number = window.setInterval((): void => {
			setOfferIndex((current: number): number => nextOfferIndex(current, total));
		}, seconds * 1000);

		onCleanup((): void => window.clearInterval(timer));
	});

	createEffect((): void => {
		props.hostElement.dataset.offerCount = String(offers().length);
	});

	return (
		<section
			class={`wb-offer-poster ${style['wb-offer-poster']}`}
			data-preview-id="offer-poster-root"
			data-host-ready={Boolean(props.hostElement)}
			data-offer-count={offers().length}
			data-offer-index={offerIndex()}
			data-canvas-scale={frame().scale.toFixed(3)}
			data-letterbox={frame().renderedWidth < surface().width - 1 || frame().renderedHeight < surface().height - 1}
			style={{
				'--wb-offer-canvas': settings().canvasColor,
				'--wb-offer-ink': settings().inkColor,
				'--wb-offer-accent': settings().accentColor,
				'--wb-offer-letterbox': settings().letterboxColor
			}}
		>
			<div class="wb-offer-poster-canvas" data-preview-id="offer-canvas" style={fixedCanvasStyle(frame())}>
				<Show
					when={offer()}
					fallback={(
						<div class="wb-offer-poster-empty" data-preview-id="offer-empty">
							<span class="wb-offer-poster-brand">{settings().brandName}</span>
							<p class="wb-offer-poster-empty-message">{settings().emptyStateText}</p>
						</div>
					)}
				>
					{(current: Accessor<OfferRecord>): JSX.Element => (
						<>
							<span class="wb-offer-poster-brand">{settings().brandName}</span>

							<div class="wb-offer-poster-copy">
								<Show when={current().eyebrow}>
									<span class="wb-offer-poster-eyebrow">{current().eyebrow}</span>
								</Show>
								<h1 ref={fitHeadline} class="wb-offer-poster-headline">
									<For each={headlineLines(current().headline)}>
										{(line: string): JSX.Element => <span>{line}</span>}
									</For>
								</h1>
								<Show when={settings().showValidity && current().validUntil}>
									<span class="wb-offer-poster-validity">{current().validUntil}</span>
								</Show>
							</div>

							<Show when={current().price}>
								<div class="wb-offer-poster-price" data-preview-id="offer-price">
									<strong>{current().price}</strong>
									<Show when={current().priceNote}>
										<span>{current().priceNote}</span>
									</Show>
								</div>
							</Show>

							<Show when={current().smallPrint}>
								<p class="wb-offer-poster-small-print">{current().smallPrint}</p>
							</Show>
						</>
					)}
				</Show>
			</div>
		</section>
	);
};
