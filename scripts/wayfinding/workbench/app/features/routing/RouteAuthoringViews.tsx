import {
	Footprints,
	MousePointer2,
	Network,
	PenLine,
	Trash2,
	WandSparkles,
	Waypoints
} from 'lucide-solid';
import {
	Show,
	type Accessor,
	type JSX
} from 'solid-js';

import type {
	EditorSnapshot,
	EditorStore,
	EditorTool
} from '../../../../editor-core/types';
import { FreehandSettings } from '../../components/FreehandSettings';
import { SmartTraceSettings } from '../../components/SmartTraceSettings';
import { PanelSection } from '../../ui';
import type { CanvasSelectionActions } from '../map';
import { RouteGraphNavigator } from './RouteGraphNavigator';

const ToolButton = (props: {
	active: boolean;
	icon: typeof MousePointer2;
	label: string;
	onClick: () => void;
	title?: string;
}): JSX.Element => (
	<button
		type="button"
		class="route-task"
		classList={{ active: props.active }}
		aria-label={props.title ?? props.label}
		title={props.title}
		onClick={() => props.onClick()}
	>
		<props.icon size={17} />
		<span>{props.label}</span>
	</button>
);

export const RouteSpaceView = (props: {
	activeTool: Accessor<EditorTool>;
	activateSmartTrace: () => void;
	obstacleCount: Accessor<number>;
	setTool: (tool: EditorTool) => void;
	snapshot: Accessor<EditorSnapshot>;
	store: EditorStore;
	walkableCount: Accessor<number>;
}): JSX.Element => (
	<>
		<div class="workflow-intro">
			<small>Step 1</small>
			<strong>Define pedestrian space</strong>
			<p>Choose one method for the current floor. Routes stay inside walkable space and outside blocked areas.</p>
		</div>
		<div class="route-summary">
			<span><strong>{props.walkableCount()}</strong> walkable</span>
			<span><strong>{props.obstacleCount()}</strong> blocked</span>
		</div>
		<div class="route-task-grid route-task-grid--single-choice">
			<ToolButton
				active={props.activeTool() === 'smart-trace'}
				icon={WandSparkles}
				label="Detect from image"
				onClick={props.activateSmartTrace}
			/>
			<ToolButton
				active={props.activeTool() === 'freehand'}
				icon={PenLine}
				label="Paint freehand"
				onClick={() => props.setTool('freehand')}
			/>
			<ToolButton
				active={props.activeTool() === 'walkable'}
				icon={Footprints}
				label="Draw polygon"
				onClick={() => props.setTool('walkable')}
			/>
			<ToolButton
				active={props.activeTool() === 'obstacle'}
				icon={Trash2}
				label="Exclude area"
				onClick={() => props.setTool('obstacle')}
			/>
		</div>
		<Show when={props.activeTool() === 'smart-trace'}>
			<div class="route-subpanel">
				<SmartTraceSettings
					allowedTypes={['walkable', 'obstacle']}
					snapshot={props.snapshot}
					store={props.store}
				/>
			</div>
		</Show>
		<Show when={props.activeTool() === 'freehand'}>
			<div class="route-subpanel">
				<FreehandSettings snapshot={props.snapshot} store={props.store} />
			</div>
		</Show>
	</>
);

export const RouteEditView = (props: {
	activeTool: Accessor<EditorTool>;
	selectionActions: Accessor<CanvasSelectionActions | undefined>;
	setTool: (tool: EditorTool) => void;
	snapshot: Accessor<EditorSnapshot>;
	store: EditorStore;
}): JSX.Element => (
	<>
		<div class="route-edit-intro">
			<span>
				<small>Network editing</small>
				<strong>Correct paths on the map</strong>
			</span>
			<p>Only route geometry is selectable here. Pedestrian areas stay locked behind the network.</p>
		</div>
		<div class="route-task-grid route-task-grid--editing">
			<ToolButton
				active={props.activeTool() === 'select'}
				icon={MousePointer2}
				label="Select"
				title="Select and reshape route segments"
				onClick={() => props.setTool('select')}
			/>
			<ToolButton
				active={props.activeTool() === 'route-node'}
				icon={Waypoints}
				label="Junction"
				title="Place junction"
				onClick={() => props.setTool('route-node')}
			/>
			<ToolButton
				active={props.activeTool() === 'route-edge'}
				icon={PenLine}
				label="Connection"
				title="Draw connection"
				onClick={() => props.setTool('route-edge')}
			/>
		</div>
		<div class="route-edit-hint">
			<Network size={15} />
			<span>Double-click a segment to add a bend. Select a bend and press Delete to remove it.</span>
		</div>
		<PanelSection title="Network navigator" eyebrow="Inspect and correct" defaultOpen>
			<RouteGraphNavigator
				selectionActions={props.selectionActions}
				snapshot={props.snapshot}
				store={props.store}
			/>
		</PanelSection>
	</>
);
