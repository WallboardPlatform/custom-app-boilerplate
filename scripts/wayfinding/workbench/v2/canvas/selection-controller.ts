import type {
	WayfindingStudioElement,
	WayfindingStudioFloor
} from '../../../studio-project.mts';
import type {
	EditorSelection,
	EditorState,
	EditorTransaction
} from '../../../editor-core/types';
import type {
	WayfindingEdge,
	WayfindingNode,
	WayfindingPoint
} from '../../../../../src/utils/wayfinding.js';
import {
	inspectRouteGeometry,
	repairRouteGeometry,
	straightenRouteGeometry
} from '../route-geometry';
import {
	insertGeometryPoint,
	moveGraphNodeTransaction,
	removeGeometryPoint,
	simplifyPolygonGeometry
} from './editing';
import { clampPoint } from './geometry';
import {
	edgeGeometry,
	isPointElement,
	isPolygonElement
} from './model';

export type CanvasSelectionKind =
	| 'destination'
	| 'point'
	| 'polygon'
	| 'route-node'
	| 'route-segment';

export interface CanvasSelectionDescriptor {
	canAddPoint: boolean;
	canDelete: boolean;
	canDuplicate: boolean;
	canFit: boolean;
	canRemovePoint: boolean;
	canRepair: boolean;
	canSimplify: boolean;
	canStraighten: boolean;
	issueCount: number;
	kind: CanvasSelectionKind;
	pointCount: number;
	pointKind?: 'bend' | 'vertex';
}

export type CanvasSelectionOperation =
	| { type: 'add-point' }
	| { type: 'delete' }
	| { createId: (prefix: string) => string; type: 'duplicate' }
	| { delta: WayfindingPoint; type: 'nudge' }
	| { type: 'remove-point' }
	| { type: 'repair' }
	| { type: 'simplify' }
	| { type: 'straighten' };

export interface CanvasSelectionOperationResult {
	notification?: {
		message: string;
		tone: 'danger' | 'info' | 'success' | 'warning';
	};
	selection?: EditorSelection;
	transaction: EditorTransaction;
}

const selectedFloor = (state: EditorState): WayfindingStudioFloor | undefined =>
	state.project.floors.find((floor) => floor.id === state.currentFloorId)
	?? state.project.floors[0];

const selectedElement = (
	state: EditorState
): WayfindingStudioElement | undefined => {
	const selection = state.selection;

	if (selection?.kind !== 'element') return undefined;

	return selectedFloor(state)?.elements.find((element) => element.id === selection.id);
};

const selectedEdge = (
	state: EditorState
): WayfindingEdge | undefined => {
	const selection = state.selection;

	return selection?.kind === 'graph-edge'
		? state.project.graph.edges.find((edge) => edge.id === selection.id)
		: undefined;
};

const floorNodes = (state: EditorState): WayfindingNode[] =>
	state.project.graph.nodes.filter((node) => node.levelId === selectedFloor(state)?.id);

const floorEdges = (state: EditorState): WayfindingEdge[] => {
	const nodeIds = new Set(floorNodes(state).map((node) => node.id));

	return state.project.graph.edges.filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to));
};

const result = (
	label: string,
	commands: EditorTransaction['commands'],
	selection?: EditorSelection,
	notification?: CanvasSelectionOperationResult['notification']
): CanvasSelectionOperationResult => ({
	notification,
	selection,
	transaction: { commands, label }
});

const translatedGeometry = (
	geometry: readonly WayfindingPoint[],
	delta: WayfindingPoint,
	floor: WayfindingStudioFloor
): WayfindingPoint[] => geometry.map((point) => clampPoint({
	x: point.x + delta.x,
	y: point.y + delta.y
}, floor.width, floor.height));

