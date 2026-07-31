import type {
	WayfindingEdge,
	WayfindingNode
} from '../../../../../../src/utils/wayfinding';
import type {
	WayfindingStudioElement,
	WayfindingStudioProject
} from '../../../../studio-project.mts';
import type { RouteGeometryIssue } from './route-geometry';

const semanticElement = (
	project: WayfindingStudioProject,
	node: WayfindingNode
): WayfindingStudioElement | undefined => {
	const semanticElementId = node.semanticElementId
		?? (node.id.startsWith('semantic:') ? node.id.slice('semantic:'.length) : undefined);

	if (!semanticElementId) return undefined;

	return project.floors
		.flatMap((floor) => floor.elements)
		.find((element) => element.id === semanticElementId);
};

export const routeNodeLabel = (
	project: WayfindingStudioProject,
	node: WayfindingNode
): string => {
	const destination = node.locationId
		? project.destinations.find((candidate) => candidate.id === node.locationId)
		: undefined;

	if (destination) return destination.name || 'Unnamed destination';

	const element = semanticElement(project, node);

	if (element?.type === 'origin') return element.label || 'You are here';

	if (element?.type === 'transition') return element.label || 'Floor connection';

	if (element?.type === 'poi') return element.label || 'Point of interest';

	if (element?.type === 'location') return element.label || 'Destination';

	if (node.kind === 'location') return 'Destination entrance';

	if (node.kind === 'transition') return 'Floor connection';

	return 'Route junction';
};

export const routeEdgeLabel = (
	project: WayfindingStudioProject,
	edge: WayfindingEdge,
	nodes: readonly WayfindingNode[]
): string => {
	const endpoints = [edge.from, edge.to]
		.map((id) => nodes.find((node) => node.id === id))
		.filter((node): node is WayfindingNode => Boolean(node));
	const location = endpoints.find((node) => node.kind === 'location');

	if (location) return `Entrance connection to ${routeNodeLabel(project, location)}`;

	const transition = endpoints.find((node) => node.kind === 'transition');

	if (transition) return `Floor connection to ${routeNodeLabel(project, transition)}`;

	return 'Route segment';
};

export const routeDisconnectedMessage = (
	project: WayfindingStudioProject,
	node: WayfindingNode
): string => node.kind === 'location'
	? `${routeNodeLabel(project, node)} is not connected. Open Build to link its entrance, or draw a connection from this endpoint.`
	: `${routeNodeLabel(project, node)} is not connected to the route network.`;

export const routeGeometryIssueMessage = (
	project: WayfindingStudioProject,
	issue: RouteGeometryIssue,
	edge: WayfindingEdge,
	nodes: readonly WayfindingNode[]
): string => {
	const subject = routeEdgeLabel(project, edge, nodes);

	switch (issue.code) {
		case 'backtracking':
			return `${subject} doubles back near bend ${issue.geometryIndex ?? 1}.`;

		case 'excessive-bends':
			return `${subject} has too many bends and may be difficult to maintain.`;

		case 'missing-endpoint':
			return `${subject} references a route point that no longer exists.`;

		case 'short-zigzag':
			return `${subject} contains a short left-right jog near bend ${issue.geometryIndex ?? 1}.`;

		case 'unsnapped-endpoint':
			return `${subject} does not terminate exactly on both connected route points.`;

		case 'zero-length-segment':
			return `${subject} contains overlapping control points.`;
	}
};
