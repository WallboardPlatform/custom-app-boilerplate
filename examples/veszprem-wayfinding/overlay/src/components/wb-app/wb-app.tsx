import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show, untrack } from 'solid-js';
import type { Accessor, JSX } from 'solid-js';

import { useAutoFitText } from '@hooks/system/useAutoFitText';
import { useDataSources } from '@hooks/system/useDataSources';
import { useSettings } from '@hooks/system/useSettings';

import type { DataSources, Settings } from '@interfaces/application.interface';
import type { Destination } from '@interfaces/wayfinding.interface';
import { directionBetweenPoints, resolveWayfindingGuidanceMode } from '@utils/wayfinding-guidance';
import type { WayfindingDirection, WayfindingGuidanceMode } from '@utils/wayfinding-guidance';
import { normalizeDestinations } from '@utils/destinations';

import style from '@components/wb-app/wb-app.module.scss';
import { keyboardLayoutsFor, OnScreenKeyboard } from '../../capabilities/keyboard';
import type { KeyboardLayoutId } from '../../capabilities/keyboard';
import mapMarkup from '../../assets/map.svg?raw';
import mapArtwork from '../../assets/veszprem-map.webp';
import sampleDestinationData from '../../../sample-destinations-datasource.json';

type MapState = 'loading' | 'ready' | 'error';
type GuidanceState = 'idle' | 'directory' | 'highlight' | 'directional' | 'external';

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
	allDestinations: string;
	back: string;
	clear: string;
	clearSelection: string;
	close: string;
	categoryLabel: string;
	delete: string;
	destinationPrompt: string;
	direction: string;
	directionalDisclaimer: string;
	externalMap: string;
	findLandmark: string;
	fitMap: string;
	hours: string;
	keyboardLabel: string;
	languageSelector: string;
	loadingMap: string;
	map: string;
	mapControls: string;
	mapInstruction: string;
	mapUnavailable: string;
	highlightedOnMap: string;
	openKeyboard: string;
	reset: string;
	guidanceHonesty: string;
	searchPlaceholder: string;
	shift: string;
	showResults: string;
	space: string;
	status: string;
	youAreHere: string;
	zoomIn: string;
	zoomOut: string;
}

