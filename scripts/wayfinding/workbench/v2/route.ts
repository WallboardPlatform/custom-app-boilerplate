import {
	WayfindingGraph,
	type WayfindingPoint,
	type WayfindingRoutePoint
} from '../../../../src/utils/wayfinding';
import type {
	WayfindingStudioOriginElement,
	WayfindingStudioProject
} from '../../studio-project.mts';

export const routeToDestination = (
	project: WayfindingStudioProject,
	destinationId: string | undefined
): WayfindingRoutePoint[] => {
	if (!destinationId) return [];
	const origin: WayfindingStudioOriginElement | undefined = project.floors
		.flatMap((floor) => floor.elements)
		.find((element): element is WayfindingStudioOriginElement => element.type === 'origin');
	const startNode = origin
		? project.graph.nodes.find((node) => node.semanticElementId === origin.id)
		: project.graph.nodes.find((node) => node.kind === 'route');
	const destinationNode = project.graph.nodes.find((node) => node.locationId === destinationId);

	if (!startNode || !destinationNode) return [];

	try {
		return new WayfindingGraph(project.graph).route(startNode.id, destinationNode.id)?.path ?? [];
	} catch {
		return [];
	}
};

export const floorRoutePoints = (
	points: WayfindingRoutePoint[],
	floorId: string
): WayfindingPoint[] => points.filter((point) => point.levelId === floorId).map(({ x, y }) => ({ x, y }));

export const routePolyline = (points: WayfindingPoint[]): string =>
	points.map((point) => `${point.x},${point.y}`).join(' ');
