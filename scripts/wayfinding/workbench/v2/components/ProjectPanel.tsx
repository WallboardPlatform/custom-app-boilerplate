import {
	ArrowDown,
	ArrowUp,
	FolderPlus,
	FolderOpen,
	ImagePlus,
	MapPinned,
	PanelLeftClose,
	Trash2
} from 'lucide-solid';
import { createMemo, For, Show, type Accessor, type JSX, type Setter } from 'solid-js';

import { projectCounts, selectedFloor } from '../../../editor-core/selectors';
import type { EditorLayerId, EditorSnapshot, EditorStore } from '../../../editor-core/types';
import type { WayfindingStudioAsset } from '../../../studio-project.mts';
import {
	Field,
	IconButton,
	PanelNav,
	PanelResizeHandle,
	PanelSection,
	UploadField
} from '../ui';
import type { CanvasSelectionActions } from '../features/map';
import { AssetLibrary, readImageFile } from '../features/assets';
import { DirectorySettings } from '../features/directory';
import { ProjectSettings } from '../features/appearance';
import { DraftInput } from './draft-fields';
import { FreehandSettings } from './FreehandSettings';
import { ObjectTree } from './ObjectTree';
import { updateProject } from './project-edit';
import { SmartTraceSettings } from './SmartTraceSettings';

