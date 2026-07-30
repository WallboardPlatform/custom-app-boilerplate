import type {
	EditorSelection,
	EditorState,
	EditorTool,
	EditorWorkspace
} from './types';

export interface WorkspaceDefinition {
	allowedSelectionKinds: EditorSelection['kind'][];
	allowedTools: EditorTool[];
	defaultTool: EditorTool;
	label: string;
	purpose: string;
}

export const WORKSPACE_DEFINITIONS: Record<EditorWorkspace, WorkspaceDefinition> = {
	map: {
		allowedSelectionKinds: ['element', 'destination'],
		allowedTools: [
			'select',
			'pan',
			'location',
			'freehand',
			'smart-trace',
			'door',
			'poi',
			'origin',
			'transition',
			'label',
			'icon',
			'logo'
		],
		defaultTool: 'select',
		label: 'Map',
		purpose: 'Author rooms, destinations, labels, symbols, entrances, and floor connections.'
	},
	'route-edit': {
		allowedSelectionKinds: ['graph-edge', 'graph-node'],
		allowedTools: ['select', 'pan', 'walkable', 'obstacle', 'freehand', 'smart-trace', 'route-node', 'route-edge'],
		defaultTool: 'select',
		label: 'Route edit',
		purpose: 'Define pedestrian space, generate the route network, and refine route geometry.'
	},
	'route-preview': {
		allowedSelectionKinds: ['destination'],
		allowedTools: ['pan'],
		defaultTool: 'pan',
		label: 'Route preview',
		purpose: 'Test a visitor journey without exposing authoring handles.'
	},
	'visitor-preview': {
		allowedSelectionKinds: ['destination'],
		allowedTools: ['pan'],
		defaultTool: 'pan',
		label: 'Visitor preview',
		purpose: 'Inspect the final directory, destination details, layers, and route presentation.'
	}
};

export const toolAllowedInWorkspace = (workspace: EditorWorkspace, tool: EditorTool): boolean =>
	WORKSPACE_DEFINITIONS[workspace].allowedTools.includes(tool);

export const toolForWorkspace = (
	workspace: EditorWorkspace,
	previousTool: EditorTool
): EditorTool => toolAllowedInWorkspace(workspace, previousTool)
	? previousTool
	: WORKSPACE_DEFINITIONS[workspace].defaultTool;

export const selectionForWorkspace = (
	workspace: EditorWorkspace,
	selection: EditorSelection | undefined
): EditorSelection | undefined => selection
	&& WORKSPACE_DEFINITIONS[workspace].allowedSelectionKinds.includes(selection.kind)
	? selection
	: undefined;

export const stateForWorkspace = (
	state: EditorState,
	workspace: EditorWorkspace
): Pick<EditorState, 'activeTool' | 'draft' | 'selection' | 'workspace'> => ({
	activeTool: toolForWorkspace(workspace, state.activeTool),
	draft: undefined,
	selection: selectionForWorkspace(workspace, state.selection),
	workspace
});
