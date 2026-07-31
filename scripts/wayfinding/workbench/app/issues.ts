import type {
	WayfindingStudioIssue,
	WayfindingStudioProject
} from '../../studio-project.mts';
import type { EditorSelection } from '../../editor-core/types';

const ISSUE_COPY: Partial<Record<string, string>> = {
	'destination-floor-missing': 'A destination is assigned to a floor that no longer exists. Choose an available floor.',
	'destination-logo-kind-mismatch': 'A destination logo uses the wrong asset type. Choose a logo asset.',
	'destination-photo-kind-mismatch': 'A destination photo uses the wrong asset type. Choose a gallery photo.',
	'destination-symbol-kind-mismatch': 'A destination symbol uses the wrong asset type. Choose a map icon.',
	'disconnected-route': 'This destination cannot be reached from a You are here point. Connect it to the route network.',
	'disconnected-step-free-route': 'This destination has no step-free route. Add or update an accessible connection.',
	'duplicate-destination-id': 'Two directory destinations share the same identity. Duplicate or recreate one of them.',
	'duplicate-floor-order': 'Two floors occupy the same position. Reorder the floors before publishing.',
	'duplicate-graph-edge': 'Two route segments share the same identity. Rebuild the network or remove one segment.',
	'duplicate-graph-node': 'Two route points share the same identity. Rebuild the network or remove one point.',
	'duplicate-id': 'Two project items share the same identity. Duplicate or recreate one of them.',
	'duplicate-screen-id': 'Two You are here points use the same screen assignment. Give each installed screen a unique ID.',
	'duplicate-transition-floor': 'A floor connection appears more than once on the same floor. Keep one anchor per floor.',
	'edge-outside-floor': 'A route segment leaves the floor boundary. Move the route fully inside the map.',
	'element-outside-floor': 'A map object sits outside the floor canvas. Move it back onto the map.',
	'floor-mismatch': 'A map object is assigned to a different floor than the one containing it. Move or recreate the object.',
	'graph-destination-missing': 'A route endpoint points to a destination that no longer exists. Reassign or remove the endpoint.',
	'graph-node-floor-missing': 'A route point belongs to a floor that no longer exists. Move or remove the route point.',
	'graph-node-outside-floor': 'A route point is outside the floor canvas. Move it back onto the map.',
	'graph-semantic-element-missing': 'A destination entrance was removed. Open the destination and choose an entrance again.',
	'invalid-3d-camera': 'The saved 3D camera view is invalid. Reset or refit the 3D view.',
	'invalid-door-location': 'An entrance is linked to a room on another floor or to a room that no longer exists. Relink the entrance.',
	'invalid-floor-size': 'A floor has an invalid canvas size. Replace its floor plan or correct its dimensions.',
	'invalid-label-color': 'A text label has an invalid color. Choose a valid text and outline color.',
	'invalid-label-font-size': 'A text label has an invalid size. Choose a font size between 6 and 512.',
	'invalid-label-outline-width': 'A text label has an invalid outline. Choose an outline width between 0 and 16.',
	'invalid-location-color-mode': 'The default room color behavior is invalid. Choose inherited, random, or fixed.',
	'invalid-location-fixed-color': 'The default fixed room color is invalid. Choose a valid color.',
	'invalid-media-bounds': 'A map image has invalid dimensions or extends beyond the floor. Resize or reposition it.',
	'invalid-polygon-color': 'A map area has an invalid fill color. Choose a valid color.',
	'invalid-polygon-height': 'A map area has an invalid 3D height. Choose a value between 0 and 100.',
	'invalid-polygon-opacity': 'A map area has an invalid opacity. Choose a value between 0% and 100%.',
	'media-kind-mismatch': 'A map image uses the wrong asset type. Replace it with a matching asset.',
	'missing-background': 'This floor has no background image. Add a floor plan before publishing.',
	'missing-destination': 'A map object points to a directory destination that no longer exists. Reassign or remove it.',
	'missing-destination-node': 'This destination needs a route endpoint. Add an entrance and rebuild or connect the route network.',
	'missing-destination-logo': 'A destination logo was removed from the asset library. Choose another logo.',
	'missing-destination-photo': 'A destination photo was removed from the asset library. Choose another photo.',
	'missing-destination-symbol': 'A destination map icon was removed from the asset library. Choose another icon.',
	'missing-floor': 'Add at least one floor before publishing.',
	'missing-location-door': 'This destination needs a linked entrance. Add or select a door, then assign it to the room.',
	'missing-media': 'A map image was removed from the asset library. Replace or remove the map object.',
	'missing-origin-node': 'A You are here point is not connected to the route graph. Rebuild or connect the route network.',
	'missing-route-destination': 'Add at least one routeable destination before publishing.',
	'missing-route-origin': 'Add a You are here point for the installed screen.',
	'missing-route-pedestrian-area': 'Define walkable space before building routes.',
	'open-polygon': 'A map area does not have enough points to form a closed shape. Redraw or remove it.',
	'orphan-edge': 'A route segment has a missing endpoint. Repair or remove the segment.',
	'polygon-outside-floor': 'A map area extends beyond the floor canvas. Move its points fully inside the map.',
	'route-leaves-walkable-space': 'A route segment leaves walkable space. Rebuild the network or move the segment fully inside the pedestrian area.',
	'unpaired-transition': 'A floor connection has no matching anchor on another floor. Add its paired elevator, stairs, or escalator.'
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
