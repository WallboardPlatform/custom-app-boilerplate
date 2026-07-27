import {
	FolderOpen,
	MapPinned,
	PanelLeftClose
} from 'lucide-solid';
import { createMemo, For, type Accessor, type JSX } from 'solid-js';

import { projectCounts, selectedFloor } from '../../../editor-core/selectors';
import type { EditorLayerId, EditorSnapshot, EditorStore } from '../../../editor-core/types';
import { Field, IconButton, PanelSection } from '../ui';
import { DraftInput } from './draft-fields';
import { ProjectSettings } from './ProjectSettings';

interface ProjectPanelProps {
	onNew: () => void;
	onOpen: () => void;
	snapshot: Accessor<EditorSnapshot>;
	store: EditorStore;
}

const layerLabels: Record<EditorLayerId, string> = {
	background: 'Background',
	door: 'Doors',
	icon: 'Icons',
	label: 'Labels',
	location: 'Locations',
	logo: 'Logos',
	obstacle: 'Blocked areas',
	origin: 'You are here',
	poi: 'Points of interest',
	'route-network': 'Route network',
	'simulated-route': 'Preview route',
	transition: 'Floor connections',
	walkable: 'Walkable areas'
};

const panelLayerIds: EditorLayerId[] = [
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
	'route-network'
];

export const ProjectPanel = (props: ProjectPanelProps): JSX.Element => {
	const state = createMemo(() => props.snapshot().state);
	const floor = createMemo(() => selectedFloor(state()));
	const counts = createMemo(() => projectCounts(state()));

	return (
		<aside class="left-panel panel-shell">
			<div class="panel-title">
				<span>
					<small>Project</small>
					<strong>{state().project.name}</strong>
				</span>
				<IconButton
					icon={PanelLeftClose}
					label="Close project panel"
					onClick={() => props.store.dispatch({ type: 'panel/toggle', panelId: 'left' })}
				/>
			</div>
			<div class="panel-scroll">
				<div class="file-actions">
					<button type="button" class="button primary" onClick={() => props.onNew()}>
						<MapPinned size={16} /> New
					</button>
					<button type="button" class="button" onClick={() => props.onOpen()}>
						<FolderOpen size={16} /> Open
					</button>
				</div>
				<PanelSection title="Project and floors" eyebrow="Setup" defaultOpen>
					<Field label="Project name">
						<DraftInput
							value={state().project.name}
							onCommit={(name) => props.store.dispatch({ type: 'project/name', name })}
						/>
					</Field>
					<Field label="Current floor">
						<select
							value={state().currentFloorId}
							onChange={(event) => props.store.dispatch({
								type: 'floor/select',
								floorId: event.currentTarget.value
							})}
						>
							<For each={[...state().project.floors].sort((a, b) => a.order - b.order)}>
								{(item) => <option value={item.id}>{item.name}</option>}
							</For>
						</select>
					</Field>
					<Field label="Floor name">
						<DraftInput
							value={floor().name}
							onCommit={(name) => props.store.dispatch({
								type: 'floor/update',
								floorId: floor().id,
								patch: { name }
							})}
						/>
					</Field>
					<div class="metrics-row" aria-label="Project summary">
						<span><strong>{counts().floors}</strong> floors</span>
						<span><strong>{counts().items}</strong> objects</span>
						<span><strong>{counts().routes}</strong> routes</span>
					</div>
				</PanelSection>
				<PanelSection title="Layers" eyebrow="Map objects">
					<div class="layer-actions">
						<button
							type="button"
							class="text-button"
							onClick={() => panelLayerIds.forEach((layerId) => props.store.dispatch({
								type: 'layer/set',
								layerId,
								visible: true
							}))}
						>Show all</button>
						<button
							type="button"
							class="text-button"
							onClick={() => panelLayerIds.forEach((layerId) => props.store.dispatch({
								type: 'layer/set',
								layerId,
								visible: false
							}))}
						>Hide all</button>
					</div>
					<div class="layer-list">
						<For each={panelLayerIds}>{(layerId) => (
							<label>
								<input
									type="checkbox"
									checked={state().layerVisibility[layerId]}
									onChange={(event) => props.store.dispatch({
										type: 'layer/set',
										layerId,
										visible: event.currentTarget.checked
									})}
								/>
								<span>{layerLabels[layerId]}</span>
							</label>
						)}</For>
					</div>
				</PanelSection>
				<PanelSection title="Project settings" eyebrow="Presentation">
					<ProjectSettings snapshot={props.snapshot} store={props.store} />
				</PanelSection>
			</div>
		</aside>
	);
};
