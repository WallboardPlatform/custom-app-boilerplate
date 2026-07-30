import {
	WayfindingGraph,
	type WayfindingEdge,
	type WayfindingEdgeKind,
	type WayfindingNode,
	type WayfindingPoint,
	type WayfindingRoutePoint,
	type WayfindingRouteResult
} from '../../../../src/utils/wayfinding';
import type {
	WayfindingStudioOriginElement,
	WayfindingStudioProject
} from '../../studio-project.mts';

export type VisitorRouteProfile = 'standard' | 'step-free';

export interface VisitorRouteFloorSegment {
	floorId: string;
	points: WayfindingPoint[];
}

export interface VisitorRouteTransition {
	connectionId?: string;
	fromFloorId: string;
	kind: Extract<WayfindingEdgeKind, 'elevator' | 'escalator' | 'stairs' | 'shuttle'>;
	toFloorId: string;
}

export type VisitorRouteInstructionKind =
	| 'arrive'
	| 'continue'
	| 'start'
	| 'transition'
	| 'turn-left'
	| 'turn-right';

export interface VisitorRouteInstruction {
	floorId: string;
	kind: VisitorRouteInstructionKind;
	text: string;
}

export interface VisitorRouteJourney {
	instructions: VisitorRouteInstruction[];
	metrics: {
		calibrated: boolean;
		distanceMeters?: number;
		walkingSeconds?: number;
	};
	result: WayfindingRouteResult;
	segments: VisitorRouteFloorSegment[];
	transitions: VisitorRouteTransition[];
}

const ROUTE_POINT_EPSILON = 0.25;
const ROUTE_MICRO_SEGMENT_MAXIMUM = 8;
const ROUTE_MICRO_SEGMENT_RATIO = 0.08;

const squaredDistance = (a: WayfindingRoutePoint, b: WayfindingRoutePoint): number => {
	const dx = a.x - b.x;
	const dy = a.y - b.y;

	return dx * dx + dy * dy;
};

const pointsMatch = (a: WayfindingRoutePoint, b: WayfindingRoutePoint): boolean =>
	a.levelId === b.levelId && squaredDistance(a, b) <= ROUTE_POINT_EPSILON * ROUTE_POINT_EPSILON;

const pointToSegmentDistance = (
	point: WayfindingRoutePoint,
	start: WayfindingRoutePoint,
	end: WayfindingRoutePoint
): number => {
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	const lengthSquared = dx * dx + dy * dy;

	if (lengthSquared <= Number.EPSILON) return Math.sqrt(squaredDistance(point, start));
	const projection = Math.max(0, Math.min(1, (
		(point.x - start.x) * dx + (point.y - start.y) * dy
	) / lengthSquared));
	const projectedX = start.x + projection * dx;
	const projectedY = start.y + projection * dy;

	return Math.hypot(point.x - projectedX, point.y - projectedY);
};

const cleanFloorRoute = (points: WayfindingRoutePoint[]): WayfindingRoutePoint[] => {
	const loopErased: WayfindingRoutePoint[] = [];

	for (const point of points) {
		if (loopErased.length > 0 && pointsMatch(loopErased[loopErased.length - 1], point)) continue;
		const repeatedIndex = loopErased.findIndex((candidate) => pointsMatch(candidate, point));

		if (repeatedIndex >= 0) {
			loopErased.splice(repeatedIndex + 1);

			continue;
		}
		loopErased.push(point);
	}

	const simplified: WayfindingRoutePoint[] = [];

	for (const point of loopErased) {
		while (simplified.length >= 2) {
			const start = simplified[simplified.length - 2];
			const middle = simplified[simplified.length - 1];

			if (pointToSegmentDistance(middle, start, point) > ROUTE_POINT_EPSILON) break;
			simplified.pop();
		}
		simplified.push(point);
	}

	while (simplified.length >= 3) {
		const leadInLength = Math.sqrt(squaredDistance(simplified[0], simplified[1]));
		const followingLength = Math.sqrt(squaredDistance(simplified[1], simplified[2]));

		if (
			leadInLength > ROUTE_MICRO_SEGMENT_MAXIMUM
			|| leadInLength > followingLength * ROUTE_MICRO_SEGMENT_RATIO
		) break;
		simplified.splice(1, 1);
	}

	return simplified;
};

export const cleanRoutePath = (points: WayfindingRoutePoint[]): WayfindingRoutePoint[] => {
	const cleaned: WayfindingRoutePoint[] = [];
	let floorRun: WayfindingRoutePoint[] = [];

	const flush = (): void => {
		cleaned.push(...cleanFloorRoute(floorRun));
		floorRun = [];
	};

	for (const point of points) {
		if (floorRun.length > 0 && floorRun[0].levelId !== point.levelId) flush();
		floorRun.push(point);
	}
	flush();

	return cleaned;
};

