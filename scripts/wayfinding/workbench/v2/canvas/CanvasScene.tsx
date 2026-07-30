import {
	For,
	Show,
	type Accessor,
	type JSX
} from 'solid-js';
import {
	wayfindingStudioProjectDefaults,
	type WayfindingStudioDoorElement,
	type WayfindingStudioElement,
	type WayfindingStudioFloor,
	type WayfindingStudioMediaElement,
	type WayfindingStudioOriginElement,
	type WayfindingStudioPolygonElement
} from '../../../studio-project.mts';
import type {
	EditorCamera2d,
	EditorDraft,
	EditorSelection,
	EditorSnapshot,
	EditorWorkspace
} from '../../../editor-core/types';
import type {
	WayfindingEdge,
	WayfindingNode,
	WayfindingPoint
} from '../../../../../src/utils/wayfinding.js';
import type {
	VisitorMapItem,
	VisitorMapLabelPlacement
} from '../visitor-map';
import { visitorMarkerIds } from '../visitor-map';
import {
	isCanvasElementInteractive,
	isRouteGraphInteractive,
	type RouteWorkspaceView
} from '../route-workspace';
import {
	isPointElement,
	isPolygonElement,
	pointsAttribute
} from './model';

interface CanvasSceneProps {
	activateVisitorDestination: (destinationId: string) => void;
	beginDirectionDrag: (
		event: PointerEvent,
		element: WayfindingStudioDoorElement | WayfindingStudioOriginElement
	) => void;
	beginElementDrag: (event: PointerEvent, element: WayfindingStudioElement) => void;
	beginGraphEdgePointDrag: (event: PointerEvent, edgeId: string, geometryIndex: number) => void;
	beginGraphNodeDrag: (event: PointerEvent, nodeId: string) => void;
	beginInsertedGraphPointDrag: (
		event: PointerEvent,
		point: WayfindingPoint,
		edgeId: string,
		afterIndex: number
	) => void;
	beginInsertedPolygonVertexDrag: (
		event: PointerEvent,
		point: WayfindingPoint,
		afterIndex: number
	) => void;
	beginMediaResize: (event: PointerEvent, element: WayfindingStudioMediaElement) => void;
	beginMediaRotate: (event: PointerEvent, element: WayfindingStudioMediaElement) => void;
	beginVertexDrag: (event: PointerEvent, vertexIndex: number) => void;
	camera: Accessor<EditorCamera2d>;
	draft: Accessor<EditorDraft | undefined>;
	draftCursor: Accessor<WayfindingPoint | undefined>;
	elements: Accessor<WayfindingStudioElement[]>;
	floor: Accessor<WayfindingStudioFloor>;
	floorGraphEdges: Accessor<WayfindingEdge[]>;
	floorGraphNodes: Accessor<WayfindingNode[]>;
	freehandGeometry: Accessor<WayfindingPoint[] | undefined>;
	graphEdgePoints: (edgeId: string) => WayfindingPoint[];
	handleRadius: Accessor<number>;
	insertVertex: (event: MouseEvent, afterIndex: number) => void;
	interactionGeometry: Accessor<WayfindingPoint[] | undefined>;
	interactionGraphPoint: Accessor<WayfindingPoint | undefined>;
	polygonDraft: Accessor<Extract<EditorDraft, { kind: 'polygon' }> | undefined>;
	renderedSvg: Accessor<string>;
	route: Accessor<WayfindingPoint[]>;
	routeDraft: Accessor<Extract<EditorDraft, { kind: 'route-edge' }> | undefined>;
	routeWorkspaceView: Accessor<RouteWorkspaceView>;
	selectedElement: Accessor<WayfindingStudioElement | undefined>;
	selectedGraphEdge: Accessor<WayfindingEdge | undefined>;
	selectedGraphGeometry: Accessor<WayfindingPoint[]>;
	selectedGraphGeometryIndex: Accessor<number | undefined>;
	selectedGraphNode: Accessor<WayfindingNode | undefined>;
	selectedPoint: Accessor<WayfindingPoint | undefined>;
	selectedPolygon: Accessor<WayfindingStudioPolygonElement | undefined>;
	selectedPolygonGeometry: Accessor<WayfindingPoint[]>;
	selectedVertexIndex: Accessor<number | undefined>;
	selectElement: (element: WayfindingStudioElement) => void;
	showRouteNetwork?: Accessor<boolean>;
	snapshot: Accessor<EditorSnapshot>;
	visitorLabelPlacements: Accessor<VisitorMapLabelPlacement[]>;
	visitorMapItems: Accessor<VisitorMapItem[]>;
}

