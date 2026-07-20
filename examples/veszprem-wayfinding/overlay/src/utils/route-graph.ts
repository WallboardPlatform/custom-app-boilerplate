import type { WayfindingGraphDocument, WayfindingNode, WayfindingRouteResult } from '@utils/wayfinding';
import { WayfindingGraph } from '@utils/wayfinding';

import routeGraphDocument from '../assets/route-graph.json';

const document: WayfindingGraphDocument = routeGraphDocument as WayfindingGraphDocument;

export const routeGraph = new WayfindingGraph(document);

export const routeBetweenLocations = (
	startLocationId: string,
	destinationLocationId: string,
	mapRatio: number
): WayfindingRouteResult | undefined => {
	const start: WayfindingNode | undefined = routeGraph.locationNode(startLocationId);
	const destination: WayfindingNode | undefined = routeGraph.locationNode(destinationLocationId);

	return start && destination ? routeGraph.route(start.id, destination.id, { mapRatio }) : undefined;
};
