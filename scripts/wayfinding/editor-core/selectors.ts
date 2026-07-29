import type {
	WayfindingStudioElement,
	WayfindingStudioFloor,
	WayfindingStudioProject
} from '../studio-project.mts';
import type { EditorState } from './types';

export const selectedElement = (state: EditorState): WayfindingStudioElement | undefined => {
	if (state.selection?.kind !== 'element') return undefined;

	return state.project.floors
		.flatMap((floor): WayfindingStudioElement[] => floor.elements)
		.find((element): boolean => element.id === state.selection?.id);
};

export const selectedFloor = (state: EditorState): WayfindingStudioFloor =>
	state.project.floors.find((floor): boolean => floor.id === state.currentFloorId) ?? state.project.floors[0];

export const elementDisplayName = (
	element: WayfindingStudioElement,
	project?: WayfindingStudioProject
): string => {
	if ('label' in element && element.label?.trim()) return element.label.trim();

	if (element.type === 'label') return element.text || 'Text label';

	if (element.type === 'origin') return element.label || 'You are here';

	if (element.type === 'transition') return element.label || element.kind;

	const destinationId = 'destinationId' in element ? element.destinationId : undefined;
	const linkedLocation = element.type === 'door' && element.locationId
		? project?.floors
			.flatMap((floor) => floor.elements)
			.find((candidate) => candidate.id === element.locationId)
		: undefined;
	const linkedDestinationId = destinationId
		?? (
			linkedLocation && 'destinationId' in linkedLocation
				? linkedLocation.destinationId
				: undefined
		);
	const destinationName = linkedDestinationId
		? project?.destinations.find((destination) => destination.id === linkedDestinationId)?.name.trim()
		: undefined;

	if (destinationName) {
		return element.type === 'door' ? `Entrance — ${destinationName}` : destinationName;
	}

	if ((element.type === 'icon' || element.type === 'logo') && project) {
		const assetName = project.assets.find((asset) => asset.id === element.assetId)?.name.trim();

		if (assetName) return assetName;
	}

	switch (element.type) {
		case 'door': return 'Entrance';

		case 'icon': return 'Map symbol';

		case 'location': return 'Room or area';

		case 'logo': return 'Brand mark';

		case 'obstacle': return 'Blocked area';

		case 'poi': return 'Point of interest';

		case 'walkable': return 'Walkable area';
	}
};

export const projectCounts = (state: EditorState): {
	destinations: number;
	floors: number;
	items: number;
	routes: number;
} => ({
	destinations: state.project.destinations.length,
	floors: state.project.floors.length,
	items: state.project.floors.reduce((count, floor): number => count + floor.elements.length, 0),
	routes: state.project.graph.edges.length
});
