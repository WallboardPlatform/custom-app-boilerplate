import {
	Accessibility,
	CircleDot,
	DoorOpen,
	Hand,
	Image,
	MapPin,
	MousePointer2,
	OctagonX,
	PencilLine,
	Route,
	Square,
	Type,
	WandSparkles,
	Waypoints
} from 'lucide-solid';
import {
	For,
	Show,
	type Accessor,
	type JSX
} from 'solid-js';
import type {
	EditorSnapshot,
	EditorStore,
	EditorTool
} from '../../../editor-core/types';
import {
	isRouteToolAvailable,
	type RouteWorkspaceView
} from '../features/routing';
import { IconButton } from '../ui';

interface ToolRailProps {
	routeWorkspaceView: Accessor<RouteWorkspaceView>;
	snapshot: Accessor<EditorSnapshot>;
	store: EditorStore;
}

interface ToolDefinition {
	icon: typeof MousePointer2;
	id: EditorTool;
	label: string;
	shortcut?: string;
}

const mapTools: ToolDefinition[] = [
	{ icon: MousePointer2, id: 'select', label: 'Select and edit', shortcut: 'V' },
	{ icon: Hand, id: 'pan', label: 'Pan canvas', shortcut: 'H' },
	{ icon: Square, id: 'location', label: 'Draw room or area', shortcut: 'R' },
	{ icon: PencilLine, id: 'freehand', label: 'Draw a freehand room outline', shortcut: 'F' },
	{ icon: WandSparkles, id: 'smart-trace', label: 'Detect an area from the floor plan' },
	{ icon: DoorOpen, id: 'door', label: 'Place door', shortcut: 'D' },
	{ icon: MapPin, id: 'poi', label: 'Place point of interest', shortcut: 'P' },
	{ icon: CircleDot, id: 'origin', label: 'Place You are here', shortcut: 'Y' },
	{ icon: Accessibility, id: 'transition', label: 'Place floor connection', shortcut: 'T' },
	{ icon: Type, id: 'label', label: 'Place text label', shortcut: 'L' },
	{ icon: Image, id: 'icon', label: 'Place selected symbol', shortcut: 'I' }
];

const routeTools: ToolDefinition[] = [
	{ icon: MousePointer2, id: 'select', label: 'Select route geometry', shortcut: 'V' },
	{ icon: Hand, id: 'pan', label: 'Pan canvas', shortcut: 'H' },
	{ icon: PencilLine, id: 'freehand', label: 'Draw a freehand pedestrian area', shortcut: 'F' },
	{ icon: WandSparkles, id: 'smart-trace', label: 'Detect pedestrian space from the floor plan' },
	{ icon: Square, id: 'walkable', label: 'Draw walkable area', shortcut: 'W' },
	{ icon: OctagonX, id: 'obstacle', label: 'Draw blocked area', shortcut: 'B' },
	{ icon: Waypoints, id: 'route-node', label: 'Place route endpoint', shortcut: 'A' },
	{ icon: Route, id: 'route-edge', label: 'Draw route segment', shortcut: 'E' }
];

export const ToolRail = (props: ToolRailProps): JSX.Element => {
	const tools = (): ToolDefinition[] => props.snapshot().state.workspace === 'route-edit'
		? routeTools.filter((tool) => isRouteToolAvailable(props.routeWorkspaceView(), tool.id))
		: mapTools;

	return (
		<Show when={props.snapshot().state.workspace === 'map' || props.snapshot().state.workspace === 'route-edit'}>
			<div class="tool-rail" role="toolbar" aria-label="Map authoring tools">
				<For each={tools()}>{(tool, index) => (
					<>
						<Show when={index() === 2}><span class="tool-rail__divider" /></Show>
						<IconButton
							active={props.snapshot().state.activeTool === tool.id}
							icon={tool.icon}
							label={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ''}`}
							onClick={() => {
								if (tool.id === 'smart-trace') {
									props.store.dispatch({
										type: 'trace/patch',
										patch: {
											elementType: props.snapshot().state.workspace === 'route-edit'
												? 'walkable'
												: 'location'
										}
									});
								}
								props.store.dispatch({ type: 'tool/set', tool: tool.id });
							}}
						/>
					</>
				)}</For>
			</div>
		</Show>
	);
};
