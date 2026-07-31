import type {
	Accessor,
	JSX,
	Setter
} from 'solid-js';

import type {
	WayfindingStudioElement,
	WayfindingStudioFloor,
	WayfindingStudioPolygonElement
} from '../../../studio-project.mts';
import type {
	EditorCamera2d,
	EditorDraft,
	EditorStore
} from '../../../editor-core/types';
import type {
	WayfindingEdge,
	WayfindingNode,
	WayfindingPoint
} from '../../../../../src/utils/wayfinding.js';
import {
	constrainPointToAngle,
	moveGraphNodeTransaction,
	pointerMoved,
	translateGeometry,
	translatePoint
} from './editing';
import {
	appendFreehandPoint,
	simplifyFreehandPolygon
} from './freehand';
import type { DragInteraction } from './interaction';

export interface ElementInteractionPreview {
	elementId: string;
	patch: Partial<WayfindingStudioElement>;
}

const rotateAround = (
	point: WayfindingPoint,
	origin: WayfindingPoint,
	degrees: number
): WayfindingPoint => {
	const radians = degrees * Math.PI / 180;
	const cosine = Math.cos(radians);
	const sine = Math.sin(radians);
	const deltaX = point.x - origin.x;
	const deltaY = point.y - origin.y;

	return {
		x: origin.x + deltaX * cosine - deltaY * sine,
		y: origin.y + deltaX * sine + deltaY * cosine
	};
};

