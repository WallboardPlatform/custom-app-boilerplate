import {
	Footprints,
	MousePointer2,
	Network,
	PanelLeftClose,
	PenLine,
	RefreshCw,
	Route,
	Trash2,
	Waypoints
} from 'lucide-solid';
import { createMemo, For, Show, type Accessor, type JSX } from 'solid-js';

import { selectedFloor } from '../../../editor-core/selectors';
import type { EditorSnapshot, EditorStore, EditorTool } from '../../../editor-core/types';
import { routeToDestination } from '../route';
import { EmptyState, IconButton, PanelSection } from '../ui';

interface RoutePanelProps {
	onBuildRoutes: () => void;
	snapshot: Accessor<EditorSnapshot>;
	store: EditorStore;
}

const ToolButton = (props: {
	active: boolean;
	icon: typeof MousePointer2;
	label: string;
	onClick: () => void;
}): JSX.Element => (
	<button
		type="button"
		class="route-task"
		classList={{ active: props.active }}
		onClick={() => props.onClick()}
	>
		<props.icon size={17} />
		<span>{props.label}</span>
	</button>
);

export const RoutePanel = (props: RoutePanelProps): JSX.Element => {
	const state = createMemo(() => props.snapshot().state);
	const floor = createMemo(() => selectedFloor(state()));
	const floorNodes = createMemo(() => state().project.graph.nodes.filter((node) => node.levelId === floor().id));
	const floorNodeIds = createMemo(() => new Set(floorNodes().map((node) => node.id)));
	const floorEdges = createMemo(() => state().project.graph.edges.filter((edge) =>
		floorNodeIds().has(edge.from) || floorNodeIds().has(edge.to)
	));
	const walkableCount = createMemo(() => floor().elements.filter((element) => element.type === 'walkable').length);
	const obstacleCount = createMemo(() => floor().elements.filter((element) => element.type === 'obstacle').length);
	const originCount = createMemo(() => floor().elements.filter((element) => element.type === 'origin').length);
	const selectedDestinationId = createMemo(() => {
		const selection = state().selection;

		if (selection?.kind === 'destination') return selection.id;

		if (selection?.kind !== 'element') return undefined;
		const element = floor().elements.find((candidate) => candidate.id === selection.id);

		return element && 'destinationId' in element ? element.destinationId : undefined;
	});
	const route = createMemo(() => routeToDestination(state().project, selectedDestinationId()));
	const setTool = (tool: EditorTool): void => props.store.dispatch({ type: 'tool/set', tool });
	const selectDestination = (destinationId: string): void => {
		if (!destinationId) {
			props.store.dispatch({ type: 'selection/clear' });

			return;
		}
		props.store.dispatch({
			type: 'selection/set',
			selection: { id: destinationId, kind: 'destination' }
		});
	};

	return (
		<aside class="left-panel panel-shell route-panel">
			<div class="panel-title">
				<span>
					<small>{state().workspace === 'route-edit' ? 'Route workspace' : 'Route test'}</small>
					<strong>{floor().name}</strong>
				</span>
				<IconButton
					icon={PanelLeftClose}
					label="Close route panel"
					onClick={() => props.store.dispatch({ type: 'panel/toggle', panelId: 'left' })}
				/>
			</div>
			<div class="panel-scroll">
				<Show
					when={state().workspace === 'route-edit'}
					fallback={
						<>
							<PanelSection title="Test a journey" eyebrow="Simulation" defaultOpen>
								<label class="field">
									<span>Destination</span>
									<select
										value={selectedDestinationId() ?? ''}
										onChange={(event) => selectDestination(event.currentTarget.value)}
									>
										<option value="">Choose a destination</option>
										<For each={state().project.destinations.filter((destination) =>
											destination.floor === floor().id && destination.routeable !== false
										)}>
											{(destination) => <option value={destination.id}>{destination.name}</option>}
										</For>
									</select>
								</label>
								<div class="route-summary">
									<span><strong>{originCount()}</strong> start point{originCount() === 1 ? '' : 's'}</span>
									<span><strong>{floorEdges().length}</strong> segments</span>
									<span><strong>{route().length}</strong> route points</span>
								</div>
								<Show
									when={selectedDestinationId()}
									fallback={<EmptyState title="Choose a destination" body="The route will be calculated from the first You are here point on this floor." />}
								>
									<button
										type="button"
										class="button full"
										onClick={() => props.store.dispatch({ type: 'selection/clear' })}
									>
										<Trash2 size={16} /> Clear preview
									</button>
								</Show>
							</PanelSection>
							<PanelSection title="Presentation" eyebrow="Preview">
								<label class="setting-row">
									<span>
										<strong>Route network</strong>
										<small>Show the authored graph behind the visitor route.</small>
									</span>
									<input
										type="checkbox"
										checked={state().layerVisibility['route-network']}
										onChange={(event) => props.store.dispatch({
											type: 'layer/set',
											layerId: 'route-network',
											visible: event.currentTarget.checked
										})}
									/>
								</label>
							</PanelSection>
						</>
					}
				>
					<PanelSection title="Pedestrian space" eyebrow="1. Define" defaultOpen>
						<p class="panel-copy">Routes are generated only inside walkable areas and never through blocked areas.</p>
						<div class="route-summary">
							<span><strong>{walkableCount()}</strong> walkable</span>
							<span><strong>{obstacleCount()}</strong> blocked</span>
						</div>
						<div class="route-task-grid">
							<ToolButton
								active={state().activeTool === 'walkable'}
								icon={Footprints}
								label="Draw walkable area"
								onClick={() => setTool('walkable')}
							/>
							<ToolButton
								active={state().activeTool === 'obstacle'}
								icon={Trash2}
								label="Draw blocked area"
								onClick={() => setTool('obstacle')}
							/>
						</div>
					</PanelSection>
					<PanelSection title="Build network" eyebrow="2. Generate" defaultOpen>
						<div class="route-summary">
							<span><strong>{floorNodes().length}</strong> nodes</span>
							<span><strong>{floorEdges().length}</strong> segments</span>
						</div>
						<button type="button" class="button primary full" onClick={() => props.onBuildRoutes()}>
							<RefreshCw size={16} />
							{floorEdges().length ? 'Rebuild route network' : 'Build route network'}
						</button>
						<p class="control-hint">Generation replaces this floor's editable route graph. A confirmation appears when existing work would be overwritten.</p>
					</PanelSection>
					<PanelSection title="Manual adjustments" eyebrow="3. Refine" defaultOpen>
						<p class="panel-copy">Select and drag route geometry, insert points with a double-click, or add missing connections.</p>
						<div class="route-task-grid">
							<ToolButton
								active={state().activeTool === 'select'}
								icon={MousePointer2}
								label="Edit network"
								onClick={() => setTool('select')}
							/>
							<ToolButton
								active={state().activeTool === 'route-node'}
								icon={Waypoints}
								label="Place endpoint"
								onClick={() => setTool('route-node')}
							/>
							<ToolButton
								active={state().activeTool === 'route-edge'}
								icon={PenLine}
								label="Draw segment"
								onClick={() => setTool('route-edge')}
							/>
						</div>
						<div class="route-tip">
							<Network size={17} />
							<span><strong>Direct editing:</strong> double-click a segment to insert a bend. Select a bend and press Delete to remove it.</span>
						</div>
					</PanelSection>
					<PanelSection title="Test the result" eyebrow="4. Verify">
						<button
							type="button"
							class="button full"
							onClick={() => props.store.dispatch({ type: 'workspace/set', workspace: 'route-preview' })}
						>
							<Route size={16} /> Open route preview
						</button>
					</PanelSection>
				</Show>
			</div>
		</aside>
	);
};
