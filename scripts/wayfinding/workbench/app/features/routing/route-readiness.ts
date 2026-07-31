import { WayfindingGraph } from '../../../../../../src/utils/wayfinding';
import type {
	WayfindingStudioDoorElement,
	WayfindingStudioPointElement,
	WayfindingStudioPolygonElement,
	WayfindingStudioProject
} from '../../../../studio-project.mts';

export type RouteReadinessAction =
	| 'add-destinations'
	| 'add-entrances'
	| 'add-origin'
	| 'build-network'
	| 'define-space'
	| 'review-routes';

export interface RouteReadinessItem {
	action: RouteReadinessAction;
	body: string;
	target?: {
		destinationId?: string;
		elementId?: string;
		floorId?: string;
	};
	title: string;
}

export interface RouteReadiness {
	blockers: RouteReadinessItem[];
	buildBlockers: RouteReadinessItem[];
	connectedDestinations: number;
	destinationAnchors: number;
	linkedEntrances: number;
	mappedDestinationsOnFloor: number;
	origins: number;
	routeableDestinations: number;
	routeReadyDestinationsOnFloor: number;
	segments: number;
	skippedDestinationsOnFloor: number;
	status: 'needs-work' | 'not-configured' | 'ready';
	unlinkedDestinationsOnFloor: number;
	unpositionedDestinations: number;
	walkableAreas: number;
	warnings: RouteReadinessItem[];
}

export interface RouteUnavailableGuidance {
	actionLabel: string;
	code: 'disconnected' | 'missing-entrance' | 'missing-origin' | 'unpositioned';
	message: string;
	target?: {
		destinationId?: string;
		elementId?: string;
		floorId?: string;
	};
	title: string;
}

const unique = <Value>(values: Iterable<Value>): Value[] => [...new Set(values)];

export const getRouteUnavailableGuidance = (
	project: WayfindingStudioProject,
	destinationId: string
): RouteUnavailableGuidance => {
	const destination = project.destinations.find((candidate) => candidate.id === destinationId);
	const mappedElement = project.floors
		.flatMap((floor) => floor.elements)
		.find((element) =>
			(element.type === 'location' || element.type === 'poi')
			&& element.destinationId === destinationId
		);

	if (!mappedElement) {
		return {
			actionLabel: 'Place on map',
			code: 'unpositioned',
			message: 'Place this directory destination on a floor before testing directions.',
			target: {
				destinationId,
				floorId: destination?.floor
			},
			title: 'Destination is not on the map'
		};
	}

	if (
		mappedElement.type === 'location'
		&& !project.floors.some((floor) => floor.elements.some((element) =>
			element.type === 'door' && element.locationId === mappedElement.id
		))
	) {
		return {
			actionLabel: 'Add entrance',
			code: 'missing-entrance',
			message: 'Add a public entrance on this room boundary so the route can terminate at the doorway.',
			target: {
				destinationId,
				elementId: mappedElement.id,
				floorId: mappedElement.floorId
			},
			title: 'This room has no linked entrance'
		};
	}

	if (!project.floors.some((floor) => floor.elements.some((element) => element.type === 'origin'))) {
		return {
			actionLabel: 'Add starting point',
			code: 'missing-origin',
			message: 'Place a You are here point before testing directions from a screen.',
			target: {
				destinationId,
				floorId: mappedElement.floorId
			},
			title: 'No starting point is available'
		};
	}

	return {
		actionLabel: 'Review network',
		code: 'disconnected',
		message: 'Open Route edit to find the broken connector or isolated network segment.',
		target: {
			destinationId,
			elementId: mappedElement.id,
			floorId: mappedElement.floorId
		},
		title: 'No safe route reaches this destination'
	};
};

