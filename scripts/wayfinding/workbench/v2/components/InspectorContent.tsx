import { Check } from 'lucide-solid';
import {
	createMemo,
	For,
	Show,
	type Accessor,
	type JSX
} from 'solid-js';
import type {
	WayfindingStudioDestination,
	WayfindingStudioElement,
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
	store: EditorStore;
}): JSX.Element => (
	<PanelSection title="Object" eyebrow={props.element.type} defaultOpen>
		<Field label="Stable ID" hint="Used by runtime links and datasources.">
			<input value={props.element.id} disabled />
		</Field>
		<Show when={'label' in props.element}>
			<Field label="Label">
				<DraftInput
					value={'label' in props.element ? props.element.label ?? '' : ''}
					onCommit={(label) => props.store.dispatch({
						type: 'element/patch',
						elementId: props.element.id,
						patch: { label }
					})}
				/>
			</Field>
		</Show>
		<div class="property-note">
			<Check size={15} />
			<span>{props.element.status === 'confirmed' ? 'Confirmed map object' : 'Draft map object'}</span>
		</div>
	</PanelSection>
);

export const DestinationInspector = (props: {
	destination: WayfindingStudioDestination;
	patch: (destination: WayfindingStudioDestination, patch: Partial<WayfindingStudioDestination>) => void;
}): JSX.Element => (
	<PanelSection title="Destination details" eyebrow="Visitor information" defaultOpen>
		<Field label="Name">
			<DraftInput value={props.destination.name} onCommit={(name) => props.patch(props.destination, { name })} />
		</Field>
		<Field label="Description">
			<DraftTextarea
				value={props.destination.description ?? ''}
				onCommit={(description) => props.patch(props.destination, { description })}
			/>
		</Field>
		<div class="field-grid">
			<Field label="Category">
				<input value={props.destination.category ?? ''} disabled />
			</Field>
			<Field label="Directory number">
				<DraftInput
					value={props.destination.mapNumber ?? ''}
					onCommit={(mapNumber) => props.patch(props.destination, { mapNumber })}
				/>
			</Field>
		</div>
		<Field label="Opening hours">
			<DraftInput value={props.destination.hours ?? ''} onCommit={(hours) => props.patch(props.destination, { hours })} />
		</Field>
		<Field label="Phone">
			<DraftInput value={props.destination.phone ?? ''} onCommit={(phone) => props.patch(props.destination, { phone })} />
		</Field>
	</PanelSection>
);

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
