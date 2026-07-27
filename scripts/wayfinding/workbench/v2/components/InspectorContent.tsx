import { Check } from 'lucide-solid';
import {
	createMemo,
	createSignal,
	For,
	Show,
	type Accessor,
	type JSX
} from 'solid-js';
import type {
	WayfindingStudioDestination,
	WayfindingStudioElement,
	WayfindingStudioFloor,
	WayfindingStudioLanguage,
	WayfindingStudioAsset,
	WayfindingStudioIssue
} from '../../../studio-project.mts';
import { projectCounts } from '../../../editor-core/selectors';
import type {
	EditorSnapshot,
	EditorStore
} from '../../../editor-core/types';
import {
	Field,
	PanelSection
} from '../ui';
import {
	DraftInput,
	DraftTextarea
} from './draft-fields';

const friendlyIssue = (issue: WayfindingStudioIssue): string => {
	const messages: Partial<Record<string, string>> = {
		'disconnected-route': 'A destination cannot be reached from a You are here point.',
		'edge-outside-floor': 'A route segment leaves the floor boundary.',
		'missing-background': 'A floor background image is missing.',
		'missing-destination-node': 'A destination needs a route endpoint.',
		'missing-floor': 'Add at least one floor.',
		'missing-location-door': 'A routeable room needs a linked door.',
		'missing-route-destination': 'Add at least one routeable destination.',
		'missing-route-origin': 'Add a You are here point.',
		'missing-route-pedestrian-area': 'Draw a walkable area before building routes.',
		'polygon-outside-floor': 'A polygon extends beyond the floor canvas.'
	};

	return messages[issue.code] ?? issue.message;
};

