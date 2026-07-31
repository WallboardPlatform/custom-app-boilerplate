import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import type { Accessor, JSX } from 'solid-js';

import { useSettings } from '@hooks/system/useSettings';
import type { Settings } from '@interfaces/application.interface';
import type {
	RuntimeAsset,
	RuntimeDestination,
	RuntimeDoor,
	RuntimeElement,
	RuntimeFloor,
	RuntimeLabel,
	RuntimeMedia,
	RuntimeOrigin,
	RuntimePointOfInterest,
	RuntimePolygon,
	RuntimeTransition,
	WayfindingRuntimeBundle
} from '@interfaces/spatial-wayfinding.interface';
import { WayfindingGraph } from '@utils/wayfinding';
import type { WayfindingNode, WayfindingPoint, WayfindingRouteResult } from '@utils/wayfinding';
import {
	buildPresentationScene,
	getPresentationThreeDimensionalReadiness,
	layoutPresentationLabels,
	presentationDestinationFloorIds
} from '@utils/wayfinding-presentation';
import { fetchWayfindingMapPackage } from '@utils/wayfinding-map-package';
import { SpatialScene } from '@utils/spatial-scene';

import style from '@components/wb-app/wb-app.module.scss';

import runtimePackageUrl from '../../assets/campus.wbmap';
import { buildRouteGuidance } from '../../utils/route-guidance';
import type { RouteGuidanceLeg } from '../../utils/route-guidance';

interface WbAppProps {
	hostElement: HTMLElement;
}

const polygonPoints = (points: WayfindingPoint[]): string =>
	points.map((point: WayfindingPoint): string => `${point.x},${point.y}`).join(' ');

const doorEndpoints = (door: RuntimeDoor): [WayfindingPoint, WayfindingPoint] => {
	const radians = door.angle * Math.PI / 180;
	const dx = Math.cos(radians) * door.length / 2;
	const dy = Math.sin(radians) * door.length / 2;

	return [
		{ x: door.point.x - dx, y: door.point.y - dy },
		{ x: door.point.x + dx, y: door.point.y + dy }
	];
};

const mediaDimensions = (media: RuntimeMedia, asset?: RuntimeAsset): { height: number; width: number } => {
	const ratio: number = asset?.naturalWidth && asset.naturalHeight
		? asset.naturalWidth / asset.naturalHeight
		: media.width / media.height;

	return { height: media.height, width: media.height * ratio };
};