const midpoint = (start: WayfindingPoint, end: WayfindingPoint): WayfindingPoint => ({
	x: (start.x + end.x) / 2,
	y: (start.y + end.y) / 2
});

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

interface RouteDirectionMarker {
	angle: number;
	x: number;
	y: number;
}

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

const directionEndpoint = (
	element: WayfindingStudioDoorElement | WayfindingStudioOriginElement
): WayfindingPoint => {
	const angle = element.type === 'door'
		? element.angle * Math.PI / 180
		: (element.facingDegrees - 90) * Math.PI / 180;
	const distance = element.type === 'door' ? Math.max(28, element.length * 1.4) : 48;

	return {
		x: element.point.x + Math.cos(angle) * distance,
		y: element.point.y + Math.sin(angle) * distance
	};
};

const mediaBounds = (element: WayfindingStudioMediaElement): {
	height: number;
	width: number;
	x: number;
	y: number;
} => ({
	height: element.height,
	width: element.width,
	x: element.point.x - element.width / 2,
	y: element.point.y - element.height / 2
});

const isMediaElement = (
	element: WayfindingStudioElement
): element is WayfindingStudioMediaElement =>
	element.type === 'icon' || element.type === 'logo';

const graphNodePoint = (
	node: WayfindingNode,
	interactionPoint: WayfindingPoint | undefined,
	selectedNode: WayfindingNode | undefined
): WayfindingPoint => selectedNode?.id === node.id && interactionPoint
	? interactionPoint
	: node;