export const ElementInspector = (props: {
	element: WayfindingStudioElement;
	projectAssets?: WayfindingStudioAsset[];
	store: EditorStore;
}): JSX.Element => {
	const patch = (value: Record<string, unknown>): void => props.store.dispatch({
		type: 'element/patch',
		elementId: props.element.id,
		patch: value
	});
	const commitNumber = (key: string, value: string): void => {
		const parsed = Number(value);

		if (Number.isFinite(parsed)) patch({ [key]: parsed });
	};

	return (
		<PanelSection title="Object" eyebrow={props.element.type} defaultOpen>
			<Field label="Stable ID" hint="Used by runtime links and datasource updates.">
				<input value={props.element.id} disabled />
			</Field>
			<Show when={'label' in props.element}>
				<Field label="Map label">
					<DraftInput
						value={'label' in props.element ? props.element.label ?? '' : ''}
						onCommit={(label) => patch({ label })}
					/>
				</Field>
			</Show>
			<Show when={'point' in props.element}>
				<div class="field-grid">
					<Field label="X position">
						<DraftInput
							value={'point' in props.element ? String(Math.round(props.element.point.x)) : '0'}
							onCommit={(value) => {
								if (!('point' in props.element)) return;
								const x = Number(value);

								if (Number.isFinite(x)) patch({ point: { ...props.element.point, x } });
							}}
						/>
					</Field>
					<Field label="Y position">
						<DraftInput
							value={'point' in props.element ? String(Math.round(props.element.point.y)) : '0'}
							onCommit={(value) => {
								if (!('point' in props.element)) return;
								const y = Number(value);

								if (Number.isFinite(y)) patch({ point: { ...props.element.point, y } });
							}}
						/>
					</Field>
				</div>
			</Show>
			<Show when={props.element.type === 'door'}>
				<div class="field-grid">
					<Field label="Angle">
						<DraftInput
							value={props.element.type === 'door' ? String(props.element.angle) : '0'}
							onCommit={(value) => commitNumber('angle', value)}
						/>
					</Field>
					<Field label="Length">
						<DraftInput
							value={props.element.type === 'door' ? String(props.element.length) : '42'}
							onCommit={(value) => commitNumber('length', value)}
						/>
					</Field>
				</div>
			</Show>
			<Show when={props.element.type === 'origin'}>
				<div class="field-grid">
					<Field label="Facing direction">
						<DraftInput
							value={props.element.type === 'origin' ? String(props.element.facingDegrees) : '0'}
							onCommit={(value) => commitNumber('facingDegrees', value)}
						/>
					</Field>
					<Field label="Screen ID">
						<DraftInput
							value={props.element.type === 'origin' ? props.element.screenId : ''}
							onCommit={(screenId) => patch({ screenId })}
						/>
					</Field>
				</div>
			</Show>
			<Show when={props.element.type === 'transition'}>
				<div class="field-grid">
					<Field label="Connection type">
						<select
							value={props.element.type === 'transition' ? props.element.kind : 'stairs'}
							onChange={(event) => patch({ kind: event.currentTarget.value })}
						>
							<option value="elevator">Elevator</option>
							<option value="escalator">Escalator</option>
							<option value="stairs">Stairs</option>
						</select>
					</Field>
					<Field label="Accessibility">
						<select
							value={props.element.type === 'transition' && props.element.accessible ? 'yes' : 'no'}
							onChange={(event) => patch({ accessible: event.currentTarget.value === 'yes' })}
						>
							<option value="yes">Step-free</option>
							<option value="no">Not step-free</option>
						</select>
					</Field>
				</div>
			</Show>
			<Show when={props.element.type === 'label'}>
				<Field label="Displayed text">
					<DraftInput
						value={props.element.type === 'label' ? props.element.text : ''}
						onCommit={(text) => patch({ text })}
					/>
				</Field>
				<div class="field-grid">
					<Field label="Font">
						<select
							value={props.element.type === 'label' ? props.element.fontFamily ?? 'sans-serif' : 'sans-serif'}
							onChange={(event) => patch({ fontFamily: event.currentTarget.value })}
						>
							<option value="sans-serif">Sans serif</option>
							<option value="serif">Serif</option>
							<option value="monospace">Monospace</option>
						</select>
					</Field>
					<Field label="Size">
						<DraftInput
							value={props.element.type === 'label' ? String(props.element.fontSize ?? 24) : '24'}
							onCommit={(value) => commitNumber('fontSize', value)}
						/>
					</Field>
				</div>
			</Show>
			<Show when={props.element.type === 'icon' || props.element.type === 'logo'}>
				{((): JSX.Element => {
					const asset = createMemo(() => props.projectAssets?.find(
						(candidate) => (props.element.type === 'icon' || props.element.type === 'logo')
							&& candidate.id === props.element.assetId
					));
					const ratio = (): number => {
						if (props.element.type !== 'icon' && props.element.type !== 'logo') return 1;

						return props.element.height > 0 ? props.element.width / props.element.height : 1;
					};

					return (
						<>
							<div class="asset-inspector-preview">
								<img src={asset()?.dataUrl} alt="" />
								<span>
									<strong>{asset()?.name ?? 'Missing asset'}</strong>
									<small>{props.element.type === 'logo' ? 'Destination brand mark' : 'Reusable map symbol'}</small>
								</span>
							</div>
							<div class="field-grid">
								<Field label="Width">
									<DraftInput
										value={String(Math.round(props.element.type === 'icon' || props.element.type === 'logo' ? props.element.width : 0))}
										onCommit={(value) => {
											const width = Number(value);

											if (Number.isFinite(width) && width > 0) patch({ width, height: width / ratio() });
										}}
									/>
								</Field>
								<Field label="Height">
									<DraftInput
										value={String(Math.round(props.element.type === 'icon' || props.element.type === 'logo' ? props.element.height : 0))}
										onCommit={(value) => {
											const height = Number(value);

											if (Number.isFinite(height) && height > 0) patch({ height, width: height * ratio() });
										}}
									/>
								</Field>
							</div>
						</>
					);
				})()}
			</Show>
			<Show when={props.element.type === 'location' || props.element.type === 'walkable' || props.element.type === 'obstacle'}>
				<div class="field-grid">
					<Field label="Fill color">
						<input
							type="color"
							value={'presentation' in props.element ? props.element.presentation?.fillColor ?? '#15927d' : '#15927d'}
							onInput={(event) => patch({
								presentation: {
									...('presentation' in props.element ? props.element.presentation : {}),
									fillColor: event.currentTarget.value
								}
							})}
						/>
					</Field>
					<Field label="3D height">
						<DraftInput
							value={'presentation' in props.element ? String(props.element.presentation?.extrusionHeight ?? 18) : '18'}
							onCommit={(value) => {
								const extrusionHeight = Number(value);

								if (Number.isFinite(extrusionHeight)) patch({
									presentation: {
										...('presentation' in props.element ? props.element.presentation : {}),
										extrusionHeight
									}
								});
							}}
						/>
					</Field>
				</div>
			</Show>
			<div class="property-note">
				<Check size={15} />
				<span>{props.element.status === 'confirmed' ? 'Ready for the visitor map' : 'Draft map object'}</span>
			</div>
		</PanelSection>
	);
};

