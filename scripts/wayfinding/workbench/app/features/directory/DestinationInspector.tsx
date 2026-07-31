import {
	Check,
	MapPin
} from 'lucide-solid';
import {
	createMemo,
	For,
	Show,
	type Accessor,
	type JSX,
	type Setter
} from 'solid-js';
import type {
	WayfindingStudioAsset,
	WayfindingStudioDestination,
	WayfindingStudioFloor,
	WayfindingStudioLanguage
} from '../../../../studio-project.mts';
import {
	Field,
	InspectorGroup,
	InspectorHero,
	PanelSection
} from '../../ui';
import {
	DraftInput,
	DraftTextarea
} from '../../components/draft-fields';

export const DestinationInspector = (props: {
	assets?: WayfindingStudioAsset[];
	categories: string[];
	defaultLanguage: string;
	destination: WayfindingStudioDestination;
	floors: WayfindingStudioFloor[];
	language: Accessor<string>;
	languages: WayfindingStudioLanguage[];
	patch: (destination: WayfindingStudioDestination, patch: Partial<WayfindingStudioDestination>) => void;
	setLanguage: Setter<string>;
}): JSX.Element => {
	const translation = createMemo(() => props.destination.translations?.[props.language()] ?? {});
	const isDefault = createMemo(() => props.language() === props.defaultLanguage);
	const iconAssets = createMemo(() => props.assets?.filter((asset) => asset.kind === 'icon') ?? []);
	const logoAssets = createMemo(() => props.assets?.filter((asset) => asset.kind === 'logo') ?? []);
	const photoAssets = createMemo(() => props.assets?.filter((asset) => asset.kind === 'photo') ?? []);
	const patchTranslation = (patch: { description?: string; name?: string }): void => {
		if (isDefault()) {
			props.patch(props.destination, patch);

			return;
		}
		props.patch(props.destination, {
			translations: {
				...(props.destination.translations ?? {}),
				[props.language()]: { ...translation(), ...patch }
			}
		});
	};

	return (
		<PanelSection title="Destination details" eyebrow="Visitor information" defaultOpen>
			<InspectorHero
				badge={props.destination.status === 'closed' ? 'Closed' : props.destination.status === 'coming-soon' ? 'Coming soon' : 'Visible'}
				body={props.destination.description || 'Add a visitor description so people know what they will find here.'}
				eyebrow={props.destination.category || 'Uncategorized destination'}
				icon={MapPin}
				title={props.destination.name || 'Unnamed destination'}
			/>
			<InspectorGroup
				title="Map marker"
				body="Choose the symbol visitors use to recognize this destination on the map."
			>
				<Show
					when={iconAssets().length > 0}
					fallback={(
						<div class="visitor-detail__notice">
							Add a built-in or uploaded map icon in Assets, then return here to assign it.
						</div>
					)}
				>
					<Field composite label="Location symbol" hint="This replaces the generic destination pin.">
						<div class="destination-symbol-grid" role="group" aria-label="Location symbol">
							<button
								type="button"
								classList={{ selected: !props.destination.symbolAssetId }}
								aria-pressed={!props.destination.symbolAssetId}
								onClick={() => props.patch(props.destination, { symbolAssetId: undefined })}
							>
								<span class="destination-symbol-generic"><MapPin size={18} /></span>
								<span>Generic</span>
							</button>
							<For each={iconAssets()}>
								{(asset) => (
									<button
										type="button"
										classList={{ selected: props.destination.symbolAssetId === asset.id }}
										aria-label={`Use ${asset.name} as the location symbol`}
										aria-pressed={props.destination.symbolAssetId === asset.id}
										onClick={() => props.patch(props.destination, { symbolAssetId: asset.id })}
									>
										<img src={asset.dataUrl} alt="" />
										<span>{asset.name}</span>
									</button>
								)}
							</For>
						</div>
					</Field>
				</Show>
			</InspectorGroup>
			<Show when={logoAssets().length > 0 || photoAssets().length > 0}>
				<InspectorGroup
					title="Destination imagery"
					body="Assign one brand logo and any visitor photos. These appear in destination details, never as movable map objects."
				>
					<Show when={logoAssets().length > 0}>
						<Field composite label="Brand logo" hint="Choose one logo for search results and destination details.">
							<div class="destination-media-grid destination-media-grid--logo" role="radiogroup" aria-label="Brand logo">
								<button
									type="button"
									class="destination-media-choice destination-media-choice--none"
									classList={{ selected: !props.destination.logoAssetId }}
									role="radio"
									aria-checked={!props.destination.logoAssetId}
									onClick={() => props.patch(props.destination, { logoAssetId: undefined })}
								>
									<span>No logo</span>
									<Show when={!props.destination.logoAssetId}><Check size={14} /></Show>
								</button>
								<For each={logoAssets()}>{(asset) => {
									const selected = (): boolean => props.destination.logoAssetId === asset.id;

									return (
										<button
											type="button"
											class="destination-media-choice"
											classList={{ selected: selected() }}
											role="radio"
											aria-checked={selected()}
											onClick={() => props.patch(props.destination, { logoAssetId: asset.id })}
										>
											<img src={asset.dataUrl} alt="" />
											<span>{asset.name}</span>
											<Show when={selected()}><Check class="destination-media-check" size={14} /></Show>
										</button>
									);
								}}</For>
							</div>
						</Field>
					</Show>
					<Show when={photoAssets().length > 0}>
						<Field
							composite
							label={`Visitor photos · ${props.destination.photoAssetIds?.length ?? 0} selected`}
							hint="Select every photo that should appear in the destination gallery."
						>
							<div class="destination-media-grid" role="group" aria-label="Visitor photos">
								<For each={photoAssets()}>{(asset) => {
									const selected = (): boolean => props.destination.photoAssetIds?.includes(asset.id) ?? false;

									return (
										<button
											type="button"
											class="destination-media-choice"
											classList={{ selected: selected() }}
											aria-label={`${selected() ? 'Remove' : 'Add'} ${asset.name} ${selected() ? 'from' : 'to'} visitor photos`}
											aria-pressed={selected()}
											onClick={() => {
												const current = props.destination.photoAssetIds ?? [];
												props.patch(props.destination, {
													photoAssetIds: selected()
														? current.filter((id) => id !== asset.id)
														: [...new Set([...current, asset.id])]
												});
											}}
										>
											<img src={asset.dataUrl} alt="" />
											<span>{asset.name}</span>
											<Show when={selected()}><Check class="destination-media-check" size={14} /></Show>
										</button>
									);
								}}</For>
							</div>
						</Field>
					</Show>
				</InspectorGroup>
			</Show>
			<InspectorGroup
				title="Visitor content"
				body="This is the information people see in search results and the destination card."
			>
				<Show when={props.languages.length > 1}>
					<div class="language-tabs" role="tablist" aria-label="Destination language">
						<For each={props.languages}>{(item) => (
							<button
								type="button"
								classList={{ active: props.language() === item.code }}
								onClick={() => props.setLanguage(item.code)}
							>{item.label}</button>
						)}</For>
					</div>
				</Show>
				<Field label={isDefault() ? 'Name' : `Name in ${props.languages.find((item) => item.code === props.language())?.label ?? props.language()}`}>
					<DraftInput
						value={isDefault() ? props.destination.name : translation().name ?? ''}
						onCommit={(name) => patchTranslation({ name })}
					/>
				</Field>
				<Field label={isDefault() ? 'Description' : `Description in ${props.languages.find((item) => item.code === props.language())?.label ?? props.language()}`}>
					<DraftTextarea
						value={isDefault() ? props.destination.description ?? '' : translation().description ?? ''}
						onCommit={(description) => patchTranslation({ description })}
					/>
				</Field>
			</InspectorGroup>
			<InspectorGroup
				title="Directory listing"
				body="Controls where the destination appears and its live visitor status."
			>
				<div class="field-grid">
					<Field label="Category">
						<select
							value={props.destination.category ?? ''}
							onChange={(event) => props.patch(props.destination, { category: event.currentTarget.value || undefined })}
						>
							<option value="">Uncategorized</option>
							<For each={props.categories}>{(category) => <option value={category}>{category}</option>}</For>
						</select>
					</Field>
					<Field label="Directory number">
						<DraftInput
							value={props.destination.mapNumber ?? ''}
							onCommit={(mapNumber) => props.patch(props.destination, { mapNumber })}
						/>
					</Field>
				</div>
				<div class="field-grid">
					<Field label="Floor">
						<select
							value={props.destination.floor ?? ''}
							onChange={(event) => props.patch(props.destination, { floor: event.currentTarget.value || undefined })}
						>
							<option value="">Not assigned</option>
							<For each={props.floors}>{(floor) => <option value={floor.id}>{floor.name}</option>}</For>
						</select>
					</Field>
					<Field label="Visitor status">
						<select
							value={props.destination.status ?? 'open'}
							onChange={(event) => props.patch(props.destination, { status: event.currentTarget.value })}
						>
							<option value="open">Open</option>
							<option value="closed">Closed</option>
							<option value="temporarily-closed">Temporarily closed</option>
							<option value="coming-soon">Coming soon</option>
						</select>
					</Field>
				</div>
				<Field label="Opening hours">
					<DraftInput value={props.destination.hours ?? ''} onCommit={(hours) => props.patch(props.destination, { hours })} />
				</Field>
				<div class="field-grid">
					<Field label="Phone">
						<DraftInput value={props.destination.phone ?? ''} onCommit={(phone) => props.patch(props.destination, { phone })} />
					</Field>
					<Field label="Website">
						<DraftInput value={props.destination.website ?? ''} onCommit={(website) => props.patch(props.destination, { website })} />
					</Field>
				</div>
			</InspectorGroup>
			<InspectorGroup
				title="Directions"
				body="Decide whether visitors can route here and whether the destination supports step-free access."
			>
				<label class="inline-toggle inspector-toggle">
					<input
						type="checkbox"
						checked={props.destination.accessible ?? false}
						onChange={(event) => props.patch(props.destination, { accessible: event.currentTarget.checked })}
					/>
					Step-free access
				</label>
				<label class="inline-toggle inspector-toggle">
					<input
						type="checkbox"
						checked={props.destination.routeable !== false}
						onChange={(event) => props.patch(props.destination, { routeable: event.currentTarget.checked })}
					/>
					Show directions for this destination
				</label>
			</InspectorGroup>
		</PanelSection>
	);
};
