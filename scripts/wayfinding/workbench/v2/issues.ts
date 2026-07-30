import type {
	WayfindingStudioIssue,
	WayfindingStudioProject
} from '../../studio-project.mts';
import type { EditorSelection } from '../../editor-core/types';

const ISSUE_COPY: Partial<Record<string, string>> = {
	'disconnected-route': 'This destination cannot be reached from a You are here point. Connect it to the route network.',
	'disconnected-step-free-route': 'This destination has no step-free route. Add or update an accessible connection.',
	'edge-outside-floor': 'A route segment leaves the floor boundary. Move the route fully inside the map.',
	'graph-destination-missing': 'A route endpoint points to a destination that no longer exists. Reassign or remove the endpoint.',
	'graph-node-floor-missing': 'A route point belongs to a floor that no longer exists. Move or remove the route point.',
	'graph-node-outside-floor': 'A route point is outside the floor canvas. Move it back onto the map.',
	'graph-semantic-element-missing': 'A destination entrance was removed. Open the destination and choose an entrance again.',
	'missing-background': 'This floor has no background image. Add a floor plan before publishing.',
	'missing-destination-node': 'This destination needs a route endpoint. Add an entrance and rebuild or connect the route network.',
	'missing-floor': 'Add at least one floor before publishing.',
	'missing-location-door': 'This destination needs a linked entrance. Add or select a door, then assign it to the room.',
	'missing-route-destination': 'Add at least one routeable destination before publishing.',
	'missing-route-origin': 'Add a You are here point for the installed screen.',
	'missing-route-pedestrian-area': 'Define walkable space before building routes.',
	'orphan-edge': 'A route segment has a missing endpoint. Repair or remove the segment.',
	'polygon-outside-floor': 'A map area extends beyond the floor canvas. Move its points fully inside the map.'
};

const firstMatchingId = (
	ids: string[],
	predicate: (id: string) => boolean
): string | undefined => ids.find(predicate);

export const friendlyIssue = (issue: WayfindingStudioIssue): string =>
	ISSUE_COPY[issue.code] ?? issue.message;

export const issueSelection = (
	issue: WayfindingStudioIssue,
	project: WayfindingStudioProject
): EditorSelection | undefined => {
	const nodeId = firstMatchingId(
		issue.elementIds,
		(id) => project.graph.nodes.some((node) => node.id === id)
	);
	const linkedDestination = nodeId
		? project.destinations.find((destination) => destination.id === project.graph.nodes.find((node) => node.id === nodeId)?.locationId)
		: undefined;

	if (linkedDestination) return { id: linkedDestination.id, kind: 'destination' };

	const destinationId = firstMatchingId(
		issue.elementIds,
		(id) => project.destinations.some((destination) => destination.id === id)
	);

	if (destinationId) return { id: destinationId, kind: 'destination' };

	const elementId = firstMatchingId(
		issue.elementIds,
		(id) => project.floors.some((floor) => floor.elements.some((element) => element.id === id))
	);

	if (elementId) {
		const destination = project.destinations.find((candidate) => candidate.id === elementId);

		return destination
			? { id: destination.id, kind: 'destination' }
			: { id: elementId, kind: 'element' };
	}

	if (nodeId) return { id: nodeId, kind: 'graph-node' };

	const edgeId = firstMatchingId(
		issue.elementIds,
		(id) => project.graph.edges.some((edge) => edge.id === id)
	);

	return edgeId ? { id: edgeId, kind: 'graph-edge' } : undefined;
};
