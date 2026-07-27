import type {
	WayfindingStudioElement,
	WayfindingStudioProject
} from '../studio-project.mts';

export type EditorWorkspace = 'map' | 'route-edit' | 'route-preview' | 'visitor-preview';
export type EditorViewMode = '2d' | '3d';
export type EditorPanelId = 'left' | 'right';
export type EditorSelection =
	| { id: string; kind: 'element' }
	| { id: string; kind: 'graph-edge' }
	| { id: string; kind: 'graph-node' }
	| { id: string; kind: 'destination' };

export type EditorLayerId =
	| WayfindingStudioElement['type']
	| 'background'
	| 'route-network'
	| 'simulated-route';

export interface EditorCamera2d {
	offsetX: number;
	offsetY: number;
	scale: number;
}

export interface EditorPanelState {
	collapsed: boolean;
	width: number;
}

export interface EditorDocumentState {
	dirty: boolean;
	fileName?: string;
	lastSavedAt?: string;
	openedFrom: 'browser-recovery' | 'file' | 'new';
	saveState: 'error' | 'idle' | 'saving' | 'saved';
}

export interface EditorState {
	camera2dByFloor: Record<string, EditorCamera2d>;
	currentFloorId: string;
	document: EditorDocumentState;
	layerVisibility: Record<EditorLayerId, boolean>;
	panels: Record<EditorPanelId, EditorPanelState>;
	project: WayfindingStudioProject;
	selection?: EditorSelection;
	viewMode: EditorViewMode;
	workspace: EditorWorkspace;
}

export interface EditorTransaction {
	commands: EditorCommand[];
	label: string;
}

export type EditorCommand =
	| { type: 'camera/set'; floorId: string; camera: EditorCamera2d }
	| { type: 'document/error' }
	| { type: 'document/mark-saved'; fileName?: string; savedAt: string }
	| { type: 'document/saving' }
	| { type: 'element/patch'; elementId: string; patch: Partial<WayfindingStudioElement> }
	| { type: 'floor/add'; floorId: string; name: string }
	| { type: 'floor/remove'; floorId: string }
	| { type: 'floor/select'; floorId: string }
	| { type: 'floor/update'; floorId: string; patch: { name?: string; unitsPerMeter?: number } }
	| { type: 'layer/set'; layerId: EditorLayerId; visible: boolean }
	| { type: 'panel/resize'; panelId: EditorPanelId; width: number }
	| { type: 'panel/toggle'; panelId: EditorPanelId; collapsed?: boolean }
	| { type: 'project/load'; project: WayfindingStudioProject; fileName?: string; openedFrom: EditorDocumentState['openedFrom'] }
	| { type: 'project/name'; name: string }
	| { type: 'project/replace'; project: WayfindingStudioProject; label?: string }
	| { type: 'selection/clear' }
	| { type: 'selection/set'; selection: EditorSelection }
	| { type: 'view/set'; viewMode: EditorViewMode }
	| { type: 'workspace/set'; workspace: EditorWorkspace };

export interface EditorSnapshot {
	canRedo: boolean;
	canUndo: boolean;
	state: EditorState;
}

export interface EditorStore {
	dispatch(command: EditorCommand): void;
	getSnapshot(): EditorSnapshot;
	redo(): void;
	run(transaction: EditorTransaction): void;
	subscribe(listener: (snapshot: EditorSnapshot) => void): () => void;
	undo(): void;
}

export interface RendererAdapter {
	dispose(): void;
	fit(): void;
	render(state: EditorState): void;
}

export interface EditorHost {
	confirm(message: string): Promise<boolean>;
	notify(message: string, tone?: 'danger' | 'info' | 'success' | 'warning'): void;
}

export interface EditorCapabilities {
	fileSystemAccess: boolean;
	pointerEvents: boolean;
	webGl: boolean;
}

export interface PersistenceAdapter {
	clearRecovery(): Promise<void>;
	loadRecovery(): Promise<WayfindingStudioProject | undefined>;
	openProject(): Promise<{ fileName: string; project: WayfindingStudioProject } | undefined>;
	saveProject(project: WayfindingStudioProject, options?: { forceSaveAs?: boolean; suggestedName?: string }): Promise<{ fileName: string }>;
	saveRecovery(project: WayfindingStudioProject): Promise<void>;
}