export default (props: WbAppProps): JSX.Element => {
	void props;
	const settings: Accessor<Settings> = useSettings();
	const [runtime, setRuntime] = createSignal<WayfindingRuntimeBundle>();
	const [runtimeError, setRuntimeError] = createSignal<string>();
	const [selectedId, setSelectedId] = createSignal<string>();
	const [selectedFloorId, setSelectedFloorId] = createSignal<string>();
	const [selectedLanguage, setSelectedLanguage] = createSignal<string>();
	const [selectedCategory, setSelectedCategory] = createSignal<string>('all');
	const [search, setSearch] = createSignal<string>('');
	const [showBrands, setShowBrands] = createSignal<boolean>(true);
	const [showLabels, setShowLabels] = createSignal<boolean>(true);
	const [showSymbols, setShowSymbols] = createSignal<boolean>(true);
	const [view, setView] = createSignal<'2d' | '3d'>(settings().defaultView);
	let previousDefaultView: '2d' | '3d' | undefined;
	let sceneHost: HTMLDivElement | undefined;
	let scene: SpatialScene | undefined;

	const presentationScene = createMemo(() => {
		const loaded = runtime();

		if (!loaded) return undefined;

		return buildPresentationScene({
			defaultLanguage: loaded.defaultLanguage,
			destinations: loaded.destinations.Destinations.rows,
			floors: loaded.floors,
			projectId: loaded.manifest.projectId
		}, {
			floorId: selectedFloorId(),
			language: selectedLanguage()
		});
	});
	const floor = createMemo((): RuntimeFloor | undefined => presentationScene()?.activeFloor);
	const destinations = createMemo((): RuntimeDestination[] => {
		return presentationScene()?.destinations ?? [];
	});
	const presentationLabels = createMemo((): RuntimeLabel[] =>
		layoutPresentationLabels(
			presentationScene()?.mapItems ?? [],
			1.4,
			undefined,
			floor() ? { height: floor()!.height, width: floor()!.width } : undefined
		)
			.map((placement): RuntimeLabel => ({
				color: '#17332d',
				floorId: placement.item.floorId,
				fontSize: 26,
				fontWeight: 700,
				id: `presentation-destination-label:${placement.item.destinationId}`,
				maxWidth: placement.item.geometry
					? Math.max(80, Math.max(
						...placement.item.geometry.map((point) => point.x)
					) - Math.min(
						...placement.item.geometry.map((point) => point.x)
					) - 36)
					: placement.width,
				outlineColor: '#ffffff',
				outlineWidth: 5,
				point: placement.item.geometry
					? placement.item.anchor
					: {
						x: placement.x + placement.width / 2,
						y: placement.y + placement.height * 0.72
					},
				text: placement.item.mapNumber
					? `${placement.item.mapNumber}  ${placement.item.name}`
					: placement.item.name,
				textAnchor: 'middle',
				type: 'label'
			}))
	);
	const presentationFloor = createMemo((): RuntimeFloor | undefined => {
		const activeFloor = floor();
		const supersededLabelIds = new Set(presentationScene()?.supersededLabelIds ?? []);

		return activeFloor
			? {
				...activeFloor,
				elements: [
					...activeFloor.elements.filter((element) => !supersededLabelIds.has(element.id)),
					...presentationLabels()
				]
			}
			: undefined;
	});
	const threeDimensionalReady = createMemo((): boolean => {
		const scene = presentationScene();

		return scene ? getPresentationThreeDimensionalReadiness(scene).ready : false;
	});
	const visibleDestinations = createMemo((): RuntimeDestination[] => {
		const floorId: string | undefined = floor()?.id;
		const query: string = search().trim().toLocaleLowerCase();
		const sourceDestinations: RuntimeDestination[] = runtime()?.destinations.Destinations.rows ?? [];

		return destinations().filter((destination): boolean => {
			const floorIds: string[] = presentationDestinationFloorIds(destination);

			if (floorId && floorIds.length > 0 && !floorIds.includes(floorId)) return false;

			if (selectedCategory() !== 'all' && destination.category !== selectedCategory()) return false;

			if (!query) return true;

			const source: RuntimeDestination | undefined = sourceDestinations.find(
				(candidate): boolean => candidate.id === destination.id
			);
			const searchableValues: Array<string | undefined> = [
				destination.name,
				destination.description,
				destination.category,
				destination.mapNumber,
				source?.name,
				source?.description,
				...Object.values(source?.translations ?? {}).flatMap((translation): Array<string | undefined> => [
					translation.name,
					translation.description
				])
			];

			return searchableValues.some((value): boolean => value?.toLocaleLowerCase().includes(query) ?? false);
		});
	});
	const graph = createMemo((): WayfindingGraph | undefined => {
		const graphDocument = runtime()?.graph;

		return graphDocument ? new WayfindingGraph(graphDocument) : undefined;
	});
	const selected = createMemo((): RuntimeDestination | undefined =>
		destinations().find((destination: RuntimeDestination): boolean => destination.id === selectedId())
	);
	const originNodeId = createMemo((): string | undefined => {
		const loaded = runtime();

		if (!loaded) return undefined;
		const originElement: RuntimeOrigin | undefined = loaded.floors
			.flatMap((candidate): RuntimeElement[] => candidate.elements)
			.find((element): element is RuntimeOrigin => element.type === 'origin');

		return loaded.graph.nodes.find((node: WayfindingNode): boolean =>
			node.semanticElementId === originElement?.id
		)?.id;
	});
	const route = createMemo((): WayfindingRouteResult | undefined => {
		const destinationId: string | undefined = selectedId();
		const destination = selected();
		const activeGraph: WayfindingGraph | undefined = graph();
		const startId: string | undefined = originNodeId();
		const node = destinationId && activeGraph ? activeGraph.locationNode(destinationId) : undefined;
		const startFloorId = startId ? runtime()?.graph.nodes.find((candidate): boolean => candidate.id === startId)?.levelId : undefined;
		const startFloor = runtime()?.floors.find((candidate): boolean => candidate.id === startFloorId);

		// The published floor owns its scale. Authored edge distances win; this only sizes the
		// pixel fallback, so a regenerated route network cannot silently report map units as metres.
		return destination?.routeable !== false && node && activeGraph && startId
			? activeGraph.route(startId, node.id, { mapRatio: startFloor?.unitsPerMeter })
			: undefined;
	});
	const routeJourney = createMemo((): RouteGuidanceLeg[] => {
		const result = route();
		const loaded = runtime();

		return result && loaded
			? buildRouteGuidance(result, loaded.floors, loaded.graph.edges, loaded.graph.nodes)
			: [];
	});
	const activeRouteLeg = createMemo((): RouteGuidanceLeg | undefined =>
		routeJourney().find((leg): boolean => leg.floorId === floor()?.id)
	);
	const activeRoutePoints = createMemo((): WayfindingPoint[] => {
		const floorId: string | undefined = floor()?.id;

		return route()?.path.filter((point): boolean => point.levelId === floorId) ?? [];
	});
	const backgroundAsset = createMemo((): RuntimeAsset | undefined =>
		runtime()?.assets.find((asset): boolean => asset.id === floor()?.backgroundAssetId)
	);
	const selectedPhotos = createMemo((): RuntimeAsset[] => {
		const photoIds: string[] = selected()?.photoAssetIds ?? [];

		return runtime()?.assets.filter((asset): boolean => photoIds.includes(asset.id)) ?? [];
	});
	const selectedTarget = createMemo((): WayfindingPoint | undefined => {
		const routeTarget = activeRoutePoints().at(-1);

		return routeTarget ?? presentationScene()?.mapItems.find(
			(item) => item.destinationId === selectedId()
		)?.anchor;
	});
	const themeStyle = createMemo((): JSX.CSSProperties => ({
		'--wb-spatial-accent': settings().accentColor,
		'--wb-spatial-background': settings().backgroundColor,
		'--wb-spatial-panel': settings().panelColor,
		'--wb-spatial-primary': settings().primaryTextColor,
		'--wb-spatial-route': runtime()?.defaults.route.color ?? settings().accentColor,
		'--wb-spatial-route-width': `${runtime()?.defaults.route.lineWidth ?? 11}px`,
		'--wb-spatial-secondary': settings().secondaryTextColor
	}));

	const chooseDestination = (destinationId: string): void => {
		const destination: RuntimeDestination | undefined = destinations().find((candidate): boolean => candidate.id === destinationId);
		const nextFloorId: string | undefined = destination && presentationDestinationFloorIds(destination)[0];

		if (nextFloorId) setSelectedFloorId(nextFloorId);
		setSelectedId(destinationId);
	};

	const reset = (): void => {
		setSelectedId(undefined);
		setSearch('');
		scene?.setRoute([]);
		scene?.selectDestination();
		scene?.resetCamera();
	};

	onMount((): void => {
		void fetchWayfindingMapPackage(runtimePackageUrl)
			.then((loadedRuntime): void => {
				setRuntime(loadedRuntime);
				setSelectedFloorId(loadedRuntime.floors[0]?.id);
				setSelectedLanguage(loadedRuntime.defaultLanguage);
			})
			.catch((error: unknown): void => {
				setRuntimeError(error instanceof Error ? error.message : 'The published map could not be loaded.');
			});
	});

	createEffect((): void => {
		const activeFloor: RuntimeFloor | undefined = presentationFloor();
		const loaded = runtime();

		if (!activeFloor || !loaded || !sceneHost || !threeDimensionalReady()) return;
		scene?.dispose();
		const nextScene = new SpatialScene(sceneHost, activeFloor, {
			accentColor: (): string => settings().accentColor,
			assets: loaded.assets,
			motionEnabled: (): boolean => settings().motionPreset !== 'off',
			onSelectDestination: chooseDestination,
			routeAnimationSpeed: (): number => loaded.defaults.route.animationSpeed,
			routeColor: (): string => loaded.defaults.route.color || settings().accentColor,
			routeWidth: (): number => loaded.defaults.route.lineWidth
		});
		scene = nextScene;
		onCleanup((): void => nextScene.dispose());
	});

	createEffect((): void => {
		const destinationId: string | undefined = selectedId();
		scene?.selectDestination(destinationId);
		scene?.setRoute(activeRoutePoints());
	});

	createEffect((): void => {
		const nextDefaultView: '2d' | '3d' = settings().defaultView;

		if (!runtime()) return;

		if (nextDefaultView === previousDefaultView) return;
		previousDefaultView = nextDefaultView;
		setView(nextDefaultView === '3d' && !threeDimensionalReady() ? '2d' : nextDefaultView);
	});

	createEffect((): void => {
		if (runtime() && view() === '3d' && !threeDimensionalReady()) setView('2d');
	});

	return (
		<div
			class={`wb-spatial-wayfinding-root ${style['wb-app']}`}
			data-preview-id={runtime() ? 'spatial-wayfinding-root' : undefined}
			data-runtime-project={runtime()?.manifest.projectId ?? ''}
			data-runtime-source="wbmap"
			data-selected-destination={selectedId() ?? ''}
			data-view={view()}
			data-motion={settings().motionPreset}
			style={themeStyle()}
		>
			<header class="wb-spatial-wayfinding-header">
				<div class="wb-spatial-wayfinding-brand">
					<span>LIVE CAMPUS WAYFINDING</span>
					<strong>{settings().title}</strong>
				</div>
				<div class="wb-spatial-wayfinding-header-actions">
					<Show when={settings().showViewSwitcher}>
						<div class="wb-spatial-wayfinding-view-switcher" role="group" aria-label="Map view">
							<button type="button" classList={{ 'wb-spatial-wayfinding-active': view() === '2d' }} onClick={(): void => { setView('2d'); }}>2D</button>
							<Show when={threeDimensionalReady()}>
								<button type="button" classList={{ 'wb-spatial-wayfinding-active': view() === '3d' }} onClick={(): void => { setView('3d'); }}>3D</button>
							</Show>
						</div>
					</Show>
					<button type="button" class="wb-spatial-wayfinding-reset" aria-label="Reset view" onClick={reset}>Reset</button>
				</div>
			</header>
			<Show
				when={presentationFloor()}
				fallback={
					<main class="wb-spatial-wayfinding-loading" role={runtimeError() ? 'alert' : 'status'}>
						<strong>{runtimeError() ? 'Map unavailable' : 'Loading campus map'}</strong>
						<span>{runtimeError() ?? 'Opening the published wayfinding package...'}</span>
					</main>
				}
			>
				{(activeFloor: Accessor<RuntimeFloor>): JSX.Element => (
					<main class="wb-spatial-wayfinding-main">
						<section class="wb-spatial-wayfinding-map" aria-label="Campus map">
							<div ref={sceneHost} class="wb-spatial-wayfinding-scene" classList={{ 'wb-spatial-wayfinding-hidden': view() !== '3d' }} />
							<svg
								class="wb-spatial-wayfinding-flat-map"
								classList={{ 'wb-spatial-wayfinding-hidden': view() !== '2d' }}
								viewBox={`0 0 ${activeFloor().width} ${activeFloor().height}`}
								role="img"
								aria-label="Two-dimensional campus map"
							>
								<defs>
									<marker
										id="wb-spatial-wayfinding-route-arrow"
										viewBox="0 0 10 10"
										refX="8"
										refY="5"
										markerWidth="24"
										markerHeight="24"
										markerUnits="userSpaceOnUse"
										orient="auto-start-reverse"
									>
										<path d="M 0 0 L 10 5 L 0 10 z" class="wb-spatial-wayfinding-route-arrow" />
									</marker>
								</defs>
								<rect x="0" y="0" width={activeFloor().width} height={activeFloor().height} class="wb-spatial-wayfinding-floor" />
								<Show when={backgroundAsset()}>
									{(asset: Accessor<RuntimeAsset>): JSX.Element => (
										<image href={asset().dataUrl} x="0" y="0" width={activeFloor().width} height={activeFloor().height} preserveAspectRatio="xMidYMid meet" />
									)}
								</Show>
								<For each={activeFloor().elements.filter((element): element is RuntimePolygon =>
									element.type === 'location' || element.type === 'obstacle' || element.type === 'walkable'
								)}>
									{(polygon: RuntimePolygon): JSX.Element => (
										<polygon
											class="wb-spatial-wayfinding-zone"
											classList={{
												'wb-spatial-wayfinding-destination-zone': polygon.type === 'location' && Boolean(polygon.destinationId),
												'wb-spatial-wayfinding-location': polygon.type === 'location',
												'wb-spatial-wayfinding-obstacle': polygon.type === 'obstacle',
												'wb-spatial-wayfinding-selected': polygon.destinationId === selectedId(),
												'wb-spatial-wayfinding-walkable': polygon.type === 'walkable'
											}}
											fill={polygon.presentation?.fillColor}
											fill-opacity={polygon.presentation?.fillOpacity}
											points={polygonPoints(polygon.geometry)}
											onClick={(): void => { if (polygon.destinationId) chooseDestination(polygon.destinationId); }}
										/>
									)}
								</For>
								<For each={activeFloor().elements.filter((element): element is RuntimeDoor => element.type === 'door')}>
									{(door: RuntimeDoor): JSX.Element => {
										const [start, end] = doorEndpoints(door);

										return (
											<g class="wb-spatial-wayfinding-door" aria-label="Doorway">
												<line
													class="wb-spatial-wayfinding-door-opening"
													x1={start.x}
													y1={start.y}
													x2={end.x}
													y2={end.y}
												/>
												<line
													class="wb-spatial-wayfinding-door-threshold"
													x1={start.x}
													y1={start.y}
													x2={end.x}
													y2={end.y}
												/>
											</g>
										);
									}}
								</For>
								<For each={activeFloor().elements.filter((element): element is RuntimeTransition => element.type === 'transition')}>
									{(transition: RuntimeTransition): JSX.Element => (
										<g
											class="wb-spatial-wayfinding-transition"
											aria-label={transition.label}
											transform={`translate(${transition.point.x} ${transition.point.y})`}
										>
											<circle r="22" />
											<text y="1">{transition.kind === 'elevator' ? '↕' : transition.kind === 'stairs' ? '↗' : '↑'}</text>
										</g>
									)}
								</For>
								<Show when={activeRoutePoints().length > 1}>
									<polyline class="wb-spatial-wayfinding-route-shadow" points={polygonPoints(activeRoutePoints())} />
									<polyline
										class="wb-spatial-wayfinding-route"
										marker-end="url(#wb-spatial-wayfinding-route-arrow)"
										points={polygonPoints(activeRoutePoints())}
									/>
									<polyline class="wb-spatial-wayfinding-route-flow" points={polygonPoints(activeRoutePoints())} />
									<circle
										class="wb-spatial-wayfinding-route-start"
										cx={activeRoutePoints()[0].x}
										cy={activeRoutePoints()[0].y}
										r="10"
									/>
								</Show>
								<Show when={showLabels()}>
									<For each={activeFloor().elements.filter((element): element is RuntimeLabel =>
										element.type === 'label'
										&& !element.id.startsWith('presentation-destination-label:')
									)}>
										{(label: RuntimeLabel): JSX.Element => (
											<text
												x={label.point.x}
												y={label.point.y}
												text-anchor={label.textAnchor ?? 'middle'}
												class="wb-spatial-wayfinding-map-label"
												fill={label.color}
												font-family={label.fontFamily}
												font-size={label.fontSize?.toString()}
												font-weight={label.fontWeight}
												stroke={label.outlineColor}
												stroke-width={label.outlineWidth}
												data-preview-allow-overflow
											>
												{label.text}
											</text>
										)}
									</For>
									<For each={presentationLabels()}>
										{(label: RuntimeLabel): JSX.Element => (
											<text
												x={label.point.x}
												y={label.point.y}
												text-anchor={label.textAnchor}
												class="wb-spatial-wayfinding-map-label wb-spatial-wayfinding-destination-label"
												fill={label.color}
												font-size={label.fontSize?.toString()}
												font-weight={label.fontWeight}
												stroke={label.outlineColor}
												stroke-width={label.outlineWidth}
												textLength={
													label.maxWidth
													&& label.text.length * (label.fontSize ?? 26) * 0.58 > label.maxWidth
														? label.maxWidth
														: undefined
												}
												lengthAdjust="spacingAndGlyphs"
												data-destination-label={label.id.replace('presentation-destination-label:', '')}
												data-preview-allow-overflow
											>
												{label.text}
											</text>
										)}
									</For>
								</Show>
								<For each={activeFloor().elements.filter((element): element is RuntimeMedia => element.type === 'icon' || element.type === 'logo')}>
									{(media: RuntimeMedia): JSX.Element => {
										const asset: RuntimeAsset | undefined = runtime()?.assets.find((candidate): boolean => candidate.id === media.assetId);
										const dimensions = mediaDimensions(media, asset);

										return (
											<Show when={asset && (media.type === 'icon' ? showSymbols() : showBrands())}>
												<image
													class="wb-spatial-wayfinding-media"
													classList={{ 'wb-spatial-wayfinding-selected-media': media.destinationId === selectedId() }}
													data-media-role={media.type === 'icon' ? 'symbol' : 'brand'}
													href={asset!.dataUrl}
													x={media.point.x - dimensions.width / 2}
													y={media.point.y - dimensions.height / 2}
													width={dimensions.width}
													height={dimensions.height}
													preserveAspectRatio="xMidYMid meet"
													onClick={(): void => { if (media.destinationId) chooseDestination(media.destinationId); }}
												/>
											</Show>
										);
									}}
								</For>
								<For each={activeFloor().elements.filter((element): element is RuntimePointOfInterest => element.type === 'poi')}>
									{(poi: RuntimePointOfInterest): JSX.Element => (
										<g
											class="wb-spatial-wayfinding-poi"
											classList={{ 'wb-spatial-wayfinding-selected-poi': poi.destinationId === selectedId() }}
											onClick={(): void => { if (poi.destinationId) chooseDestination(poi.destinationId); }}
										>
											<circle cx={poi.point.x} cy={poi.point.y} r="14" />
											<circle cx={poi.point.x} cy={poi.point.y} r="5" />
										</g>
									)}
								</For>
								<For each={activeFloor().elements.filter((element): element is RuntimeOrigin => element.type === 'origin')}>
									{(origin: RuntimeOrigin): JSX.Element => (
										<g class="wb-spatial-wayfinding-origin">
											<circle cx={origin.point.x} cy={origin.point.y} r="24" />
											<circle cx={origin.point.x} cy={origin.point.y} r="9" />
										</g>
									)}
								</For>
								<Show when={selectedTarget()}>
									{(target: Accessor<WayfindingPoint>): JSX.Element => (
										<g class="wb-spatial-wayfinding-target">
											<circle class="wb-spatial-wayfinding-target-pulse" cx={target().x} cy={target().y} r="28" />
											<circle class="wb-spatial-wayfinding-target-core" cx={target().x} cy={target().y} r="9" />
										</g>
									)}
								</Show>
							</svg>
							<div class="wb-spatial-wayfinding-map-caption">
								<span>{activeFloor().name.toUpperCase()}</span>
								<strong>{view() === '3d' ? 'Drag to rotate. Pinch or wheel to zoom.' : 'Tap a destination for details and directions.'}</strong>
							</div>
						</section>
						<aside
							class="wb-spatial-wayfinding-directory"
							classList={{ 'wb-spatial-wayfinding-has-selection': Boolean(selected()) }}
						>
							<div class="wb-spatial-wayfinding-directory-heading">
								<span>FIND A DESTINATION</span>
								<h2>Where would you like to go?</h2>
							</div>
							<div class="wb-spatial-wayfinding-filters">
								<input
									type="search"
									value={search()}
									placeholder="Search destinations"
									aria-label="Search destinations"
									onInput={(event): void => { setSearch(event.currentTarget.value); }}
								/>
								<div>
									<select value={selectedFloorId()} aria-label="Floor" onChange={(event): void => { setSelectedFloorId(event.currentTarget.value); }}>
										<For each={runtime()?.floors ?? []}>{(item): JSX.Element => <option value={item.id}>{item.name}</option>}</For>
									</select>
									<select value={selectedCategory()} aria-label="Category" onChange={(event): void => { setSelectedCategory(event.currentTarget.value); }}>
										<option value="all">All categories</option>
										<For each={runtime()?.categories ?? []}>{(category): JSX.Element => <option value={category}>{category}</option>}</For>
									</select>
								</div>
								<Show when={(runtime()?.languages.length ?? 0) > 1}>
									<select value={selectedLanguage()} aria-label="Language" onChange={(event): void => { setSelectedLanguage(event.currentTarget.value); }}>
										<For each={runtime()?.languages ?? []}>{(language): JSX.Element => <option value={language.code}>{language.label}</option>}</For>
									</select>
								</Show>
								<div class="wb-spatial-wayfinding-layers" role="group" aria-label="Map layers">
									<button type="button" classList={{ 'wb-spatial-wayfinding-active': showLabels() }} onClick={(): void => { setShowLabels(!showLabels()); }}>Labels</button>
									<button type="button" classList={{ 'wb-spatial-wayfinding-active': showSymbols() }} onClick={(): void => { setShowSymbols(!showSymbols()); }}>Symbols</button>
									<button type="button" classList={{ 'wb-spatial-wayfinding-active': showBrands() }} onClick={(): void => { setShowBrands(!showBrands()); }}>Brands</button>
								</div>
							</div>
							<div class="wb-spatial-wayfinding-destinations" data-preview-allow-overflow>
								<For each={visibleDestinations()} fallback={<div class="wb-spatial-wayfinding-no-results">No matching places</div>}>
									{(destination: RuntimeDestination): JSX.Element => (
										<button
											type="button"
											class="wb-spatial-wayfinding-destination"
											classList={{ 'wb-spatial-wayfinding-selected': selectedId() === destination.id }}
											onClick={(): void => chooseDestination(destination.id)}
										>
											<span>{destination.category ?? 'Destination'}{destination.mapNumber ? ` / ${destination.mapNumber}` : ''}</span>
											<strong>{destination.name}</strong>
											<Show when={destination.status}><em>{destination.status}</em></Show>
										</button>
									)}
								</For>
							</div>
							<Show when={selected()} fallback={<div class="wb-spatial-wayfinding-idle"><strong>Choose a place</strong><span>Search the directory or tap a marked destination on the map.</span></div>}>
								{(destination: Accessor<RuntimeDestination>): JSX.Element => (
									<div class="wb-spatial-wayfinding-details">
										<Show when={selectedPhotos()[0]}>
											{(photo: Accessor<RuntimeAsset>): JSX.Element => <img src={photo().dataUrl} alt="" />}
										</Show>
										<span>{destination().category ?? 'Destination'}{destination().floor ? ` / ${destination().floor}` : ''}</span>
										<h3>{destination().name}</h3>
										<Show when={destination().status}><strong class="wb-spatial-wayfinding-status">{destination().status}</strong></Show>
										<Show when={destination().description}><p>{destination().description}</p></Show>
										<dl>
											<Show when={destination().hours}><div><dt>Hours</dt><dd>{destination().hours}</dd></div></Show>
											<Show when={destination().phone}><div><dt>Phone</dt><dd>{destination().phone}</dd></div></Show>
											<Show when={destination().website}><div><dt>Website</dt><dd>{destination().website}</dd></div></Show>
										</dl>
										<Show
											when={route()}
											fallback={
												<div class="wb-spatial-wayfinding-route-unavailable" role="status">
													<strong>Directions unavailable</strong>
													<span>This destination is not connected to the published route network.</span>
												</div>
											}
										>
											{(activeRoute: Accessor<WayfindingRouteResult>): JSX.Element => (
												<>
													<Show when={routeJourney().length > 1}>
														<div class="wb-spatial-wayfinding-route-floors" role="group" aria-label="Route floors">
															<For each={routeJourney()}>
																{(leg: RouteGuidanceLeg, index): JSX.Element => (
																	<button
																		type="button"
																		classList={{ 'wb-spatial-wayfinding-active': leg.floorId === floor()?.id }}
																		onClick={(): void => { setSelectedFloorId(leg.floorId); }}
																	>
																		<span>{index() + 1}</span>
																		<strong>{leg.floorName}</strong>
																	</button>
																)}
															</For>
														</div>
													</Show>
													<Show when={activeRouteLeg()}>
														{(leg: Accessor<RouteGuidanceLeg>): JSX.Element => (
															<ol class="wb-spatial-wayfinding-instructions" aria-label={`Directions on ${leg().floorName}`}>
																<For each={leg().instructions}>
																	{(instruction, index): JSX.Element => (
																		<li class={`wb-spatial-wayfinding-instruction-${instruction.kind}`}>
																			<span>{index() + 1}</span>
																			<strong>{instruction.text}</strong>
																		</li>
																	)}
																</For>
															</ol>
														)}
													</Show>
													<div class="wb-spatial-wayfinding-route-summary">
														<strong>{activeRoute().walkingDistance} m</strong>
														<span>Approx. {Math.max(1, Math.ceil(activeRoute().walkingSeconds / 60))} min walk</span>
													</div>
												</>
											)}
										</Show>
									</div>
								)}
							</Show>
						</aside>
					</main>
				)}
			</Show>
		</div>
	);
};
