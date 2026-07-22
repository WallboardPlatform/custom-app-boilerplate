import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import type { Accessor, JSX } from 'solid-js';

import { useAutoFitText } from '@hooks/system/useAutoFitText';
import { useDataSources } from '@hooks/system/useDataSources';
import { useSettings } from '@hooks/system/useSettings';

import type { DataSources, FloorId, Settings } from '@interfaces/application.interface';
import type { Destination } from '@interfaces/wayfinding.interface';
import { normalizeDestinations } from '@utils/destinations';
import { WayfindingGraph } from '@utils/wayfinding';
import type { WayfindingGraphDocument, WayfindingRoutePoint, WayfindingRouteResult } from '@utils/wayfinding';

import style from '@components/wb-app/wb-app.module.scss';
import { keyboardLayoutsFor, OnScreenKeyboard } from '../../capabilities/keyboard';
import type { KeyboardLayoutId } from '../../capabilities/keyboard';
import mapMarkup from '../../assets/map.svg?raw';
import routeGraphDocument from '../../editor-assets/route-graph.json';
import sampleDestinationData from '../../../sample-destinations-datasource.json';

type UiLanguage = 'en' | 'es';

interface MapPoint {
	x: number;
	y: number;
}

interface PointerState {
	current: MapPoint;
	moved: boolean;
	origin: MapPoint;
}

interface UiCopy {
	allCategories: string;
	allFloors: string;
	approximateDistance: string;
	back: string;
	clear: string;
	close: string;
	delete: string;
	destinationPrompt: string;
	directory: string;
	elevatorNote: string;
	find: string;
	fit: string;
	floor: string;
	hours: string;
	keyboardLabel: string;
	levelChange: string;
	map: string;
	routeShown: string;
	routeViaElevator: string;
	reset: string;
	searchPlaceholder: string;
	selectedOnFloor: string;
	shift: string;
	showResults: string;
	space: string;
	status: string;
	touchHint: string;
	viewFloor: string;
	walkingTime: string;
	youAreHere: string;
	zoomIn: string;
	zoomOut: string;
}

const UI_COPY: Record<UiLanguage, UiCopy> = {
	en: {
		allCategories: 'All services',
		allFloors: 'All floors',
		approximateDistance: 'Approx. distance',
		back: 'Back to directory',
		clear: 'Clear',
		close: 'Close',
		delete: 'Delete',
		destinationPrompt: 'Where can we help you go?',
		directory: 'DIRECTORY',
		elevatorNote: 'Use the central elevator or stairs to change levels.',
		find: 'FIND A DESTINATION',
		fit: 'Fit map',
		floor: 'Level',
		hours: 'Hours',
		keyboardLabel: 'Search destinations',
		levelChange: 'This destination is on another level.',
		map: 'Building map',
		routeShown: 'Route shown from the main lobby',
		routeViaElevator: 'Follow the route to the central elevator, then continue on the destination level.',
		reset: 'Reset',
		searchPlaceholder: 'Search departments or services',
		selectedOnFloor: 'Highlighted on Level',
		shift: 'Shift',
		showResults: 'Show results',
		space: 'Space',
		status: 'Status',
		touchHint: 'Touch a department on the map or use the directory.',
		viewFloor: 'View Level',
		walkingTime: 'Walking time',
		youAreHere: 'YOU ARE HERE',
		zoomIn: 'Zoom in',
		zoomOut: 'Zoom out'
	},
	es: {
		allCategories: 'Todos los servicios',
		allFloors: 'Todos los pisos',
		approximateDistance: 'Distancia aprox.',
		back: 'Volver al directorio',
		clear: 'Borrar',
		close: 'Cerrar',
		delete: 'Eliminar',
		destinationPrompt: '¿A dónde desea ir?',
		directory: 'DIRECTORIO',
		elevatorNote: 'Use el ascensor central o las escaleras para cambiar de piso.',
		find: 'BUSCAR UN DESTINO',
		fit: 'Ajustar mapa',
		floor: 'Piso',
		hours: 'Horario',
		keyboardLabel: 'Buscar destinos',
		levelChange: 'Este destino está en otro piso.',
		map: 'Mapa del edificio',
		routeShown: 'Ruta mostrada desde el vestíbulo principal',
		routeViaElevator: 'Siga la ruta hasta el ascensor central y continúe en el piso de destino.',
		reset: 'Reiniciar',
		searchPlaceholder: 'Buscar departamentos o servicios',
		selectedOnFloor: 'Resaltado en el piso',
		shift: 'Mayúsculas',
		showResults: 'Ver resultados',
		space: 'Espacio',
		status: 'Estado',
		touchHint: 'Toque un departamento en el mapa o use el directorio.',
		viewFloor: 'Ver piso',
		walkingTime: 'Tiempo a pie',
		youAreHere: 'USTED ESTÁ AQUÍ',
		zoomIn: 'Acercar',
		zoomOut: 'Alejar'
	}
};

