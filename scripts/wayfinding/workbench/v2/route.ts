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

export interface VisitorRouteJourney {
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

	return {
		metrics: routeMetrics(project, cleanedResult),
		result: cleanedResult,
		segments: routeSegments(cleanedResult.path),
		transitions: routeTransitions(project, cleanedResult)
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
