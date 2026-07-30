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
	id: string;
	name: string;
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
}

export interface RouteGuidanceRoute {
	edgeIds: string[];
	nodeIds: string[];
	path: RouteGuidancePoint[];
}

export interface RouteGuidanceInstruction {
	floorId: string;
	kind: RouteGuidanceInstructionKind;
	text: string;
}

export interface RouteGuidanceLeg {
	floorId: string;
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

const routeTransitionKind = (
	route: RouteGuidanceRoute,
	edges: RouteGuidanceEdge[],
	nodes: RouteGuidanceNode[],
	fromFloorId: string,
	toFloorId: string
): RouteGuidanceEdge['kind'] | undefined => {
	for (let index = 1; index < route.nodeIds.length; index += 1) {
		const left = nodes.find((node): boolean => node.id === route.nodeIds[index - 1]);
		const right = nodes.find((node): boolean => node.id === route.nodeIds[index]);

		if (left?.levelId !== fromFloorId || right?.levelId !== toFloorId) continue;

		return edges.find((edge): boolean => edge.id === route.edgeIds[index - 1])?.kind;
	}

	return undefined;
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
		floorId: point.levelId,
		kind,
		text: approach ? `In ${approach}, turn ${direction}` : `Turn ${direction}`
	};
};

export const buildRouteGuidance = (
	route: RouteGuidanceRoute,
	floors: RouteGuidanceFloor[],
	edges: RouteGuidanceEdge[],
	nodes: RouteGuidanceNode[]
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
		const floor = floors.find((candidate): boolean => candidate.id === points[0].levelId);
		const floorName = floor?.name ?? points[0].levelId;
		const instructions: RouteGuidanceInstruction[] = [];

		if (legIndex === 0) {
			instructions.push({
				floorId: points[0].levelId,
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
			const nextFloor = floors.find((candidate): boolean => candidate.id === nextPoints[0].levelId);
			const transition = transitionLabel(routeTransitionKind(
				route,
				edges,
				nodes,
				points[0].levelId,
				nextPoints[0].levelId
			));
			instructions.push({
				floorId: points[0].levelId,
				kind: 'transition',
				text: `Take the ${transition} to ${nextFloor?.name ?? nextPoints[0].levelId}`
			});
		} else {
			if (instructions.length === (legIndex === 0 ? 1 : 0) && length > 0) {
				const journeyDistance = distanceText(length, floor?.unitsPerMeter);
				instructions.push({
					floorId: points[0].levelId,
					kind: 'continue',
					text: journeyDistance ? `Continue for ${journeyDistance}` : 'Continue along the highlighted route'
				});
			}
			instructions.push({
				floorId: points[0].levelId,
				kind: 'arrive',
				text: 'Arrive at your destination'
			});
		}

		return {
			floorId: points[0].levelId,
			floorName,
			instructions,
			points
		};
	});
};
