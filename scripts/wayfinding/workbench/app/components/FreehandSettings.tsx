import { createMemo, type Accessor, type JSX } from 'solid-js';

import type {
	EditorDrawingSettings,
	EditorSnapshot,
	EditorStore
} from '../../../editor-core/types';
import { Field } from '../ui';

interface FreehandSettingsProps {
	snapshot: Accessor<EditorSnapshot>;
	store: EditorStore;
}

export const FreehandSettings = (props: FreehandSettingsProps): JSX.Element => {
	const drawing = createMemo(() => props.snapshot().state.drawing);
	const patch = (value: Partial<EditorDrawingSettings>): void => props.store.dispatch({
		type: 'drawing/patch',
		patch: value
	});
	const floor = createMemo(() => props.snapshot().state.project.floors.find(
		(candidate) => candidate.id === props.snapshot().state.currentFloorId
	));
	const hasBackground = createMemo(() => Boolean(floor()?.backgroundAssetId));

	return (
		<div class="smart-trace-settings">
			<p class="panel-copy">
				Draw one continuous outline. The finished shape stays fully editable.
			</p>
			<label class="setting-row">
				<span>
					<strong>Follow floor-plan edges</strong>
					<small>{
						hasBackground()
							? 'Magnetize the stroke to nearby walls in the background image.'
							: 'Add a floor-plan image to enable wall snapping.'
					}</small>
				</span>
				<input
					type="checkbox"
					checked={drawing().snapToSourceEdges}
					disabled={!hasBackground()}
					onChange={(event) => patch({ snapToSourceEdges: event.currentTarget.checked })}
				/>
			</label>
			<Field
				label="Snap distance"
				hint="The maximum source-image distance used to find a nearby wall."
			>
				<div class="range-control">
					<input
						type="range"
						min={2}
						max={32}
						value={drawing().snapRadius}
						disabled={!hasBackground() || !drawing().snapToSourceEdges}
						onInput={(event) => patch({ snapRadius: Number(event.currentTarget.value) })}
					/>
					<output>{drawing().snapRadius} px</output>
				</div>
			</Field>
		</div>
	);
};
