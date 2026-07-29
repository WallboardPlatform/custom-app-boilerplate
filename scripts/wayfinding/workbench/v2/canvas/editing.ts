import type { EditorTransaction } from '../../../editor-core/types';
import type {
	WayfindingEdge,
	WayfindingNode,
	WayfindingPoint
} from '../../../../../src/utils/wayfinding.js';
import {
	clampPoint,
	distanceToSegment
} from './geometry';

export interface NearestGeometrySegment {
	distance: number;
	index: number;
}

const pointDistance = (left: WayfindingPoint, right: WayfindingPoint): number =>
	Math.hypot(right.x - left.x, right.y - left.y);

const samePoint = (left: WayfindingPoint, right: WayfindingPoint, tolerance: number): boolean =>
	pointDistance(left, right) <= tolerance;

export const constrainPointToAngle = (
	origin: WayfindingPoint,
	point: WayfindingPoint,
	incrementDegrees = 45
): WayfindingPoint => {
	const deltaX = point.x - origin.x;
	const deltaY = point.y - origin.y;
	const length = Math.hypot(deltaX, deltaY);

	if (length === 0 || incrementDegrees <= 0) return { ...point };
	const increment = incrementDegrees * Math.PI / 180;
	const angle = Math.round(Math.atan2(deltaY, deltaX) / increment) * increment;

	return {
		x: origin.x + Math.cos(angle) * length,
		y: origin.y + Math.sin(angle) * length
	};
};

export const pointerMoved = (
	start: WayfindingPoint,
	current: WayfindingPoint,
	scale: number,
	thresholdPixels = 3
): boolean => pointDistance(start, current) * Math.max(scale, 0.01) >= thresholdPixels;

export const translatePoint = (
	original: WayfindingPoint,
	start: WayfindingPoint,
	current: WayfindingPoint,
	width: number,
	height: number
): WayfindingPoint => clampPoint({
	x: original.x + current.x - start.x,
	y: original.y + current.y - start.y
}, width, height);

export const translateGeometry = (
	geometry: readonly WayfindingPoint[],
	start: WayfindingPoint,
	current: WayfindingPoint,
	width: number,
	height: number,
	pointIndex?: number
): WayfindingPoint[] => geometry.map((point, index) =>
	pointIndex === undefined || pointIndex === index
		? translatePoint(point, start, current, width, height)
		: { ...point });

export const nearestSegment = (
	geometry: readonly WayfindingPoint[],
	point: WayfindingPoint,
	closed: boolean
): NearestGeometrySegment | undefined => {
	if (geometry.length < 2) return undefined;
	const segmentCount = closed ? geometry.length : geometry.length - 1;
	let nearest: NearestGeometrySegment | undefined;

	for (let index = 0; index < segmentCount; index += 1) {
		const distance = distanceToSegment(
			point,
			geometry[index],
			geometry[(index + 1) % geometry.length]
		);

		if (!nearest || distance < nearest.distance) nearest = { distance, index };
	}

	return nearest;
};

export const insertGeometryPoint = (
	geometry: readonly WayfindingPoint[],
	afterIndex: number,
	point: WayfindingPoint
): WayfindingPoint[] => {
	const insertionIndex = Math.max(0, Math.min(afterIndex + 1, geometry.length));

	return [
		...geometry.slice(0, insertionIndex).map((candidate) => ({ ...candidate })),
		{ ...point },
		...geometry.slice(insertionIndex).map((candidate) => ({ ...candidate }))
	];
};

export const removeGeometryPoint = (
	geometry: readonly WayfindingPoint[],
	index: number,
	minimumPoints: number
): WayfindingPoint[] | undefined => {
	if (!Number.isInteger(index) || index < 0 || index >= geometry.length) return undefined;

	if (geometry.length <= minimumPoints) return undefined;

	return geometry.filter((_, candidateIndex) => candidateIndex !== index)
		.map((point) => ({ ...point }));
};

const edgeGeometry = (
	edge: WayfindingEdge,
	nodes: readonly WayfindingNode[]
): WayfindingPoint[] => {
	const from = nodes.find((node) => node.id === edge.from);
	const to = nodes.find((node) => node.id === edge.to);

	if (edge.geometry && edge.geometry.length >= 2) {
		return edge.geometry.map((point) => ({ ...point }));
	}

	if (from && to) return [{ x: from.x, y: from.y }, { x: to.x, y: to.y }];

	return [];
};

export const moveGraphNodeTransaction = (
	nodeId: string,
	point: WayfindingPoint,
	nodes: readonly WayfindingNode[],
	edges: readonly WayfindingEdge[]
): EditorTransaction => {
	const commands: EditorTransaction['commands'] = [{
		type: 'graph/node-patch',
		nodeId,
		patch: { x: point.x, y: point.y }
	}];

	for (const edge of edges) {
		if (edge.from !== nodeId && edge.to !== nodeId) continue;
		const geometry = edgeGeometry(edge, nodes);

		if (geometry.length < 2) continue;

		if (edge.from === nodeId) geometry[0] = { ...point };

		if (edge.to === nodeId) geometry[geometry.length - 1] = { ...point };
		commands.push({
			type: 'graph/edge-patch',
			edgeId: edge.id,
			patch: { geometry }
		});
	}

	return {
		commands,
		label: 'Move route point'
	};
};

export const simplifyPolygonGeometry = (
	geometry: readonly WayfindingPoint[],
	tolerance = 1.25
): WayfindingPoint[] => {
	if (geometry.length <= 3) return geometry.map((point) => ({ ...point }));
	const simplified = geometry
		.filter((point, index) => index === 0 || !samePoint(point, geometry[index - 1], tolerance * 0.45))
		.map((point) => ({ ...point }));

	let changed = true;

	while (changed && simplified.length > 3) {
		changed = false;

		for (let index = 0; index < simplified.length; index += 1) {
			const previous = simplified[(index - 1 + simplified.length) % simplified.length];
			const current = simplified[index];
			const next = simplified[(index + 1) % simplified.length];
			const tinyAdjacentEdge = Math.min(
				pointDistance(previous, current),
				pointDistance(current, next)
			) <= tolerance * 0.8;
			const redundantBend = distanceToSegment(current, previous, next) <= tolerance;

			if (!tinyAdjacentEdge && !redundantBend) continue;
			simplified.splice(index, 1);
			changed = true;
			break;
		}
	}

	return simplified;
};