const UI_COPY: Record<UiLanguage, UiCopy> = {
	en: {
		accessibilityConfirmation: 'Accessibility requires venue confirmation',
		accessibilityNo: 'STEP-FREE ACCESS NOT CONFIRMED',
		accessibilityUnknown: 'ACCESSIBILITY NOT VERIFIED',
		accessibilityYes: 'STEP-FREE DESTINATION',
		allDestinations: 'All destinations',
		back: 'Back to directory',
		clear: 'Clear',
		clearSelection: 'Clear selection',
		close: 'Close',
		categoryLabel: 'Destination category',
		delete: 'Delete',
		destinationPrompt: 'Where would you like to go?',
		direction: 'DIRECTION FROM HERE',
		directionalDisclaimer: 'Visual direction only - not a walking path',
		externalMap: 'Not shown on this map',
		findLandmark: 'FIND A LANDMARK',
		fitMap: 'Fit map',
		hours: 'Hours',
		keyboardLabel: 'Search destinations',
		languageSelector: 'Interface language',
		loadingMap: 'Loading map...',
		map: 'Map',
		mapControls: 'Map zoom controls',
		mapInstruction: 'Tap a highlighted landmark',
		mapUnavailable: 'Map artwork unavailable',
		highlightedOnMap: 'Highlighted on the map',
		openKeyboard: 'Open touch keyboard',
		reset: 'Reset',
		guidanceHonesty: 'Guidance matches the available reviewed evidence',
		searchPlaceholder: 'Search destinations',
		shift: 'Shift',
		showResults: 'Show results',
		space: 'Space',
		status: 'Status',
		youAreHere: 'YOU ARE HERE',
		zoomIn: 'Zoom in',
		zoomOut: 'Zoom out'
	},
	hu: {
		accessibilityConfirmation: 'Az akadálymentesség helyszíni megerősítést igényel',
		accessibilityNo: 'AKADÁLYMENTES ÚTVONAL NINCS MEGERŐSÍTVE',
		accessibilityUnknown: 'AKADÁLYMENTESSÉG NINCS ELLENŐRIZVE',
		accessibilityYes: 'AKADÁLYMENTES CÉLPONT',
		allDestinations: 'Minden helyszín',
		back: 'Vissza a listához',
		clear: 'Törlés',
		clearSelection: 'Kijelölés törlése',
		close: 'Bezárás',
		categoryLabel: 'Helyszínkategória',
		delete: 'Visszatörlés',
		destinationPrompt: 'Hová szeretne menni?',
		direction: 'IRÁNY INNEN',
		directionalDisclaimer: 'Vizuális irány, nem gyalogos útvonal',
		externalMap: 'A helyszín nem látható ezen a térképen',
		findLandmark: 'HELYSZÍN KERESÉSE',
		fitMap: 'Térkép illesztése',
		hours: 'Nyitvatartás',
		keyboardLabel: 'Helyszín keresése',
		languageSelector: 'Felület nyelve',
		loadingMap: 'Térkép betöltése...',
		map: 'Térkép',
		mapControls: 'Térkép nagyítása',
		mapInstruction: 'Érintsen meg egy kiemelt helyszínt',
		mapUnavailable: 'A térkép nem érhető el',
		highlightedOnMap: 'Kiemelve a térképen',
		openKeyboard: 'Érintőbillentyűzet megnyitása',
		reset: 'Alaphelyzet',
		guidanceHonesty: 'Az útmutatás az ellenőrzött adatokhoz igazodik',
		searchPlaceholder: 'Helyszín keresése',
		shift: 'Nagybetű',
		showResults: 'Találatok',
		space: 'Szóköz',
		status: 'Állapot',
		youAreHere: 'ÖN ITT ÁLL',
		zoomIn: 'Nagyítás',
		zoomOut: 'Kicsinyítés'
	}
};

const MAP_WIDTH = 1341;
const MAP_HEIGHT = 947;
const ALL_CATEGORIES = '__all__';
const GUIDANCE_GROUP_ID = 'wb-veszprem-wayfinding-guidance';
const CARDINAL_COPY: Record<UiLanguage, Record<WayfindingDirection['cardinal'], string>> = {
	en: { E: 'EAST', N: 'NORTH', NE: 'NORTHEAST', NW: 'NORTHWEST', S: 'SOUTH', SE: 'SOUTHEAST', SW: 'SOUTHWEST', W: 'WEST' },
	hu: { E: 'KELET', N: 'ÉSZAK', NE: 'ÉSZAKKELET', NW: 'ÉSZAKNYUGAT', S: 'DÉL', SE: 'DÉLKELET', SW: 'DÉLNYUGAT', W: 'NYUGAT' }
};

