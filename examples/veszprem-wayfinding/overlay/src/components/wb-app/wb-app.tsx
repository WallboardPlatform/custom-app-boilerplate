import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show, untrack } from 'solid-js';
import type { Accessor, JSX } from 'solid-js';

import { useAutoFitText } from '@hooks/system/useAutoFitText';
import { useDataSources } from '@hooks/system/useDataSources';
import { useSettings } from '@hooks/system/useSettings';

import type { DataSources, Settings } from '@interfaces/application.interface';
import type { Destination } from '@interfaces/wayfinding.interface';
import type { WayfindingRoutePoint, WayfindingRouteResult } from '@utils/wayfinding';
import { normalizeDestinations } from '@utils/destinations';
import { routeBetweenLocations } from '@utils/route-graph';

import style from '@components/wb-app/wb-app.module.scss';
import { keyboardLayoutsFor, OnScreenKeyboard } from '../../capabilities/keyboard';
import type { KeyboardLayoutId } from '../../capabilities/keyboard';
import mapMarkup from '../../assets/map.svg?raw';
import mapArtwork from '../../assets/veszprem-map.webp';
import sampleDestinationData from '../../../sample-destinations-datasource.json';

type MapState = 'loading' | 'ready' | 'error';
type RouteState = 'idle' | 'active' | 'external' | 'unavailable';

interface MapPoint {
	x: number;
	y: number;
}

const MAP_WIDTH = 1341;
const MAP_HEIGHT = 947;
const PAGE_SIZE = 7;
const ROUTE_GROUP_ID = 'wb-veszprem-wayfinding-route';

const normalizeSearch = (value: string): string => value
	.normalize('NFD')
	.replace(/[\u0300-\u036f]/g, '')
	.toLocaleLowerCase();

const formatWalkTime = (seconds: number): string => `${Math.max(1, Math.ceil(seconds / 60))} min`;

const clamp = (value: number, minimum: number, maximum: number): number => Math.min(maximum, Math.max(minimum, value));

