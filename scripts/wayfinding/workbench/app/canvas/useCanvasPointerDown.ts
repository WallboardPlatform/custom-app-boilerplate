import type {
	Accessor,
	JSX,
	Setter
} from 'solid-js';

import type {
	WayfindingStudioElement,
	WayfindingStudioPolygonElement
} from '../../../studio-project.mts';
import type {
	EditorCamera2d,
	EditorDraft,
	EditorSnapshot,
	EditorStore,
	EditorTool
} from '../../../editor-core/types';
import type { WayfindingPoint } from '../../../../../src/utils/wayfinding.js';
import {
	isCanvasElementInteractive,
	type RouteWorkspaceView
} from '../features/routing/route-workspace';
import {
	constrainPointToAngle,
	nearestSegment
} from './editing';
import {
	type DragInteraction,
	POINT_TOOLS,
	POLYGON_TOOLS,
	polygonTypeForTool
} from './interaction';
import type { CanvasKeyboardController } from './useCanvasKeyboard';

export const createCanvasPointerDownHandler = (options: {
	beginElementDrag: (event: PointerEvent, element: WayfindingStudioElement) => void;
	beginGraphEdgePointDrag: (event: PointerEvent, edgeId: string, geometryIndex: number) => void;
	beginGraphNodeDrag: (event: PointerEvent, nodeId: string) => void;
	beginVertexDrag: (event: PointerEvent, vertexIndex: number) => void;
	camera: Accessor<EditorCamera2d>;
	createPointElement: (tool: EditorTool, point: WayfindingPoint) => void;
	createRouteNode: (point: WayfindingPoint) => void;
	draft: Accessor<EditorDraft | undefined>;
	findElement: (elementId: string) => WayfindingStudioElement | undefined;
	graphEdgePoints: (edgeId: string) => WayfindingPoint[];
	insertGraphPoint: (point: WayfindingPoint, edgeId: string, afterIndex: number) => void;
	keyboard: CanvasKeyboardController;
	mapPoint: (event: MouseEvent | PointerEvent | WheelEvent) => WayfindingPoint;
	onPreviewDestinationSelect?: (destinationId: string | undefined) => void;
	routeGraphInteractive: () => boolean;
	routeWorkspaceView: () => RouteWorkspaceView;
	selectedPolygon: Accessor<WayfindingStudioPolygonElement | undefined>;
	setDraftCursor: Setter<WayfindingPoint | undefined>;
	setFreehandGeometry: Setter<WayfindingPoint[] | undefined>;
	setInteraction: (interaction: DragInteraction | undefined) => void;
	snapFreehandPoint: (point: WayfindingPoint) => WayfindingPoint;
	snapshot: Accessor<EditorSnapshot>;
	store: EditorStore;
	traceRegion: (point: WayfindingPoint) => void;
	viewportPoint: (event: MouseEvent | PointerEvent | WheelEvent) => WayfindingPoint;
}): JSX.EventHandler<HTMLDivElement, PointerEvent> => {
	let lastRouteEdgeClick: {
		edgeId: string;
		point: WayfindingPoint;
		time: number;
	} | undefined;

	return (event): void => {
		const state = options.snapshot().state;
		const tool = state.activeTool;
		const target = event.target instanceof Element ? event.target : undefined;
		const mapPoint = options.mapPoint(event);

		event.currentTarget.focus({ preventScroll: true });

		if (event.button === 1 || options.keyboard.isSpaceHeld() || tool === 'pan') {
			event.preventDefault();
			options.setInteraction({
				cameraStart: { ...options.camera() },
				kind: 'pan',
				pointerId: event.pointerId,
				start: options.viewportPoint(event)
			});
			event.currentTarget.setPointerCapture(event.pointerId);

			return;
		}

		if (event.button !== 0) return;

		if (
			tool === 'smart-trace'
			&& (
				state.workspace === 'map'
				|| (state.workspace === 'route-edit' && options.routeWorkspaceView() === 'space')
			)
		) {
			options.traceRegion(mapPoint);

			return;
		}

		if (
			tool === 'freehand'
			&& (
				state.workspace === 'map'
				|| (state.workspace === 'route-edit' && options.routeWorkspaceView() === 'space')
			)
		) {
			event.preventDefault();
			const elementType: WayfindingStudioPolygonElement['type'] = state.workspace === 'route-edit'
				? 'walkable'
				: 'location';
			const interaction: DragInteraction = {
				elementType,
				kind: 'freehand',
				pointerId: event.pointerId,
				points: [options.snapFreehandPoint(mapPoint)]
			};
			options.setInteraction(interaction);
			options.setFreehandGeometry(interaction.points);
			event.currentTarget.setPointerCapture(event.pointerId);

			return;
		}

		if (
			POLYGON_TOOLS.has(tool)
			&& (
				state.workspace === 'map'
				|| (
					state.workspace === 'route-edit'
					&& options.routeWorkspaceView() === 'space'
					&& (tool === 'walkable' || tool === 'obstacle')
				)
			)
		) {
			if (event.detail > 1) return;
			const elementType = polygonTypeForTool(tool);

			if (!elementType) return;
			const activeDraft = options.draft();
			const currentDraft: Extract<EditorDraft, { kind: 'polygon' }> =
				activeDraft?.kind === 'polygon' && activeDraft.elementType === elementType
					? activeDraft
					: { elementType, kind: 'polygon', points: [] };
			const point = event.shiftKey && currentDraft.points.length > 0
				? constrainPointToAngle(currentDraft.points.at(-1)!, mapPoint)
				: mapPoint;
			options.store.dispatch({
				type: 'draft/set',
				draft: { ...currentDraft, points: [...currentDraft.points, point] }
			});
			options.setDraftCursor(point);

			return;
		}

		if (POINT_TOOLS.has(tool) && state.workspace === 'map') {
			options.createPointElement(tool, mapPoint);

			return;
		}

		if (tool === 'route-node' && options.routeGraphInteractive()) {
			options.createRouteNode(mapPoint);

			return;
		}

		if (tool === 'route-edge' && options.routeGraphInteractive()) {
			if (event.detail > 1) return;
			const currentDraft: EditorDraft = options.draft()?.kind === 'route-edge'
				? options.draft()!
				: { kind: 'route-edge', points: [] };
			const point = event.shiftKey && currentDraft.points.length > 0
				? constrainPointToAngle(currentDraft.points.at(-1)!, mapPoint)
				: mapPoint;
			options.store.dispatch({
				type: 'draft/set',
				draft: { ...currentDraft, points: [...currentDraft.points, point] }
			});
			options.setDraftCursor(point);

			return;
		}

		if (options.routeGraphInteractive() && tool === 'select') {
			const graphNodeTarget = target?.closest('[data-route-node-id]');
			const graphEdgePointTarget = target?.closest('[data-route-edge-point]');
			const graphEdgeTarget = target?.closest('[data-route-edge-id]');

			if (graphNodeTarget) {
				const nodeId = graphNodeTarget.getAttribute('data-route-node-id');

				if (nodeId) options.beginGraphNodeDrag(event, nodeId);

				return;
			}

			if (graphEdgePointTarget) {
				const edgeId = graphEdgePointTarget.getAttribute('data-route-edge-point');
				const geometryIndex = Number(graphEdgePointTarget.getAttribute('data-geometry-index'));

				if (edgeId) options.beginGraphEdgePointDrag(event, edgeId, geometryIndex);

				return;
			}

			if (graphEdgeTarget) {
				const edgeId = graphEdgeTarget.getAttribute('data-route-edge-id');

				if (!edgeId) return;
				const geometry = options.graphEdgePoints(edgeId);
				const nearest = nearestSegment(geometry, mapPoint, false);
				const now = performance.now();
				const isClickPair = lastRouteEdgeClick?.edgeId === edgeId
					&& now - lastRouteEdgeClick.time <= 420
					&& Math.hypot(
						mapPoint.x - lastRouteEdgeClick.point.x,
						mapPoint.y - lastRouteEdgeClick.point.y
					) <= 14 / options.camera().scale;
				lastRouteEdgeClick = { edgeId, point: mapPoint, time: now };

				if (isClickPair && nearest && nearest.distance <= 14 / options.camera().scale) {
					event.preventDefault();
					event.stopPropagation();
					lastRouteEdgeClick = undefined;
					options.insertGraphPoint(mapPoint, edgeId, nearest.index);

					return;
				}
				event.preventDefault();
				event.stopPropagation();
				options.store.dispatch({
					type: 'selection/set',
					selection: { id: edgeId, kind: 'graph-edge' }
				});

				return;
			}
		}

		const polygonVertexTarget = target?.closest('[data-polygon-vertex-index]');

		if (
			(state.workspace === 'map' || state.workspace === 'route-edit')
			&& tool === 'select'
			&& polygonVertexTarget
			&& options.selectedPolygon()
			&& isCanvasElementInteractive(
				state.workspace,
				options.routeWorkspaceView(),
				options.selectedPolygon()!.type
			)
		) {
			const vertexIndex = Number(polygonVertexTarget.getAttribute('data-polygon-vertex-index'));

			if (Number.isInteger(vertexIndex)) options.beginVertexDrag(event, vertexIndex);

			return;
		}

		const elementTarget = target?.closest('[data-editor-element-id], [data-wayfinding-level]');
		const visitorDestinationTarget = target?.closest('[data-visitor-destination-id]');

		if (state.workspace === 'preview') {
			const destinationId = visitorDestinationTarget?.getAttribute('data-visitor-destination-id');

			if (destinationId) {
				event.preventDefault();
				event.stopPropagation();
				options.store.dispatch({
					type: 'selection/set',
					selection: { id: destinationId, kind: 'destination' }
				});
				options.onPreviewDestinationSelect?.(destinationId);
			} else if (!options.keyboard.isSpaceHeld()) {
				options.store.dispatch({ type: 'selection/clear' });
				options.onPreviewDestinationSelect?.(undefined);
			}

			return;
		}

		if (
			elementTarget
			&& tool === 'select'
			&& (state.workspace === 'map' || state.workspace === 'route-edit')
		) {
			const elementId = elementTarget.getAttribute('data-editor-element-id') || elementTarget.id;
			const element = options.findElement(elementId);

			if (!element) return;

			if (!isCanvasElementInteractive(state.workspace, options.routeWorkspaceView(), element.type)) {
				// Pedestrian-space geometry is deliberately background context in Map.
				// Treating it like empty canvas keeps rooms, doors, and points easy to
				// work with while still letting Space mode own that geometry.
				if (state.workspace === 'map') options.store.dispatch({ type: 'selection/clear' });

				return;
			}
			options.beginElementDrag(event, element);

			return;
		}

		if (tool === 'select' && options.selectedPolygon() && target?.closest('.authoring-overlay')) {
			return;
		}

		if (tool === 'select') options.store.dispatch({ type: 'selection/clear' });
	};
};