export const DestinationInspector = (props: {
	assets?: WayfindingStudioAsset[];
	categories: string[];
	defaultLanguage: string;
	destination: WayfindingStudioDestination;
	floors: WayfindingStudioFloor[];
	languages: WayfindingStudioLanguage[];
	patch: (destination: WayfindingStudioDestination, patch: Partial<WayfindingStudioDestination>) => void;
}): JSX.Element => {
	const [language, setLanguage] = createSignal(props.defaultLanguage);
	const translation = createMemo(() => props.destination.translations?.[language()] ?? {});
	const isDefault = createMemo(() => language() === props.defaultLanguage);
	const patchTranslation = (patch: { description?: string; name?: string }): void => {
		if (isDefault()) {
			props.patch(props.destination, patch);

			return;
		}
		props.patch(props.destination, {
			translations: {
				...(props.destination.translations ?? {}),
				[language()]: { ...translation(), ...patch }
			}
		});
	};

	return (
		<PanelSection title="Destination details" eyebrow="Visitor information" defaultOpen>
			<Show when={props.languages.length > 1}>
				<div class="language-tabs" role="tablist" aria-label="Destination language">
					<For each={props.languages}>{(item) => (
						<button
							type="button"
							classList={{ active: language() === item.code }}
							onClick={() => setLanguage(item.code)}
						>{item.label}</button>
					)}</For>
				</div>
			</Show>
			<Field label={isDefault() ? 'Name' : `Name in ${props.languages.find((item) => item.code === language())?.label ?? language()}`}>
				<DraftInput
					value={isDefault() ? props.destination.name : translation().name ?? ''}
					onCommit={(name) => patchTranslation({ name })}
				/>
			</Field>
			<Field label={isDefault() ? 'Description' : `Description in ${props.languages.find((item) => item.code === language())?.label ?? language()}`}>
				<DraftTextarea
					value={isDefault() ? props.destination.description ?? '' : translation().description ?? ''}
					onCommit={(description) => patchTranslation({ description })}
				/>
			</Field>
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
			<Show when={(props.assets?.filter((asset) => asset.kind === 'logo').length ?? 0) > 0}>
				<Field label="Destination logo" hint="Used in the directory and visitor information panel.">
					<select
						value={props.destination.logoAssetId ?? ''}
						onChange={(event) => props.patch(props.destination, { logoAssetId: event.currentTarget.value || undefined })}
					>
						<option value="">No logo</option>
						<For each={props.assets?.filter((asset) => asset.kind === 'logo') ?? []}>
							{(asset) => <option value={asset.id}>{asset.name}</option>}
						</For>
					</select>
				</Field>
			</Show>
			<Show when={(props.assets?.filter((asset) => asset.kind === 'photo').length ?? 0) > 0}>
				<Field label="Visitor gallery" hint="Selected photos appear in destination details and visitor preview.">
					<div class="destination-photo-grid">
						<For each={props.assets?.filter((asset) => asset.kind === 'photo') ?? []}>{(asset) => {
							const selected = (): boolean => props.destination.photoAssetIds?.includes(asset.id) ?? false;

							return (
								<label classList={{ selected: selected() }}>
									<input
										type="checkbox"
										checked={selected()}
										onChange={(event) => {
											const current = props.destination.photoAssetIds ?? [];
											props.patch(props.destination, {
												photoAssetIds: event.currentTarget.checked
													? [...new Set([...current, asset.id])]
													: current.filter((id) => id !== asset.id)
											});
										}}
									/>
									<img src={asset.dataUrl} alt="" />
									<span>{asset.name}</span>
								</label>
							);
						}}</For>
					</div>
				</Field>
			</Show>
		</PanelSection>
	);
};

export const ProjectOverview = (props: {
	issues: Accessor<WayfindingStudioIssue[]>;
	snapshot: Accessor<EditorSnapshot>;
}): JSX.Element => {
	const counts = createMemo(() => projectCounts(props.snapshot().state));
	const errors = createMemo(() => props.issues().filter((issue) => issue.severity === 'error').length);

	return (
		<PanelSection title="Project overview" eyebrow="Delivery" defaultOpen>
			<div class="overview-grid">
				<div><strong>{counts().destinations}</strong><span>Destinations</span></div>
				<div><strong>{counts().routes}</strong><span>Route segments</span></div>
				<div classList={{ alert: errors() > 0 }}><strong>{errors()}</strong><span>Blocking issues</span></div>
			</div>
			<p class="muted">Select a map object or destination to edit its details.</p>
		</PanelSection>
	);
};

export const Problems = (props: {
	issues: Accessor<WayfindingStudioIssue[]>;
	store: EditorStore;
}): JSX.Element => (
	<PanelSection title={`Problems (${props.issues().length})`} eyebrow="Validation">
		<Show
			when={props.issues().length > 0}
			fallback={<div class="validation-success"><Check size={18} /> No project errors found.</div>}
		>
			<div class="problem-list">
				<For each={props.issues()}>{(issue) => (
					<button
						type="button"
						class={`problem ${issue.severity}`}
						onClick={() => {
							const id = issue.elementIds[0];

							if (id) props.store.dispatch({ type: 'selection/set', selection: { id, kind: 'element' } });
						}}
					>
						<span>{issue.severity}</span>
						<strong>{friendlyIssue(issue)}</strong>
					</button>
				)}</For>
			</div>
		</Show>
	</PanelSection>
);
