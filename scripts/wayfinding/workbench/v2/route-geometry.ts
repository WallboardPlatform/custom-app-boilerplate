import type {
	WayfindingEdge,
	WayfindingNode,
	WayfindingPoint
} from '../../../../src/utils/wayfinding';

export type RouteGeometryIssueCode =
	| 'backtracking'
	| 'excessive-bends'
	| 'missing-endpoint'
	| 'unsnapped-endpoint'
	| 'zero-length-segment';

export interface RouteGeometryIssue {
	code: RouteGeometryIssueCode;
	geometryIndex?: number;
	message: string;
	severity: 'error' | 'warning';
}

const SNAP_TOLERANCE = 1.5;
const DUPLICATE_TOLERANCE = 0.5;
const BACKTRACKING_COSINE = -0.88;

const distance = (left: WayfindingPoint, right: WayfindingPoint): number =>
	Math.hypot(right.x - left.x, right.y - left.y);

const samePoint = (left: WayfindingPoint, right: WayfindingPoint, tolerance = DUPLICATE_TOLERANCE): boolean =>
	distance(left, right) <= tolerance;

const backtrackingCosine = (
	previous: WayfindingPoint,
	current: WayfindingPoint,
	next: WayfindingPoint
): number => {
	const incomingX = current.x - previous.x;
	const incomingY = current.y - previous.y;
	const outgoingX = next.x - current.x;
	const outgoingY = next.y - current.y;
	const incomingLength = Math.hypot(incomingX, incomingY);
	const outgoingLength = Math.hypot(outgoingX, outgoingY);

	if (incomingLength <= Number.EPSILON || outgoingLength <= Number.EPSILON) return 1;

	return (
		incomingX * outgoingX + incomingY * outgoingY
	) / (incomingLength * outgoingLength);
};

const pointToSegmentDistance = (
	point: WayfindingPoint,
	start: WayfindingPoint,
	end: WayfindingPoint
): number => {
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	const lengthSquared = dx * dx + dy * dy;

	if (lengthSquared <= Number.EPSILON) return distance(point, start);
	const projection = Math.max(0, Math.min(1, (
		(point.x - start.x) * dx + (point.y - start.y) * dy
	) / lengthSquared));

	return Math.hypot(
		point.x - (start.x + projection * dx),
		point.y - (start.y + projection * dy)
	);
};

const endpoints = (
	edge: WayfindingEdge,
	nodes: readonly WayfindingNode[]
): { from?: WayfindingNode; to?: WayfindingNode } => ({
	from: nodes.find((node) => node.id === edge.from),
	to: nodes.find((node) => node.id === edge.to)
});

const orientedGeometry = (
	edge: WayfindingEdge,
	from: WayfindingNode,
	to: WayfindingNode
): WayfindingPoint[] => {
	const sourceGeometry = edge.geometry;
	const geometry = sourceGeometry && sourceGeometry.length >= 2
		? sourceGeometry.map((point) => ({ x: point.x, y: point.y }))
		: [{ x: from.x, y: from.y }, { x: to.x, y: to.y }];
	const forwardDistance = distance(geometry[0], from) + distance(geometry[geometry.length - 1], to);
	const reverseDistance = distance(geometry[geometry.length - 1], from) + distance(geometry[0], to);

	return reverseDistance < forwardDistance ? geometry.reverse() : geometry;
};

