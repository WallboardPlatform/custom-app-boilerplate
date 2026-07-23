import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import type { Accessor, JSX } from 'solid-js';

import { useSettings } from '@hooks/system/useSettings';
import type { Settings } from '@interfaces/application.interface';
import type {
	RuntimeDestination,
	RuntimeFloor,
	RuntimeLabel,
	RuntimeOrigin,
	RuntimePolygon,
	WayfindingRuntimeBundle
} from '@interfaces/spatial-wayfinding.interface';
import { WayfindingGraph } from '@utils/wayfinding';
import type { WayfindingPoint, WayfindingRouteResult } from '@utils/wayfinding';
import { SpatialScene } from '@utils/spatial-scene';

import style from '@components/wb-app/wb-app.module.scss';
import runtimeSource from '../../assets/campus.runtime.json';

const runtime = runtimeSource as WayfindingRuntimeBundle;
const floor: RuntimeFloor = runtime.floors[0];
const destinations: RuntimeDestination[] = runtime.destinations.Destinations.rows;
const graph = new WayfindingGraph(runtime.graph);
const originId = 'origin-main';

const polygonPoints = (points: WayfindingPoint[]): string => points.map((point: WayfindingPoint): string => `${point.x},${point.y}`).join(' ');

export default (props: { hostElement: HTMLDivElement }): JSX.Element => {
	const settings: Accessor<Settings> = useSettings();
	const [selectedId, setSelectedId] = createSignal<string>();
	const [view, setView] = createSignal<'2d' | '3d'>(settings().defaultView);
	let previousDefaultView: '2d' | '3d' = settings().defaultView;
	let sceneHost!: HTMLDivElement;
	let scene: SpatialScene | undefined;
	const selected = createMemo((): RuntimeDestination | undefined => destinations.find((destination: RuntimeDestination): boolean => destination.id === selectedId()));
	const route = createMemo((): WayfindingRouteResult | undefined => {
		const destinationId: string | undefined = selectedId();
		const node = destinationId ? graph.locationNode(destinationId) : undefined;

		return node ? graph.route(originId, node.id, { mapRatio: 13 }) : undefined;
	});
	const themeStyle = createMemo((): JSX.CSSProperties => ({
		'--wb-spatial-accent': settings().accentColor,
		'--wb-spatial-background': settings().backgroundColor,
		'--wb-spatial-panel': settings().panelColor,
		'--wb-spatial-primary': settings().primaryTextColor,
		'--wb-spatial-secondary': settings().secondaryTextColor
	}));

	const chooseDestination = (destinationId: string): void => {
		setSelectedId(destinationId);
	};

	const reset = (): void => {
		setSelectedId(undefined);
		scene?.setRoute([]);
		scene?.selectDestination();
		scene?.resetCamera();
	};

	onMount((): void => {
		scene = new SpatialScene(sceneHost || props.hostElement, floor, {
			accentColor: (): string => settings().accentColor,
			motionEnabled: (): boolean => settings().motionPreset !== 'off',
			onSelectDestination: chooseDestination
		});
		onCleanup((): void => scene?.dispose());
	});

	createEffect((): void => {
		const destinationId: string | undefined = selectedId();
		scene?.selectDestination(destinationId);
		scene?.setRoute(route()?.path.filter((point): boolean => point.levelId === floor.id) ?? []);
	});

	createEffect((): void => {
		const nextDefaultView: '2d' | '3d' = settings().defaultView;

		if (nextDefaultView === previousDefaultView) return;
		previousDefaultView = nextDefaultView;
		setView(nextDefaultView);
	});

	return (
		<div
			class={`wb-spatial-wayfinding-root ${style['wb-app']}`}
			data-preview-id="spatial-wayfinding-root"
			data-runtime-project={runtime.manifest.projectId}
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
							<button type="button" classList={{ 'wb-spatial-wayfinding-active': view() === '3d' }} onClick={(): void => { setView('3d'); }}>3D</button>
						</div>
					</Show>
					<button type="button" class="wb-spatial-wayfinding-reset" onClick={reset}>Reset view</button>
				</div>
			</header>
			<main class="wb-spatial-wayfinding-main">
				<section class="wb-spatial-wayfinding-map" aria-label="Campus map">
					<div ref={sceneHost} class="wb-spatial-wayfinding-scene" classList={{ 'wb-spatial-wayfinding-hidden': view() !== '3d' }} />
					<svg
						class="wb-spatial-wayfinding-flat-map"
						classList={{ 'wb-spatial-wayfinding-hidden': view() !== '2d' }}
						viewBox={`0 0 ${floor.width} ${floor.height}`}
						role="img"
						aria-label="Two-dimensional campus map"
					>
						<rect x="0" y="0" width={floor.width} height={floor.height} class="wb-spatial-wayfinding-floor" />
						<For each={floor.elements.filter((element): element is RuntimePolygon => 'geometry' in element)}>
							{(polygon: RuntimePolygon): JSX.Element => (
								<polygon
									class="wb-spatial-wayfinding-zone"
									classList={{
										'wb-spatial-wayfinding-selected': polygon.destinationId === selectedId(),
										'wb-spatial-wayfinding-walkable': polygon.type === 'walkable'
									}}
									fill={polygon.presentation?.fillColor}
									points={polygonPoints(polygon.geometry)}
									onClick={(): void => { if (polygon.destinationId) chooseDestination(polygon.destinationId); }}
								/>
							)}
						</For>
						<Show when={route()}>
							<polyline class="wb-spatial-wayfinding-route-shadow" points={polygonPoints(route()!.path)} />
							<polyline class="wb-spatial-wayfinding-route" points={polygonPoints(route()!.path)} />
						</Show>
						<For each={floor.elements.filter((element): element is RuntimeLabel => element.type === 'label')}>
							{(label: RuntimeLabel): JSX.Element => (
								<text
									x={label.point.x}
									y={label.point.y}
									text-anchor="middle"
									class="wb-spatial-wayfinding-map-label"
									data-preview-allow-overflow
								>
									{label.text}
								</text>
							)}
						</For>
						<For each={floor.elements.filter((element): element is RuntimeOrigin => element.type === 'origin')}>
							{(origin: RuntimeOrigin): JSX.Element => (
								<g class="wb-spatial-wayfinding-origin">
									<circle cx={origin.point.x} cy={origin.point.y} r="24" />
									<circle cx={origin.point.x} cy={origin.point.y} r="9" />
								</g>
							)}
						</For>
					</svg>
					<div class="wb-spatial-wayfinding-map-caption">
						<span>GROUND FLOOR</span>
						<strong>{view() === '3d' ? 'Drag to rotate. Pinch or wheel to zoom.' : 'Tap a destination to preview the route.'}</strong>
					</div>
				</section>
				<aside class="wb-spatial-wayfinding-directory">
					<div class="wb-spatial-wayfinding-directory-heading">
						<span>FIND A DESTINATION</span>
						<h2>Where would you like to go?</h2>
					</div>
					<div class="wb-spatial-wayfinding-destinations">
						<For each={destinations}>
							{(destination: RuntimeDestination): JSX.Element => (
								<button
									type="button"
									class="wb-spatial-wayfinding-destination"
									classList={{ 'wb-spatial-wayfinding-selected': selectedId() === destination.id }}
									onClick={(): void => chooseDestination(destination.id)}
								>
									<span>{destination.category}</span>
									<strong>{destination.name}</strong>
								</button>
							)}
						</For>
					</div>
					<Show when={selected()} fallback={<div class="wb-spatial-wayfinding-idle"><strong>Choose a place</strong><span>The same exported artifact powers both the 2D and 3D views.</span></div>}>
						{(destination: Accessor<RuntimeDestination>): JSX.Element => (
							<div class="wb-spatial-wayfinding-details">
								<span>{destination().category}</span>
								<h3>{destination().name}</h3>
								<p>{destination().description}</p>
								<div>
									<strong>{route()?.walkingDistance ?? 0} m</strong>
									<span>Approx. {Math.max(1, Math.ceil((route()?.walkingSeconds ?? 0) / 60))} min walk</span>
								</div>
							</div>
						)}
					</Show>
				</aside>
			</main>
		</div>
	);
};