interface ProjectPanelProps {
	onDeleteFloor: (floorId: string, floorName: string) => void;
	onNew: () => void;
	onNotify: (message: string, tone?: 'danger' | 'info' | 'success' | 'warning') => void;
	onOpen: () => void;
	onOpenFile: (file: File) => void;
	selectionActions: Accessor<CanvasSelectionActions | undefined>;
	snapshot: Accessor<EditorSnapshot>;
	store: EditorStore;
	view: Accessor<ProjectView>;
	setView: Setter<ProjectView>;
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

export type ProjectView = 'appearance' | 'assets' | 'content' | 'directory' | 'setup';

const projectViews = [
	{ id: 'setup', label: 'Project' },
	{ id: 'content', label: 'Objects' },
	{ id: 'directory', label: 'Directory' },
	{ id: 'assets', label: 'Assets' },
	{ id: 'appearance', label: 'Style' }
] satisfies Array<{ id: ProjectView; label: string }>;

export const ProjectPanel = (props: ProjectPanelProps): JSX.Element => {
	const state = createMemo(() => props.snapshot().state);
	const floor = createMemo(() => selectedFloor(state()));
	const orderedFloors = createMemo(() => [...state().project.floors].sort((a, b) => a.order - b.order));
	const floorIndex = createMemo(() => orderedFloors().findIndex((item) => item.id === floor().id));
	const counts = createMemo(() => projectCounts(state()));
	const floorBackground = createMemo(() => state().project.assets.find(
		(asset) => asset.id === floor().backgroundAssetId
	));
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
			const source = await readImageFile(file);
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

			throw error;
		}
	};

	const removeBackground = (): void => {
		const backgroundAssetId = floor().backgroundAssetId;

		if (!backgroundAssetId) return;
		const floorId = floor().id;
		updateProject(props.store, props.snapshot(), 'Remove floor background', (project): void => {
			const target = project.floors.find((item) => item.id === floorId);

			if (!target) return;
			delete target.backgroundAssetId;

			if (!project.floors.some((item) => item.backgroundAssetId === backgroundAssetId)) {
				project.assets = project.assets.filter((asset) => asset.id !== backgroundAssetId);
			}
		});
	};

	return (
		<aside class="left-panel panel-shell">
			<PanelResizeHandle
				panelId="left"
				store={props.store}
				width={() => state().panels.left.width}
			/>
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
			<PanelNav
				active={props.view}
				label="Project workspace"
				onChange={props.setView}
				options={projectViews}
			/>
			<div class="panel-scroll">
				<Show when={props.view() === 'setup'}>
					<div class="file-actions">
						<button type="button" class="wb-studio-action primary" onClick={() => props.onNew()}>
							<MapPinned size={16} /> New
						</button>
						<button type="button" class="wb-studio-action" onClick={() => props.onOpen()}>
							<FolderOpen size={16} /> Open
						</button>
						<input
							data-project-input
							class="visually-hidden"
							type="file"
							accept=".wbwayfinding,.json,application/json"
							onChange={(event) => {
								const file = event.currentTarget.files?.[0];

								if (file) props.onOpenFile(file);
								event.currentTarget.value = '';
							}}
						/>
					</div>
					<div class="metrics-row" aria-label="Project summary">
						<span><strong>{counts().floors}</strong> floors</span>
						<span><strong>{counts().items}</strong> objects</span>
						<span><strong>{counts().routes}</strong> routes</span>
					</div>
					<PanelSection title="Project" eyebrow="File and identity" defaultOpen>
						<Field label="Project name">
							<DraftInput
								value={state().project.name}
								onCommit={(name) => props.store.dispatch({ type: 'project/name', name })}
							/>
						</Field>
					</PanelSection>
					<PanelSection title="Floors" eyebrow="Artwork and scale" defaultOpen>
						<Field label="Current floor">
							<select
								value={state().currentFloorId}
								onChange={(event) => props.store.dispatch({
									type: 'floor/select',
									floorId: event.currentTarget.value
								})}
							>
								<For each={orderedFloors()}>
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
							label="Map scale"
							hint="Floor-plan pixels per real-world metre. Calibrate this to show accurate walking distance and time."
						>
							<div class="input-with-suffix">
								<DraftInput
									value={floor().unitsPerMeter ? String(floor().unitsPerMeter) : ''}
									onCommit={(value) => {
										const unitsPerMeter = Number(value);

										if (!Number.isFinite(unitsPerMeter) || unitsPerMeter <= 0) return;
										props.store.dispatch({
											type: 'floor/update',
											floorId: floor().id,
											patch: { unitsPerMeter }
										});
									}}
								/>
								<span>px / m</span>
							</div>
						</Field>
						<Field
							composite
							label="Floor background"
							hint={floor().backgroundAssetId
								? state().project.assets.find((asset) => asset.id === floor().backgroundAssetId)?.name
								: 'Add the map image used as the tracing and visitor-map base.'}
						>
							<UploadField
								accept="image/*"
								actionLabel="Choose image"
								description="Drop a floor plan here or browse for an image."
								fileName={floorBackground()?.name}
								icon={ImagePlus}
								inputId="floor-background-input"
								metadata={floorBackground()?.naturalWidth && floorBackground()?.naturalHeight
									? `${floorBackground()!.naturalWidth} × ${floorBackground()!.naturalHeight} px`
									: undefined}
								onRemove={removeBackground}
								onSelect={addBackground}
								previewUrl={floorBackground()?.dataUrl}
								title="Floor plan artwork"
							/>
						</Field>
						<div class="floor-actions">
							<IconButton
								disabled={floorIndex() <= 0}
								icon={ArrowUp}
								label="Move current floor up"
								onClick={() => props.store.dispatch({
									type: 'floor/reorder',
									floorId: floor().id,
									direction: -1
								})}
							/>
							<IconButton
								disabled={floorIndex() < 0 || floorIndex() >= orderedFloors().length - 1}
								icon={ArrowDown}
								label="Move current floor down"
								onClick={() => props.store.dispatch({
									type: 'floor/reorder',
									floorId: floor().id,
									direction: 1
								})}
							/>
							<button type="button" class="wb-studio-action" onClick={addFloor}>
								<FolderPlus size={16} /> Add floor
							</button>
							<button
								type="button"
								class="wb-studio-action danger"
								disabled={state().project.floors.length <= 1}
								onClick={() => props.onDeleteFloor(floor().id, floor().name)}
							>
								<Trash2 size={16} /> Delete
							</button>
						</div>
					</PanelSection>
				</Show>
				<Show when={props.view() === 'assets'}>
					<PanelSection title="Symbols and media" eyebrow="Reusable assets" defaultOpen>
						<AssetLibrary
							onNotify={props.onNotify}
							snapshot={props.snapshot}
							store={props.store}
						/>
					</PanelSection>
				</Show>
				<Show when={props.view() === 'content'}>
					<Show when={state().activeTool === 'freehand'}>
						<PanelSection title="Freehand outline" eyebrow="Active tool" defaultOpen>
							<FreehandSettings snapshot={props.snapshot} store={props.store} />
						</PanelSection>
					</Show>
					<Show when={state().activeTool === 'smart-trace'}>
						<PanelSection title="Smart trace" eyebrow="Active tool" defaultOpen>
							<SmartTraceSettings
								allowedTypes={['location']}
								snapshot={props.snapshot}
								store={props.store}
							/>
						</PanelSection>
					</Show>
					<PanelSection title="Layer visibility" eyebrow="Map content">
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
					<PanelSection title="Objects" eyebrow="Select and manage" defaultOpen>
						<ObjectTree
							actions={props.selectionActions}
							layerLabels={layerLabels}
							layerOrder={panelLayerIds}
							snapshot={props.snapshot}
							store={props.store}
						/>
					</PanelSection>
				</Show>
				<Show when={props.view() === 'directory'}>
					<PanelSection title="Directory model" eyebrow="Languages and categories" defaultOpen>
						<DirectorySettings snapshot={props.snapshot} store={props.store} />
					</PanelSection>
				</Show>
				<Show when={props.view() === 'appearance'}>
					<PanelSection title="Presentation defaults" eyebrow="Map and visitor styling" defaultOpen>
						<ProjectSettings snapshot={props.snapshot} store={props.store} />
					</PanelSection>
				</Show>
			</div>
		</aside>
	);
};
