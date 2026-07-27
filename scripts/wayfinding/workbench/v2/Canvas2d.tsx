import {
	createEffect,
	createMemo,
	onCleanup,
	onMount,
	type Accessor,
	type JSX
} from 'solid-js';
import { renderWayfindingFloorSvg } from '../../studio-project.mts';
import { cameraForFloor } from '../../editor-core/commands';
import type {
	EditorSnapshot,
	EditorStore
} from '../../editor-core/types';
import {
	floorRoutePoints,
	routePolyline,
	routeToDestination
} from './route';

interface Canvas2dProps {
	onPointerCoordinate?: (point: { x: number; y: number }) => void;
	registerFit: (fit: () => void) => void;
	snapshot: Accessor<EditorSnapshot>;
	store: EditorStore;
}

const visibleGroupByLayer: Record<string, string> = {
	background: 'Background',
	door: 'Doors',
	icon: 'Icons',
	label: 'Labels',
	location: 'Locations',
	logo: 'Logos',
	obstacle: 'Obstacles',
	origin: 'Origins',
	poi: 'POIs',
	transition: 'Transitions',
	walkable: 'Walkable'
};

const escaped = (value: string): string => value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');

export const Canvas2d = (props: Canvas2dProps): JSX.Element => {
	let viewport!: HTMLDivElement;
	let dragging = false;
	let dragStart = { x: 0, y: 0 };
	let cameraStart = { offsetX: 0, offsetY: 0, scale: 1 };
	const currentFloorId = createMemo(() => props.snapshot().state.currentFloorId);
	const floor = createMemo(() => props.snapshot().state.project.floors.find(
		(candidate) => candidate.id === currentFloorId()
	) ?? props.snapshot().state.project.floors[0]);
	const camera = createMemo(() => cameraForFloor(props.snapshot().state, floor().id));
	const selectedDestinationId = createMemo(() => {
		const selection = props.snapshot().state.selection;

		return selection?.kind === 'destination' ? selection.id : undefined;
	});
	const route = createMemo(() => floorRoutePoints(
		routeToDestination(
			props.snapshot().state.project,
			selectedDestinationId()
		),
		floor().id
	));
	const renderedSvg = createMemo(() => {
		const state = props.snapshot().state;
		const hiddenRules: string[] = [];

		for (const [layer, group] of Object.entries(visibleGroupByLayer)) {
			if (!state.layerVisibility[layer as keyof typeof state.layerVisibility]) hiddenRules.push(`#${group}{display:none}`);
		}

		if (state.selection?.kind === 'element') {
			hiddenRules.push(`[id="${escaped(state.selection.id)}"]{filter:drop-shadow(0 0 5px #15927d);stroke:#15927d;stroke-width:5}`);
		}
		const source: string = renderWayfindingFloorSvg(state.project, floor().id);

		return source.replace('>', `><style>${hiddenRules.join('')}</style>`);
	});

	const fit = (): void => {
		if (!viewport || !floor()) return;
		const padding = 72;
		const scale = Math.min(
			(viewport.clientWidth - padding * 2) / floor().width,
			(viewport.clientHeight - padding * 2) / floor().height
		);
		props.store.dispatch({
			type: 'camera/set',
			floorId: floor().id,
			camera: {
				offsetX: (viewport.clientWidth - floor().width * scale) / 2,
				offsetY: (viewport.clientHeight - floor().height * scale) / 2,
				scale
			}
		});
	};

	onMount(() => {
		props.registerFit(fit);
		queueMicrotask(fit);
	});

	createEffect(() => {
		currentFloorId();
		queueMicrotask(fit);
	});

	const pointInViewport = (event: PointerEvent | WheelEvent): { x: number; y: number } => {
		const bounds = viewport.getBoundingClientRect();

		return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
	};

	const pointerDown: JSX.EventHandler<HTMLDivElement, PointerEvent> = (event): void => {
		const target = event.target;
		const element = target.closest('[data-wayfinding-level]');

		if (element && props.snapshot().state.workspace === 'map') {
			props.store.dispatch({ type: 'selection/set', selection: { id: element.id, kind: 'element' } });

			return;
		}
		dragging = true;
		dragStart = pointInViewport(event);
		cameraStart = { ...camera() };
		event.currentTarget.setPointerCapture(event.pointerId);
	};

	const pointerMove: JSX.EventHandler<HTMLDivElement, PointerEvent> = (event): void => {
		const point = pointInViewport(event);
		const current = camera();
		props.onPointerCoordinate?.({
			x: (point.x - current.offsetX) / current.scale,
			y: (point.y - current.offsetY) / current.scale
		});

		if (!dragging) return;
		props.store.dispatch({
			type: 'camera/set',
			floorId: floor().id,
			camera: {
				...cameraStart,
				offsetX: cameraStart.offsetX + point.x - dragStart.x,
				offsetY: cameraStart.offsetY + point.y - dragStart.y
			}
		});
	};

	const pointerUp = (): void => {
		dragging = false;
	};

	const wheel: JSX.EventHandler<HTMLDivElement, WheelEvent> = (event): void => {
		event.preventDefault();
		const before = pointInViewport(event);
		const current = camera();
		const scale = Math.max(0.08, Math.min(8, current.scale * (event.deltaY > 0 ? 0.9 : 1.1)));
		const mapX = (before.x - current.offsetX) / current.scale;
		const mapY = (before.y - current.offsetY) / current.scale;
		props.store.dispatch({
			type: 'camera/set',
			floorId: floor().id,
			camera: {
				offsetX: before.x - mapX * scale,
				offsetY: before.y - mapY * scale,
				scale
			}
		});
	};

	onCleanup(() => {
		dragging = false;
	});

	return (
		<div
			class="canvas-viewport"
			ref={viewport}
			onPointerDown={pointerDown}
			onPointerMove={pointerMove}
			onPointerUp={pointerUp}
			onPointerCancel={pointerUp}
			onWheel={wheel}
		>
			<div
				class="map-transform"
				style={{
					height: `${floor().height}px`,
					transform: `translate(${camera().offsetX}px, ${camera().offsetY}px) scale(${camera().scale})`,
					width: `${floor().width}px`
				}}
			>
				<div class="map-svg" innerHTML={renderedSvg()} />
				<svg
					class="route-overlay"
					viewBox={`0 0 ${floor().width} ${floor().height}`}
					aria-hidden="true"
				>
					{props.snapshot().state.layerVisibility['route-network']
						&& (props.snapshot().state.workspace === 'route-edit' || props.snapshot().state.workspace === 'route-preview')
						&& props.snapshot().state.project.graph.edges.map((edge) => {
							const from = props.snapshot().state.project.graph.nodes.find((node) => node.id === edge.from);
							const to = props.snapshot().state.project.graph.nodes.find((node) => node.id === edge.to);

							if (!from || !to || from.levelId !== floor().id) return null;
							const points = edge.geometry?.length ? edge.geometry : [from, to];

							return <polyline class="route-network-line" points={routePolyline(points)} />;
						})}
					{route().length > 1 && (
						<polyline
							class="simulated-route"
							classList={{ animated: props.snapshot().state.project.defaults?.route.animation !== 'none' }}
							points={routePolyline(route())}
						/>
					)}
				</svg>
			</div>
		</div>
	);
};