const routeResultToDestination = (
	project: WayfindingStudioProject,
	destinationId: string | undefined,
	profile: VisitorRouteProfile = 'standard',
	originId?: string
): WayfindingRouteResult | undefined => {
	if (!destinationId) return undefined;
	const origins: WayfindingStudioOriginElement[] = project.floors
		.flatMap((floor) => floor.elements)
		.filter((element): element is WayfindingStudioOriginElement => element.type === 'origin');
	const origin = originId
		? origins.find((candidate) => candidate.id === originId)
		: origins[0];
	const startNode = origin
		? project.graph.nodes.find((node) => node.semanticElementId === origin.id)
		: project.graph.nodes.find((node) => node.kind === 'route');
	const destinationNode = project.graph.nodes.find((node) => node.locationId === destinationId);

	if (!startNode || !destinationNode) return undefined;

	try {
		return new WayfindingGraph(project.graph).route(startNode.id, destinationNode.id, { profile });
	} catch {
		return undefined;
	}
};

const routeSegments = (points: WayfindingRoutePoint[]): VisitorRouteFloorSegment[] => {
	const segments: VisitorRouteFloorSegment[] = [];

	for (const point of points) {
		const previous = segments[segments.length - 1];

		if (!previous || previous.floorId !== point.levelId) {
			segments.push({
				floorId: point.levelId,
				points: [{ x: point.x, y: point.y }]
			});

			continue;
		}
		previous.points.push({ x: point.x, y: point.y });
	}

	return segments;
};

const routeTransitions = (
	project: WayfindingStudioProject,
	result: WayfindingRouteResult
): VisitorRouteTransition[] => result.edgeIds.flatMap((edgeId, index) => {
	const edge = project.graph.edges.find((candidate) => candidate.id === edgeId);
	const from = project.graph.nodes.find((node) => node.id === result.nodeIds[index]);
	const to = project.graph.nodes.find((node) => node.id === result.nodeIds[index + 1]);

	if (!edge || !from || !to || from.levelId === to.levelId) return [];
	const transitionElement = project.floors
		.flatMap((floor) => floor.elements)
		.find((element) =>
			element.type === 'transition'
			&& (element.id === from.semanticElementId || element.id === to.semanticElementId)
		);
	const kind: VisitorRouteTransition['kind'] = edge.kind === 'elevator'
		|| edge.kind === 'escalator'
		|| edge.kind === 'stairs'
		|| edge.kind === 'shuttle'
		? edge.kind
		: 'stairs';

	return [{
		connectionId: transitionElement?.type === 'transition' ? transitionElement.connectionId : undefined,
		fromFloorId: from.levelId,
		kind,
		toFloorId: to.levelId
	}];
});

const routeSegmentLength = (points: readonly WayfindingPoint[]): number =>
	points.slice(1).reduce(
		(total, point, index) => total + Math.hypot(
			point.x - points[index].x,
			point.y - points[index].y
		),
		0
	);

const signedTurnDegrees = (
	previous: WayfindingPoint,
	current: WayfindingPoint,
	next: WayfindingPoint
): number => Math.atan2(
	(current.x - previous.x) * (next.y - current.y)
		- (current.y - previous.y) * (next.x - current.x),
	(current.x - previous.x) * (next.x - current.x)
		+ (current.y - previous.y) * (next.y - current.y)
) * 180 / Math.PI;

const instructionDistance = (
	project: WayfindingStudioProject,
	floorId: string,
	mapDistance: number
): string | undefined => {
	const unitsPerMeter = project.floors.find((floor) => floor.id === floorId)?.unitsPerMeter;

	return unitsPerMeter && unitsPerMeter > 0
		? `${Math.max(1, Math.round(mapDistance / unitsPerMeter))} m`
		: undefined;
};

