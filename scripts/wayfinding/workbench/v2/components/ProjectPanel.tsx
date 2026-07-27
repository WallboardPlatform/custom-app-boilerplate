import {
	FolderPlus,
	FolderOpen,
	ImagePlus,
	MapPinned,
	PanelLeftClose,
	Trash2
} from 'lucide-solid';
import { createMemo, For, type Accessor, type JSX } from 'solid-js';

import { projectCounts, selectedFloor } from '../../../editor-core/selectors';
import type { EditorLayerId, EditorSnapshot, EditorStore } from '../../../editor-core/types';
import type { WayfindingStudioAsset } from '../../../studio-project.mts';
import { Field, IconButton, PanelSection } from '../ui';
import { AssetLibrary } from './AssetLibrary';
import { DirectorySettings } from './DirectorySettings';
import { DraftInput } from './draft-fields';
import { ObjectTree } from './ObjectTree';
import { updateProject } from './project-edit';
import { ProjectSettings } from './ProjectSettings';

interface ProjectPanelProps {
	onDeleteFloor: (floorId: string, floorName: string) => void;
	onNew: () => void;
	onNotify: (message: string, tone?: 'danger' | 'info' | 'success' | 'warning') => void;
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

const readImage = async (file: File): Promise<{
	dataUrl: string;
	height: number;
	width: number;
}> => {
	const dataUrl = await new Promise<string>((resolve, reject): void => {
		const reader = new FileReader();
		reader.onerror = (): void => reject(new Error('The selected image could not be read.'));
		reader.onload = (): void => {
			if (typeof reader.result === 'string') resolve(reader.result);
			else reject(new Error('The selected image did not produce a valid data URL.'));
		};
		reader.readAsDataURL(file);
	});
	const image = new Image();
	image.src = dataUrl;
	await image.decode();

	return { dataUrl, height: image.naturalHeight, width: image.naturalWidth };
};

export const ProjectPanel = (props: ProjectPanelProps): JSX.Element => {
	const state = createMemo(() => props.snapshot().state);
	const floor = createMemo(() => selectedFloor(state()));
	const counts = createMemo(() => projectCounts(state()));
	const addFloor = (): void => {
		const floorNumber = state().project.floors.length + 1;
		const floorId = `level-${Date.now().toString(36)}`;
		props.store.run({
			label: 'Add floor',
			commands: [
				{ type: 'floor/add', floorId, name: `Level ${floorNumber}` },
				{ type: 'floor/select', floorId }
			]
		});
	};
	const addBackground = async (file: File | undefined): Promise<void> => {
		if (!file) return;

		try {
			const source = await readImage(file);
			const assetId = `background-${Date.now().toString(36)}`;
			const asset: WayfindingStudioAsset = {
				dataUrl: source.dataUrl,
				id: assetId,
				kind: 'background',
				mimeType: file.type || 'image/png',
				name: file.name,
				naturalHeight: source.height,
				naturalWidth: source.width
			};
			const floorId = floor().id;
			updateProject(props.store, props.snapshot(), 'Set floor background', (project): void => {
				const target = project.floors.find((item) => item.id === floorId);

				if (!target) return;
				project.assets = [...project.assets.filter((item) => item.id !== target.backgroundAssetId), asset];
				target.backgroundAssetId = assetId;
				target.width = source.width;
				target.height = source.height;
			});
			props.onNotify(`Loaded ${file.name}`, 'success');
		} catch (error) {
			props.onNotify(error instanceof Error ? error.message : 'The image could not be loaded.', 'danger');
		}
	};

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
					<Field
						label="Floor background"
						hint={floor().backgroundAssetId
							? state().project.assets.find((asset) => asset.id === floor().backgroundAssetId)?.name
							: 'Add the map image used as the tracing and visitor-map base.'}
					>
						<label class="file-picker">
							<ImagePlus size={16} />
							<span>{floor().backgroundAssetId ? 'Replace image' : 'Choose image'}</span>
							<input
								data-floor-background-input
								type="file"
								accept="image/*"
								onChange={(event) => void addBackground(event.currentTarget.files?.[0])}
							/>
						</label>
					</Field>
					<div class="floor-actions">
						<button type="button" class="button" onClick={addFloor}>
							<FolderPlus size={16} /> Add floor
						</button>
						<button
							type="button"
							class="button danger"
							disabled={state().project.floors.length <= 1}
							onClick={() => props.onDeleteFloor(floor().id, floor().name)}
						>
							<Trash2 size={16} /> Delete
						</button>
					</div>
					<div class="metrics-row" aria-label="Project summary">
						<span><strong>{counts().floors}</strong> floors</span>
						<span><strong>{counts().items}</strong> objects</span>
						<span><strong>{counts().routes}</strong> routes</span>
					</div>
				</PanelSection>
				<PanelSection title="Symbols and media" eyebrow="Asset library">
					<AssetLibrary
						onNotify={props.onNotify}
						snapshot={props.snapshot}
						store={props.store}
					/>
				</PanelSection>
				<PanelSection title="Layers and objects" eyebrow="Map content">
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
					<ObjectTree
						layerLabels={layerLabels}
						layerOrder={panelLayerIds}
						snapshot={props.snapshot}
						store={props.store}
					/>
				</PanelSection>
				<PanelSection title="Directory" eyebrow="Languages and categories">
					<DirectorySettings snapshot={props.snapshot} store={props.store} />
				</PanelSection>
				<PanelSection title="Project settings" eyebrow="Presentation">
					<ProjectSettings snapshot={props.snapshot} store={props.store} />
				</PanelSection>
			</div>
		</aside>
	);
};
