import {
	createMemo,
	type Accessor,
	type JSX
} from 'solid-js';
import {
	wayfindingStudioProjectDefaults,
	type WayfindingStudioProject
} from '../../../studio-project.mts';
import type {
	EditorSnapshot,
	EditorStore
} from '../../../editor-core/types';
import { Field, RangeField } from '../ui';
import { updateProject } from './project-edit';

export const ProjectSettings = (props: {
	snapshot: Accessor<EditorSnapshot>;
	store: EditorStore;
}): JSX.Element => {
	const defaults = createMemo(() => wayfindingStudioProjectDefaults(props.snapshot().state.project));
	const replaceDefaults = (
		update: (project: WayfindingStudioProject) => void,
		historyGroup?: string
	): void => updateProject(
		props.store,
		props.snapshot(),
		'Update project settings',
		update,
		historyGroup
	);
	const edit = (
		update: (next: ReturnType<typeof wayfindingStudioProjectDefaults>) => void,
		historyGroup?: string
	): void =>
		replaceDefaults((project): void => {
			project.defaults = wayfindingStudioProjectDefaults(project);
			update(project.defaults);
		}, historyGroup);

	return (
		<div class="settings-stack project-defaults">
			<section class="settings-subsection">
				<div class="subsection-heading">
					<strong>Rooms and areas</strong>
					<small>Defaults for newly authored geometry.</small>
				</div>
				<Field label="New room colors" hint="Match the map, rotate through an accessible palette, or use one brand color.">
					<select
						value={defaults().locationColor.mode}
						onChange={(event) => edit((next): void => {
							next.locationColor.mode = event.currentTarget.value as 'fixed' | 'inherited' | 'random';
						})}
					>
						<option value="inherited">Match source map</option>
						<option value="random">Use distinct palette colors</option>
						<option value="fixed">Use one project color</option>
					</select>
				</Field>
				<Field label="Room color">
					<div class="color-field">
						<input
							type="color"
							disabled={defaults().locationColor.mode !== 'fixed'}
							value={defaults().locationColor.fixedColor}
							onChange={(event) => edit((next): void => {
								next.locationColor.fixedColor = event.currentTarget.value;
							})}
						/>
						<code>{defaults().locationColor.fixedColor.toUpperCase()}</code>
					</div>
				</Field>
				<RangeField
					label="Room opacity"
					min={0}
					max={100}
					value={Math.round(defaults().location.fillOpacity * 100)}
					formatValue={(value) => `${value}%`}
					onInput={(value) => edit((next): void => {
						next.location.fillOpacity = value / 100;
					}, 'room-opacity')}
				/>
				<RangeField
					label="Room 3D height"
					min={0}
					max={200}
					value={defaults().location.extrusionHeight}
					formatValue={(value) => `${value} px`}
					onInput={(value) => edit((next): void => {
						next.location.extrusionHeight = value;
					}, 'room-height')}
				/>
				<RangeField
					label="Blocked 3D height"
					min={0}
					max={200}
					value={defaults().obstacle.extrusionHeight}
					formatValue={(value) => `${value} px`}
					onInput={(value) => edit((next): void => {
						next.obstacle.extrusionHeight = value;
					}, 'blocked-height')}
				/>
				<RangeField
					label="Walkable opacity"
					min={0}
					max={100}
					value={Math.round(defaults().walkable.fillOpacity * 100)}
					formatValue={(value) => `${value}%`}
					onInput={(value) => edit((next): void => {
						next.walkable.fillOpacity = value / 100;
					}, 'walkable-opacity')}
				/>
				<RangeField
					label="Blocked opacity"
					min={0}
					max={100}
					value={Math.round(defaults().obstacle.fillOpacity * 100)}
					formatValue={(value) => `${value}%`}
					onInput={(value) => edit((next): void => {
						next.obstacle.fillOpacity = value / 100;
					}, 'blocked-opacity')}
				/>
			</section>

			<section class="settings-subsection">
				<div class="subsection-heading">
					<strong>Labels and media</strong>
					<small>Shared visitor-facing typography and asset scale.</small>
				</div>
				<div class="field-grid">
					<Field label="Label font">
						<select
							value={defaults().label.fontFamily}
							onChange={(event) => edit((next): void => {
								next.label.fontFamily = event.currentTarget.value as 'monospace' | 'sans-serif' | 'serif';
							})}
						>
							<option value="sans-serif">Sans serif</option>
							<option value="serif">Serif</option>
							<option value="monospace">Monospace</option>
						</select>
					</Field>
					<Field label="Label weight">
						<select
							value={defaults().label.fontWeight}
							onChange={(event) => edit((next): void => {
								next.label.fontWeight = Number(event.currentTarget.value) as 400 | 600 | 700;
							})}
						>
							<option value="400">Regular</option>
							<option value="600">Semibold</option>
							<option value="700">Bold</option>
						</select>
					</Field>
				</div>
				<RangeField
					label="Label size"
					min={8}
					max={200}
					value={defaults().label.fontSize}
					formatValue={(value) => `${value} px`}
					onInput={(value) => edit((next): void => {
						next.label.fontSize = value;
					}, 'label-size')}
				/>
				<RangeField
					label="3D destination label size"
					min={11}
					max={32}
					value={defaults().label.fontSize3d}
					formatValue={(value) => `${value} px`}
					onInput={(value) => edit((next): void => {
						next.label.fontSize3d = value;
					}, 'label-size-3d')}
				/>
				<RangeField
					label="Outline width"
					min={0}
					max={20}
					value={defaults().label.outlineWidth}
					formatValue={(value) => `${value} px`}
					onInput={(value) => edit((next): void => {
						next.label.outlineWidth = value;
					}, 'label-outline')}
				/>
				<div class="field-grid">
					<Field label="Label color">
						<input
							class="color-input"
							type="color"
							value={defaults().label.color}
							onChange={(event) => edit((next): void => {
								next.label.color = event.currentTarget.value;
							})}
						/>
					</Field>
					<Field label="Outline color">
						<input
							class="color-input"
							type="color"
							value={defaults().label.outlineColor}
							onChange={(event) => edit((next): void => {
								next.label.outlineColor = event.currentTarget.value;
							})}
						/>
					</Field>
				</div>
				<RangeField
					label="Map symbol size"
					min={12}
					max={400}
					value={defaults().iconSize}
					formatValue={(value) => `${value} px`}
					onInput={(value) => edit((next): void => {
						next.iconSize = value;
					}, 'symbol-size')}
				/>
				<RangeField
					label="Logo size"
					min={12}
					max={600}
					value={defaults().logoSize}
					formatValue={(value) => `${value} px`}
					onInput={(value) => edit((next): void => {
						next.logoSize = value;
					}, 'logo-size')}
				/>
			</section>

			<section class="settings-subsection">
				<div class="subsection-heading">
					<strong>You are here</strong>
					<small>Installed-screen marker behavior in 2D and 3D.</small>
				</div>
				<div class="field-grid">
					<Field label="Marker color">
						<input
							class="color-input"
							type="color"
							value={defaults().origin.color}
							onChange={(event) => edit((next): void => {
								next.origin.color = event.currentTarget.value;
							})}
						/>
					</Field>
					<RangeField
						label="Animation speed"
						min={1}
						max={240}
						value={defaults().origin.animationSpeed}
						onInput={(value) => edit((next): void => {
							next.origin.animationSpeed = value;
						}, 'origin-animation-speed')}
					/>
				</div>
				<div class="field-grid">
					<Field label="2D animation">
						<select
							value={defaults().origin.animation2d}
							onChange={(event) => edit((next): void => {
								next.origin.animation2d = event.currentTarget.value as 'none' | 'pulse' | 'radar';
							})}
						>
							<option value="radar">Radar</option>
							<option value="pulse">Pulse</option>
							<option value="none">None</option>
						</select>
					</Field>
					<Field label="3D animation">
						<select
							value={defaults().origin.animation3d}
							onChange={(event) => edit((next): void => {
								next.origin.animation3d = event.currentTarget.value as 'bounce' | 'none' | 'pulse';
							})}
						>
							<option value="bounce">Bounce</option>
							<option value="pulse">Pulse</option>
							<option value="none">None</option>
						</select>
					</Field>
				</div>
			</section>

			<section class="settings-subsection">
				<div class="subsection-heading">
					<strong>Route appearance</strong>
					<small>Shared preview and runtime presentation.</small>
				</div>
				<div class="field-grid">
					<Field label="Route color">
						<input
							class="color-input"
							type="color"
							value={defaults().route.color}
							onChange={(event) => edit((next): void => {
								next.route.color = event.currentTarget.value;
							})}
						/>
					</Field>
					<RangeField
						label="Route width"
						min={1}
						max={64}
						value={defaults().route.lineWidth}
						formatValue={(value) => `${value} px`}
						onInput={(value) => edit((next): void => {
							next.route.lineWidth = value;
						}, 'route-width')}
					/>
				</div>
				<div class="field-grid">
					<RangeField
						label="Corner rounding"
						min={0}
						max={100}
						value={defaults().route.cornerRadius}
						formatValue={(value) => `${value} px`}
						onInput={(value) => edit((next): void => {
							next.route.cornerRadius = value;
						}, 'route-rounding')}
					/>
					<Field label="Animation">
						<select
							value={defaults().route.animation}
							onChange={(event) => edit((next): void => {
								next.route.animation = event.currentTarget.value as 'flow' | 'none' | 'pulse';
							})}
						>
							<option value="flow">Flow to destination</option>
							<option value="pulse">Pulse</option>
							<option value="none">None</option>
						</select>
					</Field>
				</div>
				<RangeField
					label="Animation speed"
					ariaLabel="Route animation speed"
					min={1}
					max={240}
					value={defaults().route.animationSpeed}
					onInput={(value) => edit((next): void => {
						next.route.animationSpeed = value;
					}, 'route-animation-speed')}
				/>
			</section>
		</div>
	);
};