export const inspectRouteGeometry = (
	edge: WayfindingEdge,
	nodes: readonly WayfindingNode[]
): RouteGeometryIssue[] => {
	const { from, to } = endpoints(edge, nodes);

	if (!from || !to) {
		return [{
			code: 'missing-endpoint',
			message: `Segment ${edge.id} references a route point that no longer exists.`,
			severity: 'error'
		}];
	}

	const geometry = orientedGeometry(edge, from, to);
	const issues: RouteGeometryIssue[] = [];

	if (
		distance(geometry[0], from) > SNAP_TOLERANCE
		|| distance(geometry[geometry.length - 1], to) > SNAP_TOLERANCE
	) {
		issues.push({
			code: 'unsnapped-endpoint',
			message: `Segment ${edge.id} does not terminate on both connected route points.`,
			severity: 'error'
		});
	}

	for (let index = 1; index < geometry.length; index += 1) {
		if (samePoint(geometry[index - 1], geometry[index])) {
			issues.push({
				code: 'zero-length-segment',
				geometryIndex: index,
				message: `Segment ${edge.id} contains overlapping control points.`,
				severity: 'warning'
			});
		}
	}

	for (let index = 1; index < geometry.length - 1; index += 1) {
		if (backtrackingCosine(geometry[index - 1], geometry[index], geometry[index + 1]) < BACKTRACKING_COSINE) {
			issues.push({
				code: 'backtracking',
				geometryIndex: index,
				message: `Segment ${edge.id} doubles back near bend ${index}.`,
				severity: 'warning'
			});
		}
	}

	if (geometry.length > 10) {
		issues.push({
			code: 'excessive-bends',
			message: `Segment ${edge.id} has ${geometry.length - 2} bends and may be difficult to maintain.`,
			severity: 'warning'
		});
	}

	return issues;
};

const removeDuplicatePoints = (geometry: WayfindingPoint[]): WayfindingPoint[] =>
	geometry.filter((point, index) => index === 0 || !samePoint(point, geometry[index - 1]));

const removeLocalSpikes = (geometry: WayfindingPoint[]): WayfindingPoint[] => {
	const repaired = [...geometry];
	let changed = true;

	while (changed && repaired.length > 2) {
		changed = false;

		for (let index = 1; index < repaired.length - 1; index += 1) {
			const previous = repaired[index - 1];
			const current = repaired[index];
			const next = repaired[index + 1];
			const foldsBack = backtrackingCosine(previous, current, next) < BACKTRACKING_COSINE;
			const returnsNearPrevious = distance(previous, next) <= Math.max(
				2,
				Math.min(distance(previous, current), distance(current, next)) * 0.25
			);

			if (!foldsBack && !returnsNearPrevious) continue;
			repaired.splice(index, 1);
			changed = true;
			break;
		}
	}

	return repaired;
};

const removeRedundantBends = (geometry: WayfindingPoint[], tolerance = 0.75): WayfindingPoint[] => {
	if (geometry.length <= 2) return geometry;
	const simplified: WayfindingPoint[] = [geometry[0]];

	for (let index = 1; index < geometry.length - 1; index += 1) {
		const previous = simplified[simplified.length - 1];
		const current = geometry[index];
		const next = geometry[index + 1];

		if (pointToSegmentDistance(current, previous, next) <= tolerance) continue;
		simplified.push(current);
	}
	simplified.push(geometry[geometry.length - 1]);

	return simplified;
};

export const repairRouteGeometry = (
	edge: WayfindingEdge,
	nodes: readonly WayfindingNode[]
): WayfindingPoint[] | undefined => {
	const { from, to } = endpoints(edge, nodes);

	if (!from || !to) return undefined;
	const oriented = orientedGeometry(edge, from, to);
	oriented[0] = { x: from.x, y: from.y };
	oriented[oriented.length - 1] = { x: to.x, y: to.y };

	const repaired = removeRedundantBends(removeLocalSpikes(removeDuplicatePoints(oriented)));

	if (repaired.length < 2) return [{ x: from.x, y: from.y }, { x: to.x, y: to.y }];
	repaired[0] = { x: from.x, y: from.y };
	repaired[repaired.length - 1] = { x: to.x, y: to.y };

	return repaired;
};

export const straightenRouteGeometry = (
	edge: WayfindingEdge,
	nodes: readonly WayfindingNode[]
): WayfindingPoint[] | undefined => {
	const { from, to } = endpoints(edge, nodes);

	return from && to
		? [{ x: from.x, y: from.y }, { x: to.x, y: to.y }]
		: undefined;
};
