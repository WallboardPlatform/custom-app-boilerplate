import {
	CheckCircle2,
	Footprints,
	Info,
	MousePointer2,
	Network,
	PanelLeftClose,
	PenLine,
	RefreshCw,
	Route,
	Trash2,
	TriangleAlert,
	WandSparkles,
	Waypoints
} from 'lucide-solid';
import { createMemo, createSignal, For, Show, type Accessor, type JSX } from 'solid-js';

import { selectedFloor } from '../../../editor-core/selectors';
import type { RouteBuildResult } from '../../../editor-core/route-builder.mts';
import type { EditorSnapshot, EditorStore, EditorTool } from '../../../editor-core/types';
import {
	routeToDestination,
	type VisitorRouteProfile
} from '../route';
import {
	getRouteReadiness,
	type RouteReadinessAction
} from '../route-readiness';
import type { CanvasSelectionActions } from '../features/map';
import { EmptyState, IconButton, PanelNav, PanelResizeHandle, PanelSection } from '../ui';
import { FreehandSettings } from './FreehandSettings';
import { SmartTraceSettings } from './SmartTraceSettings';
import { RouteGraphNavigator } from './RouteGraphNavigator';

interface RoutePanelProps {
	onBuildRoutes: () => void;
	routeBuildReport: Accessor<RouteBuildResult | undefined>;
	routeOriginId: Accessor<string | undefined>;
	routeProfile: Accessor<VisitorRouteProfile>;
	selectionActions: Accessor<CanvasSelectionActions | undefined>;
	setRouteOriginId: (originId: string | undefined) => void;
	setRouteProfile: (profile: VisitorRouteProfile) => void;
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

type RouteView = 'build' | 'edit' | 'space' | 'test';

const routeViews = [
	{ id: 'space', label: 'Space' },
	{ id: 'build', label: 'Build' },
	{ id: 'edit', label: 'Edit' },
	{ id: 'test', label: 'Test' }
] satisfies Array<{ id: RouteView; label: string }>;

export const RoutePanel = (props: RoutePanelProps): JSX.Element => {
	const [view, setView] = createSignal<RouteView>('space');
	const state = createMemo(() => props.snapshot().state);
	const floor = createMemo(() => selectedFloor(state()));
	const floorNodes = createMemo(() => state().project.graph.nodes.filter((node) => node.levelId === floor().id));
	const floorNodeIds = createMemo(() => new Set(floorNodes().map((node) => node.id)));
	const floorEdges = createMemo(() => state().project.graph.edges.filter((edge) =>
		floorNodeIds().has(edge.from) || floorNodeIds().has(edge.to)
	));
	const usesPaintedMask = createMemo(() =>
		floor().pedestrianSpaceSource === 'mask'
		&& Boolean(floor().walkableMask?.walkableRuns.length)
	);
	const walkableCount = createMemo(() =>
		floor().elements.filter((element) => element.type === 'walkable').length
		|| (usesPaintedMask() ? 1 : 0)
	);
	const obstacleCount = createMemo(() => floor().elements.filter((element) => element.type === 'obstacle').length);
	const originCount = createMemo(() => floor().elements.filter((element) => element.type === 'origin').length);
	const origins = createMemo(() => state().project.floors.flatMap((candidateFloor) =>
		candidateFloor.elements
			.filter((element) => element.type === 'origin')
			.map((origin) => ({
				floorName: candidateFloor.name,
				id: origin.id,
				label: origin.label || origin.screenId || origin.id
			}))
	));
	const routeBuildReport = createMemo(() => props.routeBuildReport());
	const readiness = createMemo(() => getRouteReadiness(state().project, floor().id));
	const guidanceLabel = createMemo(() => ({
		directional: 'Directional guidance',
		directory: 'Directory guidance',
		highlight: 'Highlight guidance',
		route: 'Route guidance'
	})[readiness().mode]);
	const selectedDestinationId = createMemo(() => {
		const selection = state().selection;

		if (selection?.kind === 'destination') return selection.id;

		if (selection?.kind !== 'element') return undefined;
		const element = floor().elements.find((candidate) => candidate.id === selection.id);

		return element && 'destinationId' in element ? element.destinationId : undefined;
	});
	const route = createMemo(() => routeToDestination(
		state().project,
		selectedDestinationId(),
		props.routeProfile(),
		props.routeOriginId()
	));
	const setTool = (tool: EditorTool): void => props.store.dispatch({ type: 'tool/set', tool });
	const goToReadinessAction = (action: RouteReadinessAction): void => {
		switch (action) {
			case 'define-space':
				setView('space');
				setTool('walkable');
				break;

			case 'add-origin':
				props.store.dispatch({ type: 'workspace/set', workspace: 'map' });
				setTool('origin');
				break;

			case 'add-entrances':
				props.store.dispatch({ type: 'workspace/set', workspace: 'map' });
				setTool('door');
				break;

			case 'build-network':
				setView('build');
				break;

			case 'review-routes':
				setView('test');
				break;

			case 'add-destinations':
				props.store.dispatch({ type: 'workspace/set', workspace: 'map' });
				setTool('location');
				break;
		}
	};
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
			<PanelResizeHandle
				panelId="left"
				store={props.store}
				width={() => state().panels.left.width}
			/>
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
			<Show when={state().workspace === 'route-edit'}>
				<PanelNav
					active={view}
					label="Route workflow"
					onChange={setView}
					options={routeViews}
				/>
			</Show>
			<div class="panel-scroll">
				<div
					class="route-readiness"
					classList={{
						'route-readiness--highlight': readiness().status === 'highlight-ready',
						'route-readiness--ready': readiness().status === 'ready',
						'route-readiness--warning': readiness().status === 'needs-work'
					}}
				>
					<div class="route-readiness__heading">
						<span class="route-readiness__icon">
							<Show
								when={readiness().status === 'ready'}
								fallback={
									<Show
										when={readiness().status === 'highlight-ready'}
										fallback={<TriangleAlert size={18} />}
									>
										<Info size={18} />
									</Show>
								}
							>
								<CheckCircle2 size={18} />
							</Show>
						</span>
						<span>
							<small>{guidanceLabel()}</small>
							<strong>{
								readiness().status === 'ready'
									? 'Ready for journey testing'
									: readiness().status === 'highlight-ready'
										? 'Routing is optional for this map'
										: `${readiness().blockers.length + readiness().warnings.length} item${readiness().blockers.length + readiness().warnings.length === 1 ? '' : 's'} need attention`
							}</strong>
						</span>
					</div>
					<div class="route-readiness__metrics">
						<span><strong>{readiness().walkableAreas}</strong> spaces</span>
						<span><strong>{readiness().origins}</strong> starts</span>
						<span><strong>{readiness().destinationAnchors}</strong> positions</span>
						<span><strong>{readiness().connectedDestinations}/{readiness().routeableDestinations}</strong> reachable</span>
					</div>
					<Show when={readiness().status === 'highlight-ready'}>
						<p class="route-readiness__note">
							This project can publish its selected guidance without a route graph. Build routes only when the customer needs turn-by-turn guidance.
						</p>
					</Show>
					<Show when={readiness().blockers.length || readiness().warnings.length}>
						<div class="route-readiness__issues">
							<For each={[...readiness().blockers, ...readiness().warnings]}>
								{(item) => (
									<button
										type="button"
										class="route-readiness__issue"
										onClick={() => goToReadinessAction(item.action)}
									>
										<span>
											<strong>{item.title}</strong>
											<small>{item.body}</small>
										</span>
										<span aria-hidden="true">Open</span>
									</button>
								)}
							</For>
						</div>
					</Show>
				</div>
				<Show
					when={state().workspace === 'route-edit'}
					fallback={
						<>
							<PanelSection title="Test a journey" eyebrow="Simulation" defaultOpen>
								<label class="field">
									<span>Start</span>
									<select
										value={props.routeOriginId() ?? ''}
										onChange={(event) => props.setRouteOriginId(event.currentTarget.value || undefined)}
									>
										<option value="">Choose a You are here point</option>
										<For each={origins()}>
											{(origin) => (
												<option value={origin.id}>{origin.label} - {origin.floorName}</option>
											)}
										</For>
									</select>
								</label>
								<label class="field">
									<span>Destination</span>
									<select
										value={selectedDestinationId() ?? ''}
										onChange={(event) => selectDestination(event.currentTarget.value)}
									>
										<option value="">Choose a destination</option>
										<For each={state().project.destinations.filter((destination) =>
											destination.routeable !== false
										)}>
											{(destination) => (
												<option value={destination.id}>{
													destination.name
												} - {
													state().project.floors.find((candidate) => candidate.id === destination.floor)?.name
													?? destination.floor
													?? 'No floor'
												}</option>
											)}
										</For>
									</select>
								</label>
								<div class="route-profile-picker" role="group" aria-label="Route preference">
									<button
										type="button"
										classList={{ active: props.routeProfile() === 'standard' }}
										aria-pressed={props.routeProfile() === 'standard'}
										onClick={() => props.setRouteProfile('standard')}
									>
										Standard
									</button>
									<button
										type="button"
										classList={{ active: props.routeProfile() === 'step-free' }}
										aria-pressed={props.routeProfile() === 'step-free'}
										onClick={() => props.setRouteProfile('step-free')}
									>
										<Footprints size={14} /> Step-free
									</button>
								</div>
								<div class="route-summary">
									<span><strong>{originCount()}</strong> start point{originCount() === 1 ? '' : 's'}</span>
									<span><strong>{floorEdges().length}</strong> segments</span>
									<span><strong>{route().length}</strong> route points</span>
								</div>
								<Show
									when={props.routeOriginId() && selectedDestinationId()}
									fallback={<EmptyState title="Choose both endpoints" body="Select the installed screen and destination you want to test." />}
								>
									<button
										type="button"
										class="wb-studio-action full"
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
					<Show when={view() === 'space'}>
						<div class="workflow-intro">
							<small>Step 1</small>
							<strong>Define pedestrian space</strong>
							<p>Choose one method for the current floor. Routes stay inside walkable space and outside blocked areas.</p>
						</div>
						<div class="route-summary">
							<span><strong>{walkableCount()}</strong> {usesPaintedMask() ? 'painted mask' : 'walkable'}</span>
							<span><strong>{obstacleCount()}</strong> blocked</span>
						</div>
						<Show when={usesPaintedMask()}>
							<div class="route-tip">
								<Info size={17} />
								<span>
									This imported project uses a painted pedestrian mask. It remains routeable; drawing or detecting a new area switches the floor to editable vector space.
								</span>
							</div>
						</Show>
						<div class="route-task-grid route-task-grid--single-choice">
							<ToolButton
								active={state().activeTool === 'smart-trace'}
								icon={WandSparkles}
								label="Detect from image"
								onClick={() => setTool('smart-trace')}
							/>
							<ToolButton
								active={state().activeTool === 'freehand'}
								icon={PenLine}
								label="Paint freehand"
								onClick={() => setTool('freehand')}
							/>
							<ToolButton
								active={state().activeTool === 'walkable'}
								icon={Footprints}
								label="Draw polygon"
								onClick={() => setTool('walkable')}
							/>
							<ToolButton
								active={state().activeTool === 'obstacle'}
								icon={Trash2}
								label="Exclude area"
								onClick={() => setTool('obstacle')}
							/>
						</div>
						<Show when={state().activeTool === 'smart-trace'}>
							<div class="route-subpanel">
								<SmartTraceSettings
									allowedTypes={['walkable', 'obstacle']}
									snapshot={props.snapshot}
									store={props.store}
								/>
							</div>
						</Show>
						<Show when={state().activeTool === 'freehand'}>
							<div class="route-subpanel">
								<FreehandSettings snapshot={props.snapshot} store={props.store} />
							</div>
						</Show>
					</Show>
					<Show when={view() === 'build'}>
						<div class="workflow-intro">
							<small>Step 2</small>
							<strong>Generate the first network</strong>
							<p>The builder connects linked doors through reviewed pedestrian space. Reviewed and hand-authored corrections are preserved.</p>
						</div>
						<div class="route-summary route-summary--large">
							<span><strong>{floorNodes().length}</strong> nodes</span>
							<span><strong>{floorEdges().length}</strong> segments</span>
						</div>
						<button
							type="button"
							class="wb-studio-action primary full"
							disabled={
								readiness().walkableAreas === 0
								|| readiness().origins === 0
								|| readiness().destinationAnchors === 0
							}
							onClick={() => props.onBuildRoutes()}
						>
							<RefreshCw size={16} />
							{floorEdges().length ? 'Rebuild route network' : 'Build route network'}
						</button>
						<Show when={
							readiness().walkableAreas === 0
							|| readiness().origins === 0
							|| readiness().destinationAnchors === 0
						}>
							<p class="field-hint">
								Complete the missing prerequisites above before generating routes.
							</p>
						</Show>
						<div class="route-tip">
							<Network size={17} />
							<span>Generation is a starting point. Review every destination route in Test before publishing.</span>
						</div>
						<Show when={routeBuildReport()}>
							{(report) => (
								<div class="route-build-report" classList={{ warning: report().diagnostics.length > 0 }}>
									<div class="route-build-report__summary">
										<strong>{report().connectedSemanticNodes}/{report().totalSemanticNodes}</strong>
										<span>destination anchors connected</span>
									</div>
									<dl class="route-build-report__diff">
										<div>
											<dt>Generated</dt>
											<dd>{report().diff.generatedEdgesAfter} segments</dd>
										</div>
										<div>
											<dt>Preserved</dt>
											<dd>{report().diff.manualEdgesPreserved} manual</dd>
										</div>
									</dl>
									<Show
										when={report().diagnostics.length > 0}
										fallback={<p>Every authored entrance and start point reached the generated network.</p>}
									>
										<ul>
											<For each={report().diagnostics}>
												{(diagnostic) => <li>{diagnostic.message}</li>}
											</For>
										</ul>
										<button type="button" class="wb-studio-action full" onClick={() => setView('edit')}>
											Review flagged connectors
										</button>
									</Show>
								</div>
							)}
						</Show>
					</Show>
					<Show when={view() === 'edit'}>
						<div class="workflow-intro">
							<small>Step 3</small>
							<strong>Correct the network directly</strong>
							<p>Move junctions, reshape segments, insert bends, or draw missing connections on the map.</p>
						</div>
						<div class="route-task-grid">
							<ToolButton
								active={state().activeTool === 'select'}
								icon={MousePointer2}
								label="Select and reshape"
								onClick={() => setTool('select')}
							/>
							<ToolButton
								active={state().activeTool === 'route-node'}
								icon={Waypoints}
								label="Place junction"
								onClick={() => setTool('route-node')}
							/>
							<ToolButton
								active={state().activeTool === 'route-edge'}
								icon={PenLine}
								label="Draw connection"
								onClick={() => setTool('route-edge')}
							/>
						</div>
						<div class="route-tip">
							<Network size={17} />
							<span><strong>Segment editing:</strong> double-click to add a bend. Select a bend and press Delete to remove it.</span>
						</div>
						<PanelSection title="Network navigator" eyebrow="Inspect and correct" defaultOpen>
							<RouteGraphNavigator
								selectionActions={props.selectionActions}
								snapshot={props.snapshot}
								store={props.store}
							/>
						</PanelSection>
					</Show>
					<Show when={view() === 'test'}>
						<div class="workflow-intro">
							<small>Step 4</small>
							<strong>Test as a visitor</strong>
							<p>Preview the final route without authoring handles and inspect every routeable destination.</p>
						</div>
						<button
							type="button"
							class="wb-studio-action primary full"
							onClick={() => props.store.dispatch({ type: 'workspace/set', workspace: 'preview' })}
						>
							<Route size={16} /> Open Preview
						</button>
					</Show>
				</Show>
			</div>
		</aside>
	);
};
