import { WayfindingGraph } from '../../../../src/utils/wayfinding';
import type {
	WayfindingStudioDoorElement,
	WayfindingStudioPolygonElement,
	WayfindingStudioProject
} from '../../studio-project.mts';

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
	title: string;
}

export interface RouteReadiness {
	blockers: RouteReadinessItem[];
	buildBlockers: RouteReadinessItem[];
	connectedDestinations: number;
	destinationAnchors: number;
	linkedEntrances: number;
	mode: 'directory' | 'directional' | 'highlight' | 'route';
	origins: number;
	routeableDestinations: number;
	segments: number;
	status: 'highlight-ready' | 'needs-work' | 'ready';
	walkableAreas: number;
	warnings: RouteReadinessItem[];
}

const unique = <Value>(values: Iterable<Value>): Value[] => [...new Set(values)];

export const getRouteReadiness = (
	project: WayfindingStudioProject,
	floorId: string
): RouteReadiness => {
	const floor = project.floors.find((candidate) => candidate.id === floorId);
	const mode = project.delivery.guidance.targetMode;
	const origins = project.floors
		.flatMap((candidate) => candidate.elements)
		.filter((element) => element.type === 'origin');
	const routeableDestinations = project.destinations.filter((destination) => destination.routeable !== false);
	const routeableDestinationIds = new Set(routeableDestinations.map((destination) => destination.id));
	const floorNodes = project.graph.nodes.filter((node) => node.levelId === floorId);
	const floorNodeIds = new Set(floorNodes.map((node) => node.id));
	const floorEdges = project.graph.edges.filter((edge) =>
		floorNodeIds.has(edge.from) || floorNodeIds.has(edge.to)
	);
	const destinationAnchors = unique(project.graph.nodes
		.filter((node) => node.locationId && routeableDestinationIds.has(node.locationId))
		.map((node) => node.locationId as string));
	const locationDestinationByElementId = new Map(project.floors
		.flatMap((candidate) => candidate.elements)
		.filter((element): element is WayfindingStudioPolygonElement =>
			element.type === 'location' && Boolean(element.destinationId)
		)
		.map((element) => [element.id, element.destinationId as string]));
	const roomDestinationIds = new Set([...locationDestinationByElementId.values()]
		.filter((destinationId) => routeableDestinationIds.has(destinationId)));
	const linkedEntrances = project.floors
		.flatMap((candidate) => candidate.elements)
		.filter((element): element is WayfindingStudioDoorElement => element.type === 'door')
		.filter((door) => {
			const destinationId = door.locationId
				? locationDestinationByElementId.get(door.locationId)
				: undefined;

			return Boolean(destinationId && routeableDestinationIds.has(destinationId));
		});
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

	const polygonWalkableAreas = floor?.elements.filter((element) => element.type === 'walkable').length ?? 0;
	const usesPaintedMask = floor?.pedestrianSpaceSource === 'mask'
		&& Boolean(floor.walkableMask?.walkableRuns.length);
	const walkableAreas = polygonWalkableAreas || (usesPaintedMask ? 1 : 0);
	const blockers: RouteReadinessItem[] = [];
	const buildBlockers: RouteReadinessItem[] = [];
	const warnings: RouteReadinessItem[] = [];

	if (walkableAreas === 0 && !floor?.walkableMask) {
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
	} else if (destinationAnchors.length < routeableDestinations.length) {
		buildBlockers.push({
			action: 'add-entrances',
			body: `${routeableDestinations.length - destinationAnchors.length} routeable destination${routeableDestinations.length - destinationAnchors.length === 1 ? '' : 's'} still need a map position.`,
			title: 'Position every destination'
		});
	}

	if (mode === 'route') {
		blockers.push(...buildBlockers.map((item): RouteReadinessItem => {
			switch (item.action) {
				case 'define-space':
					return {
				action: 'define-space',
				body: 'Draw or detect the pedestrian area for this floor before generating a network.',
				title: 'Pedestrian space is missing'
					};

				case 'add-origin':
					return {
				action: 'add-origin',
				body: 'Place at least one You are here point so visitor journeys have a start.',
				title: 'No installed-screen origin'
					};

				case 'add-destinations':
					return {
				action: 'add-destinations',
				body: 'Mark at least one destination as routeable.',
				title: 'No routeable destinations'
					};

				default:
					return {
				action: 'add-entrances',
				body: `${routeableDestinations.length - destinationAnchors.length} routeable destination${routeableDestinations.length - destinationAnchors.length === 1 ? '' : 's'} still need a map position.`,
				title: 'Destination positions are incomplete'
					};
			}
		}));
		const linkedRoomDestinationIds = new Set(linkedEntrances
			.map((door) => door.locationId ? locationDestinationByElementId.get(door.locationId) : undefined)
			.filter((destinationId): destinationId is string => Boolean(destinationId)));
		const roomsWithoutEntrances = [...roomDestinationIds]
			.filter((destinationId) => !linkedRoomDestinationIds.has(destinationId))
			.length;

		if (roomsWithoutEntrances > 0) {
			warnings.push({
				action: 'add-entrances',
				body: `${roomsWithoutEntrances} room destination${roomsWithoutEntrances === 1 ? '' : 's'} should terminate at a linked entrance, not at the polygon center.`,
				title: 'Some room entrances are not linked'
			});
		}

		if (floorEdges.length === 0 && blockers.every((item) => item.action !== 'define-space')) {
			blockers.push({
				action: 'build-network',
				body: 'Generate a first network, then correct its junctions and connectors in Edit.',
				title: 'No route network on this floor'
			});
		}

		if (floorEdges.length > 0 && connectedDestinations.size < routeableDestinations.length) {
			warnings.push({
				action: 'review-routes',
				body: `${routeableDestinations.length - connectedDestinations.size} destination${routeableDestinations.length - connectedDestinations.size === 1 ? '' : 's'} cannot yet be reached from an installed screen.`,
				title: 'Route coverage is incomplete'
			});
		}
	}

	return {
		blockers,
		buildBlockers,
		connectedDestinations: connectedDestinations.size,
		destinationAnchors: destinationAnchors.length,
		linkedEntrances: linkedEntrances.length,
		mode,
		origins: origins.length,
		routeableDestinations: routeableDestinations.length,
		segments: floorEdges.length,
		status: mode === 'highlight'
			? 'highlight-ready'
			: blockers.length > 0 || warnings.length > 0
				? 'needs-work'
				: 'ready',
		walkableAreas,
		warnings
	};
};
