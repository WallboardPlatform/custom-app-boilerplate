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
	WayfindingStudioIssue
} from '../../../studio-project.mts';
import { projectCounts } from '../../../editor-core/selectors';
import type {
	EditorSnapshot,
	EditorStore
} from '../../../editor-core/types';
import {
	friendlyIssue,
	issueSelection
} from '../issues';
import { getRouteReadiness } from '../features/routing';
import { PanelSection } from '../ui';

export const ProjectOverview = (props: {
	issues: Accessor<WayfindingStudioIssue[]>;
	snapshot: Accessor<EditorSnapshot>;
}): JSX.Element => {
	const counts = createMemo(() => projectCounts(props.snapshot().state));
	const errors = createMemo(() => props.issues().filter((issue) => issue.severity === 'error').length);

	return (
		<PanelSection title="Project overview" eyebrow="Publish readiness" defaultOpen>
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
			eyebrow={props.mode === 'edit' ? 'Route authoring' : 'Route testing'}
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
	<PanelSection title={`Publish checks (${props.issues().length})`} eyebrow="Validation">
		<Show
			when={props.issues().length > 0}
			fallback={<div class="validation-success"><Check size={18} /> Ready to publish.</div>}
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
