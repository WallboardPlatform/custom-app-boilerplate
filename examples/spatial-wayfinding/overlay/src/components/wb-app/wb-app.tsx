import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import type { Accessor, JSX } from 'solid-js';

import { useSettings } from '@hooks/system/useSettings';
import type { Settings } from '@interfaces/application.interface';
import type {
	RuntimeAsset,
	RuntimeDestination,
	RuntimeDoor,
	RuntimeElement,
	RuntimeLevel,
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
import type { WayfindingBuilding } from '@utils/wayfinding-contract';
import {
	buildPresentationScene,
	getPresentationThreeDimensionalReadiness,
	layoutPresentationLabels,
	presentationDestinationLevelIds
} from '@utils/wayfinding-presentation';
import { fetchWayfindingMapPackage } from '@utils/wayfinding-map-package';
import { SpatialScene } from '@utils/spatial-scene';

import style from '@components/wb-app/wb-app.module.scss';

import legacyRuntimePackageUrl from '../../assets/campus.wbmap';
import multiBuildingRuntimePackageUrl from '../../assets/multi-building-campus.wbmap';
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

const markerDimensions = (asset: RuntimeAsset, maximumSide: number): { height: number; width: number } => {
	const ratio: number = Math.max(
		0.2,
		Math.min(5, (asset.naturalWidth ?? 1) / Math.max(1, asset.naturalHeight ?? 1))
	);

	return ratio >= 1
		? { height: maximumSide / ratio, width: maximumSide }
		: { height: maximumSide, width: maximumSide * ratio };
};

const runtimeSearchParams = new URLSearchParams(window.location.search);
const runtimePackageUrl = runtimeSearchParams.get('venue') === 'multi-building'
	|| runtimeSearchParams.get('scenario')?.startsWith('multi-building')
	? multiBuildingRuntimePackageUrl
	: legacyRuntimePackageUrl;

export default (props: WbAppProps): JSX.Element => {
	void props;
	const settings: Accessor<Settings> = useSettings();
	const [runtime, setRuntime] = createSignal<WayfindingRuntimeBundle>();
	const [runtimeError, setRuntimeError] = createSignal<string>();
	const [selectedId, setSelectedId] = createSignal<string>();
	const [selectedBuildingId, setSelectedBuildingId] = createSignal<string>();
	const [directionsBuildingId, setDirectionsBuildingId] = createSignal<string>();
	const [selectedFloorId, setSelectedFloorId] = createSignal<string>();
	const [selectedLanguage, setSelectedLanguage] = createSignal<string>();
	const [selectedCategory, setSelectedCategory] = createSignal<string>('all');
	const [search, setSearch] = createSignal<string>('');
	const [showBrands, setShowBrands] = createSignal<boolean>(true);
	const [showLabels, setShowLabels] = createSignal<boolean>(true);
	const [showSymbols, setShowSymbols] = createSignal<boolean>(true);
	const [view, setView] = createSignal<'2d' | '3d'>(settings().defaultView);
	const [overviewMode, setOverviewMode] = createSignal<'atlas-2d' | 'exploded-3d' | 'site'>('site');
	const [journeyIndex, setJourneyIndex] = createSignal<number>(0);
	let previousDefaultView: '2d' | '3d' | undefined;
	let sceneHost: HTMLDivElement | undefined;
	let scene: SpatialScene | undefined;

	const presentationScene = createMemo(() => {
		const loaded = runtime();

		if (!loaded) return undefined;

		return buildPresentationScene({
			defaultLanguage: loaded.defaultLanguage,
			destinations: loaded.destinations.Destinations.rows,
			levels: loaded.levels,
			projectId: loaded.manifest.projectId
		}, {
			levelId: selectedFloorId(),
			language: selectedLanguage()
		});
	});
	const floor = createMemo((): RuntimeLevel | undefined => presentationScene()?.activeLevel);
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
				levelId: placement.item.levelId,
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
	const presentationFloor = createMemo((): RuntimeLevel | undefined => {
		const activeLevel = floor();
		const supersededLabelIds = new Set(presentationScene()?.supersededLabelIds ?? []);

		return activeLevel
			? {
				...activeLevel,
				elements: [
					...activeLevel.elements.filter((element) => !supersededLabelIds.has(element.id)),
					...presentationLabels()
				]
			}
			: undefined;
	});
	const threeDimensionalReady = createMemo((): boolean => {
		const scene = presentationScene();

		return scene ? getPresentationThreeDimensionalReadiness(scene).ready : false;
	});
	const explodedThreeDimensionalReady = createMemo((): boolean => {
		const loaded = runtime();
		const siteLevelId = loaded?.siteLevelId;

		if (!loaded || !siteLevelId) return false;
		const scene = buildPresentationScene({
			defaultLanguage: loaded.defaultLanguage,
			destinations: loaded.destinations.Destinations.rows,
			levels: loaded.levels,
			projectId: loaded.manifest.projectId
		}, {
			language: selectedLanguage(),
			levelId: siteLevelId
		});

		return getPresentationThreeDimensionalReadiness(scene).ready;
	});
	const visibleDestinations = createMemo((): RuntimeDestination[] => {
		const levelId: string | undefined = floor()?.id;
		const query: string = search().trim().toLocaleLowerCase();
		const sourceDestinations: RuntimeDestination[] = runtime()?.destinations.Destinations.rows ?? [];

		return destinations().filter((destination): boolean => {
			const levelIds: string[] = presentationDestinationLevelIds(destination);

			if ((runtime()?.buildings.length ?? 0) === 0 && levelId && levelIds.length > 0 && !levelIds.includes(levelId)) return false;

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
	const visibleBuildings = createMemo((): WayfindingBuilding[] => {
		const query = search().trim().toLocaleLowerCase();

		return (runtime()?.buildings ?? []).filter((building): boolean => {
			if (selectedCategory() !== 'all' && building.category !== selectedCategory()) return false;
			if (!query) return true;

			return [building.name, building.description, building.category]
				.some((value): boolean => value?.toLocaleLowerCase().includes(query) ?? false);
		});
	});
	const graph = createMemo((): WayfindingGraph | undefined => {
		const graphDocument = runtime()?.graph;

		return graphDocument ? new WayfindingGraph(graphDocument) : undefined;
	});
	const selected = createMemo((): RuntimeDestination | undefined =>
		destinations().find((destination: RuntimeDestination): boolean => destination.id === selectedId())
	);
	const selectedBuilding = createMemo((): WayfindingBuilding | undefined =>
		runtime()?.buildings.find((building): boolean => building.id === selectedBuildingId())
	);
	const originNodeId = createMemo((): string | undefined => {
		const loaded = runtime();

		if (!loaded) return undefined;
		const originElement: RuntimeOrigin | undefined = loaded.levels
			.flatMap((candidate): RuntimeElement[] => candidate.elements)
			.find((element): element is RuntimeOrigin => element.type === 'origin');

		return loaded.graph.nodes.find((node: WayfindingNode): boolean =>
			node.semanticElementId === originElement?.id
		)?.id;
	});
	const buildingRouteNodeId = createMemo((): string | undefined => {
		const loaded = runtime();
		const building = loaded?.buildings.find((candidate): boolean => candidate.id === directionsBuildingId());

		if (!loaded || !building) return undefined;
		const preferredConnector = building.preferredEntranceConnectorId
			? loaded.connectors.find((connector): boolean => connector.id === building.preferredEntranceConnectorId)
			: undefined;
		const siteEndpoint = preferredConnector?.endpoints.find((endpoint): boolean => endpoint.role === 'site')
			?? preferredConnector?.endpoints.find((endpoint): boolean => endpoint.levelId === building.siteLevelId);
		const preferredExternalEntranceId = building.preferredExternalEntranceId
			?? building.externalEntrances?.find((entrance): boolean => entrance.accessible)?.id
			?? building.externalEntrances?.[0]?.id;
		const semanticElementIds = [
			siteEndpoint?.id,
			preferredExternalEntranceId
		].filter((value): value is string => Boolean(value));

		return loaded.graph.nodes.find((node): boolean =>
			Boolean(node.semanticElementId && semanticElementIds.includes(node.semanticElementId))
		)?.id;
	});
	const route = createMemo((): WayfindingRouteResult | undefined => {
		const destinationId: string | undefined = selectedId();
		const destination = selected();
		const activeGraph: WayfindingGraph | undefined = graph();
		const startId: string | undefined = originNodeId();
		const node = destinationId && activeGraph ? activeGraph.locationNode(destinationId) : undefined;
		const targetNodeId = node?.id ?? buildingRouteNodeId();
		const startFloorId = startId ? runtime()?.graph.nodes.find((candidate): boolean => candidate.id === startId)?.levelId : undefined;
		const startFloor = runtime()?.levels.find((candidate): boolean => candidate.id === startFloorId);

		// The published floor owns its scale. Authored edge distances win; this only sizes the
		// pixel fallback, so a regenerated route network cannot silently report map units as metres.
		return (destination?.routeable !== false || Boolean(directionsBuildingId())) && targetNodeId && activeGraph && startId
			? activeGraph.route(startId, targetNodeId, { mapRatio: startFloor?.unitsPerMeter })
			: undefined;
	});
	const routeJourney = createMemo((): RouteGuidanceLeg[] => {
		const result = route();
		const loaded = runtime();

		return result && loaded
			? buildRouteGuidance(result, loaded.levels, loaded.graph.edges, loaded.graph.nodes, {
				buildings: loaded.buildings,
				connectors: loaded.connectors
			})
			: [];
	});
	const activeRouteLeg = createMemo((): RouteGuidanceLeg | undefined =>
		routeJourney().find((leg): boolean => leg.levelId === floor()?.id)
	);
	const overviewRoutes = createMemo((): Array<{ levelId: string; points: WayfindingPoint[] }> =>
		(runtime()?.levels ?? []).flatMap((level): Array<{ levelId: string; points: WayfindingPoint[] }> => {
			const points = route()?.path.filter((point): boolean => point.levelId === level.id) ?? [];

			return points.length > 1 ? [{ levelId: level.id, points }] : [];
		})
	);
	const relevantOverviewLevels = createMemo((): RuntimeLevel[] => {
		const loaded = runtime();

		if (!loaded) return [];
		const relevantIds = new Set(routeJourney().map((leg): string => leg.levelId));
		const buildingId = selectedBuildingId()
			?? loaded.levels.find((level): boolean => relevantIds.has(level.id) && Boolean(level.buildingId))?.buildingId;

		if (selectedBuildingId() && buildingId) {
			for (const level of loaded.levels) if (level.buildingId === buildingId) relevantIds.add(level.id);
		}
		if (loaded.siteLevelId) relevantIds.add(loaded.siteLevelId);

		return loaded.levels.filter((level): boolean => relevantIds.has(level.id));
	});
	const activeRoutePoints = createMemo((): WayfindingPoint[] => {
		const levelId: string | undefined = floor()?.id;

		return route()?.path.filter((point): boolean => point.levelId === levelId) ?? [];
	});
	const backgroundAsset = createMemo((): RuntimeAsset | undefined =>
		runtime()?.assets.find((asset): boolean => asset.id === floor()?.backgroundAssetId)
	);
	const originMarkerAsset = createMemo((): RuntimeAsset | undefined => {
		const loaded = runtime();
		const markerAssetId: string | undefined = loaded?.defaults.origin.markerAssetId;

		return markerAssetId
			? loaded?.assets.find((asset): boolean => asset.id === markerAssetId && asset.kind === 'symbol')
			: undefined;
	});
	const originMarkerDimensions = createMemo((): { height: number; width: number } | undefined => {
		const asset = originMarkerAsset();

		return asset
			? markerDimensions(asset, runtime()?.defaults.origin.markerSize2d ?? 28)
			: undefined;
	});
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
		'--wb-spatial-origin': runtime()?.defaults.origin.color ?? settings().accentColor,
		'--wb-spatial-panel': settings().panelColor,
		'--wb-spatial-primary': settings().primaryTextColor,
		'--wb-spatial-route': runtime()?.defaults.route.color ?? settings().accentColor,
		'--wb-spatial-route-width': `${runtime()?.defaults.route.lineWidth ?? 11}px`,
		'--wb-spatial-secondary': settings().secondaryTextColor
	}));

	const chooseDestination = (destinationId: string): void => {
		const destination: RuntimeDestination | undefined = destinations().find((candidate): boolean => candidate.id === destinationId);
		const nextFloorId: string | undefined = destination && presentationDestinationLevelIds(destination)[0];

		if (nextFloorId) setSelectedFloorId(nextFloorId);
		setSelectedBuildingId(undefined);
		setDirectionsBuildingId(undefined);
		setSelectedId(destinationId);
		setJourneyIndex(0);

		if (runtime()?.presentation.enabledOverviewModes.includes('atlas-2d')) setOverviewMode('atlas-2d');
	};

	const chooseBuilding = (buildingId: string): void => {
		const loaded = runtime();
		const building = loaded?.buildings.find((candidate): boolean => candidate.id === buildingId);

		if (!loaded || !building) return;
		setSelectedId(undefined);
		setDirectionsBuildingId(undefined);
		setSelectedBuildingId(buildingId);
		setJourneyIndex(0);

		if (loaded.presentation.buildingTapBehavior === 'enter-immediately' && building.defaultLevelId) {
			setSelectedFloorId(building.defaultLevelId);
			setOverviewMode('site');
		} else {
			setSelectedFloorId(loaded.siteLevelId ?? building.siteLevelId);
		}
	};

	const showBuildingDirections = (): void => {
		const buildingId = selectedBuildingId();

		if (!buildingId) return;
		setDirectionsBuildingId(buildingId);
		setJourneyIndex(0);

		if (runtime()?.presentation.enabledOverviewModes.includes('atlas-2d')) setOverviewMode('atlas-2d');
	};

	const enterBuilding = (): void => {
		const building = selectedBuilding();

		if (!building?.defaultLevelId) return;
		setSelectedFloorId(building.defaultLevelId);
		setOverviewMode('site');
	};

	const showJourneyStep = (index: number): void => {
		const legs = routeJourney();

		if (legs.length === 0) return;
		const boundedIndex = Math.max(0, Math.min(index, legs.length - 1));
		setJourneyIndex(boundedIndex);
		setSelectedFloorId(legs[boundedIndex].levelId);
		setOverviewMode('site');
	};

	const showJourneyOverview = (): void => {
		const loaded = runtime();

		if (loaded?.presentation.enabledOverviewModes.includes('exploded-3d')) setOverviewMode('exploded-3d');
		else if (loaded?.presentation.enabledOverviewModes.includes('atlas-2d')) setOverviewMode('atlas-2d');
	};

	const reset = (): void => {
		setSelectedId(undefined);
		setSelectedBuildingId(undefined);
		setDirectionsBuildingId(undefined);
		setSearch('');
		setJourneyIndex(0);
		setOverviewMode('site');
		setSelectedFloorId(runtime()?.siteLevelId ?? runtime()?.levels[0]?.id);
		scene?.setRoute([]);
		scene?.selectDestination();
		scene?.selectBuilding();
		scene?.resetCamera();
	};

	onMount((): void => {
		void fetchWayfindingMapPackage(runtimePackageUrl)
			.then((loadedRuntime): void => {
				setRuntime(loadedRuntime);
				setSelectedFloorId(loadedRuntime.siteLevelId ?? loadedRuntime.levels[0]?.id);
				setSelectedLanguage(loadedRuntime.defaultLanguage);
			})
			.catch((error: unknown): void => {
				setRuntimeError(error instanceof Error ? error.message : 'The published map could not be loaded.');
			});
	});

	createEffect((): void => {
		const loaded = runtime();
		const exploded = overviewMode() === 'exploded-3d';
		const activeLevel: RuntimeLevel | undefined = exploded
			? loaded?.levels.find((level): boolean => level.id === loaded.siteLevelId)
			: presentationFloor();

		if (
			!activeLevel
			|| !loaded
			|| !sceneHost
			|| (exploded ? !explodedThreeDimensionalReady() : !threeDimensionalReady())
		) return;
		scene?.dispose();
		const nextScene = new SpatialScene(sceneHost, activeLevel, {
			accentColor: (): string => settings().accentColor,
			assets: loaded.assets,
			motionEnabled: (): boolean => settings().motionPreset !== 'off',
			onSelectBuilding: chooseBuilding,
			onSelectDestination: chooseDestination,
			originDefaults: loaded.defaults.origin,
			overview: exploded ? {
				activeBuildingId: selectedBuildingId(),
				activeLevelId: selectedFloorId(),
				routes: overviewRoutes(),
				runtime: loaded
			} : undefined,
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
		scene?.selectBuilding(selectedBuildingId());
		scene?.setRoute(overviewMode() === 'exploded-3d' ? [] : activeRoutePoints());
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
			data-overview-mode={overviewMode()}
			data-selected-building={selectedBuildingId() ?? ''}
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
					<Show when={(runtime()?.buildings.length ?? 0) > 0}>
						<div class="wb-spatial-wayfinding-overview-switcher" role="group" aria-label="Venue overview">
							<button type="button" classList={{ 'wb-spatial-wayfinding-active': overviewMode() === 'site' }} onClick={(): void => { setOverviewMode('site'); }}>Map</button>
							<Show when={runtime()?.presentation.enabledOverviewModes.includes('atlas-2d')}>
								<button type="button" classList={{ 'wb-spatial-wayfinding-active': overviewMode() === 'atlas-2d' }} onClick={(): void => { setOverviewMode('atlas-2d'); }}>Atlas</button>
							</Show>
							<Show when={runtime()?.presentation.enabledOverviewModes.includes('exploded-3d')}>
								<button type="button" classList={{ 'wb-spatial-wayfinding-active': overviewMode() === 'exploded-3d' }} onClick={(): void => { setOverviewMode('exploded-3d'); }}>Exploded 3D</button>
							</Show>
						</div>
					</Show>
					<Show when={settings().showViewSwitcher}>
						<div class="wb-spatial-wayfinding-view-switcher" role="group" aria-label="Map view" classList={{ 'wb-spatial-wayfinding-hidden': overviewMode() !== 'site' }}>
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
				{(activeLevel: Accessor<RuntimeLevel>): JSX.Element => (
					<main class="wb-spatial-wayfinding-main">
						<section class="wb-spatial-wayfinding-map" aria-label="Campus map">
							<div ref={sceneHost} class="wb-spatial-wayfinding-scene" classList={{
								'wb-spatial-wayfinding-hidden': overviewMode() === 'atlas-2d' || (overviewMode() === 'site' && view() !== '3d')
							}} />
							<svg
								class="wb-spatial-wayfinding-flat-map"
								classList={{ 'wb-spatial-wayfinding-hidden': overviewMode() !== 'site' || view() !== '2d' }}
								viewBox={`0 0 ${activeLevel().width} ${activeLevel().height}`}
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
								<rect x="0" y="0" width={activeLevel().width} height={activeLevel().height} class="wb-spatial-wayfinding-floor" />
								<Show when={backgroundAsset()}>
									{(asset: Accessor<RuntimeAsset>): JSX.Element => (
										<image href={asset().dataUrl} x="0" y="0" width={activeLevel().width} height={activeLevel().height} preserveAspectRatio="xMidYMid meet" />
									)}
								</Show>
								<For each={activeLevel().elements.filter((element): element is RuntimePolygon =>
									element.type === 'building' || element.type === 'location' || element.type === 'obstacle' || element.type === 'walkable'
								)}>
									{(polygon: RuntimePolygon): JSX.Element => (
										<polygon
											class="wb-spatial-wayfinding-zone"
											classList={{
												'wb-spatial-wayfinding-building': polygon.type === 'building',
												'wb-spatial-wayfinding-destination-zone': polygon.type === 'location' && Boolean(polygon.destinationId),
												'wb-spatial-wayfinding-location': polygon.type === 'location',
												'wb-spatial-wayfinding-obstacle': polygon.type === 'obstacle',
												'wb-spatial-wayfinding-selected': Boolean(
													(polygon.destinationId && polygon.destinationId === selectedId())
													|| (polygon.buildingId && polygon.buildingId === selectedBuildingId())
												),
												'wb-spatial-wayfinding-walkable': polygon.type === 'walkable'
											}}
											fill={polygon.presentation?.fillColor}
											fill-opacity={polygon.presentation?.fillOpacity}
											points={polygonPoints(polygon.geometry)}
											role={polygon.destinationId || polygon.buildingId ? 'button' : undefined}
											aria-label={
												polygon.buildingId
													? `Open ${runtime()?.buildings.find((building): boolean => building.id === polygon.buildingId)?.name ?? 'building'}`
													: polygon.destinationId
														? `Open ${destinations().find((destination): boolean => destination.id === polygon.destinationId)?.name ?? 'destination'}`
														: undefined
											}
											tabindex={polygon.destinationId || polygon.buildingId ? 0 : undefined}
											onClick={(): void => {
												if (polygon.destinationId) chooseDestination(polygon.destinationId);
												else if (polygon.buildingId) chooseBuilding(polygon.buildingId);
											}}
											onKeyDown={(event): void => {
												if (event.key !== 'Enter' && event.key !== ' ') return;
												event.preventDefault();

												if (polygon.destinationId) chooseDestination(polygon.destinationId);
												else if (polygon.buildingId) chooseBuilding(polygon.buildingId);
											}}
										/>
									)}
								</For>
								<For each={activeLevel().elements.filter((element): element is RuntimeDoor => element.type === 'door')}>
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
								<For each={activeLevel().elements.filter((element): element is RuntimeTransition => element.type === 'transition')}>
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
									<For each={activeLevel().elements.filter((element): element is RuntimeLabel =>
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
								<For each={activeLevel().elements.filter((element): element is RuntimeMedia => element.type === 'icon' || element.type === 'logo')}>
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
								<For each={activeLevel().elements.filter((element): element is RuntimePointOfInterest => element.type === 'poi')}>
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
								<For each={activeLevel().elements.filter((element): element is RuntimeOrigin => element.type === 'origin')}>
									{(origin: RuntimeOrigin): JSX.Element => {
										const markerSize: number = runtime()?.defaults.origin.markerSize2d ?? 28;
										const dimensions = originMarkerDimensions();

										return (
											<g
												class="wb-spatial-wayfinding-origin"
												data-origin-marker={originMarkerAsset() ? 'custom-image-replacement' : 'default'}
											>
												<circle
													class="wb-spatial-wayfinding-origin-beacon"
													cx={origin.point.x}
													cy={origin.point.y}
													r={Math.max(24, markerSize * 0.65)}
												/>
												<Show
													when={originMarkerAsset()}
													fallback={(
														<circle
															class="wb-spatial-wayfinding-origin-core"
															cx={origin.point.x}
															cy={origin.point.y}
															r={Math.max(7, markerSize * 0.32)}
														/>
													)}
												>
													{(asset): JSX.Element => (
														<image
															class="wb-spatial-wayfinding-origin-artwork"
															data-origin-marker-2d="custom-image-replacement"
															href={asset().dataUrl}
															x={origin.point.x - dimensions!.width / 2}
															y={origin.point.y - dimensions!.height / 2}
															width={dimensions!.width}
															height={dimensions!.height}
															preserveAspectRatio="xMidYMid meet"
														/>
													)}
												</Show>
											</g>
										);
									}}
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
							<Show when={overviewMode() === 'atlas-2d'}>
								<div class="wb-spatial-wayfinding-atlas" role="region" aria-label="Route overview atlas">
									<For each={relevantOverviewLevels()}>
										{(level: RuntimeLevel): JSX.Element => {
											const routePoints = (): WayfindingPoint[] => overviewRoutes()
												.find((route) => route.levelId === level.id)?.points ?? [];

											return (
												<article class="wb-spatial-wayfinding-atlas-level" classList={{ 'wb-spatial-wayfinding-active': level.id === selectedFloorId() }}>
													<header>
														<span>{level.role === 'site' ? 'SITE' : runtime()?.buildings.find((building) => building.id === level.buildingId)?.name?.toUpperCase()}</span>
														<strong>{level.name}</strong>
													</header>
													<button type="button" aria-label={`Open ${level.name}`} onClick={(): void => { setSelectedFloorId(level.id); setOverviewMode('site'); }}>
														<div class="wb-spatial-wayfinding-atlas-svg" innerHTML={level.svg} />
														<Show when={routePoints().length > 1}>
															<svg class="wb-spatial-wayfinding-atlas-route" viewBox={`0 0 ${level.width} ${level.height}`} aria-hidden="true">
																<polyline points={polygonPoints(routePoints())} />
															</svg>
														</Show>
													</button>
												</article>
											);
										}}
									</For>
								</div>
							</Show>
							<div class="wb-spatial-wayfinding-map-caption">
								<span>{overviewMode() === 'atlas-2d' ? 'JOURNEY OVERVIEW' : overviewMode() === 'exploded-3d' ? 'EXPLODED BUILDING VIEW' : activeLevel().name.toUpperCase()}</span>
								<strong>{overviewMode() === 'atlas-2d' ? 'Select a level to inspect its route segment.' : view() === '3d' || overviewMode() === 'exploded-3d' ? 'Drag to rotate. Pinch or wheel to zoom.' : 'Tap a building or destination for details and directions.'}</strong>
							</div>
						</section>
						<aside
							class="wb-spatial-wayfinding-directory"
							classList={{ 'wb-spatial-wayfinding-has-selection': Boolean(selected() || selectedBuilding()) }}
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
									<select value={selectedFloorId()} aria-label="Level" onChange={(event): void => { setSelectedFloorId(event.currentTarget.value); setOverviewMode('site'); }}>
										<For each={runtime()?.levels ?? []}>{(item): JSX.Element => (
											<option value={item.id}>
												{item.role === 'site' ? `Site / ${item.name}` : item.buildingId ? `${runtime()?.buildings.find((building) => building.id === item.buildingId)?.name ?? 'Building'} / ${item.name}` : item.name}
											</option>
										)}</For>
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
								<Show when={visibleBuildings().length > 0}>
									<strong class="wb-spatial-wayfinding-result-group">Buildings</strong>
									<For each={visibleBuildings()}>
										{(building: WayfindingBuilding): JSX.Element => (
											<button
												type="button"
												class="wb-spatial-wayfinding-destination wb-spatial-wayfinding-building-result"
												classList={{ 'wb-spatial-wayfinding-selected': selectedBuildingId() === building.id }}
												onClick={(): void => chooseBuilding(building.id)}
											>
												<span>{building.category ?? 'Building'} / {runtime()?.levels.filter((level) => level.buildingId === building.id).length ?? 0} levels</span>
												<strong>{building.name}</strong>
												<em>{building.defaultLevelId ? 'Explore inside' : 'Exterior destination'}</em>
											</button>
										)}
									</For>
								</Show>
								<Show when={visibleDestinations().length > 0}>
									<strong class="wb-spatial-wayfinding-result-group">Places</strong>
								</Show>
								<For each={visibleDestinations()} fallback={<Show when={visibleBuildings().length === 0}><div class="wb-spatial-wayfinding-no-results">No matching places</div></Show>}>
									{(destination: RuntimeDestination): JSX.Element => (
										<button
											type="button"
											class="wb-spatial-wayfinding-destination"
											classList={{ 'wb-spatial-wayfinding-selected': selectedId() === destination.id }}
											onClick={(): void => chooseDestination(destination.id)}
										>
											<span>{runtime()?.buildings.find((building) => runtime()?.levels.some((level) => level.id === destination.levelId && level.buildingId === building.id))?.name ?? destination.category ?? 'Destination'}{destination.mapNumber ? ` / ${destination.mapNumber}` : ''}</span>
											<strong>{destination.name}</strong>
											<Show when={destination.status}><em>{destination.status}</em></Show>
										</button>
									)}
								</For>
							</div>
							<Show when={selectedBuilding()}>
								{(building: Accessor<WayfindingBuilding>): JSX.Element => (
									<div class="wb-spatial-wayfinding-details wb-spatial-wayfinding-building-details">
										<span>Building / {building().accessible === false ? 'Limited accessibility' : 'Accessible entrance available'}</span>
										<h3>{building().name}</h3>
										<Show when={building().description}><p>{building().description}</p></Show>
										<div class="wb-spatial-wayfinding-building-levels">
											<For each={runtime()?.levels.filter((level) => level.buildingId === building().id) ?? []}>
												{(level): JSX.Element => (
													<button type="button" onClick={(): void => { setSelectedFloorId(level.id); setOverviewMode('site'); }}>
														<span>{level.levelNumber ?? level.order}</span>
														<strong>{level.name}</strong>
													</button>
												)}
											</For>
										</div>
										<div class="wb-spatial-wayfinding-building-actions">
											<Show when={building().defaultLevelId}>
												<button type="button" onClick={enterBuilding}>Explore inside</button>
											</Show>
											<button type="button" onClick={showBuildingDirections}>Directions</button>
										</div>
										<Show when={directionsBuildingId() === building().id}>
											<Show when={route()} fallback={<div class="wb-spatial-wayfinding-route-unavailable" role="status"><strong>Directions unavailable</strong><span>No reachable entrance is connected to this building.</span></div>}>
												{(activeRoute: Accessor<WayfindingRouteResult>): JSX.Element => (
													<>
														<div class="wb-spatial-wayfinding-route-summary">
															<strong>{activeRoute().walkingDistance} m</strong>
															<span>Route to {building().name}</span>
														</div>
														<div class="wb-spatial-wayfinding-journey-actions">
															<button type="button" disabled={journeyIndex() === 0} onClick={(): void => showJourneyStep(journeyIndex() - 1)}>Back</button>
															<button type="button" onClick={showJourneyOverview}>Overview</button>
															<button type="button" onClick={(): void => showJourneyStep(0)}>Replay</button>
															<button type="button" disabled={journeyIndex() >= routeJourney().length - 1} onClick={(): void => showJourneyStep(journeyIndex() + 1)}>Next</button>
														</div>
													</>
												)}
											</Show>
										</Show>
									</div>
								)}
							</Show>
							<Show when={!selectedBuilding()}>
							<Show when={selected()} fallback={<div class="wb-spatial-wayfinding-idle"><strong>Choose a place</strong><span>Search globally or tap a building or marked destination on the map.</span></div>}>
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
														<div class="wb-spatial-wayfinding-route-levels" role="group" aria-label="Route levels">
															<For each={routeJourney()}>
																{(leg: RouteGuidanceLeg, index): JSX.Element => (
																	<button
																		type="button"
																		classList={{ 'wb-spatial-wayfinding-active': leg.levelId === floor()?.id }}
																		onClick={(): void => { setSelectedFloorId(leg.levelId); }}
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
												<Show when={routeJourney().length > 0}>
													<div class="wb-spatial-wayfinding-journey-actions">
														<button type="button" disabled={journeyIndex() === 0} onClick={(): void => showJourneyStep(journeyIndex() - 1)}>Back</button>
														<button type="button" onClick={showJourneyOverview}>Overview</button>
														<button type="button" onClick={(): void => showJourneyStep(0)}>Replay</button>
														<button type="button" disabled={journeyIndex() >= routeJourney().length - 1} onClick={(): void => showJourneyStep(journeyIndex() + 1)}>Next</button>
													</div>
												</Show>
												</>
											)}
										</Show>
									</div>
								)}
							</Show>
							</Show>
						</aside>
					</main>
				)}
			</Show>
		</div>
	);
};