const normalizeSearch = (value: string): string => value
	.normalize('NFD')
	.replace(/[\u0300-\u036f]/g, '')
	.toLocaleLowerCase();

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
	const [guidanceState, setGuidanceState] = createSignal<GuidanceState>('idle');
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
	const locationCenter = (locationId: string): MapPoint | undefined => {
		const target: SVGGraphicsElement | undefined = Array.from(svg?.querySelectorAll<SVGGraphicsElement>('[data-wayfinding-location-id]') ?? [])
			.find((element: SVGGraphicsElement): boolean => element.getAttribute('data-wayfinding-location-id') === locationId);

		if (!target) return undefined;

		const bounds: DOMRect = target.getBBox();

		return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
	};
	const activeGuidanceMode: Accessor<WayfindingGuidanceMode> = createMemo((): WayfindingGuidanceMode => {
		const mapReady: boolean = mapState() === 'ready';

		return resolveWayfindingGuidanceMode(settings().guidanceMode, {
			directory: true,
			directional: settings().orientationConfirmed && mapReady && Boolean(locationCenter(settings().startLocationId)),
			highlight: true,
			route: false
		}) ?? 'directory';
	});
	const directionCue: Accessor<WayfindingDirection | undefined> = createMemo((): WayfindingDirection | undefined => {
		const start: MapPoint | undefined = locationCenter(settings().startLocationId);
		const destination: MapPoint | undefined = selectedDestination() ? locationCenter(selectedDestination()!.id) : undefined;

		return start && destination
			? directionBetweenPoints(start, destination, settings().mapNorthOffsetDegrees)
			: undefined;
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

	const removeGuidanceMarkup = (): void => {
		if (!svg) return;

		for (const markup of Array.from(svg.querySelectorAll(`[id='${GUIDANCE_GROUP_ID}']`))) markup.remove();

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
		setCategory(ALL_CATEGORIES);
		setKeyboardOpen(false);
		setQuery('');
		setGuidanceState('idle');
		setSelectedId(undefined);
		resetMapView();
	};

	const scheduleReset = (): void => {
		clearResetTimer();
		resetTimer = setTimeout(resetSession, settings().routeResetSeconds * 1000);
	};

	const appendPulse = (
		parent: SVGElement,
		point: MapPoint,
		color: string,
		layer: string,
		baseRadius: number,
		pulseRadius: number
	): void => {
		const namespace = 'http://www.w3.org/2000/svg';
		const ring: SVGCircleElement = document.createElementNS(namespace, 'circle');

		ring.setAttribute('cx', String(point.x));
		ring.setAttribute('cy', String(point.y));
		ring.setAttribute('data-guidance-layer', layer);
		ring.setAttribute('fill', 'none');
		ring.setAttribute('opacity', '0.72');
		ring.setAttribute('r', String(baseRadius));
		ring.setAttribute('stroke', color);
		ring.setAttribute('stroke-width', '5');
		ring.setAttribute('vector-effect', 'non-scaling-stroke');

		if (settings().motionPreset !== 'off') {
			const radiusAnimation: SVGElement = document.createElementNS(namespace, 'animate');
			const opacityAnimation: SVGElement = document.createElementNS(namespace, 'animate');

			radiusAnimation.setAttribute('attributeName', 'r');
			radiusAnimation.setAttribute('dur', '1.8s');
			radiusAnimation.setAttribute('repeatCount', 'indefinite');
			radiusAnimation.setAttribute('values', `${baseRadius};${pulseRadius};${baseRadius}`);
			opacityAnimation.setAttribute('attributeName', 'opacity');
			opacityAnimation.setAttribute('dur', '1.8s');
			opacityAnimation.setAttribute('repeatCount', 'indefinite');
			opacityAnimation.setAttribute('values', '0.82;0.08;0.82');
			ring.append(radiusAnimation, opacityAnimation);
		}

		parent.append(ring);
	};

	const appendCurrentLocation = (group: SVGGElement, start: MapPoint): void => {
		const namespace = 'http://www.w3.org/2000/svg';
		const origin: SVGGElement = document.createElementNS(namespace, 'g');
		const core: SVGCircleElement = document.createElementNS(namespace, 'circle');

		origin.setAttribute('data-facing-degrees', String(settings().viewerFacingDegrees));
		origin.setAttribute('data-guidance-layer', 'origin');
		appendPulse(origin, start, settings().accentColor, 'origin-pulse', 19, 34);
		core.setAttribute('cx', String(start.x));
		core.setAttribute('cy', String(start.y));
		core.setAttribute('data-guidance-layer', 'origin-core');
		core.setAttribute('fill', settings().primaryTextColor);
		core.setAttribute('r', '9');
		core.setAttribute('stroke', settings().panelColor);
		core.setAttribute('stroke-width', '4');
		core.setAttribute('vector-effect', 'non-scaling-stroke');
		origin.append(core);

		if (settings().orientationConfirmed) {
			const heading: SVGPolygonElement = document.createElementNS(namespace, 'polygon');
			heading.setAttribute('data-guidance-layer', 'origin-heading');
			heading.setAttribute('fill', settings().accentColor);
			heading.setAttribute('points', `${start.x},${start.y - 37} ${start.x - 9},${start.y - 17} ${start.x + 9},${start.y - 17}`);
			heading.setAttribute('stroke', settings().panelColor);
			heading.setAttribute('stroke-width', '3');
			heading.setAttribute('transform', `rotate(${settings().viewerFacingDegrees} ${start.x} ${start.y})`);
			heading.setAttribute('vector-effect', 'non-scaling-stroke');
			origin.append(heading);
		}

		group.append(origin);
	};

	const drawGuidanceMarkup = (destination?: MapPoint, mode?: 'highlight' | 'directional'): void => {
		if (!svg) return;

		removeGuidanceMarkup();
		const namespace = 'http://www.w3.org/2000/svg';
		const group: SVGGElement = document.createElementNS(namespace, 'g');
		const start: MapPoint | undefined = locationCenter(settings().startLocationId);

		if (!start && !destination) return;

		group.id = GUIDANCE_GROUP_ID;
		group.setAttribute('pointer-events', 'none');

		if (destination && mode) {
			const definitions: SVGDefsElement = document.createElementNS(namespace, 'defs');
			const mask: SVGMaskElement = document.createElementNS(namespace, 'mask');
			const maskId = `${GUIDANCE_GROUP_ID}-mask`;
			const maskBase: SVGRectElement = document.createElementNS(namespace, 'rect');
			const maskOpening: SVGCircleElement = document.createElementNS(namespace, 'circle');
			const shade: SVGRectElement = document.createElementNS(namespace, 'rect');
			const target: SVGGElement = document.createElementNS(namespace, 'g');
			const targetCore: SVGCircleElement = document.createElementNS(namespace, 'circle');

			mask.id = maskId;
			maskBase.setAttribute('fill', '#ffffff');
			maskBase.setAttribute('height', String(MAP_HEIGHT));
			maskBase.setAttribute('width', String(MAP_WIDTH));
			maskOpening.setAttribute('cx', String(destination.x));
			maskOpening.setAttribute('cy', String(destination.y));
			maskOpening.setAttribute('fill', '#000000');
			maskOpening.setAttribute('r', '58');
			mask.append(maskBase, maskOpening);
			definitions.append(mask);
			shade.setAttribute('data-guidance-layer', 'shade');
			shade.setAttribute('fill', settings().panelColor);
			shade.setAttribute('height', String(MAP_HEIGHT));
			shade.setAttribute('mask', `url(#${maskId})`);
			shade.setAttribute('opacity', '0.34');
			shade.setAttribute('width', String(MAP_WIDTH));
			target.setAttribute('data-guidance-layer', 'target');
			appendPulse(target, destination, settings().routeColor, 'target-pulse', 25, 43);
			targetCore.setAttribute('cx', String(destination.x));
			targetCore.setAttribute('cy', String(destination.y));
			targetCore.setAttribute('data-guidance-layer', 'target-core');
			targetCore.setAttribute('fill', settings().routeColor);
			targetCore.setAttribute('r', '8');
			targetCore.setAttribute('stroke', settings().panelColor);
			targetCore.setAttribute('stroke-width', '3');
			targetCore.setAttribute('vector-effect', 'non-scaling-stroke');
			target.append(targetCore);
			group.append(definitions, shade);

			if (start) appendCurrentLocation(group, start);
			group.append(target);
		} else if (start) {
			appendCurrentLocation(group, start);
		}

		const hitTargets: Element | null = svg.querySelector('#location-hit-targets');

		if (hitTargets?.parentNode) hitTargets.parentNode.insertBefore(group, hitTargets);
		else svg.append(group);
	};

	const selectDestination = (destination: Destination, restartTimer = true): void => {
		if (!svg) return;

		setSelectedId(destination.id);
		setKeyboardOpen(false);
		const mode: WayfindingGuidanceMode = activeGuidanceMode();
		const destinationNode: MapPoint | undefined = locationCenter(destination.id);

		if (!destinationNode) {
			setGuidanceState('external');
		} else if (mode === 'directory') {
			setGuidanceState('directory');
		} else {
			const resolvedMode: 'highlight' | 'directional' = mode === 'directional' ? 'directional' : 'highlight';
			setGuidanceState(resolvedMode);
		}

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

			if (destination) selectDestination(destination);
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
		const guidanceMode: WayfindingGuidanceMode = settings().guidanceMode;
		const mapNorthOffsetDegrees: number = settings().mapNorthOffsetDegrees;
		const orientationConfirmed: boolean = settings().orientationConfirmed;
		const selected: Destination | undefined = untrack(selectedDestination);

		if (selected) {
			untrack((): void => {
				void startLocationId;
				void guidanceMode;
				void mapNorthOffsetDegrees;
				void orientationConfirmed;
				selectDestination(selected, false);
			});
		}
	});

	createEffect((): void => {
		const state: MapState = mapState();
		const selected: Destination | undefined = selectedDestination();
		const mode: WayfindingGuidanceMode = activeGuidanceMode();
		const destination: MapPoint | undefined = selected ? locationCenter(selected.id) : undefined;

		void settings().accentColor;
		void settings().motionPreset;
		void settings().orientationConfirmed;
		void settings().panelColor;
		void settings().primaryTextColor;
		void settings().routeColor;
		void settings().startLocationId;
		void settings().viewerFacingDegrees;

		if (state !== 'ready' || !svg) return;

		drawGuidanceMarkup(destination, selected && destination && mode !== 'directory'
			? mode === 'directional' ? 'directional' : 'highlight'
			: undefined);
	});

	onCleanup((): void => {
		clearResetTimer();
		removeGuidanceMarkup();
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
			data-map-north={settings().mapNorthOffsetDegrees}
			data-map-zoom={mapZoom()}
			data-orientation-confirmed={settings().orientationConfirmed}
			data-viewer-facing={settings().viewerFacingDegrees}
			data-guidance-mode={activeGuidanceMode()}
			data-guidance-state={guidanceState()}
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
					<div ref={mapHost} class={style['map-canvas']} data-preview-allow-overflow>
						<div class={style['map-markup']} innerHTML={mapMarkup} />
						<Show when={mapState() !== 'ready'}>
							<div class={style['map-status']}>{mapState() === 'error' ? copy().mapUnavailable : copy().loadingMap}</div>
						</Show>
						<div class={style['map-controls']} aria-label={copy().mapControls}>
							<button type="button" title={copy().zoomIn} aria-label={copy().zoomIn} onClick={(): void => { setMapZoom((value: number): number => clamp(value + 0.25, 1, 2.5)); scheduleReset(); }}>+</button>
							<button type="button" title={copy().zoomOut} aria-label={copy().zoomOut} onClick={(): void => { setMapZoom((value: number): number => clamp(value - 0.25, 1, 2.5)); scheduleReset(); }}>−</button>
							<button type="button" title={copy().fitMap} aria-label={copy().fitMap} onClick={(): void => { resetMapView(); scheduleReset(); }}>⛶</button>
						</div>
					</div>
					<div class={style['map-instruction']}>
						<span>{copy().mapInstruction}</span>
						<i aria-hidden="true" />
						<span>{copy().guidanceHonesty}</span>
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
								<Show when={filteredDestinations().length > 0} fallback={<div class={style['empty-state']} data-preview-id="destinations-empty">{settings().emptyStateText}</div>}>
									<For each={filteredDestinations()}>{(destination: Destination): JSX.Element => (
										<button type="button" data-destination-id={destination.id} data-mapped={Boolean(locationCenter(destination.id))} onClick={(): void => { selectDestination(destination); }}>
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
									<strong>{guidanceState() === 'external'
									? copy().externalMap
										: guidanceState() === 'directional' && directionCue()
											? `${copy().direction}: ${CARDINAL_COPY[uiLanguage()][directionCue()!.cardinal]}. ${copy().directionalDisclaimer}`
											: copy().highlightedOnMap}</strong>
								</div>
								<button class={style['clear-button']} type="button" onClick={resetSession}>{copy().clearSelection}</button>
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
