import {
	For,
	Show,
	type Accessor,
	type JSX
} from 'solid-js';
import {
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
} from '../features/preview';
import {
	isCanvasElementInteractive,
	isRouteGraphInteractive,
	type RouteWorkspaceView
} from '../features/routing';
import {
	isPointElement,
	isPolygonElement,
	pointsAttribute
} from './model';
import { RouteOverlay } from './RouteOverlay';
import { VisitorMapOverlay } from './VisitorMapOverlay';

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
	const showRouteNetwork = (): boolean => workspace() === 'route-edit'
		|| (
			workspace() === 'preview'
			&& Boolean(props.showRouteNetwork?.())
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

			<RouteOverlay
				camera={props.camera}
				floor={props.floor}
				floorGraphEdges={props.floorGraphEdges}
				graphEdgePoints={props.graphEdgePoints}
				route={props.route}
				selectedGraphEdge={props.selectedGraphEdge}
				selectedGraphGeometry={props.selectedGraphGeometry}
				selectedGraphNode={props.selectedGraphNode}
				showRouteNetwork={showRouteNetwork}
				snapshot={props.snapshot}
			/>

			<Show when={workspace() === 'preview'}>
				<VisitorMapOverlay
					activateDestination={props.activateVisitorDestination}
					camera={props.camera}
					elements={props.elements}
					floor={props.floor}
					labelPlacements={props.visitorLabelPlacements}
					mapItems={props.visitorMapItems}
					snapshot={props.snapshot}
				/>
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
