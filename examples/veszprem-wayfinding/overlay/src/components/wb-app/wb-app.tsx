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

interface ActivePointer {
	current: MapPoint;
	locationId?: string;
	moved: boolean;
	origin: MapPoint;
}

type UiLanguage = 'en' | 'hu';

interface UiCopy {
	accessibilityConfirmation: string;
	accessibilityNo: string;
	accessibilityUnknown: string;
	accessibilityYes: string;
	alreadyHere: string;
	allDestinations: string;
	approximateDistance: string;
	back: string;
	clear: string;
	clearRoute: string;
	close: string;
	categoryLabel: string;
	delete: string;
	destinationPrompt: string;
	distanceUnavailable: string;
	externalMap: string;
	findLandmark: string;
	fitMap: string;
	fitRoute: string;
	hours: string;
	keyboardLabel: string;
	languageSelector: string;
	loadingMap: string;
	map: string;
	mapControls: string;
	mapInstruction: string;
	mapUnavailable: string;
	openKeyboard: string;
	reset: string;
	routeApproximate: string;
	searchPlaceholder: string;
	shift: string;
	showResults: string;
	space: string;
	status: string;
	youAreHere: string;
	walkingTime: string;
	zoomIn: string;
	zoomOut: string;
}

const UI_COPY: Record<UiLanguage, UiCopy> = {
	en: {
		accessibilityConfirmation: 'Accessibility requires venue confirmation',
		accessibilityNo: 'STEP-FREE ACCESS NOT CONFIRMED',
		accessibilityUnknown: 'ACCESSIBILITY NOT VERIFIED',
		accessibilityYes: 'STEP-FREE DESTINATION',
		alreadyHere: 'You are already at this destination',
		allDestinations: 'All destinations',
		approximateDistance: 'APPROX. DISTANCE',
		back: 'Back to directory',
		clear: 'Clear',
		clearRoute: 'Clear route',
		close: 'Close',
		categoryLabel: 'Destination category',
		delete: 'Delete',
		destinationPrompt: 'Where would you like to go?',
		distanceUnavailable: 'No route is available from the configured start',
		externalMap: 'Listed outside the downtown route map',
		findLandmark: 'FIND A LANDMARK',
		fitMap: 'Fit map',
		fitRoute: 'Fit route',
		hours: 'Hours',
		keyboardLabel: 'Search destinations',
		languageSelector: 'Interface language',
		loadingMap: 'Loading map...',
		map: 'Map',
		mapControls: 'Map zoom controls',
		mapInstruction: 'Tap a highlighted landmark',
		mapUnavailable: 'Map artwork unavailable',
		openKeyboard: 'Open touch keyboard',
		reset: 'Reset',
		routeApproximate: 'Routes are approximate',
		searchPlaceholder: 'Search destinations',
		shift: 'Shift',
		showResults: 'Show results',
		space: 'Space',
		status: 'Status',
		youAreHere: 'YOU ARE HERE',
		walkingTime: 'WALKING TIME',
		zoomIn: 'Zoom in',
		zoomOut: 'Zoom out'
	},
	hu: {
		accessibilityConfirmation: 'Az akadálymentesség helyszíni megerősítést igényel',
		accessibilityNo: 'AKADÁLYMENTES ÚTVONAL NINCS MEGERŐSÍTVE',
		accessibilityUnknown: 'AKADÁLYMENTESSÉG NINCS ELLENŐRIZVE',
		accessibilityYes: 'AKADÁLYMENTES CÉLPONT',
		alreadyHere: 'Már ennél a helyszínnél áll',
		allDestinations: 'Minden helyszín',
		approximateDistance: 'BECSÜLT TÁVOLSÁG',
		back: 'Vissza a listához',
		clear: 'Törlés',
		clearRoute: 'Útvonal törlése',
		close: 'Bezárás',
		categoryLabel: 'Helyszínkategória',
		delete: 'Visszatörlés',
		destinationPrompt: 'Hová szeretne menni?',
		distanceUnavailable: 'A beállított kiindulóponttól nincs elérhető útvonal',
		externalMap: 'A helyszín a belvárosi útvonaltérképen kívül található',
		findLandmark: 'HELYSZÍN KERESÉSE',
		fitMap: 'Térkép illesztése',
		fitRoute: 'Útvonal illesztése',
		hours: 'Nyitvatartás',
		keyboardLabel: 'Helyszín keresése',
		languageSelector: 'Felület nyelve',
		loadingMap: 'Térkép betöltése...',
		map: 'Térkép',
		mapControls: 'Térkép nagyítása',
		mapInstruction: 'Érintsen meg egy kiemelt helyszínt',
		mapUnavailable: 'A térkép nem érhető el',
		openKeyboard: 'Érintőbillentyűzet megnyitása',
		reset: 'Alaphelyzet',
		routeApproximate: 'Az útvonal tájékoztató jellegű',
		searchPlaceholder: 'Helyszín keresése',
		shift: 'Nagybetű',
		showResults: 'Találatok',
		space: 'Szóköz',
		status: 'Állapot',
		youAreHere: 'ÖN ITT ÁLL',
		walkingTime: 'SÉTAIDŐ',
		zoomIn: 'Nagyítás',
		zoomOut: 'Kicsinyítés'
	}
};