export const createCanvasDragController = (options: {
	addFreehandPolygon: (
		elementType: WayfindingStudioPolygonElement['type'],
		geometry: WayfindingPoint[]
	) => void;
	camera: Accessor<EditorCamera2d>;
	draft: Accessor<EditorDraft | undefined>;
	floor: Accessor<WayfindingStudioFloor>;
	floorGraphEdges: Accessor<WayfindingEdge[]>;
	floorGraphNodes: Accessor<WayfindingNode[]>;
	getInteraction: () => DragInteraction | undefined;
	mapPoint: (event: MouseEvent | PointerEvent | WheelEvent) => WayfindingPoint;
	notify?: (message: string, tone?: 'danger' | 'info' | 'success' | 'warning') => void;
	onPointerCoordinate?: (point: WayfindingPoint) => void;
	resolvePointElementPatch?: (
		elementId: string,
		point: WayfindingPoint
	) => Partial<WayfindingStudioElement>;
	setCamera: (camera: EditorCamera2d) => void;
	setDraftCursor: Setter<WayfindingPoint | undefined>;
	setFreehandGeometry: Setter<WayfindingPoint[] | undefined>;
	setInteraction: (interaction: DragInteraction | undefined) => void;
	setInteractionElementPreview: Setter<ElementInteractionPreview | undefined>;
	setInteractionGeometry: Setter<WayfindingPoint[] | undefined>;
	setInteractionGraphGeometry: Setter<WayfindingPoint[] | undefined>;
	setInteractionGraphPoint: Setter<WayfindingPoint | undefined>;
	snapFreehandPoint: (point: WayfindingPoint) => WayfindingPoint;
	store: EditorStore;
	viewportPoint: (event: MouseEvent | PointerEvent | WheelEvent) => WayfindingPoint;
}): {
	pointerMove: JSX.EventHandler<HTMLDivElement, PointerEvent>;
	pointerUp: () => void;
} => {
	const pointerMove: JSX.EventHandler<HTMLDivElement, PointerEvent> = (event): void => {
		const point = options.viewportPoint(event);
		const mapPoint = options.mapPoint(event);
		options.onPointerCoordinate?.(mapPoint);
		const activeDraft = options.draft();
		const previousDraftPoint = activeDraft?.points.at(-1);

		options.setDraftCursor(activeDraft && previousDraftPoint
			? event.shiftKey
				? constrainPointToAngle(previousDraftPoint, mapPoint)
				: mapPoint
			: undefined);

		const interaction = options.getInteraction();

		if (!interaction) return;

		if (interaction.kind === 'pan') {
			options.setCamera({
				...interaction.cameraStart,
				offsetX: interaction.cameraStart.offsetX + point.x - interaction.start.x,
				offsetY: interaction.cameraStart.offsetY + point.y - interaction.start.y
			});

			return;
		}

		if (interaction.kind === 'freehand') {
			const snappedPoint = options.snapFreehandPoint(mapPoint);
			interaction.points = appendFreehandPoint(
				interaction.points,
				snappedPoint,
				Math.max(1.5, 4 / options.camera().scale)
			);
			options.setFreehandGeometry(interaction.points);

			return;
		}

		if (interaction.kind === 'point') {
			if (!interaction.moved && !pointerMoved(interaction.start, mapPoint, options.camera().scale)) return;
			const translatedPoint = translatePoint(
				interaction.original,
				interaction.start,
				mapPoint,
				options.floor().width,
				options.floor().height
			);
			const patch = options.resolvePointElementPatch?.(
				interaction.elementId,
				translatedPoint
			) ?? { point: translatedPoint };
			interaction.point = 'point' in patch && patch.point
				? patch.point
				: translatedPoint;
			interaction.patch = patch;
			interaction.moved = true;
			options.setInteractionElementPreview({
				elementId: interaction.elementId,
				patch
			});

			return;
		}

		if (interaction.kind === 'direction') {
			const deltaX = mapPoint.x - interaction.origin.x;
			const deltaY = mapPoint.y - interaction.origin.y;
			const angle = interaction.property === 'angle'
				? Math.atan2(deltaY, deltaX) * 180 / Math.PI
				: Math.atan2(deltaX, -deltaY) * 180 / Math.PI;
			interaction.angle = event.shiftKey ? Math.round(angle / 15) * 15 : angle;
			interaction.moved = true;
			options.setInteractionElementPreview({
				elementId: interaction.elementId,
				patch: { [interaction.property]: interaction.angle }
			});

			return;
		}

		if (interaction.kind === 'media-resize') {
			const localPoint = rotateAround(mapPoint, interaction.origin, -interaction.rotationDegrees);
			const rawHalfWidth = Math.max(1, Math.abs(localPoint.x - interaction.origin.x));
			const rawHalfHeight = Math.max(1, Math.abs(localPoint.y - interaction.origin.y));
			const currentWidth = interaction.originalWidth;
			const currentHeight = interaction.originalHeight;
			const scale = Math.max(
				rawHalfWidth / Math.max(1, currentWidth / 2),
				rawHalfHeight / Math.max(1, currentHeight / 2),
				12 / Math.max(1, Math.min(currentWidth, currentHeight))
			);
			const maxWidth = Math.max(12, 2 * Math.min(interaction.origin.x, options.floor().width - interaction.origin.x));
			const maxHeight = Math.max(12, 2 * Math.min(interaction.origin.y, options.floor().height - interaction.origin.y));
			const boundedScale = Math.min(
				scale,
				maxWidth / Math.max(1, currentWidth),
				maxHeight / Math.max(1, currentHeight)
			);
			interaction.width = currentWidth * boundedScale;
			interaction.height = interaction.width / interaction.aspectRatio;
			interaction.moved = true;
			options.setInteractionElementPreview({
				elementId: interaction.elementId,
				patch: {
					height: interaction.height,
					width: interaction.width
				}
			});

			return;
		}

		if (interaction.kind === 'graph-node') {
			if (!interaction.moved && !pointerMoved(interaction.start, mapPoint, options.camera().scale)) return;
			interaction.point = translatePoint(
				interaction.original,
				interaction.start,
				mapPoint,
				options.floor().width,
				options.floor().height
			);
			interaction.moved = true;
			options.setInteractionGraphPoint(interaction.point);

			return;
		}

		if (interaction.kind === 'graph-edge-point') {
			if (!interaction.moved && !pointerMoved(interaction.start, mapPoint, options.camera().scale)) return;
			interaction.geometry = translateGeometry(
				interaction.original,
				interaction.start,
				mapPoint,
				options.floor().width,
				options.floor().height,
				interaction.geometryIndex
			);
			interaction.moved = true;
			options.setInteractionGraphGeometry(interaction.geometry);

			return;
		}

		if (!interaction.moved && !pointerMoved(interaction.start, mapPoint, options.camera().scale)) return;
		const geometry = translateGeometry(
			interaction.original,
			interaction.start,
			mapPoint,
			options.floor().width,
			options.floor().height,
			interaction.vertexIndex
		);
		interaction.geometry = geometry;
		interaction.moved = true;
		options.setInteractionGeometry(geometry);
	};

	const pointerUp = (): void => {
		const interaction = options.getInteraction();

		if (interaction?.kind === 'freehand') {
			const geometry = simplifyFreehandPolygon(
				interaction.points,
				Math.max(1, 3 / options.camera().scale)
			);

			if (geometry.length >= 3) {
				options.addFreehandPolygon(interaction.elementType, geometry);
			} else {
				options.notify?.('Draw a larger closed area before releasing the pointer.', 'warning');
			}
		}

		if (interaction?.kind === 'polygon' && (interaction.moved || interaction.inserted)) {
			options.store.dispatch({
				type: 'element/patch',
				elementId: interaction.elementId,
				patch: { geometry: interaction.geometry }
			});
		}

		if (interaction?.kind === 'point' && interaction.moved) {
			options.store.dispatch({
				type: 'element/patch',
				elementId: interaction.elementId,
				patch: (interaction.patch ?? { point: interaction.point }) as Partial<WayfindingStudioElement>
			});
		}

		if (interaction?.kind === 'direction' && interaction.moved) {
			options.store.dispatch({
				type: 'element/patch',
				elementId: interaction.elementId,
				patch: { [interaction.property]: interaction.angle }
			});
		}

		if (interaction?.kind === 'media-resize' && interaction.moved) {
			options.store.dispatch({
				type: 'element/patch',
				elementId: interaction.elementId,
				patch: {
					height: interaction.height,
					width: interaction.width
				}
			});
		}

		if (interaction?.kind === 'graph-edge-point' && (interaction.moved || interaction.inserted)) {
			options.store.dispatch({
				type: 'graph/edge-patch',
				edgeId: interaction.routeEdgeId,
				patch: { geometry: interaction.geometry }
			});
			options.store.dispatch({
				type: 'selection/set',
				selection: {
					geometryIndex: interaction.geometryIndex,
					id: interaction.routeEdgeId,
					kind: 'graph-edge'
				}
			});
		}

		if (interaction?.kind === 'graph-node' && interaction.moved) {
			options.store.run(moveGraphNodeTransaction(
				interaction.nodeId,
				interaction.point,
				options.floorGraphNodes(),
				options.floorGraphEdges()
			));
		}
		options.setInteraction(undefined);
		options.setFreehandGeometry(undefined);
		options.setInteractionGeometry(undefined);
		options.setInteractionGraphGeometry(undefined);
		options.setInteractionGraphPoint(undefined);
		options.setInteractionElementPreview(undefined);
	};

	return { pointerMove, pointerUp };
};
