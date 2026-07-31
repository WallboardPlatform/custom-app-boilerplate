import {
	ImagePlus,
	Trash2
} from 'lucide-solid';
import {
	createMemo,
	createSignal,
	For,
	Show,
	type Accessor,
	type JSX
} from 'solid-js';

import type {
	WayfindingStudioAsset
} from '../../../../studio-project.mts';
import type {
	EditorSnapshot,
	EditorStore
} from '../../../../editor-core/types';
import { BUILTIN_MAP_ICONS } from '../../../icon-library';
import { Field, UploadField } from '../../ui';
import { readImageFile } from './image-file';

interface AssetLibraryProps {
	onNotify: (message: string, tone?: 'danger' | 'info' | 'success' | 'warning') => void;
	snapshot: Accessor<EditorSnapshot>;
	store: EditorStore;
}

type AssetUploadKind = 'icon' | 'logo' | 'photo';

const ASSET_UPLOAD_OPTIONS = [
	{
		actionLabel: 'Upload map icon',
		description: 'A compact marker shown on the map.',
		kind: 'icon',
		label: 'Map icon'
	},
	{
		actionLabel: 'Upload logo',
		description: 'Brand identity shown with a destination.',
		kind: 'logo',
		label: 'Logo'
	},
	{
		actionLabel: 'Upload photo',
		description: 'A large image shown in visitor details.',
		kind: 'photo',
		label: 'Gallery photo'
	}
] satisfies Array<{
	actionLabel: string;
	description: string;
	kind: AssetUploadKind;
	label: string;
}>;

const assetUseCount = (snapshot: EditorSnapshot, assetId: string): number => {
	const project = snapshot.state.project;
	let uses = project.floors.filter((floor) => floor.backgroundAssetId === assetId).length;

	for (const floor of project.floors) {
		uses += floor.elements.filter((element) => 'assetId' in element && element.assetId === assetId).length;
	}

	for (const destination of project.destinations) {
		if (destination.logoAssetId === assetId) uses += 1;

		if (destination.symbolAssetId === assetId) uses += 1;
		uses += destination.photoAssetIds?.filter((id) => id === assetId).length ?? 0;
	}

	return uses;
};

export const AssetLibrary = (props: AssetLibraryProps): JSX.Element => {
	const [uploadKind, setUploadKind] = createSignal<AssetUploadKind>('icon');
	const assets = createMemo(() => props.snapshot().state.project.assets.filter(
		(asset) => asset.kind !== 'background'
	));
	const activeAssetId = createMemo(() => props.snapshot().state.activeAssetId);
	const uploadOption = createMemo(() =>
		ASSET_UPLOAD_OPTIONS.find((option) => option.kind === uploadKind()) ?? ASSET_UPLOAD_OPTIONS[0]
	);
	const addBuiltin = (icon: typeof BUILTIN_MAP_ICONS[number]): void => {
		const assetId = `builtin-${icon.id}`;
		const existing = props.snapshot().state.project.assets.find((asset) => asset.id === assetId);

		if (!existing) {
			props.store.dispatch({
				type: 'asset/add',
				asset: {
					dataUrl: icon.dataUrl,
					id: assetId,
					kind: 'icon',
					mimeType: 'image/svg+xml',
					name: icon.label,
					naturalHeight: 64,
					naturalWidth: 64
				}
			});
		}
		props.store.dispatch({ type: 'asset/select', assetId });
		props.store.dispatch({ type: 'tool/set', tool: 'icon' });
	};
	const upload = async (
		file: File | undefined,
		kind: 'icon' | 'logo' | 'photo'
	): Promise<void> => {
		if (!file) return;

		try {
			const source = await readImageFile(file);
			const asset: WayfindingStudioAsset = {
				dataUrl: source.dataUrl,
				id: `${kind}-${Date.now().toString(36)}`,
				kind,
				mimeType: file.type || 'image/png',
				name: file.name,
				naturalHeight: source.height,
				naturalWidth: source.width
			};
			props.store.dispatch({ type: 'asset/add', asset });
			props.store.dispatch({ type: 'asset/select', assetId: asset.id });

			if (kind !== 'photo') props.store.dispatch({ type: 'tool/set', tool: kind });
			props.onNotify(
				kind === 'photo'
					? `${file.name} is ready for destination galleries.`
					: `${file.name} is ready to place on the map.`,
				'success'
			);
		} catch (error) {
			props.onNotify(error instanceof Error ? error.message : 'The image could not be loaded.', 'danger');

			throw error;
		}
	};

	return (
		<div class="asset-library">
			<Field
				composite
				label="Upload image"
				hint="Choose its purpose once; the same asset can then be reused throughout the project."
			>
				<div class="asset-kind-picker" role="radiogroup" aria-label="Image purpose">
					<For each={ASSET_UPLOAD_OPTIONS}>{(option) => (
						<button
							type="button"
							role="radio"
							aria-checked={uploadKind() === option.kind}
							classList={{ active: uploadKind() === option.kind }}
							title={option.description}
							onClick={() => setUploadKind(option.kind)}
						>
							<strong>{option.label}</strong>
						</button>
					)}</For>
				</div>
				<UploadField
					accept="image/*"
					actionLabel={uploadOption().actionLabel}
					description={uploadOption().description}
					icon={ImagePlus}
					onSelect={(file) => upload(file, uploadKind())}
					title={uploadOption().label}
					variant="compact"
				/>
			</Field>

			<Field composite label="Built-in map symbols" hint="Select a symbol, then click the map to place it.">
				<div class="builtin-icon-grid">
					<For each={BUILTIN_MAP_ICONS}>{(icon) => (
						<button
							type="button"
							title={icon.label}
							classList={{ active: activeAssetId() === `builtin-${icon.id}` }}
							onClick={() => addBuiltin(icon)}
						>
							<img src={icon.dataUrl} alt="" />
							<span>{icon.label}</span>
						</button>
					)}</For>
				</div>
			</Field>

			<Show when={assets().length > 0}>
				<Field composite label="Project assets" hint="Symbols are reusable map markers. Logos identify a destination. Photos appear in visitor details.">
					<div class="project-asset-grid">
						<For each={assets()}>{(asset) => {
							const uses = createMemo(() => assetUseCount(props.snapshot(), asset.id));

							return (
								<div classList={{ active: activeAssetId() === asset.id }} class="project-asset">
									<button
										type="button"
										class="project-asset__select"
										onClick={() => {
											props.store.dispatch({ type: 'asset/select', assetId: asset.id });

											if (asset.kind === 'icon' || asset.kind === 'logo') {
												props.store.dispatch({ type: 'tool/set', tool: asset.kind });
											}
										}}
									>
										<img src={asset.dataUrl} alt="" />
										<span>
											<strong>{asset.name}</strong>
											<small>{asset.kind} / {uses()} use{uses() === 1 ? '' : 's'}</small>
										</span>
									</button>
									<button
										type="button"
										class="project-asset__delete"
										title={uses() > 0 ? 'Removing this asset also removes its map and gallery uses.' : 'Remove asset'}
										onClick={() => props.store.dispatch({ type: 'asset/remove', assetId: asset.id })}
									>
										<Trash2 size={14} />
									</button>
								</div>
							);
						}}</For>
					</div>
				</Field>
			</Show>
		</div>
	);
};
