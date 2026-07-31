export type RouteGuidanceInstructionKind =
	| 'arrive'
	| 'continue'
	| 'start'
	| 'transition'
	| 'turn-left'
	| 'turn-right';

export interface RouteGuidancePoint {
	levelId: string;
	x: number;
	y: number;
}

export interface RouteGuidanceFloor {
	buildingId?: string;
	id: string;
	name: string;
	role?: 'building-floor' | 'site' | 'standalone';
	unitsPerMeter?: number;
}

export interface RouteGuidanceEdge {
	from: string;
	id: string;
	kind: 'elevator' | 'escalator' | 'outdoor' | 'shuttle' | 'stairs' | 'walk';
	to: string;
}

export interface RouteGuidanceNode {
	id: string;
	levelId: string;
	semanticElementId?: string;
}

export interface RouteGuidanceContext {
	buildings: Array<{ id: string; name: string }>;
	connectors: Array<{
		endpoints: Array<{ id: string; levelId: string; role?: 'interior' | 'site' }>;
		id: string;
		kind: 'elevator' | 'entrance' | 'escalator' | 'ramp' | 'stairs';
		label: string;
	}>;
}

export interface RouteGuidanceRoute {
	edgeIds: string[];
	nodeIds: string[];
	path: RouteGuidancePoint[];
}

export interface RouteGuidanceInstruction {
	levelId: string;
	kind: RouteGuidanceInstructionKind;
	text: string;
}

export interface RouteGuidanceLeg {
	levelId: string;
	floorName: string;
	instructions: RouteGuidanceInstruction[];
	points: RouteGuidancePoint[];
}

const distance = (left: RouteGuidancePoint, right: RouteGuidancePoint): number =>
	Math.hypot(right.x - left.x, right.y - left.y);

const distanceText = (pixels: number, unitsPerMeter?: number): string => {
	if (!unitsPerMeter) return '';
	const meters = Math.max(1, Math.round(pixels / unitsPerMeter));

	return `${meters} m`;
};

const transitionLabel = (kind: RouteGuidanceEdge['kind'] | undefined): string => {
	switch (kind) {
		case 'elevator':
			return 'elevator';

		case 'escalator':
			return 'escalator';

		case 'shuttle':
			return 'shuttle';

		case 'stairs':
			return 'stairs';

		default:
			return 'connection';
	}
};

const routeTransitionStep = (
	route: RouteGuidanceRoute,
	edges: RouteGuidanceEdge[],
	nodes: RouteGuidanceNode[],
	fromFloorId: string,
	toFloorId: string
): { edge?: RouteGuidanceEdge; from: RouteGuidanceNode; to: RouteGuidanceNode } | undefined => {
	for (let index = 1; index < route.nodeIds.length; index += 1) {
		const left = nodes.find((node): boolean => node.id === route.nodeIds[index - 1]);
		const right = nodes.find((node): boolean => node.id === route.nodeIds[index]);

		if (left?.levelId !== fromFloorId || right?.levelId !== toFloorId) continue;

		return {
			edge: edges.find((edge): boolean => edge.id === route.edgeIds[index - 1]),
			from: left,
			to: right
		};
	}

	return undefined;
};

const transitionInstructionText = (
	step: ReturnType<typeof routeTransitionStep>,
	fromFloor: RouteGuidanceFloor | undefined,
	toFloor: RouteGuidanceFloor | undefined,
	context?: RouteGuidanceContext
): string => {
	const fallback = `Take the ${transitionLabel(step?.edge?.kind)} to ${toFloor?.name ?? step?.to.levelId ?? 'the next level'}`;

	if (!step || !context) return fallback;
	const semanticIds = new Set([step.from.semanticElementId, step.to.semanticElementId].filter((id): id is string => Boolean(id)));
	const connector = context.connectors.find((candidate): boolean =>
		candidate.endpoints.filter((endpoint): boolean => semanticIds.has(endpoint.id)).length === 2
		|| step.edge?.id.includes(`:${candidate.id}:`) === true
	);

	if (!connector) return fallback;
	if (connector.kind !== 'entrance') return `Take ${connector.label} to ${toFloor?.name ?? step.to.levelId}`;
	const buildingId = toFloor?.buildingId ?? fromFloor?.buildingId;
	const buildingName = context.buildings.find((building): boolean => building.id === buildingId)?.name ?? 'the building';
	const entering = fromFloor?.role === 'site' || connector.endpoints.find((endpoint): boolean => endpoint.id === step.from.semanticElementId)?.role === 'site';

	return entering
		? `Enter ${buildingName} through ${connector.label} and continue on ${toFloor?.name ?? step.to.levelId}`
		: `Exit ${buildingName} through ${connector.label} to ${toFloor?.name ?? step.to.levelId}`;
};

