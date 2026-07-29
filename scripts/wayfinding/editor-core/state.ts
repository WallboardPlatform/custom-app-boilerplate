import {
	createWayfindingStudioProject,
	type WayfindingStudioFloor,
	type WayfindingStudioProject
} from '../studio-project.mts';
import type {
	EditorCamera2d,
	EditorLayerId,
	EditorState
} from './types';

export const DEFAULT_CAMERA_2D: EditorCamera2d = {
	offsetX: 0,
	offsetY: 0,
	scale: 1
};

export const EDITOR_LAYER_IDS: EditorLayerId[] = [
	'background',
	'location',
	'walkable',
	'obstacle',
	'door',
	'poi',
	'origin',
	'transition',
	'label',
	'icon',
	'logo',
	'route-network',
	'simulated-route'
];

export const createLayerVisibility = (): Record<EditorLayerId, boolean> => {
	const visibility = Object.fromEntries(
		EDITOR_LAYER_IDS.map((layerId): [EditorLayerId, boolean] => [layerId, true])
	) as Record<EditorLayerId, boolean>;

	visibility['route-network'] = false;

	return visibility;
};

export const createEditorState = (project: WayfindingStudioProject = createWayfindingStudioProject()): EditorState => {
	const currentFloorId: string = project.floors[0]?.id ?? 'level-0';

	return {
		activeAssetId: undefined,
		activeTool: 'select',
		camera2dByFloor: {},
		currentFloorId,
		document: {
			dirty: false,
			openedFrom: 'new',
			saveState: 'idle'
		},
		drawing: {
			snapRadius: 12,
			snapToSourceEdges: true
		},
		layerVisibility: createLayerVisibility(),
		panels: {
			left: { collapsed: false, width: 304 },
			right: { collapsed: false, width: 336 }
		},
		project,
		trace: {
			closeGap: 2,
			colorTolerance: 28,
			detail: 4,
			elementType: 'location',
			minimumOpening: 5
		},
		viewMode: '2d',
		workspace: 'map'
	};
};

export const cloneProject = (project: WayfindingStudioProject): WayfindingStudioProject => structuredClone(project);

export const currentFloor = (state: EditorState): WayfindingStudioFloor =>
	state.project.floors.find((floor): boolean => floor.id === state.currentFloorId) ?? state.project.floors[0];