export const CanvasScene = (props: CanvasSceneProps): JSX.Element => {
	const state = (): EditorSnapshot['state'] => props.snapshot().state;
	const workspace = (): EditorWorkspace => state().workspace;
	const selection = (): EditorSelection | undefined => state().selection;
	const routeDefaults = (): ReturnType<typeof wayfindingStudioProjectDefaults>['route'] =>
		wayfindingStudioProjectDefaults(state().project).route;
	const originDefaults = (): ReturnType<typeof wayfindingStudioProjectDefaults>['origin'] =>
		wayfindingStudioProjectDefaults(state().project).origin;
	const isPreview = (): boolean => workspace() === 'preview';
	const showRouteNetwork = (): boolean => workspace() === 'route-edit'
		|| (
			workspace() === 'preview'
			&& Boolean(props.showRouteNetwork?.())
		);
	const showSimulatedRoute = (): boolean =>
		workspace() === 'preview'
		&& state().layerVisibility['simulated-route']
		&& props.route().length >= 2;
	const directionMarkers = (): RouteDirectionMarker[] => routeDirectionMarkers(
		props.route(),
		110 / props.camera().scale,
		42 / props.camera().scale
	);
	const visitorMarkers = (): Set<string> => visitorMarkerIds(
		props.visitorMapItems(),
		props.camera().scale,
		selection()?.kind === 'destination' ? selection()?.id : undefined
	);
	const visitorOrigins = (): WayfindingStudioOriginElement[] => props.elements().filter(
		(element): element is WayfindingStudioOriginElement => element.type === 'origin'
	);
	const elementVisible = (element: WayfindingStudioElement): boolean =>
		state().layerVisibility[element.type];
	const elementInteractive = (element: WayfindingStudioElement): boolean =>
		isCanvasElementInteractive(workspace(), props.routeWorkspaceView(), element.type);
	const routeGraphInteractive = (): boolean =>
		isRouteGraphInteractive(workspace(), props.routeWorkspaceView());
	const directionElement = (): WayfindingStudioDoorElement | WayfindingStudioOriginElement | undefined => {
		const element = props.selectedElement();

		return (element?.type === 'door' || element?.type === 'origin') && elementVisible(element)
			? element
			: undefined;
	};
	const mediaElement = (): WayfindingStudioMediaElement | undefined => {
		const element = props.selectedElement();

		return (element?.type === 'icon' || element?.type === 'logo') && elementVisible(element)
			? element
			: undefined;
	};

	return (
		<div
			class="map-transform"
			data-route-workspace-view={props.routeWorkspaceView()}
			style={{
				height: `${props.floor().height}px`,
				transform: `translate(${props.camera().offsetX}px, ${props.camera().offsetY}px) scale(${props.camera().scale})`,
				width: `${props.floor().width}px`
			}}
		>
			<div class="map-svg" innerHTML={props.renderedSvg()} />

			<Show when={
				workspace() === 'route-edit'
				&& props.floor().pedestrianSpaceSource === 'mask'
				&& props.floor().walkableMask?.walkableRuns.length
			}>
				<svg
					class="painted-mask-overlay"
					preserveAspectRatio="none"
					viewBox={`0 0 ${props.floor().width} ${props.floor().height}`}
				>
					<For each={props.floor().walkableMask?.walkableRuns ?? []}>
						{([row, startColumn, endColumn]): JSX.Element => {
							const mask = (): NonNullable<WayfindingStudioFloor['walkableMask']> =>
								props.floor().walkableMask!;

							return (
								<rect
									height={mask().cellSize}
									width={(endColumn - startColumn + 1) * mask().cellSize}
									x={(mask().originX ?? 0) + startColumn * mask().cellSize}
									y={(mask().originY ?? 0) + row * mask().cellSize}
								/>
							);
						}}
					</For>
				</svg>
			</Show>

			<svg
				class="route-overlay"
				preserveAspectRatio="none"
				viewBox={`0 0 ${props.floor().width} ${props.floor().height}`}
			>
				<Show when={showRouteNetwork()}>
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

			<Show when={isPreview()}>
				<svg
					class="visitor-map-overlay"
					preserveAspectRatio="none"
					viewBox={`0 0 ${props.floor().width} ${props.floor().height}`}
				>
					<For each={props.visitorMapItems()}>
						{(item): JSX.Element => {
							const selected = (): boolean => selection()?.kind === 'destination'
								&& selection()?.id === item.destinationId;
							const markerRadius = (): number => Math.max(7, 12 / props.camera().scale);

							return (
								<g
									aria-label={`Open ${item.name} on the map`}
									class="visitor-map-destination"
									classList={{
										draft: item.presentation === 'draft',
										selected: selected()
									}}
									data-visitor-destination-id={item.destinationId}
									onClick={(event) => {
										event.preventDefault();
										event.stopPropagation();
										props.activateVisitorDestination(item.destinationId);
									}}
									onPointerDown={(event) => {
										event.preventDefault();
										event.stopPropagation();
										props.activateVisitorDestination(item.destinationId);
									}}
									onKeyDown={(event) => {
										if (event.key !== 'Enter' && event.key !== ' ') return;
										event.preventDefault();
										props.activateVisitorDestination(item.destinationId);
									}}
									role="button"
									tabindex="0"
								>
									<Show
										fallback={
											<circle
												class="visitor-location-hit"
												cx={item.anchor.x}
												cy={item.anchor.y}
												r={markerRadius() * 2.2}
											/>
										}
										when={item.geometry}
									>
										<polygon
											class="visitor-location-hit"
											points={pointsAttribute(item.geometry ?? [])}
										/>
									</Show>
									<Show when={state().layerVisibility.icon && visitorMarkers().has(item.destinationId)}>
										<circle
											class="visitor-marker-halo"
											cx={item.anchor.x}
											cy={item.anchor.y}
											r={markerRadius() * 1.45}
										/>
										<Show
											fallback={
												<circle
													class="visitor-marker"
													cx={item.anchor.x}
													cy={item.anchor.y}
													r={markerRadius() * 0.72}
												/>
											}
											when={item.symbolDataUrl ?? item.logoDataUrl}
										>
											<image
												class="visitor-marker-logo"
												height={markerRadius() * 1.7}
												href={item.symbolDataUrl ?? item.logoDataUrl}
												preserveAspectRatio="xMidYMid meet"
												width={markerRadius() * 1.7}
												x={item.anchor.x - markerRadius() * 0.85}
												y={item.anchor.y - markerRadius() * 0.85}
											/>
										</Show>
									</Show>
								</g>
							);
						}}
					</For>
					<Show when={state().layerVisibility.icon}>
						<For each={visitorOrigins()}>
							{(origin): JSX.Element => {
								const radius = (): number => Math.max(8, 13 / props.camera().scale);

								return (
									<g
										aria-label={origin.label}
										class="visitor-origin-marker"
										classList={{
											'animation-pulse': originDefaults().animation2d === 'pulse',
											'animation-radar': originDefaults().animation2d === 'radar'
										}}
										data-animation-speed={originDefaults().animationSpeed}
										data-origin-animation-2d={originDefaults().animation2d}
										data-visitor-origin-id={origin.id}
										style={`--origin-color: ${originDefaults().color}; --origin-duration: ${Math.max(0.45, 72 / Math.max(1, originDefaults().animationSpeed))}s`}
									>
										<Show when={originDefaults().animation2d !== 'none'}>
											<circle
												class="visitor-origin-marker__pulse"
												cx={origin.point.x}
												cy={origin.point.y}
												r={radius() * 1.9}
											/>
										</Show>
										<circle
											class="visitor-origin-marker__core"
											cx={origin.point.x}
											cy={origin.point.y}
											r={radius() * 0.68}
										/>
										<path
											class="visitor-origin-marker__direction"
											d={`M ${origin.point.x} ${origin.point.y - radius() * 1.1} L ${origin.point.x - radius() * 0.42} ${origin.point.y - radius() * 0.35} L ${origin.point.x + radius() * 0.42} ${origin.point.y - radius() * 0.35} Z`}
											transform={`rotate(${origin.facingDegrees} ${origin.point.x} ${origin.point.y})`}
										/>
									</g>
								);
							}}
						</For>
					</Show>
					<Show when={state().layerVisibility.label}>
						<For each={props.visitorLabelPlacements()}>
						{(placement): JSX.Element => {
							const selected = (): boolean => selection()?.kind === 'destination'
								&& selection()?.id === placement.item.destinationId;
							const fontSize = (): number => Math.max(10, 13 / props.camera().scale);
							const label = (): string => placement.item.mapNumber
								? `${placement.item.mapNumber}  ${placement.item.name}`
								: placement.item.name;

							return (
								<g
									class="visitor-map-label"
									classList={{ selected: selected() }}
									data-visitor-destination-id={placement.item.destinationId}
									onPointerDown={(event) => {
										event.preventDefault();
										event.stopPropagation();
										props.activateVisitorDestination(placement.item.destinationId);
									}}
									onKeyDown={(event) => {
										if (event.key !== 'Enter' && event.key !== ' ') return;
										event.preventDefault();
										props.activateVisitorDestination(placement.item.destinationId);
									}}
									role="button"
									tabindex="0"
								>
									<rect
										height={placement.height}
										rx={Math.min(8, placement.height / 4)}
										width={placement.width}
										x={placement.x}
										y={placement.y}
									/>
									<text
										dominant-baseline="middle"
										style={{ 'font-size': `${fontSize()}px` }}
										x={placement.x + 10 / props.camera().scale}
										y={placement.y + placement.height / 2}
									>
										{label().length > 34 ? `${label().slice(0, 33)}...` : label()}
									</text>
								</g>
							);
						}}
						</For>
					</Show>
				</svg>
			</Show>

			<Show when={workspace() === 'map' || workspace() === 'route-edit'}>
				<svg
					class="authoring-overlay"
					preserveAspectRatio="none"
					viewBox={`0 0 ${props.floor().width} ${props.floor().height}`}
				>
					<Show when={
						(workspace() === 'map' || workspace() === 'route-edit')
						&& state().activeTool === 'select'
					}>
						<For each={props.elements().filter((element) =>
							elementVisible(element) && elementInteractive(element)
						)}>
							{(element) => (
								<Show
									fallback={
										<Show when={workspace() === 'map' && isPointElement(element)}>
											<Show
												fallback={(
													<circle
														class="element-selection-hit"
														cx={isPointElement(element) ? element.point.x : 0}
														cy={isPointElement(element) ? element.point.y : 0}
														data-editor-element-id={element.id}
														onPointerDown={(event) => props.beginElementDrag(event, element)}
														r={Math.max(18, props.handleRadius() * 2.5)}
													/>
												)}
												when={isMediaElement(element) ? element : undefined}
											>
												{(media): JSX.Element => {
													const bounds = mediaBounds(media());

												return (
														<g transform={`rotate(${media().rotationDegrees ?? 0} ${media().point.x} ${media().point.y})`}>
															<rect
																class="element-selection-hit media-selection-hit"
																height={bounds.height}
																width={bounds.width}
																x={bounds.x}
																y={bounds.y}
																data-editor-element-id={media().id}
																onPointerDown={(event) => props.beginElementDrag(event, media())}
															/>
														</g>
													);
												}}
											</Show>
										</Show>
									}
									when={
										isPolygonElement(element)
										&& (
											workspace() === 'map'
											|| element.type === 'walkable'
											|| element.type === 'obstacle'
										)
									}
								>
									<polygon
										class="element-selection-hit"
										data-editor-element-id={element.id}
										onPointerDown={(event) => props.beginElementDrag(event, element)}
										points={pointsAttribute(isPolygonElement(element) ? element.geometry : [])}
									/>
								</Show>
							)}
						</For>
					</Show>

					<Show when={
						(workspace() === 'map' || workspace() === 'route-edit')
						&& props.selectedPolygon()
						&& elementVisible(props.selectedPolygon()!)
						&& elementInteractive(props.selectedPolygon()!)
					}>
						<polygon
							class="selected-polygon"
							fill="none"
							points={pointsAttribute(props.selectedPolygonGeometry())}
						/>
						<For each={props.selectedPolygonGeometry()}>
							{(point, index): JSX.Element => {
								const next = (): WayfindingPoint => props.selectedPolygonGeometry()[
									(index() + 1) % props.selectedPolygonGeometry().length
								];

								return (
									<line
										class="polygon-edge-hit"
										onDblClick={(event) => props.insertVertex(event, index())}
										x1={point.x}
										x2={next().x}
										y1={point.y}
										y2={next().y}
									/>
								);
							}}
						</For>
						<For each={props.selectedPolygonGeometry()}>
							{(point, index): JSX.Element => {
								const next = (): WayfindingPoint => props.selectedPolygonGeometry()[
									(index() + 1) % props.selectedPolygonGeometry().length
								];
								const center = (): WayfindingPoint => midpoint(point, next());

								return (
									<circle
										class="geometry-midpoint polygon-midpoint"
										cx={center().x}
										cy={center().y}
										onPointerDown={(event) => props.beginInsertedPolygonVertexDrag(
											event,
											center(),
											index()
										)}
										r={props.handleRadius() * 0.68}
									/>
								);
							}}
						</For>
						<For each={props.selectedPolygonGeometry()}>
							{(point, index) => (
								<circle
									class="polygon-vertex"
									classList={{ active: props.selectedVertexIndex() === index() }}
									cx={point.x}
									cy={point.y}
									data-polygon-vertex-index={index()}
									onPointerDown={(event) => props.beginVertexDrag(event, index())}
									r={props.handleRadius()}
								/>
							)}
						</For>
					</Show>

					<Show when={
						workspace() === 'map'
							&& props.selectedPoint()
							&& (!props.selectedElement() || elementVisible(props.selectedElement()!))
							&& props.selectedElement()?.type !== 'label'
							&& !mediaElement()
					}>
						<circle
							class="selected-point-handle"
							cx={props.selectedPoint()?.x}
							cy={props.selectedPoint()?.y}
							r={props.handleRadius() * 1.18}
						/>
					</Show>

					<Show when={workspace() === 'map' && directionElement()}>
						{(element): JSX.Element => {
							const end = (): WayfindingPoint => directionEndpoint(element());

							return (
								<>
									<line
										class="direction-guide"
										x1={element().point.x}
										x2={end().x}
										y1={element().point.y}
										y2={end().y}
									/>
									<circle
										class="transform-handle direction"
										cx={end().x}
										cy={end().y}
										data-transform-handle="direction"
										onPointerDown={(event) => props.beginDirectionDrag(event, element())}
										r={props.handleRadius()}
									/>
								</>
							);
						}}
					</Show>

					<Show when={workspace() === 'map' && mediaElement()}>
						{(element): JSX.Element => {
							const bounds = (): ReturnType<typeof mediaBounds> => mediaBounds(element());
							const rotationHandleY = (): number =>
								bounds().y - Math.max(22, props.handleRadius() * 3.2);

							return (
								<g transform={`rotate(${element().rotationDegrees ?? 0} ${element().point.x} ${element().point.y})`}>
									<rect
										class="media-selection-frame"
										height={bounds().height}
										width={bounds().width}
										x={bounds().x}
										y={bounds().y}
									/>
									<circle
										class="transform-handle resize"
										cx={bounds().x + bounds().width}
										cy={bounds().y + bounds().height}
										data-transform-handle="media-resize"
										onPointerDown={(event) => props.beginMediaResize(event, element())}
										r={props.handleRadius()}
									/>
									<line
										class="media-rotation-guide"
										x1={element().point.x}
										x2={element().point.x}
										y1={bounds().y}
										y2={rotationHandleY()}
									/>
									<circle
										class="transform-handle rotate"
										cx={element().point.x}
										cy={rotationHandleY()}
										data-transform-handle="media-rotate"
										onPointerDown={(event) => props.beginMediaRotate(event, element())}
										r={props.handleRadius()}
									/>
								</g>
							);
						}}
					</Show>

					<Show when={routeGraphInteractive()}>
						<For each={props.floorGraphEdges()}>
							{(edge): JSX.Element => {
								const geometry = (): WayfindingPoint[] => props.selectedGraphEdge()?.id === edge.id
									? props.selectedGraphGeometry()
									: props.graphEdgePoints(edge.id);

								return (
									<polyline
										class="graph-edge-hit"
										classList={{ active: props.selectedGraphEdge()?.id === edge.id }}
										data-route-edge-id={edge.id}
										points={pointsAttribute(geometry())}
									/>
								);
							}}
						</For>
						<For each={props.floorGraphNodes()}>
							{(node): JSX.Element => {
								const point = (): WayfindingPoint => graphNodePoint(
									node,
									props.interactionGraphPoint(),
									props.selectedGraphNode()
								);
								const endpoint = (): boolean => node.kind !== 'route'
									|| props.floorGraphEdges().filter((edge) =>
										edge.from === node.id || edge.to === node.id
									).length <= 1;

								return (
									<>
										<circle
											class="graph-node-hit"
											cx={point().x}
											cy={point().y}
											data-route-node-id={node.id}
											r={props.handleRadius() * 2.1}
										/>
										<circle
											class="graph-node-handle"
											classList={{
												active: props.selectedGraphNode()?.id === node.id,
												endpoint: endpoint()
											}}
											cx={point().x}
											cy={point().y}
											data-route-node-id={node.id}
											onPointerDown={(event) => props.beginGraphNodeDrag(event, node.id)}
											r={props.handleRadius()}
										/>
									</>
								);
							}}
						</For>
						<Show when={props.selectedGraphEdge()}>
							{(edge) => (
								<>
									<For each={props.selectedGraphGeometry().slice(0, -1)}>
										{(point, index): JSX.Element => {
											const next = (): WayfindingPoint | undefined =>
												props.selectedGraphGeometry()[index() + 1];

											return (
												<line
													class="graph-segment-hit"
													data-route-edge-id={edge().id}
													x1={point.x}
													x2={next()?.x}
													y1={point.y}
													y2={next()?.y}
												/>
											);
										}}
									</For>
									<For each={props.selectedGraphGeometry().slice(0, -1)}>
										{(point, index): JSX.Element => {
											const next = (): WayfindingPoint =>
												props.selectedGraphGeometry()[index() + 1];
											const center = (): WayfindingPoint => midpoint(point, next());

											return (
												<circle
													class="geometry-midpoint graph-midpoint"
													cx={center().x}
													cy={center().y}
													onPointerDown={(event) => props.beginInsertedGraphPointDrag(
														event,
														center(),
														edge().id,
														index()
													)}
													r={props.handleRadius() * 0.68}
												/>
											);
										}}
									</For>
									<For each={props.selectedGraphGeometry().slice(1, -1)}>
										{(point, index): JSX.Element => {
											const geometryIndex = (): number => index() + 1;

											return (
												<circle
													class="graph-edge-point"
													classList={{
														active: props.selectedGraphGeometryIndex() === geometryIndex()
													}}
													cx={point.x}
													cy={point.y}
													data-geometry-index={geometryIndex()}
													data-route-edge-point={edge().id}
													onPointerDown={(event) => props.beginGraphEdgePointDrag(
														event,
														edge().id,
														geometryIndex()
													)}
													r={props.handleRadius()}
												/>
											);
										}}
									</For>
								</>
							)}
						</Show>
					</Show>

					<Show when={props.polygonDraft()}>
						{(draft) => (
							<>
								<polyline
									class="draft-line"
									points={pointsAttribute(props.draftCursor()
										? [...draft().points, props.draftCursor()!]
										: draft().points)}
								/>
								<For each={draft().points}>
									{(point) => (
										<circle
											class="draft-point"
											cx={point.x}
											cy={point.y}
											r={props.handleRadius() * 0.72}
										/>
									)}
								</For>
								<Show when={props.draftCursor()}>
									{(point) => (
										<circle
											class="draft-point cursor"
											cx={point().x}
											cy={point().y}
											r={props.handleRadius() * 0.64}
										/>
									)}
								</Show>
							</>
						)}
					</Show>
					<Show when={props.freehandGeometry()}>
						<polyline
							class="draft-line"
							points={pointsAttribute(props.freehandGeometry() ?? [])}
						/>
					</Show>
					<Show when={props.routeDraft()}>
						{(draft) => (
							<>
								<polyline
									class="draft-route-line"
									points={pointsAttribute(props.draftCursor()
										? [...draft().points, props.draftCursor()!]
										: draft().points)}
								/>
								<For each={draft().points}>
									{(point) => (
										<circle
											class="draft-point route"
											cx={point.x}
											cy={point.y}
											r={props.handleRadius() * 0.72}
										/>
									)}
								</For>
								<Show when={props.draftCursor()}>
									{(point) => (
										<circle
											class="draft-point route cursor"
											cx={point().x}
											cy={point().y}
											r={props.handleRadius() * 0.64}
										/>
									)}
								</Show>
							</>
						)}
					</Show>
				</svg>
			</Show>
		</div>
	);
};
