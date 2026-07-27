import {
	touchWayfindingStudioProject,
	type WayfindingStudioElement,
	type WayfindingStudioFloor
} from '../studio-project.mts';
import {
	cloneProject,
	createEditorState,
	DEFAULT_CAMERA_2D
} from './state';
import type {
	EditorCommand,
	EditorState
} from './types';

const markProjectChanged = (state: EditorState): EditorState => ({
	...state,
	document: {
		...state.document,
		dirty: true,
		saveState: 'idle'
	}
});

const mutateProject = (state: EditorState, mutation: (project: EditorState['project']) => void): EditorState => {
	const project = cloneProject(state.project);
	mutation(project);
	touchWayfindingStudioProject(project);

	return markProjectChanged({ ...state, project });
};

const patchElement = (
	element: WayfindingStudioElement,
	patch: Partial<WayfindingStudioElement>
): WayfindingStudioElement => ({ ...element, ...patch } as WayfindingStudioElement);

export const isProjectCommand = (command: EditorCommand): boolean =>
	command.type === 'element/patch'
	|| command.type === 'floor/add'
	|| command.type === 'floor/remove'
	|| command.type === 'floor/update'
	|| command.type === 'project/name'
	|| command.type === 'project/replace';

export const applyEditorCommand = (state: EditorState, command: EditorCommand): EditorState => {
	switch (command.type) {
		case 'camera/set':
			return {
				...state,
				camera2dByFloor: {
					...state.camera2dByFloor,
					[command.floorId]: { ...command.camera }
				}
			};

		case 'document/error':
			return { ...state, document: { ...state.document, saveState: 'error' } };

		case 'document/mark-saved':
			return {
				...state,
				document: {
					...state.document,
					dirty: false,
					fileName: command.fileName ?? state.document.fileName,
					lastSavedAt: command.savedAt,
					openedFrom: 'file',
					saveState: 'saved'
				}
			};

		case 'document/saving':
			return { ...state, document: { ...state.document, saveState: 'saving' } };

		case 'element/patch':
			return mutateProject(state, (project): void => {
				for (const floor of project.floors) {
					const index: number = floor.elements.findIndex((element): boolean => element.id === command.elementId);

					if (index >= 0) {
						floor.elements[index] = patchElement(floor.elements[index], command.patch);

						return;
					}
				}
			});

		case 'floor/add':
			return mutateProject(state, (project): void => {
				const base: WayfindingStudioFloor | undefined = project.floors.find((floor): boolean => floor.id === state.currentFloorId) ?? project.floors[0];
				project.floors.push({
					elements: [],
					height: base?.height ?? 1080,
					id: command.floorId,
					name: command.name,
					order: project.floors.length,
					pedestrianSpaceSource: 'polygons',
					width: base?.width ?? 1920
				});
			});

		case 'floor/remove': {
			if (state.project.floors.length <= 1) return state;
			const next: EditorState = mutateProject(state, (project): void => {
				project.floors = project.floors.filter((floor): boolean => floor.id !== command.floorId)
					.map((floor, order): WayfindingStudioFloor => ({ ...floor, order }));
			});
			const selectedFloorId: string = next.project.floors.some((floor): boolean => floor.id === state.currentFloorId)
				? state.currentFloorId
				: next.project.floors[0].id;

			return { ...next, currentFloorId: selectedFloorId, selection: undefined };
		}

		case 'floor/select':
			return state.project.floors.some((floor): boolean => floor.id === command.floorId)
				? { ...state, currentFloorId: command.floorId, selection: undefined }
				: state;

		case 'floor/update':
			return mutateProject(state, (project): void => {
				const floor: WayfindingStudioFloor | undefined = project.floors.find((candidate): boolean => candidate.id === command.floorId);

				if (!floor) return;

				if (command.patch.name !== undefined) floor.name = command.patch.name;

				if (command.patch.unitsPerMeter !== undefined) floor.unitsPerMeter = command.patch.unitsPerMeter;
			});

		case 'layer/set':
			return {
				...state,
				layerVisibility: {
					...state.layerVisibility,
					[command.layerId]: command.visible
				}
			};

		case 'panel/resize':
			return {
				...state,
				panels: {
					...state.panels,
					[command.panelId]: {
						...state.panels[command.panelId],
						width: Math.max(240, Math.min(520, command.width))
					}
				}
			};

		case 'panel/toggle':
			return {
				...state,
				panels: {
					...state.panels,
					[command.panelId]: {
						...state.panels[command.panelId],
						collapsed: command.collapsed ?? !state.panels[command.panelId].collapsed
					}
				}
			};

		case 'project/load': {
			const loaded: EditorState = createEditorState(cloneProject(command.project));

			return {
				...loaded,
				document: {
					dirty: false,
					fileName: command.fileName,
					openedFrom: command.openedFrom,
					saveState: 'idle'
				},
				panels: state.panels
			};
		}

		case 'project/name':
			return mutateProject(state, (project): void => {
				project.name = command.name;
			});

		case 'project/replace':
			return markProjectChanged({
				...state,
				currentFloorId: command.project.floors.some((floor): boolean => floor.id === state.currentFloorId)
					? state.currentFloorId
					: command.project.floors[0]?.id ?? state.currentFloorId,
				project: cloneProject(command.project)
			});

		case 'selection/clear':
			return { ...state, selection: undefined };

		case 'selection/set':
			return { ...state, selection: command.selection };

		case 'view/set':
			return { ...state, viewMode: command.viewMode };

		case 'workspace/set':
			return {
				...state,
				selection: command.workspace === 'visitor-preview' ? undefined : state.selection,
				workspace: command.workspace
			};
		default:
			return state;
	}
};

export const cameraForFloor = (state: EditorState, floorId: string): EditorState['camera2dByFloor'][string] =>
	state.camera2dByFloor[floorId] ?? DEFAULT_CAMERA_2D;
