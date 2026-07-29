import {
	AlertTriangle,
	Check,
	DoorOpen,
	Image,
	MapPin,
	Navigation,
	Network,
	Route,
	Shapes,
	Type
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
	WayfindingStudioDestination,
	WayfindingStudioElement,
	WayfindingStudioFloor,
	WayfindingStudioLanguage,
	WayfindingStudioAsset,
	WayfindingStudioIssue
} from '../../../studio-project.mts';
import type {
	WayfindingEdge,
	WayfindingNode,
	WayfindingTraversal
} from '../../../../../src/utils/wayfinding.js';
import { projectCounts } from '../../../editor-core/selectors';
import type {
	EditorSnapshot,
	EditorStore
} from '../../../editor-core/types';
import {
	Field,
	InspectorGroup,
	InspectorHero,
	PanelSection
} from '../ui';
import {
	friendlyIssue,
	issueSelection
} from '../issues';
import {
	inspectRouteGeometry,
	repairRouteGeometry,
	straightenRouteGeometry
} from '../route-geometry';
import { getRouteReadiness } from '../route-readiness';
import {
	DraftInput,
	DraftTextarea
} from './draft-fields';

const elementTitle = (element: WayfindingStudioElement): string => {
	if ('label' in element && element.label?.trim()) return element.label.trim();

	switch (element.type) {
		case 'door': return 'Door';

		case 'icon': return 'Map symbol';

		case 'label': return element.text?.trim() || 'Text label';

		case 'location': return 'Room or area';

		case 'logo': return 'Brand mark';

		case 'obstacle': return 'Blocked area';

		case 'origin': return 'You are here';

		case 'poi': return 'Point of interest';

		case 'transition': return 'Floor connection';

		case 'walkable': return 'Walkable area';
	}
};

const elementDescription = (element: WayfindingStudioElement): string => {
	switch (element.type) {
		case 'door': return 'Connect this entrance to a room and the route network.';

		case 'icon': return 'Reusable visitor-facing symbol placed on the map.';

		case 'label': return 'Visitor-facing map text with independent typography.';

		case 'location': return 'Selectable destination shape shown in the directory and visitor map.';

		case 'logo': return 'Brand artwork associated with a destination or map area.';

		case 'obstacle': return 'Excluded space that route lines must avoid.';

		case 'origin': return 'The starting position and viewing direction for this display.';

		case 'poi': return 'A searchable amenity or landmark that may also be routeable.';

		case 'transition': return 'A connection between floors, such as stairs or an elevator.';

		case 'walkable': return 'Verified pedestrian space used to build safe routes.';
	}
};

const elementIcon = (element: WayfindingStudioElement): typeof Shapes => {
	if (element.type === 'door') return DoorOpen;

	if (element.type === 'icon' || element.type === 'logo') return Image;

	if (element.type === 'label') return Type;

	if (element.type === 'origin') return Navigation;

	if (element.type === 'poi' || element.type === 'transition') return MapPin;

	return Shapes;
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
	const mediaAsset = createMemo(() => props.projectAssets?.find(
		(candidate) => (props.element.type === 'icon' || props.element.type === 'logo')
			&& candidate.id === props.element.assetId
	));
	const mediaRatio = (): number => {
		if (props.element.type !== 'icon' && props.element.type !== 'logo') return 1;

		return props.element.height > 0 ? props.element.width / props.element.height : 1;
	};
	const commitNumber = (key: string, value: string): void => {
		const parsed = Number(value);

		if (Number.isFinite(parsed)) patch({ [key]: parsed });
	};

	return (
		<PanelSection title="Map object" eyebrow="Selection" defaultOpen>
			<InspectorHero
				badge={props.element.status === 'confirmed' ? 'Ready' : 'Draft'}
				body={elementDescription(props.element)}
				eyebrow={props.element.type}
				icon={elementIcon(props.element)}
				title={elementTitle(props.element)}
			/>
			<Show when={'label' in props.element}>
				<Field label="Map label">
					<DraftInput
						value={'label' in props.element ? props.element.label ?? '' : ''}
						onCommit={(label) => patch({ label })}
					/>
				</Field>
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
				<div class="asset-inspector-preview">
					<img src={mediaAsset()?.dataUrl} alt="" />
					<span>
						<strong>{mediaAsset()?.name ?? 'Missing asset'}</strong>
						<small>{props.element.type === 'logo' ? 'Destination brand mark' : 'Reusable map symbol'}</small>
					</span>
				</div>
				<div class="field-grid">
					<Field label="Width">
						<DraftInput
							value={String(Math.round(props.element.type === 'icon' || props.element.type === 'logo' ? props.element.width : 0))}
							onCommit={(value) => {
								const width = Number(value);

								if (Number.isFinite(width) && width > 0) {
									patch({ width, height: width / mediaRatio() });
								}
							}}
						/>
					</Field>
					<Field label="Height">
						<DraftInput
							value={String(Math.round(props.element.type === 'icon' || props.element.type === 'logo' ? props.element.height : 0))}
							onCommit={(value) => {
								const height = Number(value);

								if (Number.isFinite(height) && height > 0) {
									patch({ height, width: height * mediaRatio() });
								}
							}}
						/>
					</Field>
				</div>
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
			<PanelSection title="Advanced" eyebrow="Technical">
				<Field label="Stable ID" hint="Used by runtime links and datasource updates.">
					<input value={props.element.id} disabled />
				</Field>
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
			</PanelSection>
			<div class="property-note">
				<Check size={15} />
				<span>{props.element.status === 'confirmed' ? 'Ready for the visitor map' : 'Draft map object'}</span>
			</div>
		</PanelSection>
	);
};