export const getRouteReadiness = (
	project: WayfindingStudioProject,
	floorId: string
): RouteReadiness => {
	const floor = project.floors.find((candidate) => candidate.id === floorId);
	const origins = project.floors
		.flatMap((candidate) => candidate.elements)
		.filter((element) => element.type === 'origin');
	const routeableDestinations = project.destinations.filter((destination) => destination.routeable !== false);
	const routeableDestinationIds = new Set(routeableDestinations.map((destination) => destination.id));
	const positionedDestinationIds = unique(project.floors
		.flatMap((candidate) => candidate.elements)
		.filter((element): element is WayfindingStudioPointElement | WayfindingStudioPolygonElement =>
			(element.type === 'location' || element.type === 'poi')
			&& Boolean(element.destinationId)
		)
		.map((element) => element.destinationId as string)
		.filter((destinationId) => routeableDestinationIds.has(destinationId)));
	const mappedDestinationsOnFloor = unique((floor?.elements ?? [])
		.filter((element): element is WayfindingStudioPointElement | WayfindingStudioPolygonElement =>
			(element.type === 'location' || element.type === 'poi')
			&& Boolean(element.destinationId)
		)
		.map((element) => element.destinationId as string)
		.filter((destinationId) => routeableDestinationIds.has(destinationId)));
	const unpositionedDestinations = Math.max(
		0,
		routeableDestinations.length - positionedDestinationIds.length
	);
	const floorNodes = project.graph.nodes.filter((node) => node.levelId === floorId);
	const floorNodeIds = new Set(floorNodes.map((node) => node.id));
	const floorEdges = project.graph.edges.filter((edge) =>
		floorNodeIds.has(edge.from) || floorNodeIds.has(edge.to)
	);
	const locationDestinationByElementId = new Map(project.floors
		.flatMap((candidate) => candidate.elements)
		.filter((element): element is WayfindingStudioPolygonElement =>
			element.type === 'location' && Boolean(element.destinationId)
		)
		.map((element) => [element.id, element.destinationId as string]));
	const roomElementsOnFloor = (floor?.elements ?? [])
		.filter((element): element is WayfindingStudioPolygonElement =>
			element.type === 'location'
			&& Boolean(element.destinationId)
			&& routeableDestinationIds.has(element.destinationId as string)
		);
	const linkedEntrances = project.floors
		.flatMap((candidate) => candidate.elements)
		.filter((element): element is WayfindingStudioDoorElement => element.type === 'door')
		.filter((door) => {
			const destinationId = door.locationId
				? locationDestinationByElementId.get(door.locationId)
				: undefined;

			return Boolean(destinationId && routeableDestinationIds.has(destinationId));
		});
	const linkedRoomDestinationIdsOnFloor = new Set(linkedEntrances
		.filter((door) => door.floorId === floorId)
		.map((door) => door.locationId
			? locationDestinationByElementId.get(door.locationId)
			: undefined
		)
		.filter((destinationId): destinationId is string => Boolean(destinationId)));
	const routeablePoiDestinationIdsOnFloor = new Set((floor?.elements ?? [])
		.filter((element): element is WayfindingStudioPointElement =>
			element.type === 'poi'
			&& Boolean(element.destinationId)
		)
		.map((element) => element.destinationId as string)
		.filter((destinationId) => routeableDestinationIds.has(destinationId)));
	const routeReadyDestinationIdsOnFloor = new Set([
		...linkedRoomDestinationIdsOnFloor,
		...routeablePoiDestinationIdsOnFloor
	]);
	const routeReadyDestinationsOnFloor = routeReadyDestinationIdsOnFloor.size;
	const unlinkedDestinationsOnFloor = mappedDestinationsOnFloor
		.filter((destinationId) => !routeReadyDestinationIdsOnFloor.has(destinationId))
		.length;
	const skippedDestinationsOnFloor = unlinkedDestinationsOnFloor + unpositionedDestinations;
	const connectedDestinations = new Set<string>();

	if (origins.length > 0 && project.graph.edges.length > 0) {
		const routing = new WayfindingGraph(project.graph);

		for (const destination of routeableDestinations) {
			const destinationNode = project.graph.nodes.find((node) => node.locationId === destination.id);

			if (!destinationNode) continue;
			const connected = origins.some((origin) => {
				const originNode = project.graph.nodes.find((node) => node.semanticElementId === origin.id);

				if (!originNode) return false;

				try {
					return Boolean(routing.route(originNode.id, destinationNode.id));
				} catch {
					return false;
				}
			});

			if (connected) connectedDestinations.add(destination.id);
		}
	}

	const walkableAreas = floor?.elements.filter((element) => element.type === 'walkable').length ?? 0;
	const blockers: RouteReadinessItem[] = [];
	const buildBlockers: RouteReadinessItem[] = [];
	const warnings: RouteReadinessItem[] = [];

	if (walkableAreas === 0) {
		buildBlockers.push({
			action: 'define-space',
			body: 'Draw or detect the pedestrian area for this floor before generating a network.',
			title: 'Define pedestrian space'
		});
	}

	if (origins.length === 0) {
		buildBlockers.push({
			action: 'add-origin',
			body: 'Place at least one You are here point so generated journeys have a start.',
			title: 'Add a starting point'
		});
	}

	if (routeableDestinations.length === 0) {
		buildBlockers.push({
			action: 'add-destinations',
			body: 'Add a destination and keep Show directions enabled.',
			title: 'Add a routeable destination'
		});
	} else if (mappedDestinationsOnFloor.length === 0) {
		buildBlockers.push({
			action: 'add-destinations',
			body: 'Click Fix, then draw or detect the area for an existing directory destination on this floor.',
			title: 'Place a destination on this floor'
		});
	} else if (routeReadyDestinationsOnFloor === 0) {
		const firstRoom = roomElementsOnFloor[0];

		buildBlockers.push({
			action: 'add-entrances',
			body: 'Place a door on a room boundary and connect it to that destination. Point-of-interest destinations can route directly.',
			target: firstRoom
				? {
					destinationId: firstRoom.destinationId,
					elementId: firstRoom.id,
					floorId: firstRoom.floorId
				}
				: undefined,
			title: 'Connect a public entrance'
		});
	}

	blockers.push(...buildBlockers);
	const roomsWithoutEntrances = roomElementsOnFloor
		.filter((element) => !linkedRoomDestinationIdsOnFloor.has(element.destinationId as string));
	const roomsWithoutEntranceDestinationIds = new Set(
		roomsWithoutEntrances.map((element) => element.destinationId as string)
	);

	if (roomsWithoutEntrances.length > 0) {
		const firstRoom = roomsWithoutEntrances[0];
		const firstDestination = project.destinations.find(
			(destination) => destination.id === firstRoom.destinationId
		);
		const remaining = roomsWithoutEntrances.length - 1;

		warnings.push({
			action: 'add-entrances',
			body: `${firstDestination?.name ?? 'This room'} has no linked public entrance${remaining > 0 ? `; ${remaining} more room${remaining === 1 ? '' : 's'} need one` : ''}. Open it, then place a door on the highlighted boundary.`,
			target: {
				destinationId: firstRoom.destinationId,
				elementId: firstRoom.id,
				floorId: firstRoom.floorId
			},
			title: roomsWithoutEntrances.length === 1
				? 'Link this room entrance'
				: `Link ${roomsWithoutEntrances.length} room entrances`
		});
	}

	if (unpositionedDestinations > 0 && mappedDestinationsOnFloor.length > 0) {
		const positionedDestinationIdSet = new Set(positionedDestinationIds);
		const firstDestination = routeableDestinations.find(
			(destination) => !positionedDestinationIdSet.has(destination.id)
		);

		warnings.push({
			action: 'add-destinations',
			body: `${firstDestination?.name ?? 'A directory destination'} is not on the map${unpositionedDestinations > 1 ? `; ${unpositionedDestinations - 1} more ${unpositionedDestinations === 2 ? 'entry is' : 'entries are'} also unplaced` : ''}. Open it and draw its map area.`,
			target: firstDestination
				? {
					destinationId: firstDestination.id,
					floorId: firstDestination.floor
				}
				: undefined,
			title: unpositionedDestinations === 1
				? 'Place this directory destination'
				: `Place ${unpositionedDestinations} directory destinations`
		});
	}

	if (floorEdges.length === 0 && blockers.every((item) => item.action !== 'define-space')) {
		blockers.push({
			action: 'build-network',
			body: 'Generate a first network, then correct its junctions and connectors in Edit.',
			title: 'No route network on this floor'
		});
	}

	const unreachableDestinationIds = routeableDestinations
		.map((destination) => destination.id)
		.filter((destinationId) =>
			positionedDestinationIds.includes(destinationId)
			&& !roomsWithoutEntranceDestinationIds.has(destinationId)
			&& !connectedDestinations.has(destinationId)
		);

	if (floorEdges.length > 0 && unreachableDestinationIds.length > 0) {
		const firstDestination = routeableDestinations.find(
			(destination) => destination.id === unreachableDestinationIds[0]
		);
		const firstElement = project.floors
			.flatMap((candidateFloor) => candidateFloor.elements)
			.find((element) =>
				(element.type === 'location' || element.type === 'poi')
				&& element.destinationId === firstDestination?.id
			);
		const remaining = unreachableDestinationIds.length - 1;

		warnings.push({
			action: 'review-routes',
			body: `${firstDestination?.name ?? 'This destination'} cannot be reached from any installed screen${remaining > 0 ? `; ${remaining} more destination${remaining === 1 ? '' : 's'} are also unreachable` : ''}. Open it to inspect the failed journey.`,
			target: firstDestination
				? {
					destinationId: firstDestination.id,
					elementId: firstElement?.id,
					floorId: firstElement?.floorId ?? firstDestination.floor
				}
				: undefined,
			title: unreachableDestinationIds.length === 1
				? 'This destination is unreachable'
				: `${unreachableDestinationIds.length} destinations are unreachable`
		});
	}

	return {
		blockers,
		buildBlockers,
		connectedDestinations: connectedDestinations.size,
		destinationAnchors: positionedDestinationIds.length,
		linkedEntrances: linkedEntrances.length,
		mappedDestinationsOnFloor: mappedDestinationsOnFloor.length,
		origins: origins.length,
		routeableDestinations: routeableDestinations.length,
		routeReadyDestinationsOnFloor,
		segments: floorEdges.length,
		skippedDestinationsOnFloor,
		status: floorEdges.length === 0
			? 'not-configured'
			: blockers.length > 0 || warnings.length > 0
				? 'needs-work'
				: 'ready',
		unlinkedDestinationsOnFloor,
		unpositionedDestinations,
		walkableAreas,
		warnings
	};
};
