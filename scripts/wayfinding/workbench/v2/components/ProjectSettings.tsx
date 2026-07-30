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
import { Field } from '../ui';
import { updateProject } from './project-edit';

export const ProjectSettings = (props: {
	snapshot: Accessor<EditorSnapshot>;
	store: EditorStore;
}): JSX.Element => {
	const defaults = createMemo(() => wayfindingStudioProjectDefaults(props.snapshot().state.project));
	const replaceDefaults = (update: (project: WayfindingStudioProject) => void): void =>
		updateProject(props.store, props.snapshot(), 'Update project settings', update);
	const edit = (update: (next: ReturnType<typeof wayfindingStudioProjectDefaults>) => void): void =>
		replaceDefaults((project): void => {
			project.defaults = wayfindingStudioProjectDefaults(project);
			update(project.defaults);
		});

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
				<div class="field-grid">
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
					<Field label="Room opacity">
						<div class="input-with-unit">
							<input
								type="number"
								min="0"
								max="100"
								value={Math.round(defaults().location.fillOpacity * 100)}
								onChange={(event) => edit((next): void => {
									next.location.fillOpacity = Number(event.currentTarget.value) / 100;
								})}
							/>
							<span>%</span>
						</div>
					</Field>
				</div>
				<div class="field-grid">
					<Field label="Room 3D height">
						<input
							type="number"
							min="0"
							max="200"
							value={defaults().location.extrusionHeight}
							onChange={(event) => edit((next): void => {
								next.location.extrusionHeight = Number(event.currentTarget.value);
							})}
						/>
					</Field>
					<Field label="Blocked 3D height">
						<input
							type="number"
							min="0"
							max="200"
							value={defaults().obstacle.extrusionHeight}
							onChange={(event) => edit((next): void => {
								next.obstacle.extrusionHeight = Number(event.currentTarget.value);
							})}
						/>
					</Field>
				</div>
				<div class="field-grid">
					<Field label="Walkable opacity">
						<div class="input-with-unit">
							<input
								type="number"
								min="0"
								max="100"
								value={Math.round(defaults().walkable.fillOpacity * 100)}
								onChange={(event) => edit((next): void => {
									next.walkable.fillOpacity = Number(event.currentTarget.value) / 100;
								})}
							/>
							<span>%</span>
						</div>
					</Field>
					<Field label="Blocked opacity">
						<div class="input-with-unit">
							<input
								type="number"
								min="0"
								max="100"
								value={Math.round(defaults().obstacle.fillOpacity * 100)}
								onChange={(event) => edit((next): void => {
									next.obstacle.fillOpacity = Number(event.currentTarget.value) / 100;
								})}
							/>
							<span>%</span>
						</div>
					</Field>
				</div>
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
				<div class="field-grid">
					<Field label="Label size">
						<input
							type="number"
							min="8"
							max="200"
							value={defaults().label.fontSize}
							onChange={(event) => edit((next): void => {
								next.label.fontSize = Number(event.currentTarget.value);
							})}
						/>
					</Field>
					<Field label="Outline width">
						<input
							type="number"
							min="0"
							max="20"
							value={defaults().label.outlineWidth}
							onChange={(event) => edit((next): void => {
								next.label.outlineWidth = Number(event.currentTarget.value);
							})}
						/>
					</Field>
				</div>
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
				<div class="field-grid">
					<Field label="Map symbol size">
						<input
							type="number"
							min="12"
							max="400"
							value={defaults().iconSize}
							onChange={(event) => edit((next): void => {
								next.iconSize = Number(event.currentTarget.value);
							})}
						/>
					</Field>
					<Field label="Logo size">
						<input
							type="number"
							min="12"
							max="600"
							value={defaults().logoSize}
							onChange={(event) => edit((next): void => {
								next.logoSize = Number(event.currentTarget.value);
							})}
						/>
					</Field>
				</div>
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
					<Field label="Animation speed">
						<input
							type="number"
							min="1"
							max="240"
							value={defaults().origin.animationSpeed}
							onChange={(event) => edit((next): void => {
								next.origin.animationSpeed = Number(event.currentTarget.value);
							})}
						/>
					</Field>
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
					<Field label="Route width">
						<input
							type="number"
							min="1"
							max="64"
							value={defaults().route.lineWidth}
							onChange={(event) => edit((next): void => {
								next.route.lineWidth = Number(event.currentTarget.value);
							})}
						/>
					</Field>
				</div>
				<div class="field-grid">
					<Field label="Corner rounding">
						<input
							type="number"
							min="0"
							max="100"
							value={defaults().route.cornerRadius}
							onChange={(event) => edit((next): void => {
								next.route.cornerRadius = Number(event.currentTarget.value);
							})}
						/>
					</Field>
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
				<Field label="Animation speed">
					<input
						type="range"
						min="1"
						max="240"
						value={defaults().route.animationSpeed}
						onInput={(event) => edit((next): void => {
							next.route.animationSpeed = Number(event.currentTarget.value);
						})}
					/>
				</Field>
			</section>
		</div>
	);
};
