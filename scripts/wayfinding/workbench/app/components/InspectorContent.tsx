import {
	AlertTriangle,
	Check,
	DoorOpen,
	Image,
	MapPin,
	Navigation,
	Shapes,
	Type
} from 'lucide-solid';
import {
	createMemo,
	For,
	Show,
	type JSX
} from 'solid-js';
import type {
	WayfindingStudioElement,
	WayfindingStudioAsset,
	WayfindingStudioPolygonElement,
	WayfindingStudioProject
} from '../../../studio-project.mts';
import type { EditorStore } from '../../../editor-core/types';
import {
	Field,
	InspectorGroup,
	InspectorHero,
	PanelSection
} from '../ui';
import {
	DraftInput
} from './draft-fields';
export {
	Problems,
	ProjectOverview,
	RouteWorkspaceOverview
} from './InspectorOverviews';

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
	project: WayfindingStudioProject;
	projectAssets?: WayfindingStudioAsset[];
	store: EditorStore;
}): JSX.Element => {
	const patch = (value: Record<string, unknown>, historyGroup?: string): void => props.store.dispatch({
		type: 'element/patch',
		elementId: props.element.id,
		...(historyGroup ? { historyGroup } : {}),
		patch: value
	});
	const mediaAsset = createMemo(() => props.projectAssets?.find(
		(candidate) => (props.element.type === 'icon' || props.element.type === 'logo')
			&& candidate.id === props.element.assetId
	));
	const doorLocations = createMemo(() => props.project.floors
		.find((floor) => floor.id === props.element.floorId)
		?.elements
		.filter((element): element is WayfindingStudioPolygonElement =>
			element.type === 'location'
			&& Boolean(element.destinationId)
		) ?? []);
	const doorLocationLabel = (location: WayfindingStudioPolygonElement): string => {
		const destination = location.destinationId
			? props.project.destinations.find((candidate) => candidate.id === location.destinationId)
			: undefined;

		return destination?.name ?? location.label ?? location.id;
	};
	const inspectorBadge = (): string | undefined => {
		if (props.element.type === 'door') {
			return props.element.locationId ? 'Linked entrance' : 'Needs room';
		}

		return undefined;
	};
	const mediaRatio = (): number => {
		if (props.element.type !== 'icon' && props.element.type !== 'logo') return 1;

		return props.element.height > 0 ? props.element.width / props.element.height : 1;
	};
	const mediaLongEdge = (): number => {
		if (props.element.type !== 'icon' && props.element.type !== 'logo') return 0;

		return Math.max(props.element.width, props.element.height);
	};
	const resizeMedia = (longEdge: number): void => {
		if (props.element.type !== 'icon' && props.element.type !== 'logo') return;
		const ratio = mediaRatio();

		patch(ratio >= 1
			? { height: longEdge / ratio, width: longEdge }
			: { height: longEdge, width: longEdge * ratio }, 'media-scale');
	};
	const commitNumber = (key: string, value: string): void => {
		const parsed = Number(value);

		if (Number.isFinite(parsed)) patch({ [key]: parsed });
	};

	return (
		<PanelSection title="Map object" eyebrow="Selection" defaultOpen>
			<InspectorHero
				badge={inspectorBadge()}
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
				<InspectorGroup
					title="Route entrance"
					body="Connect this doorway to the room it serves. Route generation will approach from the corridor side of the door."
				>
					<Field label="Connected room">
						<select
							value={props.element.type === 'door' ? props.element.locationId ?? '' : ''}
							onChange={(event) => patch({
								locationId: event.currentTarget.value || undefined
							})}
						>
							<option value="">Not connected</option>
							<For each={doorLocations()}>
								{(location) => (
									<option value={location.id}>{doorLocationLabel(location)}</option>
								)}
							</For>
						</select>
					</Field>
					<div
						class="property-note"
						classList={{ warning: props.element.type === 'door' && !props.element.locationId }}
					>
						<Show
							when={props.element.type === 'door' && props.element.locationId}
							fallback={(
								<>
									<AlertTriangle size={15} />
									<span>This door will not be used for directions until a room is connected.</span>
								</>
							)}
						>
							<Check size={15} />
							<span>Ready to terminate routes at this public entrance.</span>
						</Show>
					</div>
				</InspectorGroup>
				<div class="field-grid">
					<Field label="Door angle" hint="Rotate the door line to match the wall.">
						<DraftInput
							value={props.element.type === 'door' ? String(props.element.angle) : '0'}
							onCommit={(value) => commitNumber('angle', value)}
						/>
					</Field>
					<Field label="Opening width">
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
				<Field
					label="Scale"
					hint="Resize from the image center while keeping its original proportions."
				>
					<div class="range-control">
						<input
							type="range"
							aria-label="Image scale"
							min={16}
							max={Math.max(512, Math.ceil(mediaLongEdge()))}
							value={Math.round(mediaLongEdge())}
							onInput={(event) => resizeMedia(Number(event.currentTarget.value))}
						/>
						<output>{Math.round(mediaLongEdge())} px</output>
					</div>
				</Field>
				<Field label="Rotation" hint="Rotate around the image center. Hold Shift on the canvas handle to snap to 15° increments.">
					<div class="range-control">
						<input
							type="range"
							aria-label="Image rotation"
							min={-180}
							max={180}
							step={1}
							value={props.element.type === 'icon' || props.element.type === 'logo'
								? Math.round(props.element.rotationDegrees ?? 0)
								: 0}
							onInput={(event) => patch(
								{ rotationDegrees: Number(event.currentTarget.value) },
								'media-rotation'
							)}
						/>
						<output>{Math.round(
							props.element.type === 'icon' || props.element.type === 'logo'
								? props.element.rotationDegrees ?? 0
								: 0
						)}°</output>
					</div>
				</Field>
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
		</PanelSection>
	);
};
