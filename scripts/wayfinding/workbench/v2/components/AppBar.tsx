import {
	ArrowDownToLine,
	FileDown,
	Map,
	Redo2,
	Route,
	Save,
	Undo2,
	UsersRound,
	Waypoints
} from 'lucide-solid';
import { For, type Accessor, type JSX } from 'solid-js';

import type { EditorSnapshot, EditorStore, EditorWorkspace } from '../../../editor-core/types';
import { IconButton } from '../ui';

interface AppBarProps {
	onExportRuntime: () => void;
	onSave: (forceSaveAs: boolean) => void;
	snapshot: Accessor<EditorSnapshot>;
	store: EditorStore;
}

const workspaceOptions: Array<{ icon: typeof Map; id: EditorWorkspace; label: string }> = [
	{ icon: Map, id: 'map', label: 'Map' },
	{ icon: Waypoints, id: 'route-edit', label: 'Route edit' },
	{ icon: Route, id: 'route-preview', label: 'Route preview' },
	{ icon: UsersRound, id: 'visitor-preview', label: 'Visitor preview' }
];

export const AppBar = (props: AppBarProps): JSX.Element => (
	<header class="app-bar">
		<div class="brand">
			<div class="brand-mark" aria-hidden="true">W</div>
			<div class="brand-copy">
				<small>Wallboard</small>
				<strong>Wayfinding Studio</strong>
			</div>
			<span class="version">v2 preview</span>
		</div>
		<nav class="workspace-tabs" aria-label="Workspace">
			<For each={workspaceOptions}>{(option) => {
				const Icon = option.icon;

				return (
					<button
						type="button"
						aria-pressed={props.snapshot().state.workspace === option.id}
						classList={{ active: props.snapshot().state.workspace === option.id }}
						onClick={() => props.store.dispatch({ type: 'workspace/set', workspace: option.id })}
					>
						<Icon size={16} />
						<span>{option.label}</span>
					</button>
				);
			}}</For>
		</nav>
		<div class="app-actions">
			<IconButton
				icon={Undo2}
				label="Undo (Ctrl+Z)"
				disabled={!props.snapshot().canUndo}
				onClick={() => props.store.undo()}
			/>
			<IconButton
				icon={Redo2}
				label="Redo (Ctrl+Shift+Z)"
				disabled={!props.snapshot().canRedo}
				onClick={() => props.store.redo()}
			/>
			<span class="toolbar-divider" />
			<IconButton icon={Save} label="Save (Ctrl+S)" onClick={() => props.onSave(false)} />
			<IconButton icon={ArrowDownToLine} label="Save as" onClick={() => props.onSave(true)} />
			<IconButton icon={FileDown} label="Export runtime bundle" onClick={props.onExportRuntime} />
		</div>
	</header>
);