const nudgeElement = (
	element: WayfindingStudioElement,
	selection: Extract<EditorSelection, { kind: 'element' }>,
	delta: WayfindingPoint,
	floor: WayfindingStudioFloor
): CanvasSelectionOperationResult | undefined => {
	if (isPolygonElement(element)) {
		const geometry = element.geometry.map((point, index) =>
			selection.vertexIndex === undefined || selection.vertexIndex === index
				? clampPoint({ x: point.x + delta.x, y: point.y + delta.y }, floor.width, floor.height)
				: { ...point });

		return result('Move shape', [{
			type: 'element/patch',
			elementId: element.id,
			patch: { geometry }
		}], selection);
	}

	if (!isPointElement(element)) return undefined;

	return result('Move map item', [{
		type: 'element/patch',
		elementId: element.id,
		patch: {
			point: clampPoint({
				x: element.point.x + delta.x,
				y: element.point.y + delta.y
			}, floor.width, floor.height)
		}
	}], selection);
};

const duplicateElement = (
	state: EditorState,
	element: WayfindingStudioElement,
	createId: (prefix: string) => string
): CanvasSelectionOperationResult | undefined => {
	const floor = selectedFloor(state);

	if (!floor) return undefined;
	const duplicate = structuredClone(element);
	duplicate.id = createId(element.type);
	const sourceDestinationId = 'destinationId' in element ? element.destinationId : undefined;
	const duplicateDestinationId = sourceDestinationId ? createId('destination') : undefined;
	const commands: EditorTransaction['commands'] = [];

	if (isPolygonElement(duplicate)) {
		duplicate.geometry = translatedGeometry(duplicate.geometry, { x: 16, y: 16 }, floor);
	} else if (isPointElement(duplicate)) {
		duplicate.point = clampPoint({
			x: duplicate.point.x + 16,
			y: duplicate.point.y + 16
		}, floor.width, floor.height);
	}

	if (duplicateDestinationId && 'destinationId' in duplicate) {
		duplicate.destinationId = duplicateDestinationId;
		const destination = state.project.destinations.find(
			(candidate) => candidate.id === sourceDestinationId
		);

		if (destination) {
			commands.push({
				type: 'destination/add',
				destination: {
					...structuredClone(destination),
					id: duplicateDestinationId,
					name: `${destination.name} copy`
				}
			});
		}
	}
	commands.push({ type: 'element/add', element: duplicate, floorId: floor.id });

	return result(
		`Duplicate ${element.type}`,
		commands,
		{ id: duplicate.id, kind: 'element' }
	);
};

export const describeCanvasSelection = (
	state: EditorState
): CanvasSelectionDescriptor | undefined => {
	const selection = state.selection;

	if (!selection) return undefined;

	if (selection.kind === 'destination') {
		return {
			canAddPoint: false,
			canDelete: true,
			canDuplicate: false,
			canFit: false,
			canRemovePoint: false,
			canRepair: false,
			canSimplify: false,
			canStraighten: false,
			issueCount: 0,
			kind: 'destination',
			pointCount: 0
		};
	}

	if (selection.kind === 'graph-node') {
		return {
			canAddPoint: false,
			canDelete: true,
			canDuplicate: false,
			canFit: true,
			canRemovePoint: false,
			canRepair: false,
			canSimplify: false,
			canStraighten: false,
			issueCount: 0,
			kind: 'route-node',
			pointCount: 1
		};
	}

	if (selection.kind === 'graph-edge') {
		const edge = selectedEdge(state);
		const nodes = floorNodes(state);
		const geometry = edgeGeometry(edge, nodes);

		if (!edge) return undefined;
		const hasEditableBend = selection.geometryIndex !== undefined
			&& selection.geometryIndex > 0
			&& selection.geometryIndex < geometry.length - 1;

		return {
			canAddPoint: geometry.length >= 2,
			canDelete: true,
			canDuplicate: false,
			canFit: true,
			canRemovePoint: hasEditableBend,
			canRepair: true,
			canSimplify: false,
			canStraighten: true,
			issueCount: inspectRouteGeometry(edge, nodes).length,
			kind: 'route-segment',
			pointCount: geometry.length,
			pointKind: 'bend'
		};
	}

	const element = selectedElement(state);

	if (!element) return undefined;

	if (isPolygonElement(element)) {
		return {
			canAddPoint: true,
			canDelete: true,
			canDuplicate: true,
			canFit: true,
			canRemovePoint: selection.vertexIndex !== undefined && element.geometry.length > 3,
			canRepair: false,
			canSimplify: true,
			canStraighten: false,
			issueCount: 0,
			kind: 'polygon',
			pointCount: element.geometry.length,
			pointKind: 'vertex'
		};
	}

	return {
		canAddPoint: false,
		canDelete: true,
		canDuplicate: true,
		canFit: true,
		canRemovePoint: false,
		canRepair: false,
		canSimplify: false,
		canStraighten: false,
		issueCount: 0,
		kind: 'point',
		pointCount: 1
	};
};

