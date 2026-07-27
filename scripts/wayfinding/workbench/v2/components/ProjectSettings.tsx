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

	return (
		<div class="settings-stack">
			<Field label="New room colors" hint="Choose how newly authored rooms receive their initial fill color.">
				<select
					value={defaults().locationColor.mode}
					onChange={(event) => replaceDefaults((project): void => {
						project.defaults = wayfindingStudioProjectDefaults(project);
						project.defaults.locationColor.mode = event.currentTarget.value as 'fixed' | 'inherited' | 'random';
					})}
				>
					<option value="inherited">Match source map</option>
					<option value="random">Use distinct palette colors</option>
					<option value="fixed">Use one project color</option>
				</select>
			</Field>
			<div class="field-grid">
				<Field label="Room opacity">
					<div class="input-with-unit">
						<input
							type="number"
							min="0"
							max="100"
							value={Math.round(defaults().location.fillOpacity * 100)}
							onChange={(event) => replaceDefaults((project): void => {
								project.defaults = wayfindingStudioProjectDefaults(project);
								project.defaults.location.fillOpacity = Number(event.currentTarget.value) / 100;
							})}
						/>
						<span>%</span>
					</div>
				</Field>
				<Field label="3D height">
					<input
						type="number"
						min="0"
						max="100"
						value={defaults().location.extrusionHeight}
						onChange={(event) => replaceDefaults((project): void => {
							project.defaults = wayfindingStudioProjectDefaults(project);
							project.defaults.location.extrusionHeight = Number(event.currentTarget.value);
						})}
					/>
				</Field>
			</div>
			<div class="field-grid">
				<Field label="Route color">
					<div class="color-field">
						<input
							type="color"
							value={defaults().route.color}
							onChange={(event) => replaceDefaults((project): void => {
								project.defaults = wayfindingStudioProjectDefaults(project);
								project.defaults.route.color = event.currentTarget.value;
							})}
						/>
						<code>{defaults().route.color.toLocaleUpperCase()}</code>
					</div>
				</Field>
				<Field label="Route width">
					<input
						type="number"
						min="1"
						max="64"
						value={defaults().route.lineWidth}
						onChange={(event) => replaceDefaults((project): void => {
							project.defaults = wayfindingStudioProjectDefaults(project);
							project.defaults.route.lineWidth = Number(event.currentTarget.value);
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
						onChange={(event) => replaceDefaults((project): void => {
							project.defaults = wayfindingStudioProjectDefaults(project);
							project.defaults.route.cornerRadius = Number(event.currentTarget.value);
						})}
					/>
				</Field>
				<Field label="Animation">
					<select
						value={defaults().route.animation}
						onChange={(event) => replaceDefaults((project): void => {
							project.defaults = wayfindingStudioProjectDefaults(project);
							project.defaults.route.animation = event.currentTarget.value as 'flow' | 'none' | 'pulse';
						})}
					>
						<option value="flow">Flow to destination</option>
						<option value="pulse">Pulse</option>
						<option value="none">None</option>
					</select>
				</Field>
			</div>
		</div>
	);
};
