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

import { useAutoFitText } from '@hooks/system/useAutoFitText';
import { useDataSources } from '@hooks/system/useDataSources';
import { useSettings } from '@hooks/system/useSettings';

import type { DataSources, Settings } from '@interfaces/application.interface';
import type { Product } from '@interfaces/product.interface';

import {
	buildFileSystemMediaIndex,
	findFileSystemMedia,
	type FileSystemMediaRecord
} from '@utils/media';
import { resolveMotion } from '@utils/motion';
import { createRotationController } from '@utils/rotation';
import { createTransitionController, type TransitionState } from '@utils/transition';
import { normalizeProducts, SAMPLE_PRODUCTS } from '@utils/product';

import style from '@components/wb-app/wb-app.module.scss';

type LayoutMode = 'wide' | 'landscape' | 'portrait' | 'compact';

const FALLBACK_PAINT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

const layoutModeFor = (width: number, height: number): LayoutMode => {
	const ratio = height > 0 ? width / height : 1;

	if (ratio >= 2.6) {
		return 'wide';
	}

	if (ratio <= 0.82) {
		return 'portrait';
	}

	return width < 900 || height < 560 ? 'compact' : 'landscape';
};

export default (props: { hostElement: HTMLDivElement }): JSX.Element => {
	let rootElement: HTMLDivElement | undefined;
	let resizeObserver: ResizeObserver | undefined;
	let transitionInitialized = false;
	const dataSources: Accessor<DataSources> = useDataSources();
	const settings: Accessor<Settings> = useSettings();
	const [layoutMode, setLayoutMode] = createSignal<LayoutMode>('landscape');
	const [pageIndex, setPageIndex] = createSignal(0);
	const [failedMediaKey, setFailedMediaKey] = createSignal('');
	const [transitionState, setTransitionState] = createSignal<TransitionState>({
		currentKey: 'initial',
		previousKey: null,
		transitioning: false
	});
	const rotation = createRotationController((_key, index): void => {
		setPageIndex(index);
	});
	const transition = createTransitionController('initial', setTransitionState);
	const hasBoundProducts = createMemo((): boolean => Object.prototype.hasOwnProperty.call(dataSources(), 'products'));
	const products = createMemo((): Product[] => {
		return hasBoundProducts() ? normalizeProducts(dataSources().products?.value) : SAMPLE_PRODUCTS;
	});
	const productKeys = createMemo((): string[] => products().map((product): string => product.sku));
	const currentProduct = createMemo((): Product | undefined => {
		const items = products();

		return items.length > 0 ? items[Math.min(pageIndex(), items.length - 1)] : undefined;
	});
	const imageIndex = createMemo(() => buildFileSystemMediaIndex(dataSources().productImages?.value));
	const currentMedia = createMemo((): FileSystemMediaRecord | undefined => {
		const product = currentProduct();

		return product ? findFileSystemMedia(imageIndex(), product.imageKey) : undefined;
	});
	const mediaVisible = createMemo((): boolean => {
		const product = currentProduct();

		return Boolean(product && currentMedia() && failedMediaKey() !== product.sku);
	});
	const fitCollectionTitle = useAutoFitText({
		minFontSize: 16,
		maxFontSize: 42,
		widthOnly: true,
		watch: (): string => settings().collectionTitle
	});
	const fitProductName = useAutoFitText({
		minFontSize: 28,
		maxFontSize: 104,
		watch: (): string => currentProduct()?.name ?? ''
	});
	const rootStyle = createMemo((): JSX.CSSProperties => ({
		'--wb-product-catalog-background': settings().backgroundColor,
		'--wb-product-catalog-text': settings().textColor,
		'--wb-product-catalog-muted': settings().mutedTextColor,
		'--wb-product-catalog-accent': settings().accentColor,
		'--wb-product-catalog-panel': settings().panelColor,
		'--wb-product-catalog-motion-duration': `${resolveMotion(settings().motionPreset).durationMs}ms`,
		'--wb-product-catalog-motion-distance': `${resolveMotion(settings().motionPreset).distancePx}px`
	}));

	onMount((): void => {
		if (!rootElement) {
			return;
		}

		const updateLayout = (): void => {
			if (!rootElement) {
				return;
			}

			const bounds = rootElement.getBoundingClientRect();
			setLayoutMode(layoutModeFor(bounds.width, bounds.height));
		};

		resizeObserver = new ResizeObserver(updateLayout);
		resizeObserver.observe(rootElement);
		updateLayout();
	});

	createEffect((): void => {
		const keys = productKeys();
		rotation.sync(keys, untrack(() => currentProduct()?.sku), settings().pageDurationSeconds * 1000);
	});

	createEffect((): void => {
		const key = currentProduct()?.sku ?? 'empty';
		const motion = resolveMotion(settings().motionPreset);

		transition.select(key, {
			enabled: transitionInitialized && motion.enabled,
			durationMs: motion.durationMs
		});
		transitionInitialized = true;
		setFailedMediaKey('');
	});

	onCleanup((): void => rotation.destroy());
	onCleanup((): void => transition.destroy());
	onCleanup((): void => resizeObserver?.disconnect());

	return (
		<div
			ref={(element): HTMLDivElement => rootElement = element}
			class={`wb-product-catalog-root ${style['wb-app']}`}
			data-host-ready={Boolean(props.hostElement)}
			data-layout={layoutMode()}
			data-page-index={pageIndex()}
			data-page-count={products().length}
			data-media-visible={String(mediaVisible())}
			data-motion-preset={settings().motionPreset}
			data-transitioning={String(transitionState().transitioning)}
			style={rootStyle()}
		>
			<header class="wb-product-catalog-header">
				<strong>{settings().brandLabel}</strong>
				<h1 ref={fitCollectionTitle}>{settings().collectionTitle}</h1>
				<span>{String(pageIndex() + 1).padStart(2, '0')} / {String(Math.max(1, products().length)).padStart(2, '0')}</span>
			</header>

			<Show
				when={currentProduct()}
				fallback={(
					<main class="wb-product-catalog-empty">
						<span>COLLECTION NOTE</span>
						<h2>{settings().emptyStateText}</h2>
					</main>
				)}
			>
				{(product: Accessor<Product>): JSX.Element => (
					<main class="wb-product-catalog-stage" data-product-key={product().sku}>
						<section class="wb-product-catalog-media">
							<img
								src={failedMediaKey() === product().sku ? FALLBACK_PAINT_PIXEL : currentMedia()?.url ?? FALLBACK_PAINT_PIXEL}
								alt=""
								data-visible={String(mediaVisible())}
								style={{ 'object-fit': settings().mediaFit }}
								onError={(): void => {
									setFailedMediaKey(product().sku);
								}}
							/>
							<div
								class="wb-product-catalog-media-fallback"
								aria-label="Product image unavailable"
								data-visible={String(!mediaVisible())}
							>
								<i /><i /><i />
								<span>{product().category.split('/')[0]?.trim()}</span>
							</div>
							<small>{product().sku}</small>
						</section>

						<section class="wb-product-catalog-copy">
							<div class="wb-product-catalog-copy-topline">
								<span>{product().category}</span>
								<strong>{product().badge}</strong>
							</div>
							<h2 ref={fitProductName}>{product().name}</h2>
							<p>{product().description}</p>
							<div class="wb-product-catalog-details">
								<span>{product().detailOne}</span>
								<span>{product().detailTwo}</span>
							</div>
							<footer>
								<strong>{product().price}</strong>
								<span>{product().availability}</span>
							</footer>
						</section>
					</main>
				)}
			</Show>

			<nav class="wb-product-catalog-progress" aria-label="Catalog page progress">
				<For each={products()}>{(product): JSX.Element => <i data-active={String(product.sku === currentProduct()?.sku)} />}</For>
			</nav>
		</div>
	);
};
