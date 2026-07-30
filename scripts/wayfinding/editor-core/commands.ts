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
import { stateForWorkspace, toolAllowedInWorkspace } from './workspaces';

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
	command.type === 'asset/add'
	|| command.type === 'asset/remove'
	|| command.type === 'destination/add'
	|| command.type === 'destination/patch'
	|| command.type === 'destination/remove'
	|| command.type === 'element/add'
	|| command.type === 'element/patch'
	|| command.type === 'element/remove'
	|| command.type === 'floor/add'
	|| command.type === 'floor/remove'
	|| command.type === 'floor/reorder'
	|| command.type === 'floor/update'
	|| command.type === 'graph/edge-add'
	|| command.type === 'graph/edge-patch'
	|| command.type === 'graph/edge-remove'
	|| command.type === 'graph/node-add'
	|| command.type === 'graph/node-patch'
	|| command.type === 'graph/node-remove'
	|| command.type === 'project/name'
	|| command.type === 'project/replace';

export const applyEditorCommand = (state: EditorState, command: EditorCommand): EditorState => {
	switch (command.type) {
		case 'asset/add':
			return mutateProject(state, (project): void => {
				const index = project.assets.findIndex((asset): boolean => asset.id === command.asset.id);

				if (index >= 0) project.assets[index] = structuredClone(command.asset);
				else project.assets.push(structuredClone(command.asset));
			});

		case 'asset/remove':
			return mutateProject({
				...state,
				activeAssetId: state.activeAssetId === command.assetId ? undefined : state.activeAssetId
			}, (project): void => {
				project.assets = project.assets.filter((asset): boolean => asset.id !== command.assetId);

				for (const floor of project.floors) {
					if (floor.backgroundAssetId === command.assetId) delete floor.backgroundAssetId;
					floor.elements = floor.elements.filter((element): boolean =>
						!('assetId' in element) || element.assetId !== command.assetId
					);
				}

				for (const destination of project.destinations) {
					if (destination.logoAssetId === command.assetId) delete destination.logoAssetId;
					destination.photoAssetIds = destination.photoAssetIds?.filter((assetId): boolean => assetId !== command.assetId);
				}
			});

		case 'asset/select':
			return command.assetId === undefined || state.project.assets.some((asset): boolean => asset.id === command.assetId)
				? { ...state, activeAssetId: command.assetId }
				: state;

		case 'camera/set':
			return {
				...state,
				camera2dByFloor: {
					...state.camera2dByFloor,
					[command.floorId]: { ...command.camera }
				}
			};

		case 'destination/add':
			return mutateProject(state, (project): void => {
				if (!project.destinations.some((destination): boolean => destination.id === command.destination.id)) {
					project.destinations.push(structuredClone(command.destination));
				}
			});

		case 'destination/patch':
			return mutateProject(state, (project): void => {
				const index: number = project.destinations.findIndex((destination): boolean => destination.id === command.destinationId);

				if (index >= 0) project.destinations[index] = { ...project.destinations[index], ...command.patch };
			});

		case 'destination/remove':
			return mutateProject(state, (project): void => {
				project.destinations = project.destinations.filter((destination): boolean => destination.id !== command.destinationId);

				for (const floor of project.floors) {
					for (const element of floor.elements) {
						if ('destinationId' in element && element.destinationId === command.destinationId) {
							delete element.destinationId;
						}
					}
				}
			});

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

		case 'drawing/patch':
			return {
				...state,
				drawing: {
					...state.drawing,
					...command.patch
				}
			};

		case 'draft/clear':
			return { ...state, draft: undefined };

		case 'draft/set':
			return { ...state, draft: structuredClone(command.draft) };

		case 'element/add':
			return mutateProject(state, (project): void => {
				const floor: WayfindingStudioFloor | undefined = project.floors.find((candidate): boolean => candidate.id === command.floorId);

				if (!floor || floor.elements.some((element): boolean => element.id === command.element.id)) return;
				floor.elements.push(structuredClone(command.element));

				if (command.element.type === 'walkable' || command.element.type === 'obstacle') {
					floor.pedestrianSpaceSource = 'polygons';
				}
			});

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

		case 'element/remove':
			return mutateProject(state, (project): void => {
				for (const floor of project.floors) {
					floor.elements = floor.elements.filter((element): boolean => element.id !== command.elementId);
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
				const removedFloor: WayfindingStudioFloor | undefined = project.floors.find(
					(floor): boolean => floor.id === command.floorId
				);
				const removedDestinationIds = new Set<string>(
					removedFloor?.elements.flatMap((element): string[] =>
						(element.type === 'location' || element.type === 'poi') && element.destinationId
							? [element.destinationId]
							: []
					) ?? []
				);

				project.floors = project.floors.filter((floor): boolean => floor.id !== command.floorId)
					.map((floor, order): WayfindingStudioFloor => ({ ...floor, order }));
				project.destinations = project.destinations.filter((destination): boolean =>
					destination.floor !== command.floorId && !removedDestinationIds.has(destination.id)
				);
				const retainedNodeIds = new Set(
					project.graph.nodes
						.filter((node): boolean => node.levelId !== command.floorId)
						.map((node): string => node.id)
				);
				project.graph.nodes = project.graph.nodes.filter((node): boolean => retainedNodeIds.has(node.id));
				project.graph.edges = project.graph.edges.filter((edge): boolean =>
					retainedNodeIds.has(edge.from) && retainedNodeIds.has(edge.to)
				);
			});
			const selectedFloorId: string = next.project.floors.some((floor): boolean => floor.id === state.currentFloorId)
				? state.currentFloorId
				: next.project.floors[0].id;

			return { ...next, currentFloorId: selectedFloorId, selection: undefined };
		}

		case 'floor/reorder': {
			const orderedFloors: WayfindingStudioFloor[] = [...state.project.floors]
				.sort((left, right): number => left.order - right.order);
			const currentIndex: number = orderedFloors.findIndex((floor): boolean => floor.id === command.floorId);
			const targetIndex: number = currentIndex + command.direction;

			if (currentIndex < 0 || targetIndex < 0 || targetIndex >= orderedFloors.length) return state;

			return mutateProject(state, (project): void => {
				const floors: WayfindingStudioFloor[] = [...orderedFloors];
				[floors[currentIndex], floors[targetIndex]] = [floors[targetIndex], floors[currentIndex]];
				project.floors = floors.map((floor, order): WayfindingStudioFloor => ({ ...floor, order }));
			});
		}

		case 'floor/select':
			return state.project.floors.some((floor): boolean => floor.id === command.floorId)
				? { ...state, currentFloorId: command.floorId, selection: undefined }
				: state;

		case 'floor/update':
			return mutateProject(state, (project): void => {
				const floor: WayfindingStudioFloor | undefined = project.floors.find((candidate): boolean => candidate.id === command.floorId);

				if (!floor) return;

				if (command.patch.camera3d !== undefined) floor.camera3d = structuredClone(command.patch.camera3d);

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

		case 'graph/edge-add':
			return mutateProject(state, (project): void => {
				if (!project.graph.edges.some((edge): boolean => edge.id === command.edge.id)) {
					project.graph.edges.push(structuredClone(command.edge));
				}
			});

		case 'graph/edge-patch':
			return mutateProject(state, (project): void => {
				const index: number = project.graph.edges.findIndex((edge): boolean => edge.id === command.edgeId);

				if (index >= 0) project.graph.edges[index] = { ...project.graph.edges[index], ...command.patch };
			});

		case 'graph/edge-remove':
			return mutateProject(state, (project): void => {
				project.graph.edges = project.graph.edges.filter((edge): boolean => edge.id !== command.edgeId);
			});

		case 'graph/node-add':
			return mutateProject(state, (project): void => {
				if (!project.graph.nodes.some((node): boolean => node.id === command.node.id)) {
					project.graph.nodes.push(structuredClone(command.node));
				}
			});

		case 'graph/node-patch':
			return mutateProject(state, (project): void => {
				const index: number = project.graph.nodes.findIndex((node): boolean => node.id === command.nodeId);

				if (index >= 0) project.graph.nodes[index] = { ...project.graph.nodes[index], ...command.patch };
			});

		case 'graph/node-remove':
			return mutateProject(state, (project): void => {
				project.graph.nodes = project.graph.nodes.filter((node): boolean => node.id !== command.nodeId);
				project.graph.edges = project.graph.edges.filter((edge): boolean => edge.from !== command.nodeId && edge.to !== command.nodeId);
			});

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
				activeTool: 'select',
				activeAssetId: undefined,
				drawing: state.drawing,
				panels: state.panels,
				trace: state.trace
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

		case 'trace/patch':
			return {
				...state,
				trace: {
					...state.trace,
					...command.patch
				}
			};

		case 'tool/set':
			if (!toolAllowedInWorkspace(state.workspace, command.tool)) return state;

			return {
				...state,
				activeTool: command.tool,
				draft: undefined,
				selection: command.tool === 'pan' ? undefined : state.selection
			};

		case 'view/set':
			return { ...state, viewMode: command.viewMode };

		case 'workspace/set':
			return {
				...state,
				...stateForWorkspace(state, command.workspace)
			};
		default:
			return state;
	}
};

export const cameraForFloor = (state: EditorState, floorId: string): EditorState['camera2dByFloor'][string] =>
	state.camera2dByFloor[floorId] ?? DEFAULT_CAMERA_2D;