export const GraphNodeInspector = (props: {
	node: WayfindingNode;
	store: EditorStore;
}): JSX.Element => {
	const patch = (value: Partial<WayfindingNode>): void => props.store.dispatch({
		type: 'graph/node-patch',
		nodeId: props.node.id,
		patch: value
	});

	return (
		<PanelSection title="Route point" eyebrow="Selection" defaultOpen>
			<InspectorHero
				body="Shapes the authored network. Move it on the canvas to correct a route without rebuilding the floor."
				eyebrow="Network geometry"
				icon={Network}
				title={props.node.kind === 'route' ? 'Path control point' : props.node.kind === 'location' ? 'Destination endpoint' : 'Floor transition'}
			/>
			<Field label="Point role" hint="Route points shape paths; destination and transition points connect semantic map objects.">
				<select
					value={props.node.kind}
					onChange={(event) => patch({ kind: event.currentTarget.value as WayfindingNode['kind'] })}
				>
					<option value="route">Route point</option>
					<option value="location">Destination endpoint</option>
					<option value="transition">Floor transition</option>
				</select>
			</Field>
			<Show when={props.node.kind !== 'route'}>
				<Field label="Linked map object ID">
					<DraftInput
						value={props.node.semanticElementId ?? ''}
						onCommit={(semanticElementId) => patch({ semanticElementId: semanticElementId || undefined })}
					/>
				</Field>
			</Show>
			<PanelSection title="Advanced" eyebrow="Technical">
				<Field label="Stable ID" hint="Used by route segments. It remains stable when the point moves.">
					<input value={props.node.id} disabled />
				</Field>
				<div class="field-grid">
					<Field label="X position">
						<DraftInput
							value={String(Math.round(props.node.x))}
							onCommit={(value) => {
								const x = Number(value);

								if (Number.isFinite(x)) patch({ x });
							}}
						/>
					</Field>
					<Field label="Y position">
						<DraftInput
							value={String(Math.round(props.node.y))}
							onCommit={(value) => {
								const y = Number(value);

								if (Number.isFinite(y)) patch({ y });
							}}
						/>
					</Field>
				</div>
			</PanelSection>
			<button
				type="button"
				class="button danger block"
				onClick={() => props.store.dispatch({ type: 'graph/node-remove', nodeId: props.node.id })}
			>
				Delete route point
			</button>
		</PanelSection>
	);
};