const routeInstructions = (
	project: WayfindingStudioProject,
	destinationId: string,
	originId: string | undefined,
	segments: readonly VisitorRouteFloorSegment[],
	transitions: readonly VisitorRouteTransition[]
): VisitorRouteInstruction[] => {
	const destination = project.destinations.find((candidate) => candidate.id === destinationId);
	const origin = project.floors
		.flatMap((floor) => floor.elements)
		.find((element) => element.type === 'origin' && (!originId || element.id === originId));
	const instructions: VisitorRouteInstruction[] = [];

	for (const [segmentIndex, segment] of segments.entries()) {
		if (segmentIndex === 0) {
			instructions.push({
				floorId: segment.floorId,
				kind: 'start',
				text: `Start at ${origin?.type === 'origin' ? origin.label || 'You are here' : 'You are here'}.`
			});
		}
		let distanceSinceInstruction = 0;
		let turnCount = 0;

		for (let index = 1; index < segment.points.length; index += 1) {
			distanceSinceInstruction += Math.hypot(
				segment.points[index].x - segment.points[index - 1].x,
				segment.points[index].y - segment.points[index - 1].y
			);

			if (index >= segment.points.length - 1) continue;
			const turn = signedTurnDegrees(
				segment.points[index - 1],
				segment.points[index],
				segment.points[index + 1]
			);

			if (Math.abs(turn) < 32) continue;
			const direction = turn > 0 ? 'right' : 'left';
			const distance = instructionDistance(project, segment.floorId, distanceSinceInstruction);

			instructions.push({
				floorId: segment.floorId,
				kind: direction === 'right' ? 'turn-right' : 'turn-left',
				text: `${distance ? `In ${distance}, t` : 'T'}urn ${direction}.`
			});
			turnCount += 1;
			distanceSinceInstruction = 0;
		}

		if (turnCount === 0 && segment.points.length >= 2) {
			const distance = instructionDistance(
				project,
				segment.floorId,
				routeSegmentLength(segment.points)
			);

			instructions.push({
				floorId: segment.floorId,
				kind: 'continue',
				text: distance ? `Continue for ${distance}.` : 'Continue along the highlighted route.'
			});
		}
		const transition = transitions.find((candidate) => candidate.fromFloorId === segment.floorId);

		if (transition) {
			const destinationFloor = project.floors.find((floor) => floor.id === transition.toFloorId);

			instructions.push({
				floorId: segment.floorId,
				kind: 'transition',
				text: `Take the ${transition.kind} to ${destinationFloor?.name ?? transition.toFloorId}.`
			});
		}
	}

	if (segments.length > 0) {
		instructions.push({
			floorId: segments[segments.length - 1].floorId,
			kind: 'arrive',
			text: `Arrive at ${destination?.name ?? 'your destination'}.`
		});
	}

	return instructions;
};

const edgeLength = (
	edge: WayfindingEdge,
	from: WayfindingNode,
	to: WayfindingNode
): number => {
	const geometry = edge.geometry && edge.geometry.length >= 2
		? edge.geometry
		: [{ x: from.x, y: from.y }, { x: to.x, y: to.y }];

	return geometry.slice(1).reduce((distance, point, index) =>
		distance + Math.hypot(
			point.x - geometry[index].x,
			point.y - geometry[index].y
		), 0);
};

const routeMetrics = (
	project: WayfindingStudioProject,
	result: WayfindingRouteResult
): VisitorRouteJourney['metrics'] => {
	let distanceMeters = 0;

	for (const [index, edgeId] of result.edgeIds.entries()) {
		const edge = project.graph.edges.find((candidate) => candidate.id === edgeId);
		const from = project.graph.nodes.find((node) => node.id === result.nodeIds[index]);
		const to = project.graph.nodes.find((node) => node.id === result.nodeIds[index + 1]);

		if (!edge || !from || !to) return { calibrated: false };

		if (edge.distanceMeters !== undefined) {
			distanceMeters += edge.distanceMeters;

			continue;
		}

		if (from.levelId !== to.levelId) return { calibrated: false };
		const unitsPerMeter = project.floors.find((floor) => floor.id === from.levelId)?.unitsPerMeter;

		if (!unitsPerMeter || unitsPerMeter <= 0) return { calibrated: false };
		distanceMeters += edgeLength(edge, from, to) / unitsPerMeter;
	}

	const roundedDistance = Math.max(0, Math.round(distanceMeters));

	return {
		calibrated: true,
		distanceMeters: roundedDistance,
		walkingSeconds: roundedDistance === 0 ? 0 : Math.max(1, Math.round(roundedDistance / 1.4))
	};
};

export const routeJourneyToDestination = (
	project: WayfindingStudioProject,
	destinationId: string | undefined,
	profile: VisitorRouteProfile = 'standard',
	originId?: string
): VisitorRouteJourney | undefined => {
	const result = routeResultToDestination(project, destinationId, profile, originId);

	if (!result) return undefined;
	const cleanedResult = {
		...result,
		path: cleanRoutePath(result.path)
	};
	const segments = routeSegments(cleanedResult.path);
	const transitions = routeTransitions(project, cleanedResult);

	return {
		instructions: routeInstructions(
			project,
			destinationId!,
			originId,
			segments,
			transitions
		),
		metrics: routeMetrics(project, cleanedResult),
		result: cleanedResult,
		segments,
		transitions
	};
};

export const routeToDestination = (
	project: WayfindingStudioProject,
	destinationId: string | undefined,
	profile: VisitorRouteProfile = 'standard',
	originId?: string
): WayfindingRoutePoint[] => cleanRoutePath(
	routeResultToDestination(project, destinationId, profile, originId)?.path ?? []
);

export const floorRoutePoints = (
	points: WayfindingRoutePoint[],
	floorId: string
): WayfindingPoint[] => points.filter((point) => point.levelId === floorId).map(({ x, y }) => ({ x, y }));

export const routePolyline = (points: WayfindingPoint[]): string =>
	points.map((point) => `${point.x},${point.y}`).join(' ');
