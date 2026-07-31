import {
	ArrowDownToLine,
	FileDown,
	Map,
	Play,
	Redo2,
	Save,
	Search,
	Undo2,
	Waypoints
} from 'lucide-solid';
import { For, type Accessor, type JSX } from 'solid-js';

import type { EditorSnapshot, EditorStore, EditorWorkspace } from '../../../editor-core/types';
import { IconButton } from '../ui';

interface AppBarProps {
	onExportRuntime: () => void;
	onOpenCommands: () => void;
	onOpenProject: () => void;
	onSave: (forceSaveAs: boolean) => void;
	snapshot: Accessor<EditorSnapshot>;
	store: EditorStore;
}

const workspaceOptions: Array<{ icon: typeof Map; id: EditorWorkspace; label: string }> = [
	{ icon: Map, id: 'map', label: 'Map' },
	{ icon: Waypoints, id: 'route-edit', label: 'Route edit' },
	{ icon: Play, id: 'preview', label: 'Preview' }
];

export const AppBar = (props: AppBarProps): JSX.Element => (
	<header class="app-bar">
		<div class="brand">
			<div class="brand-mark" aria-hidden="true">W</div>
			<div class="brand-copy">
				<small>Wallboard</small>
				<strong>Wayfinding Studio</strong>
			</div>
			<span class="version">v1</span>
		</div>
		<button
			type="button"
			class="document-context"
			title="Open project and floor settings"
			onClick={() => props.onOpenProject()}
		>
			<span classList={{ dirty: props.snapshot().state.document.dirty }} aria-hidden="true" />
			<div>
				<strong>{props.snapshot().state.project.name}</strong>
				<small>
					{props.snapshot().state.project.floors.find(
						(floor) => floor.id === props.snapshot().state.currentFloorId
					)?.name ?? props.snapshot().state.currentFloorId}
				</small>
			</div>
		</button>
		<nav class="workspace-tabs" aria-label="Workspace">
			<For each={workspaceOptions}>{(option) => {
				const Icon = option.icon;

				return (
					<button
						type="button"
						aria-label={option.label}
						aria-pressed={props.snapshot().state.workspace === option.id}
						classList={{ active: props.snapshot().state.workspace === option.id }}
						title={option.label}
						onClick={() => props.store.dispatch({ type: 'workspace/set', workspace: option.id })}
					>
						<Icon size={16} />
						<span>{option.label}</span>
					</button>
				);
			}}</For>
		</nav>
		<div class="app-actions">
			<button
				type="button"
				class="command-search"
				aria-label="Search commands (Ctrl+K)"
				onClick={() => props.onOpenCommands()}
			>
				<Search size={17} />
				<span>Commands</span>
				<kbd>Ctrl K</kbd>
			</button>
			<span class="toolbar-divider" />
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
			<IconButton icon={FileDown} label="Publish map" onClick={props.onExportRuntime} />
		</div>
	</header>
);
