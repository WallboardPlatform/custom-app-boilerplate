import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show, untrack } from 'solid-js';
import type { Accessor, JSX } from 'solid-js';

import { useAutoFitText } from '@hooks/system/useAutoFitText';
import { useDataSources } from '@hooks/system/useDataSources';
import { useSettings } from '@hooks/system/useSettings';

import type { DataSources, Settings } from '@interfaces/application.interface';
import type { Destination, RoutePoint, RouteResult } from '@interfaces/wayfinding.interface';
import { normalizeDestinations } from '@utils/destinations';
import { extractRoutePoints, RouteGraph } from '@utils/route-graph';

import style from '@components/wb-app/wb-app.module.scss';
import veszpremMapMarkup from '../../assets/veszprem-belvaros-wayfinding.svg?raw';
import sampleDestinationData from '../../../sample-destinations-datasource.json';


type RouteState = 'idle' | 'active' | 'external' | 'unavailable';

const ROUTE_GROUP_ID = 'wb-veszprem-wayfinding-route';

const formatWalkTime = (seconds: number): string => {
	return `${Math.max(1, Math.ceil(seconds / 60))} min walk`;
};

export default (props: { hostElement: HTMLDivElement }): JSX.Element => {
	const dataSources: Accessor<DataSources> = useDataSources();
	const settings: Accessor<Settings> = useSettings();
	const [category, setCategory] = createSignal('All destinations');
	const [query, setQuery] = createSignal('');
	const [routeResult, setRouteResult] = createSignal<RouteResult>();
	const [routeState, setRouteState] = createSignal<RouteState>('idle');
	const [selectedId, setSelectedId] = createSignal<string>();
	let mapHost!: HTMLDivElement;
	let routeGraph: RouteGraph | undefined;
	let routeResetTimer: ReturnType<typeof setTimeout> | undefined;
	let svg: SVGSVGElement | undefined;

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
		const normalizedQuery: string = query().trim().toLocaleLowerCase();

		return destinations().filter((destination: Destination): boolean => {
			const categoryMatches: boolean = category() === 'All destinations' || destination.category === category();
			const queryMatches: boolean = normalizedQuery === '' || [destination.name, destination.englishName, destination.category]
				.join(' ')
				.toLocaleLowerCase()
				.includes(normalizedQuery);

			return categoryMatches && queryMatches;
		});
	});
	const selectedDestination: Accessor<Destination | undefined> = createMemo((): Destination | undefined => {
		return selectedId() ? destinationById().get(selectedId()!) : undefined;
	});
	const startDestination: Accessor<Destination | undefined> = createMemo((): Destination | undefined => {
		return destinationById().get(settings().startLocationId);
	});
	const fitTitle = useAutoFitText({
		minFontSize: 18,
		maxFontSize: 36,
		widthOnly: true,
		watch: (): string => settings().title
	});
	const fitSelectedName = useAutoFitText({
		minFontSize: 18,
		maxFontSize: 34,
		watch: (): string => selectedDestination()?.name ?? ''
	});

	const removeRoute = (): void => {
		if (!svg) return;

		for (const route of Array.from(svg.querySelectorAll(`[id='${ROUTE_GROUP_ID}']`))) {
			route.remove();
		}

		for (const location of Array.from(svg.querySelectorAll('#Level0-Locations [data-wb-wayfinding-selected]'))) {
			location.removeAttribute('data-wb-wayfinding-selected');
			location.setAttribute('fill-opacity', '0.5');
			location.setAttribute('stroke', 'none');
			location.setAttribute('stroke-width', '0');
		}
	};

	const clearRoute = (): void => {
		if (routeResetTimer) clearTimeout(routeResetTimer);
		routeResetTimer = undefined;
		removeRoute();
		setRouteResult(undefined);
		setRouteState('idle');
		setSelectedId(undefined);
	};

	const drawRoute = (destination: Destination): void => {
		if (!svg || !routeGraph) return;

		if (routeResetTimer) clearTimeout(routeResetTimer);
		removeRoute();
		setSelectedId(destination.id);

		if (!destination.routeable) {
			setRouteResult(undefined);
			setRouteState('external');

			return;
		}

		const startPointId: string = `lp-${settings().startLocationId}`;
		const destinationPointId: string = `lp-${destination.id}`;

		if (startPointId === destinationPointId) {
			setRouteResult(undefined);
			setRouteState('active');

			return;
		}

		const result: RouteResult | undefined = routeGraph.route(startPointId, destinationPointId, settings().mapRatio);

		if (!result) {
			setRouteResult(undefined);
			setRouteState('unavailable');

			return;
		}

		const routePoints: RoutePoint[] = result.pointIds.flatMap((id: string): RoutePoint[] => {
			const point: RoutePoint | undefined = routeGraph?.point(id);

			return point ? [point] : [];
		});
		const level: Element | null = svg.querySelector('#Level0');

		if (!level || routePoints.length < 2) {
			setRouteState('unavailable');

			return;
		}

		const namespace = 'http://www.w3.org/2000/svg';
		const group: SVGGElement = document.createElementNS(namespace, 'g');
		const route: SVGPathElement = document.createElementNS(namespace, 'path');
		group.id = ROUTE_GROUP_ID;
		route.setAttribute('d', routePoints.map((point: RoutePoint, index: number): string => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' '));
		route.setAttribute('fill', 'none');
		route.setAttribute('stroke', settings().routeColor);
		route.setAttribute('stroke-linecap', 'round');
		route.setAttribute('stroke-linejoin', 'round');
		route.setAttribute('stroke-width', '7');
		route.setAttribute('vector-effect', 'non-scaling-stroke');
		group.append(route);

		for (const point of [routePoints[0], routePoints[routePoints.length - 1]]) {
			const marker: SVGCircleElement = document.createElementNS(namespace, 'circle');
			marker.setAttribute('cx', String(point.x));
			marker.setAttribute('cy', String(point.y));
			marker.setAttribute('fill', settings().panelColor);
			marker.setAttribute('r', '10');
			marker.setAttribute('stroke', settings().routeColor);
			marker.setAttribute('stroke-width', '6');
			marker.setAttribute('vector-effect', 'non-scaling-stroke');
			group.append(marker);
		}

		level.append(group);
		const routeLength: number = route.getTotalLength();
		route.style.strokeDasharray = String(routeLength);
		route.style.strokeDashoffset = String(routeLength);
		route.getBoundingClientRect();
		route.style.transition = 'stroke-dashoffset 900ms ease-out';
		route.style.strokeDashoffset = '0';

		const location: Element | null = svg.querySelector(`#Level0-Locations [id='${destination.id}']`);

		if (location) {
			location.setAttribute('data-wb-wayfinding-selected', 'true');
			location.setAttribute('fill-opacity', '0.82');
			location.setAttribute('stroke', settings().routeColor);
			location.setAttribute('stroke-width', '4');
		}

		setRouteResult(result);
		setRouteState('active');
		routeResetTimer = setTimeout(clearRoute, settings().routeResetSeconds * 1000);
	};

	const selectDestination = (destination: Destination): void => {
		drawRoute(destination);
	};

	const handleMapClick = (event: MouseEvent): void => {
		let element: Element | null = event.target instanceof Element ? event.target : null;

		while (element && element !== svg) {
			const destination: Destination | undefined = element.id ? destinationById().get(element.id) : undefined;

			if (destination) {
				selectDestination(destination);

				return;
			}
			element = element.parentElement;
		}
	};

	onMount((): void => {
		svg = mapHost.querySelector('svg') ?? undefined;

		if (!svg) return;

		svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
		svg.setAttribute('role', 'img');
		svg.setAttribute('aria-label', 'Interactive Veszprem downtown visitor map');
		mapHost.addEventListener('click', handleMapClick);
		routeGraph = new RouteGraph(extractRoutePoints(svg), settings().wayfindingSensitivity);
	});

	createEffect((): void => {
		const sensitivity: number = settings().wayfindingSensitivity;
		const mapRatio: number = settings().mapRatio;

		if (!svg) return;

		routeGraph = new RouteGraph(extractRoutePoints(svg), sensitivity);
		const selected: Destination | undefined = untrack(selectedDestination);

		if (selected && mapRatio > 0) untrack((): void => drawRoute(selected));
	});

	createEffect((): void => {
		const selected: Destination | undefined = selectedDestination();

		if (selectedId() && !selected) clearRoute();
	});

	createEffect((): void => {
		const color: string = settings().routeColor;

		if (!svg) return;

		for (const element of Array.from(svg.querySelectorAll(`#${ROUTE_GROUP_ID} path, #${ROUTE_GROUP_ID} circle`))) {
			element.setAttribute('stroke', color);
		}
	});

	onCleanup((): void => {
		if (routeResetTimer) clearTimeout(routeResetTimer);
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
			data-map-ratio={settings().mapRatio}
			data-preview-id="veszprem-wayfinding-root"
			data-route-reset={settings().routeResetSeconds}
			data-route-sensitivity={settings().wayfindingSensitivity}
		>
			<header class={style['header']}>
				<div class={style['identity']} aria-hidden="true"><strong>V</strong><span>VESZPRÉM</span></div>
				<div class={style['heading']}>
					<p class="wb-veszprem-wayfinding-metadata">DOWNTOWN VISITOR MAP / BELVÁROS</p>
					<h1 ref={fitTitle} class="wb-veszprem-wayfinding-title">{settings().title}</h1>
				</div>
				<div class={style['locator']}>
					<span class="wb-veszprem-wayfinding-metadata">YOU ARE HERE</span>
					<strong class="wb-veszprem-wayfinding-secondary">{startDestination()?.name || settings().startLocationId}</strong>
				</div>
			</header>

			<main class={style['content']}>
				<section class={style['map-panel']} aria-label="Map">
					<div ref={mapHost} class={style['map-canvas']}>
						<div class={style['map-markup']} innerHTML={veszpremMapMarkup} />
					</div>
					<div class={style['map-instruction']}>
						<span>Tap a numbered landmark on the map</span>
						<i aria-hidden="true" />
						<span>Route clears after {settings().routeResetSeconds}s</span>
					</div>
				</section>

				<aside class={style['directory']}>
					<div class={style['directory-intro']}>
						<p class="wb-veszprem-wayfinding-metadata">FIND A LANDMARK</p>
						<h2 class="wb-veszprem-wayfinding-secondary">Where would you like to go?</h2>
						<span>{settings().subtitle}</span>
					</div>
					<div class={style['filters']}>
						<input
							aria-label="Search destinations"
							placeholder="Search destinations"
							type="search"
							value={query()}
							onInput={(event): void => { setQuery(event.currentTarget.value); }}
						/>
						<select aria-label="Destination category" value={category()} onChange={(event): void => { setCategory(event.currentTarget.value); }}>
							<For each={categories()}>{(name: string): JSX.Element => <option value={name}>{name}</option>}</For>
						</select>
					</div>

					<Show when={selectedDestination()} keyed fallback={
						<div class={style['destination-list']} data-destination-count={filteredDestinations().length} data-preview-allow-overflow>
							<Show when={filteredDestinations().length > 0} fallback={<div class={style['empty-state']}>{settings().emptyStateText}</div>}>
								<For each={filteredDestinations()}>{(destination: Destination, index): JSX.Element => (
									<button type="button" onClick={(): void => selectDestination(destination)} data-routeable={destination.routeable}>
										<small>{String(index() + 1).padStart(2, '0')}</small>
										<span>
											<strong class="wb-veszprem-wayfinding-destination-name">{destination.name}</strong>
											<em>{destination.englishName || destination.category}</em>
										</span>
										<i aria-hidden="true">-&gt;</i>
									</button>
								)}</For>
							</Show>
						</div>
					}>
						{(destination: Destination): JSX.Element => (
							<section class={style['route-card']} data-route-state={routeState()}>
								<button class={style['back-button']} type="button" onClick={clearRoute}>&lt;- All destinations</button>
								<p class="wb-veszprem-wayfinding-metadata">{destination.category}</p>
								<h2 ref={fitSelectedName} class="wb-veszprem-wayfinding-selected-name">{destination.name}</h2>
								<Show when={destination.englishName}><h3>{destination.englishName}</h3></Show>
								<p class={style['description']}>{destination.description}</p>
								<Show when={destination.accessible}><span class={style['accessibility']}>STEP-FREE DESTINATION</span></Show>
								<div class={style['route-summary']}>
									<Show when={routeState() === 'active' && routeResult()} keyed fallback={
										<strong>{routeState() === 'external'
											? 'Outside the downtown walking map'
											: routeState() === 'unavailable'
												? 'No connected walking route in this map'
												: 'You are already at this destination'}</strong>
									}>
										{(result: RouteResult): JSX.Element => (
											<>
												<div><span>APPROX. DISTANCE</span><strong>{result.walkingDistance} m</strong></div>
												<div><span>WALKING TIME</span><strong>{formatWalkTime(result.walkingSeconds)}</strong></div>
											</>
										)}
									</Show>
								</div>
								<button class={style['clear-button']} type="button" onClick={clearRoute}>Clear route</button>
							</section>
						)}
					</Show>
				</aside>
			</main>
		</div>
	);
};
