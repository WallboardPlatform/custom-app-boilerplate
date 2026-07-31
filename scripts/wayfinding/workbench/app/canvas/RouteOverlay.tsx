import {
	For,
	Show,
	type Accessor,
	type JSX
} from 'solid-js';
import {
	wayfindingStudioProjectDefaults,
	type WayfindingStudioFloor
} from '../../../studio-project.mts';
import type {
	EditorCamera2d,
	EditorSnapshot
} from '../../../editor-core/types';
import type {
	WayfindingEdge,
	WayfindingNode,
	WayfindingPoint
} from '../../../../../src/utils/wayfinding.js';
import { pointsAttribute } from './model';

interface RouteOverlayProps {
	camera: Accessor<EditorCamera2d>;
	floor: Accessor<WayfindingStudioFloor>;
	floorGraphEdges: Accessor<WayfindingEdge[]>;
	graphEdgePoints: (edgeId: string) => WayfindingPoint[];
	route: Accessor<WayfindingPoint[]>;
	selectedGraphEdge: Accessor<WayfindingEdge | undefined>;
	selectedGraphGeometry: Accessor<WayfindingPoint[]>;
	selectedGraphNode: Accessor<WayfindingNode | undefined>;
	showRouteNetwork: Accessor<boolean>;
	snapshot: Accessor<EditorSnapshot>;
}

interface RouteDirectionMarker {
	angle: number;
	x: number;
	y: number;
}

const routePath = (points: WayfindingPoint[], radius: number): string => {
	if (points.length === 0) return '';

	if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

	if (points.length === 2 || radius <= 0) {
		return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
	}
	const commands = [`M ${points[0].x} ${points[0].y}`];

	for (let index = 1; index < points.length - 1; index += 1) {
		const previous = points[index - 1];
		const current = points[index];
		const next = points[index + 1];
		const incomingLength = Math.hypot(current.x - previous.x, current.y - previous.y);
		const outgoingLength = Math.hypot(next.x - current.x, next.y - current.y);
		const corner = Math.min(radius, incomingLength / 2, outgoingLength / 2);
		const incomingRatio = incomingLength === 0 ? 0 : corner / incomingLength;
		const outgoingRatio = outgoingLength === 0 ? 0 : corner / outgoingLength;
		const entry = {
			x: current.x + (previous.x - current.x) * incomingRatio,
			y: current.y + (previous.y - current.y) * incomingRatio
		};
		const exit = {
			x: current.x + (next.x - current.x) * outgoingRatio,
			y: current.y + (next.y - current.y) * outgoingRatio
		};

		commands.push(`L ${entry.x} ${entry.y}`);
		commands.push(`Q ${current.x} ${current.y} ${exit.x} ${exit.y}`);
	}
	const last = points[points.length - 1];

	commands.push(`L ${last.x} ${last.y}`);

	return commands.join(' ');
};

const routeDirectionMarkers = (
	points: readonly WayfindingPoint[],
	spacing: number,
	endInset: number
): RouteDirectionMarker[] => {
	if (points.length < 2) return [];
	const segments = points.slice(1).map((point, index) => {
		const start = points[index];
		const length = Math.hypot(point.x - start.x, point.y - start.y);

		return { end: point, length, start };
	}).filter((segment) => segment.length > Number.EPSILON);
	const totalLength = segments.reduce((total, segment) => total + segment.length, 0);

	if (segments.length === 0 || totalLength <= endInset * 2) return [];
	const count = Math.max(1, Math.floor((totalLength - endInset * 2) / Math.max(1, spacing)) + 1);
	const interval = (totalLength - endInset * 2) / count;
	const distances = Array.from(
		{ length: count },
		(_, index) => endInset + interval * (index + 0.5)
	);

	return distances.map((targetDistance): RouteDirectionMarker => {
		let cursor = targetDistance;

		for (const segment of segments) {
			if (cursor <= segment.length) {
				const ratio = cursor / segment.length;

				return {
					angle: Math.atan2(
						segment.end.y - segment.start.y,
						segment.end.x - segment.start.x
					) * 180 / Math.PI,
					x: segment.start.x + (segment.end.x - segment.start.x) * ratio,
					y: segment.start.y + (segment.end.y - segment.start.y) * ratio
				};
			}
			cursor -= segment.length;
		}
		const finalSegment = segments[segments.length - 1];

		return {
			angle: Math.atan2(
				finalSegment.end.y - finalSegment.start.y,
				finalSegment.end.x - finalSegment.start.x
			) * 180 / Math.PI,
			x: finalSegment.end.x,
			y: finalSegment.end.y
		};
	});
};

