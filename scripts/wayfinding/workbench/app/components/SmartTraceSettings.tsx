import { createMemo, type Accessor, type JSX } from 'solid-js';

import type {
	EditorSnapshot,
	EditorStore,
	EditorTraceSettings
} from '../../../editor-core/types';
import { Field } from '../ui';

interface SmartTraceSettingsProps {
	allowedTypes: EditorTraceSettings['elementType'][];
	snapshot: Accessor<EditorSnapshot>;
	store: EditorStore;
}

const targetLabels: Record<EditorTraceSettings['elementType'], string> = {
	location: 'Room or area',
	obstacle: 'Blocked area',
	walkable: 'Walkable area'
};

const RangeField = (props: {
	hint: string;
	label: string;
	max: number;
	min: number;
	onInput: (value: number) => void;
	value: number;
}): JSX.Element => (
	<Field label={props.label} hint={props.hint}>
		<div class="range-control">
			<input
				type="range"
				min={props.min}
				max={props.max}
				value={props.value}
				onInput={(event) => props.onInput(Number(event.currentTarget.value))}
			/>
			<output>{props.value}</output>
		</div>
	</Field>
);

export const SmartTraceSettings = (props: SmartTraceSettingsProps): JSX.Element => {
	const trace = createMemo(() => props.snapshot().state.trace);
	const patch = (value: Partial<EditorTraceSettings>): void => props.store.dispatch({
		type: 'trace/patch',
		patch: value
	});

	return (
		<div class="smart-trace-settings">
			<p class="panel-copy">
				Click inside a flat-color region. Smart trace follows its visible boundary and creates editable geometry.
			</p>
			<Field label="Create">
				<select
					value={trace().elementType}
					onChange={(event) => patch({
						elementType: event.currentTarget.value as EditorTraceSettings['elementType']
					})}
				>
					{props.allowedTypes.map((type) => <option value={type}>{targetLabels[type]}</option>)}
				</select>
			</Field>
			<RangeField
				label="Color range"
				hint="Increase when the region contains subtle shading. Lower values avoid leaking into nearby colors."
				min={4}
				max={96}
				value={trace().colorTolerance}
				onInput={(colorTolerance) => patch({ colorTolerance })}
			/>
			<RangeField
				label="Boundary detail"
				hint="Higher values simplify tiny door notches and noisy image edges."
				min={1}
				max={18}
				value={trace().detail}
				onInput={(detail) => patch({ detail })}
			/>
			<RangeField
				label="Close small gaps"
				hint="Bridges small breaks in the detected region boundary."
				min={0}
				max={12}
				value={trace().closeGap}
				onInput={(closeGap) => patch({ closeGap })}
			/>
			<RangeField
				label="Minimum opening"
				hint="Prevents detection from escaping through narrow gaps such as doors or scan noise."
				min={0}
				max={24}
				value={trace().minimumOpening}
				onInput={(minimumOpening) => patch({ minimumOpening })}
			/>
		</div>
	);
};
