import type { WayfindingStudioElement } from '../../../../studio-project.mts';
import type { EditorTool, EditorWorkspace } from '../../../../editor-core/types';

export type RouteWorkspaceView = 'build' | 'edit' | 'space' | 'test';

export const isRouteGraphInteractive = (
	workspace: EditorWorkspace,
	view: RouteWorkspaceView
): boolean => workspace === 'route-edit' && view === 'edit';

const routeToolsByView: Record<RouteWorkspaceView, ReadonlySet<EditorTool>> = {
	build: new Set(['pan']),
	edit: new Set(['pan', 'route-edge', 'route-node', 'select']),
	space: new Set(['freehand', 'obstacle', 'pan', 'select', 'smart-trace', 'walkable']),
	test: new Set(['pan'])
};

export const isRouteToolAvailable = (
	view: RouteWorkspaceView,
	tool: EditorTool
): boolean => routeToolsByView[view].has(tool);

export const isCanvasElementInteractive = (
	workspace: EditorWorkspace,
	view: RouteWorkspaceView,
	elementType: WayfindingStudioElement['type']
): boolean => {
	if (workspace === 'map') {
		return elementType !== 'walkable' && elementType !== 'obstacle';
	}

	if (workspace === 'route-edit' && view === 'space') {
		return elementType === 'walkable' || elementType === 'obstacle';
	}

	return false;
};