export default (props: { hostElement: HTMLDivElement }): JSX.Element => {
	const dataSources: Accessor<DataSources> = useDataSources();
	const settings: Accessor<Settings> = useSettings();
	const [category, setCategory] = createSignal('All destinations');
	const [currentPage, setCurrentPage] = createSignal(0);
	const [keyboardOpen, setKeyboardOpen] = createSignal(false);
	const [mapCenter, setMapCenter] = createSignal<MapPoint>({ x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 });
	const [mapState, setMapState] = createSignal<MapState>('loading');
	const [mapZoom, setMapZoom] = createSignal(1);
	const [query, setQuery] = createSignal('');
	const [routeResult, setRouteResult] = createSignal<WayfindingRouteResult>();
	const [routeState, setRouteState] = createSignal<RouteState>('idle');
	const [selectedId, setSelectedId] = createSignal<string>();
	let mapHost!: HTMLDivElement;
	let resetTimer: ReturnType<typeof setTimeout> | undefined;
	let svg: SVGSVGElement | undefined;
	const keyboardLayouts = createMemo(() => {
		const configuredLanguage = settings().keyboardLanguages;
		const languages: KeyboardLayoutId[] = configuredLanguage === 'hu-en'
			? ['hu', 'en']
			: [configuredLanguage];

		return keyboardLayoutsFor(languages);
	});

	createEffect((): void => {
		if (!settings().onScreenKeyboard) setKeyboardOpen(false);
	});

	const hasBoundDestinations: Accessor<boolean> = createMemo((): boolean => {
		return Object.prototype.hasOwnProperty.call(dataSources(), 'destinationData');
	});
	const destinations: Accessor<Destination[]> = createMemo((): Destination[] => {
		const source: unknown = hasBoundDestinations()
			? dataSources().destinationData?.value
			: sampleDestinationData;

		return normalizeDestinations(source);
	});
	const destinationById: Accessor<Map<string, Destination>> = createMemo((): Map<string, Destination> => {
		return new Map(destinations().map((destination: Destination): [string, Destination] => [destination.id, destination]));
	});
	const categories: Accessor<string[]> = createMemo((): string[] => {
		return ['All destinations', ...Array.from(new Set(destinations().map((destination: Destination): string => destination.category)))];
	});
	const filteredDestinations: Accessor<Destination[]> = createMemo((): Destination[] => {
		const normalizedQuery: string = normalizeSearch(query().trim());

		return destinations().filter((destination: Destination): boolean => {
			const categoryMatches: boolean = category() === 'All destinations' || destination.category === category();
			const queryMatches: boolean = normalizedQuery === '' || normalizeSearch([
				destination.mapNumber,
				destination.name,
				destination.englishName,
				destination.category,
				destination.status
			].join(' ')).includes(normalizedQuery);

			return categoryMatches && queryMatches;
		});
	});
	const pageCount: Accessor<number> = createMemo((): number => Math.max(1, Math.ceil(filteredDestinations().length / PAGE_SIZE)));
	const visibleDestinations: Accessor<Destination[]> = createMemo((): Destination[] => {
		const start: number = currentPage() * PAGE_SIZE;

		return filteredDestinations().slice(start, start + PAGE_SIZE);
	});
	const selectedDestination: Accessor<Destination | undefined> = createMemo((): Destination | undefined => {
		return selectedId() ? destinationById().get(selectedId()!) : undefined;
	});
	const startDestination: Accessor<Destination | undefined> = createMemo((): Destination | undefined => {
		return destinationById().get(settings().startLocationId);
	});
	const fitTitle = useAutoFitText({
		minFontSize: 20,
		maxFontSize: 36,
		widthOnly: true,
		watch: (): string => settings().title
	});
	const fitSelectedName = useAutoFitText({
		minFontSize: 22,
		maxFontSize: 38,
		watch: (): string => selectedDestination()?.name ?? ''
	});

	const resetMapView = (): void => {
		setMapCenter({ x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 });
		setMapZoom(1);
	};

	const removeRouteMarkup = (): void => {
		if (!svg) return;

		for (const route of Array.from(svg.querySelectorAll(`[id='${ROUTE_GROUP_ID}']`))) route.remove();

		for (const target of Array.from(svg.querySelectorAll('[data-wb-wayfinding-selected]'))) {
			target.removeAttribute('data-wb-wayfinding-selected');
		}
	};

	const clearResetTimer = (): void => {
		if (resetTimer) clearTimeout(resetTimer);
		resetTimer = undefined;
	};

	const resetSession = (): void => {
		clearResetTimer();
		removeRouteMarkup();
		setCategory('All destinations');
		setCurrentPage(0);
		setKeyboardOpen(false);
		setQuery('');
		setRouteResult(undefined);
		setRouteState('idle');
		setSelectedId(undefined);
		resetMapView();
	};

	const scheduleReset = (): void => {
		clearResetTimer();
		resetTimer = setTimeout(resetSession, settings().routeResetSeconds * 1000);
	};

	const drawRoute = (
		destination: Destination,
		restartTimer = true,
		startLocationId = settings().startLocationId,
		mapRatio = settings().mapRatio
	): void => {
		if (!svg) return;

		removeRouteMarkup();
		setSelectedId(destination.id);
		setKeyboardOpen(false);

		if (!destination.routeable) {
			setRouteResult(undefined);
			setRouteState('external');
			resetMapView();

			if (restartTimer) scheduleReset();

			return;
		}

		const result: WayfindingRouteResult | undefined = routeBetweenLocations(
			startLocationId,
			destination.id,
			mapRatio
		);

		if (!result) {
			setRouteResult(undefined);
			setRouteState('unavailable');

			if (restartTimer) scheduleReset();

			return;
		}

		const path: WayfindingRoutePoint[] = result.path;

		if (path.length > 1) {
			const namespace = 'http://www.w3.org/2000/svg';
			const group: SVGGElement = document.createElementNS(namespace, 'g');
			const route: SVGPathElement = document.createElementNS(namespace, 'path');
			group.id = ROUTE_GROUP_ID;
			group.setAttribute('pointer-events', 'none');
			route.setAttribute('d', path.map((point: WayfindingRoutePoint, index: number): string => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' '));
			route.setAttribute('fill', 'none');
			route.setAttribute('stroke', settings().routeColor);
			route.setAttribute('stroke-linecap', 'round');
			route.setAttribute('stroke-linejoin', 'round');
			route.setAttribute('stroke-width', '7');
			route.setAttribute('vector-effect', 'non-scaling-stroke');
			group.append(route);

			for (const point of [path[0], path[path.length - 1]]) {
				const marker: SVGCircleElement = document.createElementNS(namespace, 'circle');
				marker.setAttribute('cx', String(point.x));
				marker.setAttribute('cy', String(point.y));
				marker.setAttribute('fill', settings().panelColor);
				marker.setAttribute('r', '10');
				marker.setAttribute('stroke', settings().routeColor);
				marker.setAttribute('stroke-width', '5');
				marker.setAttribute('vector-effect', 'non-scaling-stroke');
				group.append(marker);
			}

			svg.append(group);

			if (settings().motionPreset !== 'off') {
				const routeLength: number = route.getTotalLength();
				route.style.strokeDasharray = String(routeLength);
				route.style.strokeDashoffset = String(routeLength);
				route.getBoundingClientRect();
				route.style.transition = 'stroke-dashoffset 650ms ease-out';
				route.style.strokeDashoffset = '0';
			}
		}

		const target: Element | undefined = Array.from(svg.querySelectorAll('[data-wayfinding-location-id]')).find((element: Element): boolean => {
			return element.getAttribute('data-wayfinding-location-id') === destination.id;
		});

		target?.setAttribute('data-wb-wayfinding-selected', 'true');
		setRouteResult(result);
		setRouteState('active');

		if (restartTimer) scheduleReset();
	};

	const handleMapClick = (event: MouseEvent): void => {
		let element: Element | null = event.target instanceof Element ? event.target : null;

		while (element && element !== svg) {
			const locationId: string | null = element.getAttribute('data-wayfinding-location-id');
			const destination: Destination | undefined = locationId ? destinationById().get(locationId) : undefined;

			if (destination) {
				drawRoute(destination);

				return;
			}

			element = element.parentElement;
		}
	};

	const changeQuery = (value: string): void => {
		setQuery(value);
		setCurrentPage(0);
		scheduleReset();
	};

	onMount((): void => {
		svg = mapHost.querySelector('svg') ?? undefined;

		if (!svg) {
			setMapState('error');

			return;
		}

		svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
		const image: SVGImageElement | null = svg.querySelector('#map-artwork');

		if (!image) {
			setMapState('error');

			return;
		}

		image.addEventListener('load', (): void => { setMapState('ready'); }, { once: true });
		image.addEventListener('error', (): void => { setMapState('error'); }, { once: true });
		image.setAttribute('href', mapArtwork);
		image.setAttributeNS('http://www.w3.org/1999/xlink', 'href', mapArtwork);
		mapHost.addEventListener('click', handleMapClick);
	});

	createEffect((): void => {
		const zoom: number = mapZoom();
		const center: MapPoint = mapCenter();
		const width: number = MAP_WIDTH / zoom;
		const height: number = MAP_HEIGHT / zoom;
		const x: number = clamp(center.x - width / 2, 0, MAP_WIDTH - width);
		const y: number = clamp(center.y - height / 2, 0, MAP_HEIGHT - height);

		svg?.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
	});

	createEffect((): void => {
		if (currentPage() >= pageCount()) setCurrentPage(pageCount() - 1);
	});

	createEffect((): void => {
		const selected: Destination | undefined = selectedDestination();

		if (selectedId() && !selected) resetSession();
	});

	createEffect((): void => {
		const startLocationId: string = settings().startLocationId;
		const mapRatio: number = settings().mapRatio;
		const selected: Destination | undefined = untrack(selectedDestination);

		if (selected && untrack(routeState) === 'active') {
			untrack((): void => { drawRoute(selected, false, startLocationId, mapRatio); });
		}
	});

	createEffect((): void => {
		const color: string = settings().routeColor;

		if (!svg) return;

		for (const element of Array.from(svg.querySelectorAll(`#${ROUTE_GROUP_ID} path, #${ROUTE_GROUP_ID} circle`))) {
			element.setAttribute('stroke', color);
		}
	});

	onCleanup((): void => {
		clearResetTimer();
		mapHost?.removeEventListener('click', handleMapClick);
	});

	return (
		<div
			class={style['wb-app']}
			style={{
				'--wb-veszprem-accent': settings().accentColor,
				'--wb-veszprem-background': settings().backgroundColor,
				'--wb-veszprem-panel': settings().panelColor,
				'--wb-veszprem-primary': settings().primaryTextColor,
				'--wb-veszprem-route': settings().routeColor,
				'--wb-veszprem-secondary': settings().secondaryTextColor
			}}
			data-host-ready={Boolean(props.hostElement)}
			data-map-state={mapState()}
			data-map-ratio={settings().mapRatio}
			data-map-zoom={mapZoom()}
			data-motion={settings().motionPreset}
			data-preview-id="veszprem-wayfinding-root"
			data-route-reset={settings().routeResetSeconds}
		>
			<header class={style['header']}>
				<div class={style['identity']} aria-hidden="true"><strong>V</strong><span>VESZPREM</span></div>
				<div class={style['heading']}>
					<p class="wb-veszprem-metadata">DOWNTOWN VISITOR MAP / BELVAROS</p>
					<h1 ref={fitTitle} class="wb-veszprem-title">{settings().title}</h1>
				</div>
				<div class={style['locator']}>
					<span class="wb-veszprem-metadata">YOU ARE HERE</span>
					<strong class="wb-veszprem-secondary">{startDestination()?.name || settings().startLocationId}</strong>
				</div>
				<button class={style['reset-button']} type="button" onClick={resetSession}>Reset</button>
			</header>

			<main class={style['content']}>
				<section class={style['map-panel']} aria-label="Map">
					<div ref={mapHost} class={style['map-canvas']}>
						<div class={style['map-markup']} innerHTML={mapMarkup} />
						<Show when={mapState() !== 'ready'}>
							<div class={style['map-status']}>{mapState() === 'error' ? 'Map artwork unavailable' : 'Loading map...'}</div>
						</Show>
						<div class={style['map-controls']} aria-label="Map zoom controls">
							<button type="button" title="Zoom in" aria-label="Zoom in" onClick={(): void => { setMapZoom((value: number): number => clamp(value + 0.25, 1, 2.5)); scheduleReset(); }}>+</button>
							<button type="button" title="Zoom out" aria-label="Zoom out" onClick={(): void => { setMapZoom((value: number): number => clamp(value - 0.25, 1, 2.5)); scheduleReset(); }}>−</button>
							<button type="button" title="Fit map" aria-label="Fit map" onClick={(): void => { resetMapView(); scheduleReset(); }}>⛶</button>
						</div>
					</div>
					<div class={style['map-instruction']}>
						<span>Tap a numbered landmark</span>
						<i aria-hidden="true" />
						<span>Routes are approximate</span>
						<i aria-hidden="true" />
						<span>Accessibility requires venue confirmation</span>
					</div>
				</section>

				<aside class={style['directory']}>
					<Show when={selectedDestination()} keyed fallback={
						<>
							<div class={style['directory-intro']}>
								<p class="wb-veszprem-metadata">FIND A LANDMARK</p>
								<h2 class="wb-veszprem-secondary">Where would you like to go?</h2>
								<span>{settings().subtitle}</span>
							</div>
							<div class={style['filters']}>
								<div class={style['search-field']}>
									<input
										aria-label="Search destinations"
										inputMode="none"
										placeholder="Search destinations"
										type="search"
										value={query()}
										onFocus={(): void => { setKeyboardOpen(true); scheduleReset(); }}
										onInput={(event): void => { changeQuery(event.currentTarget.value); }}
									/>
									<button type="button" aria-label="Open touch keyboard" title="Open touch keyboard" onClick={(): void => { setKeyboardOpen(true); scheduleReset(); }}>ABC</button>
								</div>
								<select aria-label="Destination category" value={category()} onChange={(event): void => { setCategory(event.currentTarget.value); setCurrentPage(0); scheduleReset(); }}>
									<For each={categories()}>{(name: string): JSX.Element => <option value={name}>{name}</option>}</For>
								</select>
							</div>

							<div class={style['destination-list']} data-destination-count={filteredDestinations().length}>
								<Show when={visibleDestinations().length > 0} fallback={<div class={style['empty-state']}>{settings().emptyStateText}</div>}>
									<For each={visibleDestinations()}>{(destination: Destination): JSX.Element => (
										<button type="button" data-routeable={destination.routeable} onClick={(): void => { drawRoute(destination); }}>
											<small data-wide={destination.mapNumber.length > 2}>{destination.mapNumber || '•'}</small>
											<span>
												<strong class="wb-veszprem-destination-name">{destination.name}</strong>
												<em>{destination.englishName || destination.category}</em>
											</span>
											<i aria-hidden="true">›</i>
										</button>
									)}</For>
								</Show>
							</div>

							<div class={style['pagination']}>
								<button type="button" aria-label="Previous destination page" disabled={currentPage() === 0} onClick={(): void => { setCurrentPage((value: number): number => Math.max(0, value - 1)); scheduleReset(); }}>‹</button>
								<span>{filteredDestinations().length === 0 ? '0 / 0' : `${currentPage() + 1} / ${pageCount()}`}</span>
								<button type="button" aria-label="Next destination page" disabled={currentPage() >= pageCount() - 1} onClick={(): void => { setCurrentPage((value: number): number => Math.min(pageCount() - 1, value + 1)); scheduleReset(); }}>›</button>
							</div>

						</>
					}>
						{(destination: Destination): JSX.Element => (
							<section class={style['route-card']}>
								<button class={style['back-button']} type="button" onClick={resetSession}>‹ Back to directory</button>
								<div class={style['detail-number']}>{destination.mapNumber || 'INFO'}</div>
								<p class="wb-veszprem-metadata">{destination.category}</p>
								<h2 ref={fitSelectedName} class="wb-veszprem-selected-name">{destination.name}</h2>
								<Show when={destination.englishName}><h3>{destination.englishName}</h3></Show>
								<Show when={destination.description}><p class={style['description']}>{destination.description}</p></Show>
								<Show when={destination.hours}><p class={style['fact']}><span>Hours</span>{destination.hours}</p></Show>
								<Show when={destination.status}><p class={style['fact']}><span>Status</span>{destination.status}</p></Show>
								<span class={style['accessibility']} data-accessibility={destination.accessible === null ? 'unknown' : destination.accessible ? 'yes' : 'no'}>
									{destination.accessible === null ? 'ACCESSIBILITY NOT VERIFIED' : destination.accessible ? 'STEP-FREE DESTINATION' : 'STEP-FREE ACCESS NOT CONFIRMED'}
								</span>
								<div class={style['route-summary']}>
									<Show when={routeState() === 'active' && routeResult()} keyed fallback={
										<strong>{routeState() === 'external'
											? 'Listed outside the downtown route map'
											: routeState() === 'unavailable'
												? 'No route is available from the configured start'
												: 'You are already at this destination'}</strong>
									}>
										{(result: WayfindingRouteResult): JSX.Element => (
											<>
												<div><span>APPROX. DISTANCE</span><strong>{result.walkingDistance} m</strong></div>
												<div><span>WALKING TIME</span><strong>{formatWalkTime(result.walkingSeconds)}</strong></div>
											</>
										)}
									</Show>
								</div>
								<button class={style['clear-button']} type="button" onClick={resetSession}>Clear route</button>
							</section>
						)}
					</Show>
				</aside>
			</main>
			<Show when={keyboardOpen()}>
				<OnScreenKeyboard
					accentColor={settings().accentColor}
					backgroundColor={settings().panelColor}
					borderColor={settings().secondaryTextColor}
					label="Search destinations"
					layouts={keyboardLayouts()}
					maximumLength={80}
					onClose={(): void => { setKeyboardOpen(false); }}
					onInput={setQuery}
					onSubmit={(): void => { setKeyboardOpen(false); }}
					submitLabel="Show results"
					textColor={settings().primaryTextColor}
					value={query()}
				/>
			</Show>
		</div>
	);
};