const MAP_WIDTH = 1341;
const MAP_HEIGHT = 947;
const ALL_CATEGORIES = '__all__';
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
	const [category, setCategory] = createSignal(ALL_CATEGORIES);
	const [keyboardOpen, setKeyboardOpen] = createSignal(false);
	const [mapCenter, setMapCenter] = createSignal<MapPoint>({ x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 });
	const [mapState, setMapState] = createSignal<MapState>('loading');
	const [mapZoom, setMapZoom] = createSignal(1);
	const [query, setQuery] = createSignal('');
	const [routeResult, setRouteResult] = createSignal<WayfindingRouteResult>();
	const [routeState, setRouteState] = createSignal<RouteState>('idle');
	const [selectedId, setSelectedId] = createSignal<string>();
	const [uiLanguage, setUiLanguage] = createSignal<UiLanguage>('en');
	const activePointers = new Map<number, ActivePointer>();
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
	const copy: Accessor<UiCopy> = createMemo((): UiCopy => UI_COPY[uiLanguage()]);
	const showLanguageSelector: Accessor<boolean> = createMemo((): boolean => settings().interfaceLanguages === 'en-hu');
	const destinationName = (destination: Destination): string => {
		return uiLanguage() === 'en' ? destination.englishName || destination.name : destination.name;
	};
	const destinationSecondaryName = (destination: Destination): string => {
		const secondary: string = uiLanguage() === 'en' ? destination.name : destination.englishName;

		return secondary && secondary !== destinationName(destination) ? secondary : destination.category;
	};

	createEffect((): void => {
		if (!settings().onScreenKeyboard) setKeyboardOpen(false);
	});

	createEffect((): void => {
		const configuredLanguages = settings().interfaceLanguages;

		if (configuredLanguages === 'en' || configuredLanguages === 'hu') setUiLanguage(configuredLanguages);
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
		return Array.from(new Set(destinations().map((destination: Destination): string => destination.category)));
	});
	const filteredDestinations: Accessor<Destination[]> = createMemo((): Destination[] => {
		const normalizedQuery: string = normalizeSearch(query().trim());

		return destinations().filter((destination: Destination): boolean => {
			const categoryMatches: boolean = category() === ALL_CATEGORIES || destination.category === category();
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
		watch: (): string => selectedDestination() ? destinationName(selectedDestination()!) : ''
	});

	const resetMapView = (): void => {
		setMapCenter({ x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 });
		setMapZoom(1);
	};

	const fitRouteView = (path = routeResult()?.path): void => {
		if (!path || path.length < 2) return;

		const xValues = path.map((point: WayfindingRoutePoint): number => point.x);
		const yValues = path.map((point: WayfindingRoutePoint): number => point.y);
		const padding = 70;
		const width = Math.max(1, Math.max(...xValues) - Math.min(...xValues) + padding * 2);
		const height = Math.max(1, Math.max(...yValues) - Math.min(...yValues) + padding * 2);
		setMapCenter({
			x: (Math.min(...xValues) + Math.max(...xValues)) / 2,
			y: (Math.min(...yValues) + Math.max(...yValues)) / 2
		});
		setMapZoom(clamp(Math.min(MAP_WIDTH / width, MAP_HEIGHT / height), 1, 2.5));
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
		setCategory(ALL_CATEGORIES);
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
			const underlay: SVGPathElement = document.createElementNS(namespace, 'path');
			const route: SVGPathElement = document.createElementNS(namespace, 'path');
			const pathData: string = path.map((point: WayfindingRoutePoint, index: number): string => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
			group.id = ROUTE_GROUP_ID;
			group.setAttribute('pointer-events', 'none');
			underlay.setAttribute('d', pathData);
			underlay.setAttribute('data-route-layer', 'underlay');
			underlay.setAttribute('fill', 'none');
			underlay.setAttribute('stroke', settings().panelColor);
			underlay.setAttribute('stroke-linecap', 'round');
			underlay.setAttribute('stroke-linejoin', 'round');
			underlay.setAttribute('stroke-width', '11');
			underlay.setAttribute('vector-effect', 'non-scaling-stroke');
			route.setAttribute('d', pathData);
			route.setAttribute('data-route-layer', 'foreground');
			route.setAttribute('fill', 'none');
			route.setAttribute('stroke', settings().routeColor);
			route.setAttribute('stroke-linecap', 'round');
			route.setAttribute('stroke-linejoin', 'round');
			route.setAttribute('stroke-width', '6');
			route.setAttribute('vector-effect', 'non-scaling-stroke');
			group.append(underlay, route);

			const destinationPoint: WayfindingRoutePoint = path[path.length - 1];
			const marker: SVGCircleElement = document.createElementNS(namespace, 'circle');
			marker.setAttribute('cx', String(destinationPoint.x));
			marker.setAttribute('cy', String(destinationPoint.y));
			marker.setAttribute('data-route-layer', 'destination');
			marker.setAttribute('fill', settings().routeColor);
			marker.setAttribute('r', '5');
			marker.setAttribute('stroke', settings().panelColor);
			marker.setAttribute('stroke-width', '3');
			marker.setAttribute('vector-effect', 'non-scaling-stroke');
			group.append(marker);

			const hitTargets: Element | null = svg.querySelector('#location-hit-targets');

			if (hitTargets?.parentNode) {
				hitTargets.parentNode.insertBefore(group, hitTargets);
			} else {
				svg.append(group);
			}

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

	const panMap = (deltaX: number, deltaY: number): void => {
		if (!svg) return;

		const bounds: DOMRect = svg.getBoundingClientRect();

		if (bounds.width <= 0 || bounds.height <= 0) return;

		const visibleWidth: number = MAP_WIDTH / mapZoom();
		const visibleHeight: number = MAP_HEIGHT / mapZoom();
		setMapCenter((center: MapPoint): MapPoint => ({
			x: center.x - deltaX * visibleWidth / bounds.width,
			y: center.y - deltaY * visibleHeight / bounds.height
		}));
	};

	const pointerPosition = (event: PointerEvent): MapPoint => ({ x: event.clientX, y: event.clientY });

	const handleMapPointerDown = (event: PointerEvent): void => {
		const target: Element | null = event.target instanceof Element ? event.target : null;

		if (target?.closest(`.${style['map-controls']}`)) return;

		const origin: MapPoint = pointerPosition(event);
		const locationTarget: Element | null = target?.closest('[data-wayfinding-location-id]') ?? null;
		activePointers.set(event.pointerId, {
			current: origin,
			locationId: locationTarget?.getAttribute('data-wayfinding-location-id') ?? undefined,
			moved: false,
			origin
		});

		if (activePointers.size > 1) {
			for (const pointer of activePointers.values()) pointer.moved = true;
		}

		mapHost.setPointerCapture?.(event.pointerId);
		scheduleReset();
	};

	const handleMapPointerMove = (event: PointerEvent): void => {
		const pointer: ActivePointer | undefined = activePointers.get(event.pointerId);

		if (!pointer) return;

		const previousPointers = new Map(Array.from(activePointers, ([pointerId, state]): [number, ActivePointer] => [pointerId, { ...state }]));
		const previousPosition: MapPoint = pointer.current;
		const nextPosition: MapPoint = pointerPosition(event);
		pointer.current = nextPosition;
		pointer.moved = pointer.moved || Math.hypot(nextPosition.x - pointer.origin.x, nextPosition.y - pointer.origin.y) > 6;

		if (activePointers.size === 1) {
			if (pointer.moved) panMap(nextPosition.x - previousPosition.x, nextPosition.y - previousPosition.y);

			return;
		}

		for (const activePointer of activePointers.values()) activePointer.moved = true;

		const pointerIds: number[] = Array.from(activePointers.keys()).slice(0, 2);
		const oldFirst: MapPoint | undefined = previousPointers.get(pointerIds[0])?.current;
		const oldSecond: MapPoint | undefined = previousPointers.get(pointerIds[1])?.current;
		const nextFirst: MapPoint | undefined = activePointers.get(pointerIds[0])?.current;
		const nextSecond: MapPoint | undefined = activePointers.get(pointerIds[1])?.current;

		if (!oldFirst || !oldSecond || !nextFirst || !nextSecond) return;

		const oldDistance: number = Math.hypot(oldSecond.x - oldFirst.x, oldSecond.y - oldFirst.y);
		const nextDistance: number = Math.hypot(nextSecond.x - nextFirst.x, nextSecond.y - nextFirst.y);
		const oldMidpoint: MapPoint = { x: (oldFirst.x + oldSecond.x) / 2, y: (oldFirst.y + oldSecond.y) / 2 };
		const nextMidpoint: MapPoint = { x: (nextFirst.x + nextSecond.x) / 2, y: (nextFirst.y + nextSecond.y) / 2 };

		if (oldDistance > 0 && nextDistance > 0) {
			setMapZoom((zoom: number): number => clamp(zoom * nextDistance / oldDistance, 1, 3.5));
		}

		panMap(nextMidpoint.x - oldMidpoint.x, nextMidpoint.y - oldMidpoint.y);
	};

	const handleMapPointerEnd = (event: PointerEvent): void => {
		const pointer: ActivePointer | undefined = activePointers.get(event.pointerId);
		const isTap: boolean = event.type === 'pointerup' && activePointers.size === 1 && Boolean(pointer && !pointer.moved);
		activePointers.delete(event.pointerId);

		if (mapHost.hasPointerCapture?.(event.pointerId)) mapHost.releasePointerCapture(event.pointerId);

		if (isTap && pointer?.locationId) {
			const destination: Destination | undefined = destinationById().get(pointer.locationId);

			if (destination) drawRoute(destination);
		}
	};

	const handleMapWheel = (event: WheelEvent): void => {
		event.preventDefault();
		setMapZoom((zoom: number): number => clamp(zoom + (event.deltaY < 0 ? 0.2 : -0.2), 1, 3.5));
		scheduleReset();
	};

	const changeQuery = (value: string): void => {
		setQuery(value);
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
		mapHost.addEventListener('pointerdown', handleMapPointerDown);
		mapHost.addEventListener('pointermove', handleMapPointerMove);
		mapHost.addEventListener('pointerup', handleMapPointerEnd);
		mapHost.addEventListener('pointercancel', handleMapPointerEnd);
		mapHost.addEventListener('wheel', handleMapWheel, { passive: false });
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
		const panelColor: string = settings().panelColor;

		if (!svg) return;

		for (const element of Array.from(svg.querySelectorAll(`#${ROUTE_GROUP_ID} [data-route-layer='foreground']`))) {
			element.setAttribute('stroke', color);
		}

		for (const element of Array.from(svg.querySelectorAll(`#${ROUTE_GROUP_ID} [data-route-layer='destination']`))) {
			element.setAttribute('fill', color);
			element.setAttribute('stroke', panelColor);
		}

		for (const element of Array.from(svg.querySelectorAll(`#${ROUTE_GROUP_ID} [data-route-layer='underlay']`))) {
			element.setAttribute('stroke', panelColor);
		}
	});

	onCleanup((): void => {
		clearResetTimer();
		mapHost?.removeEventListener('pointerdown', handleMapPointerDown);
		mapHost?.removeEventListener('pointermove', handleMapPointerMove);
		mapHost?.removeEventListener('pointerup', handleMapPointerEnd);
		mapHost?.removeEventListener('pointercancel', handleMapPointerEnd);
		mapHost?.removeEventListener('wheel', handleMapWheel);
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
					<span class="wb-veszprem-metadata">{copy().youAreHere}</span>
					<strong class="wb-veszprem-secondary">{startDestination() ? destinationName(startDestination()!) : settings().startLocationId}</strong>
				</div>
				<Show when={showLanguageSelector()}>
					<div class={style['language-selector']} aria-label={copy().languageSelector}>
						<button type="button" aria-pressed={uiLanguage() === 'en'} onClick={(): void => { setUiLanguage('en'); scheduleReset(); }}>EN</button>
						<button type="button" aria-pressed={uiLanguage() === 'hu'} onClick={(): void => { setUiLanguage('hu'); scheduleReset(); }}>HU</button>
					</div>
				</Show>
				<button class={style['reset-button']} type="button" onClick={resetSession}>{copy().reset}</button>
			</header>

			<main class={style['content']}>
				<section class={style['map-panel']} aria-label={copy().map}>
					<div ref={mapHost} class={style['map-canvas']}>
						<div class={style['map-markup']} innerHTML={mapMarkup} />
						<Show when={mapState() !== 'ready'}>
							<div class={style['map-status']}>{mapState() === 'error' ? copy().mapUnavailable : copy().loadingMap}</div>
						</Show>
						<div class={style['map-controls']} aria-label={copy().mapControls}>
							<button type="button" title={copy().zoomIn} aria-label={copy().zoomIn} onClick={(): void => { setMapZoom((value: number): number => clamp(value + 0.25, 1, 2.5)); scheduleReset(); }}>+</button>
							<button type="button" title={copy().zoomOut} aria-label={copy().zoomOut} onClick={(): void => { setMapZoom((value: number): number => clamp(value - 0.25, 1, 2.5)); scheduleReset(); }}>−</button>
							<Show when={routeState() === 'active'}>
								<button type="button" title={copy().fitRoute} aria-label={copy().fitRoute} onClick={(): void => { fitRouteView(); scheduleReset(); }}>⌖</button>
							</Show>
							<button type="button" title={copy().fitMap} aria-label={copy().fitMap} onClick={(): void => { resetMapView(); scheduleReset(); }}>⛶</button>
						</div>
					</div>
					<div class={style['map-instruction']}>
						<span>{copy().mapInstruction}</span>
						<i aria-hidden="true" />
						<span>{copy().routeApproximate}</span>
						<i aria-hidden="true" />
						<span>{copy().accessibilityConfirmation}</span>
					</div>
				</section>

				<aside class={style['directory']}>
					<Show when={selectedDestination()} keyed fallback={
						<>
							<div class={style['directory-intro']}>
								<p class="wb-veszprem-metadata">{copy().findLandmark}</p>
								<h2 class="wb-veszprem-secondary">{copy().destinationPrompt}</h2>
								<span>{settings().subtitle}</span>
							</div>
							<div class={style['filters']}>
								<div class={style['search-field']}>
									<input
										aria-label={copy().keyboardLabel}
										inputMode={settings().onScreenKeyboard ? 'none' : 'search'}
										placeholder={copy().searchPlaceholder}
										type="search"
										value={query()}
										onFocus={(): void => { if (settings().onScreenKeyboard) setKeyboardOpen(true); scheduleReset(); }}
										onInput={(event): void => { changeQuery(event.currentTarget.value); }}
									/>
									<Show when={settings().onScreenKeyboard}><button type="button" aria-label={copy().openKeyboard} title={copy().openKeyboard} onClick={(): void => { setKeyboardOpen(true); scheduleReset(); }}>ABC</button></Show>
								</div>
								<select aria-label={copy().categoryLabel} value={category()} onChange={(event): void => { setCategory(event.currentTarget.value); scheduleReset(); }}>
									<option value={ALL_CATEGORIES}>{copy().allDestinations}</option>
									<For each={categories()}>{(name: string): JSX.Element => <option value={name}>{name}</option>}</For>
								</select>
							</div>

							<div class={style['destination-list']} data-destination-count={filteredDestinations().length} data-preview-allow-overflow>
								<Show when={filteredDestinations().length > 0} fallback={<div class={style['empty-state']}>{settings().emptyStateText}</div>}>
									<For each={filteredDestinations()}>{(destination: Destination): JSX.Element => (
										<button type="button" data-routeable={destination.routeable} onClick={(): void => { drawRoute(destination); }}>
											<small data-wide={destination.mapNumber.length > 2}>{destination.mapNumber || '•'}</small>
											<span>
												<strong class="wb-veszprem-destination-name">{destinationName(destination)}</strong>
												<em>{destinationSecondaryName(destination)}</em>
											</span>
											<i aria-hidden="true">›</i>
										</button>
									)}</For>
								</Show>
							</div>

						</>
					}>
						{(destination: Destination): JSX.Element => (
							<section class={style['route-card']}>
								<button class={style['back-button']} type="button" onClick={resetSession}>‹ {copy().back}</button>
								<div class={style['detail-number']}>{destination.mapNumber || 'INFO'}</div>
								<p class="wb-veszprem-metadata">{destination.category}</p>
								<h2 ref={fitSelectedName} class="wb-veszprem-selected-name">{destinationName(destination)}</h2>
								<Show when={destinationSecondaryName(destination)}><h3>{destinationSecondaryName(destination)}</h3></Show>
								<Show when={destination.description}><p class={style['description']}>{destination.description}</p></Show>
								<Show when={destination.hours}><p class={style['fact']}><span>{copy().hours}</span>{destination.hours}</p></Show>
								<Show when={destination.status}><p class={style['fact']}><span>{copy().status}</span>{destination.status}</p></Show>
								<span class={style['accessibility']} data-accessibility={destination.accessible === null ? 'unknown' : destination.accessible ? 'yes' : 'no'}>
									{destination.accessible === null ? copy().accessibilityUnknown : destination.accessible ? copy().accessibilityYes : copy().accessibilityNo}
								</span>
								<div class={style['route-summary']}>
									<Show when={routeState() === 'active' && routeResult()} keyed fallback={
										<strong>{routeState() === 'external'
										? copy().externalMap
											: routeState() === 'unavailable'
																? copy().distanceUnavailable
												: copy().alreadyHere}</strong>
									}>
										{(result: WayfindingRouteResult): JSX.Element => (
											<>
													<div><span>{copy().approximateDistance}</span><strong>{result.walkingDistance} m</strong></div>
													<div><span>{copy().walkingTime}</span><strong>{formatWalkTime(result.walkingSeconds)}</strong></div>
											</>
										)}
									</Show>
								</div>
								<button class={style['clear-button']} type="button" onClick={resetSession}>{copy().clearRoute}</button>
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
					label={copy().keyboardLabel}
					labels={{ clear: copy().clear, close: copy().close, delete: copy().delete, shift: copy().shift, space: copy().space }}
					layouts={keyboardLayouts()}
					maximumLength={80}
					onClose={(): void => { setKeyboardOpen(false); }}
					onInput={changeQuery}
					onSubmit={(): void => { setKeyboardOpen(false); }}
					submitLabel={copy().showResults}
					textColor={settings().primaryTextColor}
					value={query()}
				/>
			</Show>
		</div>
	);
};