export const GraphEdgeInspector = (props: {
	edge: WayfindingEdge;
	geometryIndex?: number;
	store: EditorStore;
}): JSX.Element => {
	const patch = (value: Partial<WayfindingEdge>): void => props.store.dispatch({
		type: 'graph/edge-patch',
		edgeId: props.edge.id,
		patch: value
	});
	const removeGeometryPoint = (): void => {
		if (props.geometryIndex === undefined || !props.edge.geometry || props.edge.geometry.length <= 2) return;
		patch({ geometry: props.edge.geometry.filter((_, index) => index !== props.geometryIndex) });
		props.store.dispatch({
			type: 'selection/set',
			selection: { id: props.edge.id, kind: 'graph-edge' }
		});
	};
	const nodes = (): WayfindingNode[] => props.store.getSnapshot().state.project.graph.nodes;
	const diagnostics = createMemo(() => inspectRouteGeometry(props.edge, nodes()));
	const repairGeometry = (): void => {
		const geometry = repairRouteGeometry(props.edge, nodes());

		if (geometry) patch({ geometry });
	};
	const straightenGeometry = (): void => {
		const geometry = straightenRouteGeometry(props.edge, nodes());

		if (geometry) patch({ geometry });
	};

	return (
		<PanelSection title="Route segment" eyebrow="Selection" defaultOpen>
			<InspectorHero
				badge={props.edge.reviewStatus === 'confirmed' ? 'Confirmed' : 'Draft'}
				body="Controls how visitors may travel between two route points."
				eyebrow="Network geometry"
				icon={Route}
				title={props.edge.kind === 'walk' ? 'Walking segment' : `${props.edge.kind[0]?.toUpperCase()}${props.edge.kind.slice(1)} segment`}
			/>
			<Show when={diagnostics().length > 0}>
				<div class="property-warning">
					<AlertTriangle size={15} />
					<span>{diagnostics()[0]?.message}</span>
				</div>
			</Show>
			<InspectorGroup
				title="Movement rules"
				body="Define the physical space and the journeys that may use this segment."
			>
				<div class="field-grid">
					<Field label="Route type">
						<select
							value={props.edge.kind}
							onChange={(event) => patch({ kind: event.currentTarget.value as WayfindingEdge['kind'] })}
						>
							<option value="walk">Walking</option>
							<option value="outdoor">Outdoor</option>
							<option value="stairs">Stairs</option>
							<option value="elevator">Elevator</option>
							<option value="escalator">Escalator</option>
							<option value="shuttle">Shuttle</option>
						</select>
					</Field>
					<Field label="Space">
						<select
							value={props.edge.traversal ?? 'indoor-corridor'}
							onChange={(event) => patch({ traversal: event.currentTarget.value as WayfindingTraversal })}
						>
							<option value="indoor-corridor">Indoor corridor</option>
							<option value="open-area">Open area</option>
							<option value="portal">Door or entrance</option>
							<option value="outdoor-path">Outdoor path</option>
							<option value="crossing">Crossing</option>
							<option value="transition">Floor transition</option>
						</select>
					</Field>
				</div>
				<div class="field-grid">
					<Field label="Corridor width" hint="Optional real-world width used by accessibility rules.">
						<DraftInput
							value={props.edge.corridorWidth ? String(props.edge.corridorWidth) : ''}
							onCommit={(value) => {
								const corridorWidth = Number(value);

								patch({ corridorWidth: Number.isFinite(corridorWidth) && corridorWidth > 0 ? corridorWidth : undefined });
							}}
						/>
					</Field>
					<Field label="Review status">
						<select
							value={props.edge.reviewStatus ?? 'proposed'}
							onChange={(event) => patch({ reviewStatus: event.currentTarget.value as WayfindingEdge['reviewStatus'] })}
						>
							<option value="proposed">Draft</option>
							<option value="confirmed">Confirmed</option>
						</select>
					</Field>
				</div>
				<label class="inline-toggle inspector-toggle">
					<input
						type="checkbox"
						checked={props.edge.bidirectional}
						onChange={(event) => patch({ bidirectional: event.currentTarget.checked })}
					/>
					Travel in both directions
				</label>
				<label class="inline-toggle inspector-toggle">
					<input
						type="checkbox"
						checked={props.edge.accessible}
						onChange={(event) => patch({ accessible: event.currentTarget.checked })}
					/>
					Include in step-free routes
				</label>
			</InspectorGroup>
			<InspectorGroup
				title="Geometry"
				body="Use these tools when a generated segment bends unnecessarily or leaves the pedestrian area."
			>
				<div class="inspector-action-grid">
					<button type="button" class="button" onClick={repairGeometry}>
						Clean geometry
					</button>
					<button
						type="button"
						class="button"
						title="Replace all bends with a direct segment. Confirm that it stays inside walkable space."
						onClick={straightenGeometry}
					>
						Use direct line
					</button>
				</div>
				<Show when={props.geometryIndex !== undefined}>
					<button
						type="button"
						class="button block"
						disabled={!props.edge.geometry || props.edge.geometry.length <= 2}
						onClick={removeGeometryPoint}
					>
						Delete selected bend
					</button>
				</Show>
			</InspectorGroup>
			<PanelSection title="Advanced" eyebrow="Technical">
				<Field label="Stable ID">
					<input value={props.edge.id} disabled />
				</Field>
			</PanelSection>
			<button
				type="button"
				class="button danger block"
				onClick={() => props.store.dispatch({ type: 'graph/edge-remove', edgeId: props.edge.id })}
			>
				Delete route segment
			</button>
		</PanelSection>
	);
};

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
			<Show when={(props.assets?.filter((asset) => asset.kind === 'logo' || asset.kind === 'photo').length ?? 0) > 0}>
				<InspectorGroup
					title="Brand and photos"
					body="Media appears in the directory and destination detail card, not as editable map geometry."
				>
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
				</InspectorGroup>
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
				<div classList={{ alert: errors() > 0 }}><strong>{errors()}</strong><span>Publish checks</span></div>
			</div>
			<p class="muted">Select a map object or destination to edit its details.</p>
		</PanelSection>
	);
};