export const insertionSegmentIndex = (
	geometry: readonly WayfindingPoint[],
	selectedIndex: number | undefined,
	closed: boolean
): number | undefined => {
	if (geometry.length < 2) return undefined;
	const lastSegmentIndex = closed ? geometry.length - 1 : geometry.length - 2;

	if (selectedIndex !== undefined) return Math.min(selectedIndex, lastSegmentIndex);
	let longestIndex = 0;
	let longestLength = -1;

	for (let index = 0; index <= lastSegmentIndex; index += 1) {
		const next = geometry[(index + 1) % geometry.length];
		const length = Math.hypot(next.x - geometry[index].x, next.y - geometry[index].y);

		if (length <= longestLength) continue;
		longestLength = length;
		longestIndex = index;
	}

	return longestIndex;
};

export const segmentMidpoint = (
	geometry: readonly WayfindingPoint[],
	afterIndex: number,
	closed: boolean
): WayfindingPoint => {
	const nextIndex = closed
		? (afterIndex + 1) % geometry.length
		: Math.min(afterIndex + 1, geometry.length - 1);

	return {
		x: (geometry[afterIndex].x + geometry[nextIndex].x) / 2,
		y: (geometry[afterIndex].y + geometry[nextIndex].y) / 2
	};
};

export const buildCanvasSelectionOperation = (
	state: EditorState,
	operation: CanvasSelectionOperation
): CanvasSelectionOperationResult | undefined => {
	const selection = state.selection;
	const floor = selectedFloor(state);

	if (!selection || !floor) return undefined;
	const element = selectedElement(state);
	const edge = selectedEdge(state);
	const nodes = floorNodes(state);

	if (operation.type === 'duplicate') {
		return element ? duplicateElement(state, element, operation.createId) : undefined;
	}

	if (operation.type === 'nudge') {
		if (selection.kind === 'element' && element) {
			return nudgeElement(element, selection, operation.delta, floor);
		}

		if (selection.kind === 'graph-node') {
			const node = nodes.find((candidate) => candidate.id === selection.id);

			if (!node) return undefined;
			const point = clampPoint({
				x: node.x + operation.delta.x,
				y: node.y + operation.delta.y
			}, floor.width, floor.height);
			const transaction = moveGraphNodeTransaction(
				node.id,
				point,
				nodes,
				floorEdges(state)
			);

			return { selection, transaction };
		}

		if (selection.kind === 'graph-edge' && selection.geometryIndex !== undefined && edge) {
			const geometry = edgeGeometry(edge, nodes);
			const point = geometry[selection.geometryIndex];

			if (!point) return undefined;
			geometry[selection.geometryIndex] = clampPoint({
				x: point.x + operation.delta.x,
				y: point.y + operation.delta.y
			}, floor.width, floor.height);

			return result('Move route bend', [{
				type: 'graph/edge-patch',
				edgeId: edge.id,
				patch: { geometry }
			}], selection);
		}

		return undefined;
	}

	if (operation.type === 'add-point') {
		if (selection.kind === 'element' && element && isPolygonElement(element)) {
			const afterIndex = insertionSegmentIndex(element.geometry, selection.vertexIndex, true);

			if (afterIndex === undefined) return undefined;
			const geometry = insertGeometryPoint(
				element.geometry,
				afterIndex,
				segmentMidpoint(element.geometry, afterIndex, true)
			);

			return result('Add shape point', [{
				type: 'element/patch',
				elementId: element.id,
				patch: { geometry }
			}], { id: element.id, kind: 'element', vertexIndex: afterIndex + 1 });
		}

		if (selection.kind === 'graph-edge' && edge) {
			const geometry = edgeGeometry(edge, nodes);
			const afterIndex = insertionSegmentIndex(geometry, selection.geometryIndex, false);

			if (afterIndex === undefined) return undefined;
			const nextGeometry = insertGeometryPoint(
				geometry,
				afterIndex,
				segmentMidpoint(geometry, afterIndex, false)
			);

			return result('Add route bend', [{
				type: 'graph/edge-patch',
				edgeId: edge.id,
				patch: { geometry: nextGeometry }
			}], { geometryIndex: afterIndex + 1, id: edge.id, kind: 'graph-edge' });
		}

		return undefined;
	}

	if (operation.type === 'remove-point') {
		if (selection.kind === 'element' && element && isPolygonElement(element)
			&& selection.vertexIndex !== undefined) {
			const geometry = removeGeometryPoint(element.geometry, selection.vertexIndex, 3);

			return geometry
				? result('Remove shape point', [{
					type: 'element/patch',
					elementId: element.id,
					patch: { geometry }
				}], { id: element.id, kind: 'element' })
				: undefined;
		}

		if (
			selection.kind === 'graph-edge'
			&& edge
			&& selection.geometryIndex !== undefined
		) {
			const currentGeometry = edgeGeometry(edge, nodes);
			const isEndpoint = selection.geometryIndex === 0
				|| selection.geometryIndex === currentGeometry.length - 1;

			if (isEndpoint) return undefined;
			const geometry = removeGeometryPoint(currentGeometry, selection.geometryIndex, 2);

			return geometry
				? result('Remove route bend', [{
					type: 'graph/edge-patch',
					edgeId: edge.id,
					patch: { geometry }
				}], { id: edge.id, kind: 'graph-edge' })
				: undefined;
		}

		return undefined;
	}

	if (operation.type === 'simplify' && element && isPolygonElement(element)) {
		const geometry = simplifyPolygonGeometry(element.geometry);

		if (geometry.length === element.geometry.length) {
			return result('Inspect shape', [], selection, {
				message: 'This shape is already clean.',
				tone: 'info'
			});
		}

		return result('Simplify shape', [{
			type: 'element/patch',
			elementId: element.id,
			patch: { geometry }
		}], { id: element.id, kind: 'element' }, {
			message: `Removed ${element.geometry.length - geometry.length} redundant shape points.`,
			tone: 'success'
		});
	}

	if ((operation.type === 'repair' || operation.type === 'straighten') && edge) {
		const geometry = operation.type === 'repair'
			? repairRouteGeometry(edge, nodes)
			: straightenRouteGeometry(edge, nodes);

		if (!geometry) return undefined;

		return result(
			operation.type === 'repair' ? 'Repair route segment' : 'Straighten route segment',
			[{
				type: 'graph/edge-patch',
				edgeId: edge.id,
				patch: { geometry }
			}],
			{ id: edge.id, kind: 'graph-edge' },
			{
				message: operation.type === 'repair'
					? 'Route segment repaired and snapped to its endpoints.'
					: 'Route segment straightened.',
				tone: 'success'
			}
		);
	}

	if (operation.type !== 'delete') return undefined;

	if (selection.kind === 'destination') {
		const linkedElements = state.project.floors.flatMap((candidateFloor) =>
			candidateFloor.elements.filter(
				(candidate) => 'destinationId' in candidate && candidate.destinationId === selection.id
			));

		return result('Delete destination', [
			...linkedElements.map((candidate) => ({
				type: 'element/remove' as const,
				elementId: candidate.id
			})),
			{ type: 'destination/remove', destinationId: selection.id }
		]);
	}

	if (selection.kind === 'graph-node') {
		return result('Delete route point', [{
			type: 'graph/node-remove',
			nodeId: selection.id
		}]);
	}

	if (selection.kind === 'graph-edge') {
		return result('Delete route segment', [{
			type: 'graph/edge-remove',
			edgeId: selection.id
		}]);
	}

	if (!element) return undefined;
	const destinationId = 'destinationId' in element ? element.destinationId : undefined;

	return result(`Delete ${element.type}`, [
		{ type: 'element/remove', elementId: element.id },
		...(destinationId
			? [{ type: 'destination/remove' as const, destinationId }]
			: [])
	]);
};