const MAP_WIDTH = 1000;
const MAP_HEIGHT = 620;
const ALL_CATEGORIES = '__all__';
const ALL_FLOORS = '__all__';
const GUIDANCE_ID = 'wb-civic-directory-guidance';
const FLOOR_IDS: FloorId[] = ['1', '2', '3'];
const ROUTE_GRAPH = new WayfindingGraph(routeGraphDocument as WayfindingGraphDocument);

const normalizeSearch = (value: string): string => value
	.normalize('NFD')
	.replace(/[\u0300-\u036f]/g, '')
	.toLocaleLowerCase();

const clamp = (value: number, minimum: number, maximum: number): number => Math.min(maximum, Math.max(minimum, value));

const simplifyRoutePoints = (points: WayfindingRoutePoint[]): WayfindingRoutePoint[] => {
	const simplified: WayfindingRoutePoint[] = [];

	for (const point of points) {
		if (simplified.length >= 2) {
			const beforePrevious: WayfindingRoutePoint = simplified[simplified.length - 2];
			const previous: WayfindingRoutePoint = simplified[simplified.length - 1];
			const sharesHorizontalAxis: boolean = beforePrevious.y === previous.y && previous.y === point.y;
			const sharesVerticalAxis: boolean = beforePrevious.x === previous.x && previous.x === point.x;

			if (sharesHorizontalAxis || sharesVerticalAxis) simplified.pop();
		}
		simplified.push(point);
	}

	return simplified;
};

