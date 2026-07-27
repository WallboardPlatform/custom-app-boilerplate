import type {
	WayfindingStudioElement,
	WayfindingStudioFloor
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

export const elementDisplayName = (element: WayfindingStudioElement): string => {
	if ('label' in element && element.label) return element.label;

	if (element.type === 'label') return element.text || 'Text label';

	if (element.type === 'origin') return element.label || 'You are here';

	if (element.type === 'transition') return element.label || element.kind;

	return element.id;
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
