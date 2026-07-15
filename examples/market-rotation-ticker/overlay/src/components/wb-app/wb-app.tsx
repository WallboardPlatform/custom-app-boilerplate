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

import { useDataSources } from '@hooks/system/useDataSources';
import { useSettings } from '@hooks/system/useSettings';

import type { DataSources, FontSettings, Settings } from '@interfaces/application.interface';
import type {
	IconIndex,
	IconRecord,
	MarketDefinition,
	MarketDirection,
	MarketSnapshot,
	MarketStock
} from '@interfaces/market.interface';

import style from '@components/wb-app/wb-app.module.scss';

interface Dimensions {
	width: number;
	height: number;
}

interface RailStock extends MarketStock {
	renderKey: string;
}

type TickerPhase = 'title' | 'title-exit' | 'scroll' | 'scroll-exit';

const TRANSITION_MILLISECONDS: number = 320;
const REFERENCE_HEIGHT: number = 136;

const isRecord = (value: unknown): value is Record<string, unknown> => {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const parseValue = (value: unknown): unknown => {
	if (typeof value !== 'string') {
		return value;
	}

	try {
		return JSON.parse(value) as unknown;
	} catch {
		return value;
	}
};

const toText = (value: unknown): string => {
	return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
};

const toNumber = (value: unknown): number | undefined => {
	const text: string = toText(value);

	if (!text || text.toUpperCase() === '#N/A' || text.toUpperCase() === 'N/A') {
		return undefined;
	}

	const parsedValue: number = Number(text.replace(/[$,%\s]/g, '').replace(/,/g, ''));

	return Number.isFinite(parsedValue) ? parsedValue : undefined;
};

const addThousandsSeparators = (value: string): string => {
	const parts: string[] = value.split('.');
	parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');

	return parts.join('.');
};

const formatNumber = (value: number, decimals: number): string => {
	return addThousandsSeparators(value.toFixed(decimals));
};

const formatChange = (value: number, isFx: boolean): string => {
	const absoluteValue: number = Math.abs(value);

	if (isFx) {
		return formatNumber(absoluteValue, 3);
	}

	return formatNumber(absoluteValue, absoluteValue < 10 ? 2 : 1);
};

const extractPathArray = (rawValue: unknown, path: string[]): unknown[] => {
	let currentValue: unknown = parseValue(rawValue);

	for (const segment of path) {
		if (!isRecord(currentValue)) {
			return [];
		}

		currentValue = parseValue(currentValue[segment]);
	}

	return Array.isArray(currentValue) ? currentValue : [];
};

const directionFrom = (rawDirection: unknown, rawChange: unknown, change: number): MarketDirection => {
	const explicitDirection: string = toText(rawDirection).toLowerCase();

	if (explicitDirection === 'up' || explicitDirection === 'down') {
		return explicitDirection;
	}

	const changeText: string = toText(rawChange);

	return changeText.startsWith('-') || change < 0 ? 'down' : 'up';
};

const normalizeApiStocks = (rawValue: unknown, marketId: string, isFx: boolean): MarketStock[] => {
	return extractPathArray(rawValue, ['response'])
		.map((rawRow: unknown, index: number): MarketStock | undefined => {
			if (!isRecord(rawRow)) {
				return undefined;
			}

			const symbol: string = toText(rawRow.s);
			const price: number | undefined = toNumber(rawRow.c);
			const change: number | undefined = toNumber(rawRow.ch);

			if (!symbol || price === undefined || change === undefined) {
				return undefined;
			}

			return {
				id: `${marketId}-${toText(rawRow.id) || index}-${symbol}`,
				symbol,
				price: formatNumber(price, isFx ? 4 : 2),
				change: formatChange(change, isFx),
				direction: directionFrom(undefined, rawRow.ch, change)
			};
		})
		.filter((stock: MarketStock | undefined): stock is MarketStock => Boolean(stock));
};

const normalizeTsxStocks = (rawValue: unknown, marketId: string): MarketStock[] => {
	return extractPathArray(rawValue, ['feed', 'entry'])
		.map((rawRow: unknown, index: number): MarketStock | undefined => {
			if (!isRecord(rawRow)) {
				return undefined;
			}

			const symbol: string = toText(rawRow['gsx:Ticker']);
			const price: number | undefined = toNumber(rawRow['gsx:Live Price']);
			const rawChange: unknown = rawRow['gsx:Today\'s Change ($)'];
			const change: number | undefined = toNumber(rawChange);

			if (!symbol || price === undefined || change === undefined) {
				return undefined;
			}

			return {
				id: `${marketId}-${toText(rawRow['gsx:ID']) || index}-${symbol}`,
				symbol,
				price: formatNumber(price, 2),
				change: formatChange(change, false),
				direction: directionFrom(rawRow['gsx:ChangeIcon'], rawChange, change)
			};
		})
		.filter((stock: MarketStock | undefined): stock is MarketStock => Boolean(stock));
};

const normalizeMarket = (definition: MarketDefinition, rawValue: unknown): MarketSnapshot | undefined => {
	const stocks: MarketStock[] = definition.kind === 'tsx-feed'
		? normalizeTsxStocks(rawValue, definition.id)
		: normalizeApiStocks(rawValue, definition.id, definition.kind === 'fx-api');

	if (stocks.length === 0) {
		return undefined;
	}

	return {
		id: definition.id,
		label: definition.label,
		stocks
	};
};

const iconKey = (value: string): string => {
	const fileName: string = value.split(/[\\/]/).pop() ?? value;

	return fileName.replace(/\.[^.]+$/, '').trim().toUpperCase();
};

const normalizedIconKey = (value: string): string => {
	return iconKey(value).replace(/[^A-Z0-9]/g, '');
};

const normalizeIconRecords = (rawValue: unknown): IconRecord[] => {
	const value: unknown = parseValue(rawValue);
	const rows: unknown[] = Array.isArray(value)
		? value
		: isRecord(value) && Array.isArray(value.content)
			? value.content
			: [];

	return rows
		.map((rawRow: unknown): IconRecord | undefined => {
			if (!isRecord(rawRow)) {
				return undefined;
			}

			const name: string = toText(rawRow.name);
			const url: string = toText(rawRow.url) || toText(rawRow.thumbnailUrl);

			return name && url ? { name, url } : undefined;
		})
		.filter((record: IconRecord | undefined): record is IconRecord => Boolean(record));
};

const buildIconIndex = (rawValue: unknown): IconIndex => {
	const exact: Map<string, string> = new Map<string, string>();
	const normalized: Map<string, string> = new Map<string, string>();

	for (const record of normalizeIconRecords(rawValue)) {
		exact.set(iconKey(record.name), record.url);
		normalized.set(normalizedIconKey(record.name), record.url);
	}

	return { exact, normalized };
};

const findIcon = (index: IconIndex, symbol: string): string | undefined => {
	return index.exact.get(iconKey(symbol)) ?? index.normalized.get(normalizedIconKey(symbol));
};

const cloneMarket = (market: MarketSnapshot): MarketSnapshot => ({
	...market,
	stocks: market.stocks.map((stock: MarketStock): MarketStock => ({ ...stock }))
});

const createRailStocks = (stocks: MarketStock[], repetitions: number, prefix: string): RailStock[] => {
	const railStocks: RailStock[] = [];

	for (let repetition: number = 0; repetition < repetitions; repetition += 1) {
		for (const stock of stocks) {
			railStocks.push({
				...stock,
				renderKey: `${prefix}-${repetition}-${stock.id}`
			});
		}
	}

	return railStocks;
};

const fontVariables = (prefix: string, font: FontSettings, scale: number): Record<string, string> => ({
	[`--${prefix}-family`]: font.family,
	[`--${prefix}-size`]: `${font.size * scale}px`,
	[`--${prefix}-style`]: font.style,
	[`--${prefix}-weight`]: font.weight,
	[`--${prefix}-color`]: font.color,
	[`--${prefix}-decoration`]: font.decoration
});

const WbLogo = (props: { symbol: string; url?: string }): JSX.Element => {
	const [failed, setFailed] = createSignal<boolean>(false);

	return (
		<Show
			when={props.url && !failed()}
			fallback={<span class="stock-logo-fallback">{props.symbol.slice(0, 3)}</span>}
		>
			<img
				class="stock-logo-image"
				src={props.url}
				alt=""
				onError={(): void => {
					setFailed(true);
				}}
			/>
		</Show>
	);
};

const WbDirectionIcon = (props: {
	direction: MarketDirection;
	file?: string;
}): JSX.Element => {
	const [failed, setFailed] = createSignal<boolean>(false);

	return (
		<Show
			when={props.file && !failed()}
			fallback={<i class={`direction-triangle direction-triangle--${props.direction}`} />}
		>
			<img
				class="direction-image"
				src={props.file}
				alt=""
				onError={(): void => {
					setFailed(true);
				}}
			/>
		</Show>
	);
};

const WbStock = (props: {
	stock: RailStock;
	iconIndex: IconIndex;
	settings: Settings;
}): JSX.Element => {
	const logoUrl: Accessor<string | undefined> = createMemo((): string | undefined => {
		return findIcon(props.iconIndex, props.stock.symbol);
	});
	const directionFile: Accessor<string | undefined> = createMemo((): string | undefined => {
		return props.stock.direction === 'up' ? props.settings.upIconFile : props.settings.downIconFile;
	});

	return (
		<article class="stock-item" data-symbol={props.stock.symbol}>
			<div class="stock-logo"><WbLogo symbol={props.stock.symbol} url={logoUrl()} /></div>
			<div class="stock-values">
				<strong class="stock-symbol">{props.stock.symbol}</strong>
				<span class="stock-price">{props.stock.price}</span>
			</div>
			<div class={`stock-change stock-change--${props.stock.direction}`}>
				<WbDirectionIcon direction={props.stock.direction} file={directionFile()} />
				<span>{props.stock.change}</span>
			</div>
		</article>
	);
};

const WbTitleRail = (props: {
	label: string;
	speedPixelsPerSecond: number;
	scale: number;
	durationSeconds: number;
}): JSX.Element => {
	const labelSnapshot: string = untrack((): string => props.label);
	const speedSnapshot: number = untrack((): number => props.speedPixelsPerSecond);
	const scaleSnapshot: number = untrack((): number => props.scale);
	const durationSnapshot: number = untrack((): number => props.durationSeconds);
	let viewport!: HTMLDivElement;
	let rail!: HTMLDivElement;
	let mainTrack!: HTMLDivElement;
	let resizeObserver: ResizeObserver | undefined;
	let frameIds: number[] = [];
	let mounted: boolean = false;
	const [mainCopies, setMainCopies] = createSignal<number[]>([0]);
	const [bufferCopies, setBufferCopies] = createSignal<number[]>([]);

	const createCopies = (count: number): number[] => {
		return Array.from({ length: count }, (_: unknown, index: number): number => index);
	};

	const clearFrames = (): void => {
		for (const frameId of frameIds) {
			window.cancelAnimationFrame(frameId);
		}

		frameIds = [];
	};

	const nextFrame = (callback: () => void): void => {
		frameIds.push(window.requestAnimationFrame(callback));
	};

	const initialize = (): void => {
		if (!mounted) {
			return;
		}

		clearFrames();
		rail.style.transition = 'none';
		rail.style.transform = 'translate3d(0, 0, 0)';
		setBufferCopies([]);
		setMainCopies([0]);

		nextFrame((): void => {
			const viewportWidth: number = viewport.getBoundingClientRect().width;
			const labelWidth: number = mainTrack.getBoundingClientRect().width;
			const speed: number = Math.max(1, speedSnapshot * scaleSnapshot);

			if (viewportWidth <= 0 || labelWidth <= 0) {
				return;
			}

			const requiredTravel: number = speed * Math.max(0.2, durationSnapshot);
			const repetitions: number = Math.max(1, Math.ceil(Math.max(viewportWidth, requiredTravel) / labelWidth));
			setMainCopies(createCopies(repetitions));

			nextFrame((): void => {
				const mainWidth: number = mainTrack.getBoundingClientRect().width;

				if (mainWidth <= 0) {
					return;
				}

				setBufferCopies(createCopies(repetitions));

				nextFrame((): void => {
					const animationSeconds: number = Math.max(0.2, mainWidth / speed);

					rail.style.transition = `transform ${animationSeconds}s linear`;
					rail.style.transform = `translate3d(${-mainWidth}px, 0, 0)`;
				});
			});
		});
	};

	onMount((): void => {
		mounted = true;
		resizeObserver = new ResizeObserver((): void => initialize());
		resizeObserver.observe(viewport);
		initialize();
	});

	onCleanup((): void => {
		mounted = false;
		clearFrames();
		resizeObserver?.disconnect();
	});

	return (
		<div class="exchange-title" ref={viewport} data-preview-allow-overflow>
			<div class="exchange-title__rail" ref={rail}>
				<div class="exchange-title__track exchange-title__track--main" ref={mainTrack}>
					<For each={mainCopies()}>{(): JSX.Element => <strong>{labelSnapshot}</strong>}</For>
				</div>
				<div class="exchange-title__track exchange-title__track--buffer" aria-hidden="true">
					<For each={bufferCopies()}>{(): JSX.Element => <strong>{labelSnapshot}</strong>}</For>
				</div>
			</div>
		</div>
	);
};

const WbTickerRail = (props: {
	market: MarketSnapshot;
	iconIndex: IconIndex;
	settings: Settings;
	scale: number;
	onComplete: () => void;
}): JSX.Element => {
	const marketSnapshot: MarketSnapshot = untrack((): MarketSnapshot => props.market);
	const settingsSnapshot: Settings = untrack((): Settings => props.settings);
	const scaleSnapshot: number = untrack((): number => props.scale);
	let viewport!: HTMLDivElement;
	let rail!: HTMLDivElement;
	let mainTrack!: HTMLDivElement;
	let resizeObserver: ResizeObserver | undefined;
	let frameIds: number[] = [];
	let completed: boolean = false;
	let mounted: boolean = false;
	const [mainStocks, setMainStocks] = createSignal<RailStock[]>(createRailStocks(marketSnapshot.stocks, 1, 'main'));
	const [bufferStocks, setBufferStocks] = createSignal<RailStock[]>([]);

	const clearFrames = (): void => {
		for (const frameId of frameIds) {
			window.cancelAnimationFrame(frameId);
		}

		frameIds = [];
	};

	const nextFrame = (callback: () => void): void => {
		frameIds.push(window.requestAnimationFrame(callback));
	};

	const handleTransitionEnd = (event: TransitionEvent): void => {
		if (event.target !== rail || event.propertyName !== 'transform' || completed) {
			return;
		}

		completed = true;
		props.onComplete();
	};

	const initialize = (): void => {
		if (!mounted || marketSnapshot.stocks.length === 0) {
			return;
		}

		clearFrames();
		completed = false;
		rail.style.transition = 'none';
		rail.style.transform = 'translate3d(0, 0, 0)';
		setBufferStocks([]);
		setMainStocks(createRailStocks(marketSnapshot.stocks, 1, 'main'));

		nextFrame((): void => {
			const viewportWidth: number = viewport.getBoundingClientRect().width;
			const sourceWidth: number = mainTrack.getBoundingClientRect().width;

			if (viewportWidth <= 0 || sourceWidth <= 0) {
				return;
			}

			const repetitions: number = Math.max(1, Math.ceil(viewportWidth / sourceWidth));
			setMainStocks(createRailStocks(marketSnapshot.stocks, repetitions, 'main'));

			nextFrame((): void => {
				const mainWidth: number = mainTrack.getBoundingClientRect().width;

				if (mainWidth <= 0) {
					return;
				}

				setBufferStocks(createRailStocks(marketSnapshot.stocks, repetitions, 'buffer'));

				nextFrame((): void => {
					const speed: number = Math.max(1, settingsSnapshot.speedPixelsPerSecond * scaleSnapshot);
					const durationSeconds: number = Math.max(0.2, mainWidth / speed);

					rail.style.transition = `transform ${durationSeconds}s linear`;
					rail.style.transform = `translate3d(${-mainWidth}px, 0, 0)`;
				});
			});
		});
	};

	onMount((): void => {
		mounted = true;
		rail.addEventListener('transitionend', handleTransitionEnd);
		resizeObserver = new ResizeObserver((): void => initialize());
		resizeObserver.observe(viewport);
		initialize();
	});

	onCleanup((): void => {
		mounted = false;
		clearFrames();
		resizeObserver?.disconnect();
		rail.removeEventListener('transitionend', handleTransitionEnd);
	});

	return (
		<div class="ticker-viewport" ref={viewport} data-preview-allow-overflow>
			<div class="ticker-rail" ref={rail}>
				<div class="ticker-track ticker-track--main" ref={mainTrack}>
					<For each={mainStocks()}>
						{(stock: RailStock): JSX.Element => (
							<WbStock stock={stock} iconIndex={props.iconIndex} settings={props.settings} />
						)}
					</For>
				</div>
				<div class="ticker-track ticker-track--buffer" aria-hidden="true">
					<For each={bufferStocks()}>
						{(stock: RailStock): JSX.Element => (
							<WbStock stock={stock} iconIndex={props.iconIndex} settings={props.settings} />
						)}
					</For>
				</div>
			</div>
		</div>
	);
};

export default (props: { hostElement: HTMLDivElement }): JSX.Element => {
	const dataSources: Accessor<DataSources> = useDataSources();
	const settings: Accessor<Settings> = useSettings();
	const [dimensions, setDimensions] = createSignal<Dimensions>({ width: 6000, height: REFERENCE_HEIGHT });
	const [activeMarket, setActiveMarket] = createSignal<MarketSnapshot | undefined>();
	const [activeMarketIndex, setActiveMarketIndex] = createSignal<number>(0);
	const [phase, setPhase] = createSignal<TickerPhase>('title');
	let titleTimer: number | undefined;
	let titleExitTimer: number | undefined;
	let scrollExitTimer: number | undefined;

	const marketDefinitions: Accessor<MarketDefinition[]> = createMemo((): MarketDefinition[] => [
		{ id: 'nasdaq100', dataSourceKey: 'nasdaqData', kind: 'market-api', label: settings().nasdaqLabel },
		{ id: 'tsx60', dataSourceKey: 'tsxData', kind: 'tsx-feed', label: settings().tsxLabel },
		{ id: 'dow30', dataSourceKey: 'dowData', kind: 'market-api', label: settings().dowLabel },
		{ id: 'fx', dataSourceKey: 'fxData', kind: 'fx-api', label: settings().fxLabel }
	]);
	const markets: Accessor<MarketSnapshot[]> = createMemo((): MarketSnapshot[] => {
		return marketDefinitions()
			.map((definition: MarketDefinition): MarketSnapshot | undefined => {
				return normalizeMarket(definition, dataSources()[definition.dataSourceKey]?.value);
			})
			.filter((market: MarketSnapshot | undefined): market is MarketSnapshot => Boolean(market));
	});
	const icons: Accessor<IconIndex> = createMemo((): IconIndex => {
		return buildIconIndex(dataSources().stockIcons?.value);
	});
	const scale: Accessor<number> = createMemo((): number => {
		return Math.max(0.25, Math.min(dimensions().height / REFERENCE_HEIGHT, dimensions().width / 900));
	});
	const rootStyle: Accessor<JSX.CSSProperties> = createMemo((): JSX.CSSProperties => {
		const currentSettings: Settings = settings();
		const currentScale: number = scale();
		const contentHeight: number = Math.max(12, REFERENCE_HEIGHT - (currentSettings.verticalMargin * 2));
		const variables: Record<string, string> = {
			'--ticker-background': currentSettings.backgroundColor,
			'--exchange-title-color': currentSettings.exchangeTitleColor,
			'--up-color': currentSettings.upColor,
			'--down-color': currentSettings.downColor,
			'--fallback-icon-background': currentSettings.fallbackIconBackground,
			'--ticker-vertical-margin': `${currentSettings.verticalMargin * currentScale}px`,
			'--ticker-item-margin': `${currentSettings.itemMargin * currentScale}px`,
			'--ticker-logo-size': `${contentHeight * (currentSettings.logoScale / 100) * currentScale}px`,
			...fontVariables('exchange-title-font', currentSettings.marketLabelFont, currentScale),
			...fontVariables('symbol-font', currentSettings.tickerFont, currentScale),
			...fontVariables('price-font', currentSettings.priceFont, currentScale),
			...fontVariables('change-font', currentSettings.changeFont, currentScale)
		};

		return variables;
	});

	const clearCycleTimers = (): void => {
		if (titleTimer !== undefined) {
			window.clearTimeout(titleTimer);
		}

		if (titleExitTimer !== undefined) {
			window.clearTimeout(titleExitTimer);
		}

		if (scrollExitTimer !== undefined) {
			window.clearTimeout(scrollExitTimer);
		}

		titleTimer = undefined;
		titleExitTimer = undefined;
		scrollExitTimer = undefined;
	};

	const beginMarket = (requestedIndex: number): void => {
		clearCycleTimers();
		const availableMarkets: MarketSnapshot[] = untrack(markets);

		if (availableMarkets.length === 0) {
			setActiveMarket(undefined);

			return;
		}

		const nextIndex: number = requestedIndex % availableMarkets.length;
		setActiveMarketIndex(nextIndex);
		setActiveMarket(cloneMarket(availableMarkets[nextIndex]));
		setPhase('title');

		titleTimer = window.setTimeout((): void => {
			setPhase('title-exit');
			titleExitTimer = window.setTimeout((): void => {
				setPhase('scroll');
			}, TRANSITION_MILLISECONDS);
		}, settings().exchangeTitleSeconds * 1000);
	};

	const finishMarket = (): void => {
		if (phase() !== 'scroll') {
			return;
		}

		setPhase('scroll-exit');
		scrollExitTimer = window.setTimeout((): void => {
			untrack((): void => beginMarket(activeMarketIndex() + 1));
		}, TRANSITION_MILLISECONDS);
	};

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
		beginMarket(0);

		onCleanup((): void => {
			clearCycleTimers();
			resizeObserver.disconnect();
		});
	});

	createEffect((): void => {
		const availableMarkets: MarketSnapshot[] = markets();

		if (!activeMarket() && availableMarkets.length > 0) {
			untrack((): void => beginMarket(0));
		}
	});

	return (
		<div
			class={`wb-app ${style['wb-app']}`}
			data-host-ready={Boolean(props.hostElement)}
			data-market={activeMarket()?.id ?? 'none'}
			data-phase={phase()}
			style={rootStyle()}
		>
			<Show
				when={activeMarket()}
				fallback={<div class="ticker-empty">{settings().emptyStateText}</div>}
			>
				{(market: Accessor<MarketSnapshot>): JSX.Element => (
					<>
						<Show when={phase() === 'title' || phase() === 'title-exit'}>
							<div classList={{ 'exchange-title--exit': phase() === 'title-exit' }}>
								<WbTitleRail
									label={market().label}
									speedPixelsPerSecond={settings().speedPixelsPerSecond}
									scale={scale()}
									durationSeconds={settings().exchangeTitleSeconds}
								/>
							</div>
						</Show>
						<Show when={phase() === 'scroll' || phase() === 'scroll-exit'}>
							<div class="market-scroll" classList={{ 'market-scroll--exit': phase() === 'scroll-exit' }}>
								<WbTickerRail
									market={market()}
									iconIndex={icons()}
									settings={settings()}
									scale={scale()}
									onComplete={finishMarket}
								/>
							</div>
						</Show>
					</>
				)}
			</Show>
		</div>
	);
};
