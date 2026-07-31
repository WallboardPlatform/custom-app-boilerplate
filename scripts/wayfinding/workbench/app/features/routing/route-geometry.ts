import type {
	WayfindingEdge,
	WayfindingNode,
	WayfindingPoint
} from '../../../../../../src/utils/wayfinding';

export type RouteGeometryIssueCode =
	| 'backtracking'
	| 'excessive-bends'
	| 'missing-endpoint'
	| 'short-zigzag'
	| 'unsnapped-endpoint'
	| 'zero-length-segment';

export interface RouteGeometryIssue {
	code: RouteGeometryIssueCode;
	geometryIndex?: number;
	message: string;
	severity: 'error' | 'warning';
}

export interface RouteGeometryQuality {
	bendCount: number;
	length: number;
	score: number;
}

export interface RouteNetworkQuality {
	bendCount: number;
	length: number;
	score: number;
}

const SNAP_TOLERANCE = 1.5;
const DUPLICATE_TOLERANCE = 0.5;
const BACKTRACKING_COSINE = -0.88;
const MINIMUM_ZIGZAG_TURN_DEGREES = 22;

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

const signedTurnDegrees = (
	previous: WayfindingPoint,
	current: WayfindingPoint,
	next: WayfindingPoint
): number => {
	const incomingX = current.x - previous.x;
	const incomingY = current.y - previous.y;
	const outgoingX = next.x - current.x;
	const outgoingY = next.y - current.y;

	if (
		Math.hypot(incomingX, incomingY) <= Number.EPSILON
		|| Math.hypot(outgoingX, outgoingY) <= Number.EPSILON
	) return 0;

	return Math.atan2(
		incomingX * outgoingY - incomingY * outgoingX,
		incomingX * outgoingX + incomingY * outgoingY
	) * 180 / Math.PI;
};

const isShortZigzag = (
	geometry: readonly WayfindingPoint[],
	leftTurnIndex: number
): boolean => {
	if (leftTurnIndex < 1 || leftTurnIndex + 2 >= geometry.length) return false;
	const leftTurn = signedTurnDegrees(
		geometry[leftTurnIndex - 1],
		geometry[leftTurnIndex],
		geometry[leftTurnIndex + 1]
	);
	const rightTurn = signedTurnDegrees(
		geometry[leftTurnIndex],
		geometry[leftTurnIndex + 1],
		geometry[leftTurnIndex + 2]
	);

	if (
		Math.abs(leftTurn) < MINIMUM_ZIGZAG_TURN_DEGREES
		|| Math.abs(rightTurn) < MINIMUM_ZIGZAG_TURN_DEGREES
		|| Math.sign(leftTurn) === Math.sign(rightTurn)
	) return false;

	const bridgeLength = distance(geometry[leftTurnIndex], geometry[leftTurnIndex + 1]);
	const incomingLength = distance(geometry[leftTurnIndex - 1], geometry[leftTurnIndex]);
	const outgoingLength = distance(geometry[leftTurnIndex + 1], geometry[leftTurnIndex + 2]);

	return bridgeLength <= Math.max(2, Math.min(incomingLength, outgoingLength) * 0.34);
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

	for (let index = 1; index < geometry.length - 2; index += 1) {
		if (!isShortZigzag(geometry, index)) continue;
		issues.push({
			code: 'short-zigzag',
			geometryIndex: index,
			message: `Segment ${edge.id} contains a short left-right jog near bend ${index}.`,
			severity: 'warning'
		});
		index += 1;
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

const issuePenalty: Record<RouteGeometryIssueCode, number> = {
	backtracking: 28,
	'excessive-bends': 12,
	'missing-endpoint': 60,
	'short-zigzag': 14,
	'unsnapped-endpoint': 35,
	'zero-length-segment': 18
};

export const measureRouteGeometry = (
	edge: WayfindingEdge,
	nodes: readonly WayfindingNode[]
): RouteGeometryQuality => {
	const { from, to } = endpoints(edge, nodes);

	if (!from || !to) return { bendCount: 0, length: 0, score: 0 };
	const geometry = orientedGeometry(edge, from, to);
	const issues = inspectRouteGeometry(edge, nodes);
	const length = geometry.slice(1).reduce(
		(total, point, index) => total + distance(geometry[index], point),
		0
	);
	const score = Math.max(0, Math.round(
		100 - issues.reduce((total, issue) => total + issuePenalty[issue.code], 0)
	));

	return {
		bendCount: Math.max(0, geometry.length - 2),
		length,
		score
	};
};

export const measureRouteNetwork = (
	edges: readonly WayfindingEdge[],
	nodes: readonly WayfindingNode[]
): RouteNetworkQuality => {
	const measurements = edges.map((edge) => measureRouteGeometry(edge, nodes));
	const totalLength = measurements.reduce((total, measurement) => total + measurement.length, 0);
	const weightedScore = measurements.reduce(
		(total, measurement) => total + measurement.score * Math.max(1, measurement.length),
		0
	);
	const weight = measurements.reduce(
		(total, measurement) => total + Math.max(1, measurement.length),
		0
	);

	return {
		bendCount: measurements.reduce((total, measurement) => total + measurement.bendCount, 0),
		length: totalLength,
		score: measurements.length === 0 ? 0 : Math.round(weightedScore / weight)
	};
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