const turnInstruction = (
	previous: RouteGuidancePoint,
	point: RouteGuidancePoint,
	next: RouteGuidancePoint,
	unitsPerMeter?: number
): RouteGuidanceInstruction | undefined => {
	const incomingX = point.x - previous.x;
	const incomingY = point.y - previous.y;
	const outgoingX = next.x - point.x;
	const outgoingY = next.y - point.y;
	const incomingLength = Math.hypot(incomingX, incomingY);
	const outgoingLength = Math.hypot(outgoingX, outgoingY);

	if (incomingLength < 1 || outgoingLength < 1) return undefined;

	const dot = (incomingX * outgoingX + incomingY * outgoingY) / (incomingLength * outgoingLength);
	const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;

	if (angle < 30) return undefined;

	const cross = incomingX * outgoingY - incomingY * outgoingX;
	const kind: RouteGuidanceInstructionKind = cross < 0 ? 'turn-left' : 'turn-right';
	const direction = cross < 0 ? 'left' : 'right';
	const approach = distanceText(incomingLength, unitsPerMeter);

	return {
		levelId: point.levelId,
		kind,
		text: approach ? `In ${approach}, turn ${direction}` : `Turn ${direction}`
	};
};

export const buildRouteGuidance = (
	route: RouteGuidanceRoute,
	levels: RouteGuidanceFloor[],
	edges: RouteGuidanceEdge[],
	nodes: RouteGuidanceNode[],
	context?: RouteGuidanceContext
): RouteGuidanceLeg[] => {
	const grouped: RouteGuidancePoint[][] = [];

	for (const point of route.path) {
		const current = grouped[grouped.length - 1];

		if (!current || current[0]?.levelId !== point.levelId) {
			grouped.push([point]);
		} else if (current.at(-1)?.x !== point.x || current.at(-1)?.y !== point.y) {
			current.push(point);
		}
	}

	return grouped.map((points, legIndex): RouteGuidanceLeg => {
		const floor = levels.find((candidate): boolean => candidate.id === points[0].levelId);
		const floorName = floor?.name ?? points[0].levelId;
		const instructions: RouteGuidanceInstruction[] = [];

		if (legIndex === 0) {
			instructions.push({
				levelId: points[0].levelId,
				kind: 'start',
				text: `Start on ${floorName}`
			});
		}

		for (let pointIndex = 1; pointIndex < points.length - 1; pointIndex += 1) {
			const instruction = turnInstruction(
				points[pointIndex - 1],
				points[pointIndex],
				points[pointIndex + 1],
				floor?.unitsPerMeter
			);

			if (instruction) instructions.push(instruction);
		}

		const nextPoints = grouped[legIndex + 1];
		const length = points.slice(1).reduce(
			(total, point, pointIndex): number => total + distance(points[pointIndex], point),
			0
		);

		if (nextPoints) {
			const nextFloor = levels.find((candidate): boolean => candidate.id === nextPoints[0].levelId);
			const transitionStep = routeTransitionStep(
				route,
				edges,
				nodes,
				points[0].levelId,
				nextPoints[0].levelId
			);
			instructions.push({
				levelId: points[0].levelId,
				kind: 'transition',
				text: transitionInstructionText(transitionStep, floor, nextFloor, context)
			});
		} else {
			if (instructions.length === (legIndex === 0 ? 1 : 0) && length > 0) {
				const journeyDistance = distanceText(length, floor?.unitsPerMeter);
				instructions.push({
					levelId: points[0].levelId,
					kind: 'continue',
					text: journeyDistance ? `Continue for ${journeyDistance}` : 'Continue along the highlighted route'
				});
			}
			instructions.push({
				levelId: points[0].levelId,
				kind: 'arrive',
				text: 'Arrive at your destination'
			});
		}

		return {
			levelId: points[0].levelId,
			floorName,
			instructions,
			points
		};
	});
};
