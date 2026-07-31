import { PanelRightClose } from 'lucide-solid';
import {
	createEffect,
	createSignal,
	Show,
	type Accessor,
	type JSX
} from 'solid-js';

import type {
	WayfindingStudioDestination,
	WayfindingStudioElement,
	WayfindingStudioIssue
} from '../../../studio-project.mts';
import type {
	EditorSnapshot,
	EditorStore
} from '../../../editor-core/types';
import type {
	WayfindingEdge,
	WayfindingNode
} from '../../../../../src/utils/wayfinding.js';
import { DestinationInspector } from '../features/directory';
import {
	GraphEdgeInspector,
	GraphNodeInspector
} from '../features/routing';
import { IconButton, PanelResizeHandle } from '../ui';
import {
	ElementInspector,
	Problems,
	ProjectOverview,
	RouteWorkspaceOverview
} from './InspectorContent';

interface InspectorPanelProps {
	publishIssues: Accessor<WayfindingStudioIssue[]>;
	element: Accessor<WayfindingStudioElement | undefined>;
	elementName: Accessor<string>;
	graphEdge: Accessor<WayfindingEdge | undefined>;
	graphEdgeGeometryIndex: Accessor<number | undefined>;
	graphNode: Accessor<WayfindingNode | undefined>;
	onPatchDestination: (
		destination: WayfindingStudioDestination,
		patch: Partial<WayfindingStudioDestination>
	) => void;
	selectedDestination: Accessor<WayfindingStudioDestination | undefined>;
	snapshot: Accessor<EditorSnapshot>;
	store: EditorStore;
}

export const InspectorPanel = (props: InspectorPanelProps): JSX.Element => {
	const [destinationLanguage, setDestinationLanguage] = createSignal('en');
	createEffect(() => {
		const project = props.snapshot().state.project;
		const languages = project.languages ?? [];

		if (!languages.some((language) => language.code === destinationLanguage())) {
			setDestinationLanguage(project.defaultLanguage ?? languages[0]?.code ?? 'en');
		}
	});
	const destinationEditor = (destination: WayfindingStudioDestination): JSX.Element => (
		<DestinationInspector
			assets={props.snapshot().state.project.assets}
			categories={props.snapshot().state.project.categories ?? []}
			defaultLanguage={props.snapshot().state.project.defaultLanguage ?? 'en'}
			destination={destination}
			floors={props.snapshot().state.project.floors}
			language={destinationLanguage}
			languages={props.snapshot().state.project.languages ?? []}
			patch={props.onPatchDestination}
			setLanguage={setDestinationLanguage}
		/>
	);
	const contextualOverview = (): JSX.Element => {
		const workspace = props.snapshot().state.workspace;

		if (workspace === 'route-edit') {
			return (
				<RouteWorkspaceOverview
					mode="edit"
					selectedDestination={props.selectedDestination}
					snapshot={props.snapshot}
				/>
			);
		}

		return (
			<ProjectOverview
				issues={props.publishIssues}
				snapshot={props.snapshot}
			/>
		);
	};

	return (
		<aside class="right-panel panel-shell" aria-label="Inspector">
			<PanelResizeHandle
				panelId="right"
				store={props.store}
				width={() => props.snapshot().state.panels.right.width}
			/>
			<div class="panel-title">
				<span>
					<small>Inspector</small>
					<strong>{props.elementName()}</strong>
				</span>
				<IconButton
					icon={PanelRightClose}
					label="Close inspector panel"
					onClick={() => props.store.dispatch({ type: 'panel/toggle', panelId: 'right' })}
				/>
			</div>
			<div class="panel-scroll">
				<Show
					when={props.element()}
					fallback={
						<Show
							when={props.selectedDestination()}
							fallback={
								<Show
									when={props.graphNode()}
									fallback={
										<Show
											when={props.graphEdge()}
											fallback={contextualOverview()}
											keyed
										>
											{(edge) => (
												<GraphEdgeInspector
													edge={edge}
													geometryIndex={props.graphEdgeGeometryIndex()}
													store={props.store}
												/>
											)}
										</Show>
									}
									keyed
								>
									{(node) => <GraphNodeInspector node={node} store={props.store} />}
								</Show>
							}
							keyed
						>
							{destinationEditor}
						</Show>
					}
					keyed
				>
					{(element) => (
						<>
							<Show when={props.selectedDestination()} keyed>
								{destinationEditor}
							</Show>
							<ElementInspector
								element={element}
								project={props.snapshot().state.project}
								projectAssets={props.snapshot().state.project.assets}
								store={props.store}
							/>
						</>
					)}
				</Show>
				<Problems issues={props.publishIssues} store={props.store} />
			</div>
		</aside>
	);
};
