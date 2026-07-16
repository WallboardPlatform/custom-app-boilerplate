import { createEffect, createMemo, createSignal, on, onCleanup, onMount, Show } from 'solid-js';
import type { Accessor, JSX } from 'solid-js';

import { useAutoFitText } from '@hooks/system/useAutoFitText';
import { useSettings } from '@hooks/system/useSettings';

import type { Settings } from '@interfaces/application.interface';

import style from '@components/wb-app/wb-app.module.scss';
import defaultArtwork from '../../assets/calder-kinetic-study.jpg';

export default (props: { hostElement: HTMLDivElement }): JSX.Element => {
	const settings: Accessor<Settings> = useSettings();
	const [imageFailed, setImageFailed] = createSignal<boolean>(false);
	const [imageLoaded, setImageLoaded] = createSignal<boolean>(false);
	const [layoutSettled, setLayoutSettled] = createSignal<boolean>(false);
	const [renderReady, setRenderReady] = createSignal<boolean>(false);
	let firstLayoutFrame: number | undefined;
	let secondLayoutFrame: number | undefined;
	let renderReadyTimer: number | undefined;
	const titleFitRef = useAutoFitText({
		minFontSize: 64,
		maxFontSize: 164,
		watch: (): string => settings().exhibitionTitle
	});
	const subtitleFitRef = useAutoFitText({
		minFontSize: 34,
		maxFontSize: 68,
		watch: (): string => settings().subtitle
	});
	const dateFitRef = useAutoFitText({
		minFontSize: 24,
		maxFontSize: 35,
		watch: (): string => settings().dateRange
	});
	const venueFitRef = useAutoFitText({
		minFontSize: 24,
		maxFontSize: 34,
		watch: (): string => settings().venue
	});
	const imageSourceSIG: Accessor<string> = createMemo((): string => settings().heroImage || defaultArtwork);
	const imageVisibleSIG: Accessor<boolean> = createMemo((): boolean => settings().showImage && !imageFailed());
	const detailsVisibleSIG: Accessor<boolean> = createMemo(
		(): boolean => settings().showVenue || settings().showSubtitle
	);
	const rootStyleSIG: Accessor<JSX.CSSProperties> = createMemo((): JSX.CSSProperties => ({
		'--museum-ground': settings().transparentBackground ? 'transparent' : settings().backgroundColor,
		'--museum-primary': settings().primaryColor,
		'--museum-secondary': settings().secondaryColor,
		'--museum-accent': settings().accentColor,
		'--museum-ground-text': settings().groundTextColor,
		'--museum-primary-text': settings().primaryTextColor,
		'--museum-primary-meta-text': settings().primaryMetaTextColor,
		'--museum-secondary-text': settings().secondaryTextColor,
		'--museum-accent-text': settings().accentTextColor,
		'--museum-ring': settings().ringColor
	}));

	createEffect(on(
		[imageSourceSIG, (): boolean => settings().showImage],
		([, showImage]): void => {
			setImageFailed(false);
			setImageLoaded(!showImage);
		},
		{ defer: true }
	));

	createEffect((): void => {
		const prerequisitesReady: boolean =
			layoutSettled() && (!settings().showImage || imageLoaded() || imageFailed());

		if (renderReadyTimer !== undefined) {
			window.clearTimeout(renderReadyTimer);
			renderReadyTimer = undefined;
		}

		setRenderReady(false);

		if (prerequisitesReady) {
			renderReadyTimer = window.setTimeout((): void => {
				renderReadyTimer = undefined;
				setRenderReady(true);
			}, 250);
		}
	});

	onMount((): void => {
		firstLayoutFrame = window.requestAnimationFrame((): void => {
			firstLayoutFrame = undefined;
			secondLayoutFrame = window.requestAnimationFrame((): void => {
				secondLayoutFrame = undefined;
				setLayoutSettled(true);
			});
		});
	});

	onCleanup((): void => {
		if (firstLayoutFrame !== undefined) {
			window.cancelAnimationFrame(firstLayoutFrame);
		}

		if (secondLayoutFrame !== undefined) {
			window.cancelAnimationFrame(secondLayoutFrame);
		}

		if (renderReadyTimer !== undefined) {
			window.clearTimeout(renderReadyTimer);
		}
	});

	return (
		<section
			class={`wb-app ${style['wb-app']}`}
			data-host-ready={Boolean(props.hostElement)}
			data-theme={settings().themePreset}
			data-transparent-background={settings().transparentBackground}
			style={rootStyleSIG()}
			aria-label="Calder Museum welcome"
		>
			<span class={`museum-render-ready ${style['render-ready']}`} aria-hidden="true">
				{renderReady() ? 'ready' : ''}
			</span>
			<div class={`museum-left-field ${style['left-field']}`}>
				<div class={`museum-brand ${style['brand']}`}>CALDER MUSEUM</div>
				<div ref={titleFitRef} class={`museum-title-fit ${style['title-fit']}`}>
					<span class={`museum-title ${style['title']}`}>{settings().exhibitionTitle}</span>
				</div>
				<div
					ref={dateFitRef}
					class={`museum-date ${style['date']}`}
					data-visible={settings().showDate}
					aria-hidden={!settings().showDate}
				>
					{settings().dateRange}
				</div>
			</div>

			<div class={style['right-field']}>
				<header class={style['welcome-band']}>
					<span>WELCOME</span>
				</header>

				<div class={style['lower-fields']}>
					<div
						class={`museum-image-field ${style['image-field']}`}
						data-image-state={imageVisibleSIG() ? 'image' : 'motif'}
					>
						<div class={style['image-ring']}>
							<div class={style['image-core']}>
								<Show
									when={imageVisibleSIG()}
									fallback={<div class={`museum-image-motif ${style['image-motif']}`} />}
								>
									<img
										class={`museum-artwork ${style['artwork']}`}
										src={imageSourceSIG()}
										alt=""
										draggable={false}
										onLoad={(event: Event): void => {
											const image: HTMLImageElement = event.currentTarget as HTMLImageElement;

											if (image.naturalWidth <= 1 || image.naturalHeight <= 1) {
												setImageFailed(true);
											} else {
												setImageLoaded(true);
											}
										}}
										onError={(): void => {
											setImageFailed(true);
										}}
									/>
								</Show>
							</div>
						</div>
					</div>

					<aside class={`museum-details-field ${style['details-field']}`}>
						<div
							ref={venueFitRef}
							class={`museum-venue ${style['venue']}`}
							data-visible={settings().showVenue}
							aria-hidden={!settings().showVenue}
						>
							{settings().venue}
						</div>
						<div
							ref={subtitleFitRef}
							class={`museum-subtitle-fit ${style['subtitle-fit']}`}
							data-visible={settings().showSubtitle}
							aria-hidden={!settings().showSubtitle}
						>
							<span class={`museum-subtitle ${style['subtitle']}`} data-visible={settings().showSubtitle}>
								{settings().subtitle}
							</span>
						</div>
						<div
							class={style['rule']}
							data-visible={detailsVisibleSIG()}
							aria-hidden="true"
						/>
						<div class={style['details-mark']} aria-hidden="true">
							<span />
						</div>
					</aside>
				</div>
			</div>
		</section>
	);
};