export const RouteOverlay = (props: RouteOverlayProps): JSX.Element => {
	const routeDefaults = (): ReturnType<typeof wayfindingStudioProjectDefaults>['route'] =>
		wayfindingStudioProjectDefaults(props.snapshot().state.project).route;
	const showSimulatedRoute = (): boolean =>
		props.snapshot().state.workspace === 'preview'
		&& props.snapshot().state.layerVisibility['simulated-route']
		&& props.route().length >= 2;
	const directionMarkers = (): RouteDirectionMarker[] => routeDirectionMarkers(
		props.route(),
		110 / props.camera().scale,
		42 / props.camera().scale
	);

	return (
		<svg
			class="route-overlay"
			preserveAspectRatio="none"
			viewBox={`0 0 ${props.floor().width} ${props.floor().height}`}
		>
			<Show when={props.showRouteNetwork()}>
				<For each={props.floorGraphEdges()}>
					{(edge): JSX.Element => {
						const selected = (): boolean => props.selectedGraphEdge()?.id === edge.id;
						const context = (): boolean => props.selectedGraphNode()
							? edge.from === props.selectedGraphNode()?.id || edge.to === props.selectedGraphNode()?.id
							: true;

						return (
							<polyline
								class="route-network-line"
								classList={{
									context: context(),
									dimmed: Boolean(props.selectedGraphNode()) && !context(),
									selected: selected()
								}}
								data-route-edge-id={edge.id}
								points={pointsAttribute(
									selected() && props.selectedGraphGeometry().length
										? props.selectedGraphGeometry()
										: props.graphEdgePoints(edge.id)
								)}
							/>
						);
					}}
				</For>
			</Show>
			<Show when={showSimulatedRoute()}>
				<path
					class="simulated-route-casing"
					d={routePath(props.route(), routeDefaults().cornerRadius)}
					style={{ 'stroke-width': `${routeDefaults().lineWidth + 8}px` }}
				/>
				<path
					class="simulated-route"
					classList={{
						pulsing: routeDefaults().animation === 'pulse'
					}}
					d={routePath(props.route(), routeDefaults().cornerRadius)}
					style={{
						stroke: routeDefaults().color,
						'stroke-width': `${routeDefaults().lineWidth}px`
					}}
				/>
				<Show when={routeDefaults().animation === 'flow'}>
					<path
						class="simulated-route-flow"
						d={routePath(props.route(), routeDefaults().cornerRadius)}
						style={{
							'animation-duration': `${Math.max(0.35, 72 / Math.max(1, routeDefaults().animationSpeed))}s`,
							'stroke-width': `${Math.max(2, routeDefaults().lineWidth * 0.3)}px`
						}}
					/>
				</Show>
				<For each={directionMarkers()}>
					{(marker) => (
						<path
							class="simulated-route-chevron"
							d="M -7 -5 L 0 0 L -7 5"
							style={{ 'stroke-width': '2.4px' }}
							transform={`translate(${marker.x} ${marker.y}) rotate(${marker.angle}) scale(${1 / props.camera().scale})`}
						/>
					)}
				</For>
				<circle
					class="simulated-route-start"
					cx={props.route()[0]?.x}
					cy={props.route()[0]?.y}
					r={9 / props.camera().scale}
					style={{ stroke: routeDefaults().color, 'stroke-width': '4px' }}
				/>
				<circle
					class="simulated-route-arrival-halo"
					cx={props.route()[props.route().length - 1]?.x}
					cy={props.route()[props.route().length - 1]?.y}
					r={15 / props.camera().scale}
					style={{ stroke: routeDefaults().color, 'stroke-width': '3px' }}
				/>
				<circle
					class="simulated-route-arrival"
					cx={props.route()[props.route().length - 1]?.x}
					cy={props.route()[props.route().length - 1]?.y}
					r={7 / props.camera().scale}
					style={{ fill: routeDefaults().color, 'stroke-width': '3px' }}
				/>
			</Show>
		</svg>
	);
};