export const RouteWorkspaceOverview = (props: {
	mode: 'edit' | 'preview';
	selectedDestination?: Accessor<WayfindingStudioDestination | undefined>;
	snapshot: Accessor<EditorSnapshot>;
}): JSX.Element => {
	const readiness = createMemo(() => {
		const state = props.snapshot().state;

		return getRouteReadiness(state.project, state.currentFloorId);
	});
	const routeNetworkVisible = createMemo(
		() => props.snapshot().state.layerVisibility['route-network']
	);

	return (
		<PanelSection
			title={props.mode === 'edit' ? 'Network status' : 'Journey status'}
			eyebrow={props.mode === 'edit' ? 'Route authoring' : 'Route preview'}
			defaultOpen
		>
			<div class="overview-grid route-overview-grid">
				<div>
					<strong>{readiness().segments}</strong>
					<span>Segments</span>
				</div>
				<div>
					<strong>{readiness().connectedDestinations}/{readiness().routeableDestinations}</strong>
					<span>Reachable</span>
				</div>
				<div classList={{ alert: readiness().blockers.length > 0 }}>
					<strong>{readiness().blockers.length}</strong>
					<span>Setup actions</span>
				</div>
			</div>
			<Show
				when={props.mode === 'preview'}
				fallback={(
					<p class="muted">
						Select a node or segment on the map to inspect and correct the authored network.
					</p>
				)}
			>
				<div class="context-summary">
					<span>Destination</span>
					<strong>{props.selectedDestination?.()?.name ?? 'Choose a destination'}</strong>
				</div>
				<div class="context-summary">
					<span>Network overlay</span>
					<strong>{routeNetworkVisible() ? 'Visible for diagnostics' : 'Hidden from preview'}</strong>
				</div>
			</Show>
			<Show when={readiness().blockers[0]}>
				<div class="context-callout warning">
					<strong>{readiness().blockers[0].title}</strong>
					<span>{readiness().blockers[0].body}</span>
				</div>
			</Show>
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
			fallback={<div class="validation-success"><Check size={18} /> Project data is valid.</div>}
		>
			<div class="problem-list">
				<For each={props.issues()}>{(issue) => (
					<button
						type="button"
						class={`problem ${issue.severity}`}
						onClick={() => {
							const selection = issueSelection(
								issue,
								props.store.getSnapshot().state.project
							);

							if (selection) props.store.dispatch({ type: 'selection/set', selection });
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