export default (props: { hostElement: HTMLDivElement }): JSX.Element => {
	const dataSources: Accessor<DataSources> = useDataSources();
	const settings: Accessor<Settings> = useSettings();
	const [activeFloor, setActiveFloor] = createSignal<FloorId>('1');
	const [category, setCategory] = createSignal(ALL_CATEGORIES);
	const [floorFilter, setFloorFilter] = createSignal(ALL_FLOORS);
	const [keyboardOpen, setKeyboardOpen] = createSignal(false);
	const [mapCenter, setMapCenter] = createSignal<MapPoint>({ x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 });
	const [mapReady, setMapReady] = createSignal(false);
	const [mapZoom, setMapZoom] = createSignal(1);
	const [query, setQuery] = createSignal('');
	const [selectedId, setSelectedId] = createSignal<string>();
	const [uiLanguage, setUiLanguage] = createSignal<UiLanguage>('en');
	const pointers = new Map<number, PointerState>();
	let mapHost!: HTMLDivElement;
	let resetTimer: ReturnType<typeof setTimeout> | undefined;
	let svg: SVGSVGElement | undefined;

	const copy: Accessor<UiCopy> = createMemo((): UiCopy => UI_COPY[uiLanguage()]);
	const showLanguageSelector: Accessor<boolean> = createMemo((): boolean => settings().interfaceLanguages === 'en-es');
	const keyboardLayouts = createMemo(() => {
		const configuredLanguage = settings().keyboardLanguages;
		const configured: KeyboardLayoutId[] = configuredLanguage === 'en-es'
			? ['en', 'es']
			: [configuredLanguage];

		return keyboardLayoutsFor(configured);
	});
	const hasBoundData: Accessor<boolean> = createMemo((): boolean => Object.prototype.hasOwnProperty.call(dataSources(), 'destinationData'));
	const destinations: Accessor<Destination[]> = createMemo((): Destination[] => normalizeDestinations(
		hasBoundData() ? dataSources().destinationData?.value : sampleDestinationData
	));
	const destinationById = createMemo((): Map<string, Destination> => new Map(
		destinations().map((destination: Destination): [string, Destination] => [destination.id, destination])
	));
	const categories: Accessor<string[]> = createMemo((): string[] => Array.from(new Set(
		destinations().map((destination: Destination): string => destination.category)
	)));
	const displayName = (destination: Destination): string => {
		return uiLanguage() === 'es' && destination.alternateName ? destination.alternateName : destination.name;
	};
	const secondaryName = (destination: Destination): string => {
		const candidate: string = uiLanguage() === 'es' ? destination.name : destination.alternateName;

		return candidate && candidate !== displayName(destination) ? candidate : destination.category;
	};
	const filteredDestinations: Accessor<Destination[]> = createMemo((): Destination[] => {
		const normalizedQuery: string = normalizeSearch(query().trim());

		return destinations().filter((destination: Destination): boolean => {
			const categoryMatches: boolean = category() === ALL_CATEGORIES || destination.category === category();
			const floorMatches: boolean = floorFilter() === ALL_FLOORS || destination.floor === floorFilter();
			const queryMatches: boolean = normalizedQuery === '' || normalizeSearch([
				destination.name,
				destination.alternateName,
				destination.category,
				destination.description,
				destination.keywords
			].join(' ')).includes(normalizedQuery);

			return categoryMatches && floorMatches && queryMatches;
		});
	});
	const selectedDestination: Accessor<Destination | undefined> = createMemo((): Destination | undefined => {
		return selectedId() ? destinationById().get(selectedId()!) : undefined;
	});
	const routeResult: Accessor<WayfindingRouteResult | undefined> = createMemo((): WayfindingRouteResult | undefined => {
		const selected: Destination | undefined = selectedDestination();

		if (!selected || settings().guidanceMode !== 'route') return undefined;
		const startNode = ROUTE_GRAPH.locationNode(settings().startLocationId);
		const destinationNode = ROUTE_GRAPH.locationNode(selected.id);

		if (!startNode || !destinationNode) return undefined;

		return ROUTE_GRAPH.route(startNode.id, destinationNode.id, { mapRatio: 12, profile: 'step-free' });
	});
	const fitTitle = useAutoFitText({ minFontSize: 21, maxFontSize: 36, widthOnly: true, watch: (): string => settings().title });
	const fitSelectedName = useAutoFitText({ minFontSize: 22, maxFontSize: 42, watch: (): string => selectedDestination() ? displayName(selectedDestination()!) : '' });

	const rootStyle = createMemo((): JSX.CSSProperties => ({
		'--wb-civic-accent': settings().accentColor,
		'--wb-civic-background': settings().backgroundColor,
		'--wb-civic-destination': settings().destinationColor,
		'--wb-civic-map': settings().mapSurfaceColor,
		'--wb-civic-panel': settings().panelColor,
		'--wb-civic-primary': settings().primaryTextColor,
		'--wb-civic-route': settings().routeColor,
		'--wb-civic-secondary': settings().secondaryTextColor
	}));

	const resetView = (): void => {
		setMapCenter({ x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 });
		setMapZoom(1);
	};

	const resetSession = (): void => {
		if (resetTimer) clearTimeout(resetTimer);
		resetTimer = undefined;
		setActiveFloor(settings().initialFloor);
		setCategory(ALL_CATEGORIES);
		setFloorFilter(ALL_FLOORS);
		setKeyboardOpen(false);
		setQuery('');
		setSelectedId(undefined);
		resetView();
	};

	const scheduleReset = (): void => {
		if (resetTimer) clearTimeout(resetTimer);
		resetTimer = setTimeout(resetSession, settings().selectionResetSeconds * 1000);
	};

	const setFloor = (floor: FloorId): void => {
		setActiveFloor(floor);
		resetView();
		scheduleReset();
	};

	const fitMapLabel = (group: SVGGElement, value: string): void => {
		const element: SVGTextElement | null = group.querySelector('text:not(.wb-civic-zone-kicker)');

		if (!element) return;
		const words: string[] = value.toLocaleUpperCase().split(/\s+/).filter(Boolean);
		const maximumWidth: number = Number(group.dataset.labelWidth ?? 140);
		const maximumLines: number = Number(group.dataset.labelLines ?? 3);
		const minimumFontSize: number = Number(group.dataset.labelMinSize ?? 11);
		let fontSize: number = group.classList.contains('wb-civic-compact') ? 13 : 16;
		const measure = (text: string): number => {
			element.style.fontSize = `${fontSize}px`;
			element.textContent = text;

			return element.getComputedTextLength();
		};
		const wrap = (): string[] => {
			const lines: string[] = [];

			for (const word of words) {
				const last: string | undefined = lines[lines.length - 1];
				const candidate: string = last ? `${last} ${word}` : word;

				if (!last) lines.push(word);
				else if (measure(candidate) <= maximumWidth) lines[lines.length - 1] = candidate;
				else lines.push(word);
			}

			return lines;
		};
		let lines: string[] = wrap();

		while (fontSize > minimumFontSize && (lines.length > maximumLines || lines.some((line: string): boolean => measure(line) > maximumWidth))) {
			fontSize -= 1;
			lines = wrap();
		}

		if (lines.length > maximumLines) {
			const visible: string[] = lines.slice(0, maximumLines);
			let lastLine: string = `${lines.slice(maximumLines - 1).join(' ')}...`;

			while (lastLine.length > 4 && measure(lastLine) > maximumWidth) lastLine = `${lastLine.slice(0, -4).trimEnd()}...`;
			visible[maximumLines - 1] = lastLine;
			lines = visible;
		}

		element.replaceChildren();
		element.style.fontSize = `${fontSize}px`;
		const lineHeight: number = Math.max(14, Math.round(fontSize * 1.15));
		const firstLineY: number = -((lines.length - 1) * lineHeight) / 2;

		for (const [index, line] of lines.entries()) {
			const tspan: SVGTSpanElement = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
			tspan.setAttribute('x', '0');
			tspan.setAttribute('y', String(firstLineY + index * lineHeight));
			tspan.textContent = line;
			element.append(tspan);
		}

		const kicker: SVGTextElement | null = group.querySelector('.wb-civic-zone-kicker');

		if (kicker) {
			let kickerSize = 8;
			kicker.style.fontSize = `${kickerSize}px`;

			while (kickerSize > 6 && kicker.getComputedTextLength() > maximumWidth) {
				kickerSize -= 1;
				kicker.style.fontSize = `${kickerSize}px`;
			}
			kicker.setAttribute('y', String(((lines.length - 1) * lineHeight) / 2 + 27));
		}
		group.dataset.wbLabelFitted = 'true';
	};

	const destinationCenter = (id: string): MapPoint | undefined => {
		const target: SVGGraphicsElement | null | undefined = svg?.querySelector<SVGGraphicsElement>(`[data-wayfinding-location-id='${CSS.escape(id)}']`);

		if (!target) return undefined;
		const bounds: DOMRect = target.getBBox();

		return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
	};

	const updateMap = (): void => {
		if (!svg) return;

		for (const level of Array.from(svg.querySelectorAll<SVGGElement>('[data-wayfinding-level]'))) {
			level.style.display = level.getAttribute('data-wayfinding-level') === activeFloor() ? '' : 'none';
		}

		for (const target of Array.from(svg.querySelectorAll('[data-wayfinding-location-id]'))) {
			target.toggleAttribute('data-wb-selected', target.getAttribute('data-wayfinding-location-id') === selectedId());
		}

		for (const labelGroup of Array.from(svg.querySelectorAll<SVGGElement>('[data-wayfinding-label-for]'))) {
			if (labelGroup.closest('[data-wayfinding-level]')?.getAttribute('data-wayfinding-level') !== activeFloor()) continue;
			const destination: Destination | undefined = destinationById().get(labelGroup.getAttribute('data-wayfinding-label-for') ?? '');

			if (destination) fitMapLabel(labelGroup, destination.mapLabel);
		}
		svg.querySelector(`#${GUIDANCE_ID}`)?.remove();
		const selected: Destination | undefined = selectedDestination();

		if (!selected || settings().guidanceMode === 'directory') return;
		const group: SVGGElement = document.createElementNS('http://www.w3.org/2000/svg', 'g');
		group.id = GUIDANCE_ID;
		group.setAttribute('pointer-events', 'none');

		if (settings().guidanceMode === 'route') {
			const routePoints: WayfindingRoutePoint[] = simplifyRoutePoints(
				(routeResult()?.path ?? []).filter((point: WayfindingRoutePoint): boolean => point.levelId === activeFloor())
			);

			if (routePoints.length >= 2) {
				const points: string = routePoints.map((point: WayfindingRoutePoint): string => `${point.x},${point.y}`).join(' ');
				const underlay: SVGPolylineElement = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
				const line: SVGPolylineElement = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
				underlay.setAttribute('points', points);
				underlay.setAttribute('class', 'wb-civic-route-line-underlay');
				underlay.setAttribute('data-route', activeFloor());
				line.setAttribute('points', points);
				line.setAttribute('class', 'wb-civic-route-line');
				line.setAttribute('data-route', activeFloor());
				group.append(underlay, line);
			}
		}

		if (selected.floor === activeFloor()) {
			const activeRoutePoints: WayfindingRoutePoint[] = settings().guidanceMode === 'route'
				? simplifyRoutePoints((routeResult()?.path ?? []).filter((point: WayfindingRoutePoint): boolean => point.levelId === activeFloor()))
				: [];
			const routeEntrance: WayfindingRoutePoint | undefined = activeRoutePoints[activeRoutePoints.length - 1];
			const center: MapPoint | undefined = routeEntrance ?? destinationCenter(selected.id);

			if (center) {
				const ring: SVGCircleElement = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
				const core: SVGCircleElement = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
				ring.setAttribute('cx', String(center.x));
				ring.setAttribute('cy', String(center.y));
				ring.setAttribute('r', '29');
				ring.setAttribute('class', 'wb-civic-target-pulse');
				core.setAttribute('cx', String(center.x));
				core.setAttribute('cy', String(center.y));
				core.setAttribute('r', '9');
				core.setAttribute('class', 'wb-civic-target-core');
				group.append(ring, core);
			}
		}

		if (group.childElementCount > 0) svg.append(group);
	};

	const updateViewBox = (): void => {
		if (!svg) return;
		const zoom: number = mapZoom();
		const width: number = MAP_WIDTH / zoom;
		const height: number = MAP_HEIGHT / zoom;
		const center: MapPoint = mapCenter();
		const x: number = clamp(center.x - width / 2, 0, MAP_WIDTH - width);
		const y: number = clamp(center.y - height / 2, 0, MAP_HEIGHT - height);
		svg.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
	};

	const zoomMap = (factor: number): void => {
		setMapZoom((value: number): number => clamp(value * factor, 1, 3));
		scheduleReset();
	};

	const selectDestination = (destination: Destination): void => {
		setSelectedId(destination.id);
		setKeyboardOpen(false);
		scheduleReset();
	};

	const mapPoint = (event: PointerEvent): MapPoint => {
		const bounds: DOMRect = mapHost.getBoundingClientRect();

		return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
	};

	const pointerDown = (event: PointerEvent): void => {
		if (event.pointerType === 'mouse' && event.button !== 0) return;
		const point: MapPoint = mapPoint(event);
		pointers.set(event.pointerId, { current: point, moved: false, origin: point });
		mapHost.setPointerCapture(event.pointerId);
	};

	const pointerMove = (event: PointerEvent): void => {
		const pointer: PointerState | undefined = pointers.get(event.pointerId);

		if (!pointer || mapZoom() <= 1) return;
		const point: MapPoint = mapPoint(event);
		const dx: number = point.x - pointer.current.x;
		const dy: number = point.y - pointer.current.y;

		if (Math.hypot(point.x - pointer.origin.x, point.y - pointer.origin.y) > 7) pointer.moved = true;
		pointer.current = point;
		const bounds: DOMRect = mapHost.getBoundingClientRect();
		setMapCenter((center: MapPoint): MapPoint => ({
			x: center.x - dx * (MAP_WIDTH / mapZoom()) / bounds.width,
			y: center.y - dy * (MAP_HEIGHT / mapZoom()) / bounds.height
		}));
	};

	const pointerUp = (event: PointerEvent): void => {
		const pointer: PointerState | undefined = pointers.get(event.pointerId);
		pointers.delete(event.pointerId);

		if (!pointer?.moved) {
			const element: Element | null = document.elementFromPoint(event.clientX, event.clientY);
			const target: Element | null = element?.closest('[data-wayfinding-location-id]') ?? null;
			const id: string | null = target?.getAttribute('data-wayfinding-location-id') ?? null;
			const destination: Destination | undefined = id ? destinationById().get(id) : undefined;

			if (destination && destination.floor === activeFloor()) selectDestination(destination);
		}
	};

	createEffect((): void => {
		const configuredLanguage = settings().interfaceLanguages;

		if (configuredLanguage === 'en' || configuredLanguage === 'es') setUiLanguage(configuredLanguage);

		if (!settings().onScreenKeyboard) setKeyboardOpen(false);
	});

	createEffect((): void => {
		const initialFloor: FloorId = settings().initialFloor;

		if (!selectedId()) setActiveFloor(initialFloor);
	});

	createEffect((): void => {
		activeFloor();
		selectedId();
		destinationById();
		void settings().guidanceMode;
		void settings().motionPreset;
		routeResult();
		updateMap();
	});

	createEffect((): void => {
		mapCenter();
		mapZoom();
		updateViewBox();
	});

	onMount((): void => {
		svg = mapHost.querySelector('svg') ?? undefined;

		if (svg) {
			svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
			setActiveFloor(settings().initialFloor);
			setMapReady(true);
			updateMap();
			updateViewBox();
		}
		mapHost.addEventListener('pointerdown', pointerDown);
		mapHost.addEventListener('pointermove', pointerMove);
		mapHost.addEventListener('pointerup', pointerUp);
		mapHost.addEventListener('pointercancel', pointerUp);
	});

	onCleanup((): void => {
		if (resetTimer) clearTimeout(resetTimer);
		mapHost?.removeEventListener('pointerdown', pointerDown);
		mapHost?.removeEventListener('pointermove', pointerMove);
		mapHost?.removeEventListener('pointerup', pointerUp);
		mapHost?.removeEventListener('pointercancel', pointerUp);
	});

	return (
		<div
			class={style['wb-app']}
			data-preview-id="civic-building-directory-root"
			data-active-floor={activeFloor()}
			data-map-ready={String(mapReady())}
			data-map-zoom={String(mapZoom())}
			data-guidance-mode={settings().guidanceMode}
			data-motion={settings().motionPreset}
			data-selection-reset={String(settings().selectionResetSeconds)}
			data-host-attached={String(Boolean(props.hostElement))}
			style={rootStyle()}
		>
			<header class={style.header}>
				<div class={style.identity}><span aria-hidden="true">C</span><strong>CIVIC CENTER</strong></div>
				<div class={style.heading}>
					<p>{settings().subtitle}</p>
					<h1 class="wb-civic-title" ref={fitTitle}>{settings().title}</h1>
				</div>
				<div class={style.floorTabs} role="tablist" aria-label="Building levels">
					<For each={FLOOR_IDS}>{(floor: FloorId): JSX.Element => (
						<button type="button" role="tab" aria-selected={activeFloor() === floor} onClick={(): void => setFloor(floor)}>
							<span>{copy().floor}</span><strong>{floor}</strong>
						</button>
					)}</For>
				</div>
				<Show when={showLanguageSelector()}>
					<div class={style.languages} aria-label="Interface language">
						<button type="button" aria-pressed={uiLanguage() === 'en'} onClick={(): void => { setUiLanguage('en'); }}>EN</button>
						<button type="button" aria-pressed={uiLanguage() === 'es'} onClick={(): void => { setUiLanguage('es'); }}>ES</button>
					</div>
				</Show>
				<button class={style.reset} type="button" onClick={resetSession}>{copy().reset}</button>
			</header>

			<main class={style.content}>
				<section class={style.mapPanel} aria-label={copy().map}>
					<div class={style.mapHeader}>
						<div><span class="wb-civic-map-label">{copy().map}</span><strong>{copy().floor} {activeFloor()}</strong></div>
						<p class="wb-civic-secondary">{activeFloor() === '1' ? copy().youAreHere : copy().elevatorNote}</p>
					</div>
					<div class={style.mapCanvas}>
						<div class={style.mapMarkup} ref={mapHost} innerHTML={mapMarkup} />
						<div class={style.mapControls} aria-label="Map controls">
							<button type="button" aria-label={copy().zoomIn} onClick={(): void => zoomMap(1.25)}>+</button>
							<button type="button" aria-label={copy().zoomOut} onClick={(): void => zoomMap(0.8)}>-</button>
							<button type="button" aria-label={copy().fit} onClick={resetView}>FIT</button>
						</div>
					</div>
					<div class={style.mapFooter}><span class={style.pulseKey} />{copy().touchHint}</div>
				</section>

				<aside class={style.directory}>
					<Show when={!selectedDestination()} fallback={
						<section class={style.detail}>
							<button class={style.back} type="button" onClick={(): void => { setSelectedId(undefined); }}>&lt; {copy().back}</button>
							<div class={`${style.levelBadge} wb-civic-metadata`}>{copy().floor} {selectedDestination()!.floor}</div>
							<p class={style.eyebrow}>{selectedDestination()!.category}</p>
							<h2 class="wb-civic-selected-name" ref={fitSelectedName}>{displayName(selectedDestination()!)}</h2>
							<Show when={secondaryName(selectedDestination()!)}><h3>{secondaryName(selectedDestination()!)}</h3></Show>
							<Show when={selectedDestination()!.description}><p class={style.description}>{selectedDestination()!.description}</p></Show>
							<div class={style.detailFacts}>
								<Show when={selectedDestination()!.hours}><div><span>{copy().hours}</span><strong>{selectedDestination()!.hours}</strong></div></Show>
								<Show when={selectedDestination()!.status}><div><span>{copy().status}</span><strong>{selectedDestination()!.status}</strong></div></Show>
							</div>
							<Show when={selectedDestination()!.floor !== activeFloor()} fallback={
								<Show when={settings().guidanceMode === 'route' && routeResult()} fallback={<p class={style.highlightStatus}>{copy().selectedOnFloor} {activeFloor()}</p>}>
									<div class={style.routeSummary} data-route-summary>
										<strong>{copy().routeShown}</strong>
										<span>{copy().approximateDistance}: {routeResult()!.walkingDistance} m</span>
										<span>{copy().walkingTime}: {Math.max(1, Math.ceil(routeResult()!.walkingSeconds / 60))} min</span>
									</div>
								</Show>
							}>
								<div class={style.levelChange}>
									<p>{settings().guidanceMode === 'route' && routeResult() ? copy().routeViaElevator : copy().levelChange}</p>
									<button type="button" onClick={(): void => setFloor(selectedDestination()!.floor)}>{copy().viewFloor} {selectedDestination()!.floor}</button>
								</div>
							</Show>
							<button class={style.clearSelection} type="button" onClick={(): void => { setSelectedId(undefined); }}>{copy().clear}</button>
						</section>
					}>
						<div class={style.directoryIntro}>
							<p>{copy().find}</p>
							<h2>{copy().destinationPrompt}</h2>
						</div>
						<div class={style.filters}>
							<div class={style.searchField}>
								<input
									type="search"
									aria-label={copy().keyboardLabel}
									placeholder={copy().searchPlaceholder}
									value={query()}
									onFocus={(): void => { if (settings().onScreenKeyboard) setKeyboardOpen(true); }}
									onInput={(event): void => { setQuery(event.currentTarget.value); }}
								/>
								<Show when={settings().onScreenKeyboard}><button type="button" aria-label="Open touch keyboard" onClick={(): void => { setKeyboardOpen(true); }}>ABC</button></Show>
							</div>
							<div class={style.selectRow}>
								<select aria-label="Floor filter" value={floorFilter()} onChange={(event): void => { setFloorFilter(event.currentTarget.value); }}>
									<option value={ALL_FLOORS}>{copy().allFloors}</option>
									<For each={FLOOR_IDS}>{(floor: FloorId): JSX.Element => <option value={floor}>{copy().floor} {floor}</option>}</For>
								</select>
								<select aria-label="Service category" value={category()} onChange={(event): void => { setCategory(event.currentTarget.value); }}>
									<option value={ALL_CATEGORIES}>{copy().allCategories}</option>
									<For each={categories()}>{(item: string): JSX.Element => <option value={item}>{item}</option>}</For>
								</select>
							</div>
						</div>
						<div
							class={style.destinationList}
							data-destination-count={filteredDestinations().length}
							data-preview-allow-overflow
						>
							<Show when={filteredDestinations().length > 0} fallback={<div class={style.empty}>{settings().emptyStateText}</div>}>
								<For each={filteredDestinations()}>{(destination: Destination): JSX.Element => (
									<button type="button" data-destination-id={destination.id} onClick={(): void => selectDestination(destination)}>
										<small>{destination.floor}</small>
										<span><strong class="wb-civic-destination-name">{displayName(destination)}</strong><em>{secondaryName(destination)}</em></span>
										<i>&gt;</i>
									</button>
								)}</For>
							</Show>
						</div>
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
					onClose={(): void => { setKeyboardOpen(false); }}
					onInput={(value: string): void => { setQuery(value); }}
					onSubmit={(): void => { setKeyboardOpen(false); }}
					submitLabel={copy().showResults}
					textColor={settings().primaryTextColor}
					value={query()}
				/>
			</Show>
		</div>
	);
};
