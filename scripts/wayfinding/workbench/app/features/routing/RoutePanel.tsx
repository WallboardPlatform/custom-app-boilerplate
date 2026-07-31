import {
	CheckCircle2,
	Footprints,
	Info,
	PanelLeftClose,
	Route,
	Trash2,
	TriangleAlert
} from 'lucide-solid';
import { createMemo, For, Show, type Accessor, type JSX } from 'solid-js';

import { selectedFloor } from '../../../../editor-core/selectors';
import type {
	RouteBuildDiagnostic,
	RouteBuildResult
} from '../../../../editor-core/route-builder.mts';
import type { EditorSnapshot, EditorStore, EditorTool } from '../../../../editor-core/types';
import type { CanvasSelectionActions } from '../map';
import { EmptyState, IconButton, PanelNav, PanelResizeHandle, PanelSection } from '../../ui';
import {
	routeToDestination,
	type VisitorRouteProfile
} from './route';
import {
	getRouteReadiness,
	type RouteReadinessItem
} from './route-readiness';
import type { RouteWorkspaceView } from './route-workspace';
import {
	RouteEditView,
	RouteSpaceView
} from './RouteAuthoringViews';
import { RouteBuildView } from './RouteBuildView';

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
	view: Accessor<RouteWorkspaceView>;
	setView: (view: RouteWorkspaceView) => void;
}

const routeViews = [
	{ id: 'space', label: 'Space' },
	{ id: 'build', label: 'Build' },
	{ id: 'edit', label: 'Edit' },
	{ id: 'test', label: 'Test' }
] satisfies Array<{ id: RouteWorkspaceView; label: string }>;

export const RoutePanel = (props: RoutePanelProps): JSX.Element => {
	const view = (): RouteWorkspaceView => props.view();
	const state = createMemo(() => props.snapshot().state);
	const floor = createMemo(() => selectedFloor(state()));
	const floorNodes = createMemo(() => state().project.graph.nodes.filter((node) => node.levelId === floor().id));
	const floorNodeIds = createMemo(() => new Set(floorNodes().map((node) => node.id)));
	const floorEdges = createMemo(() => state().project.graph.edges.filter((edge) =>
		floorNodeIds().has(edge.from) || floorNodeIds().has(edge.to)
	));
	const walkableCount = createMemo(() =>
		floor().elements.filter((element) => element.type === 'walkable').length
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
	const attentionCount = createMemo(() => readiness().blockers.length + readiness().warnings.length);
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
	const revealBuildDiagnostic = (diagnostic: RouteBuildDiagnostic): void => {
		if (!diagnostic.elementId) return;
		props.store.dispatch({ type: 'workspace/set', workspace: 'map' });
		props.store.dispatch({ type: 'panel/toggle', panelId: 'right', collapsed: false });
		props.store.dispatch({
			type: 'selection/set',
			selection: { id: diagnostic.elementId, kind: 'element' }
		});
		const selectionActions = props.selectionActions();

		queueMicrotask(() => selectionActions?.fit());
	};
	const setView = (nextView: RouteWorkspaceView): void => {
		props.setView(nextView);

		if (nextView === 'space' || nextView === 'edit') {
			props.store.dispatch({ type: 'view/set', viewMode: '2d' });
		}
		setTool(nextView === 'build' || nextView === 'test' ? 'pan' : 'select');

		const selection = state().selection;
		const isGraphSelection = selection?.kind === 'graph-edge' || selection?.kind === 'graph-node';
		const isElementSelection = selection?.kind === 'element';

		if (
			(nextView === 'space' && isGraphSelection)
			|| (nextView === 'edit' && isElementSelection)
			|| ((nextView === 'build' || nextView === 'test') && (isGraphSelection || isElementSelection))
		) {
			props.store.dispatch({ type: 'selection/clear' });
		}
	};
	const activateSmartTrace = (): void => {
		props.store.dispatch({
			type: 'trace/patch',
			patch: { elementType: 'walkable' }
		});
		setTool('smart-trace');
	};
	const revealReadinessTarget = (item: RouteReadinessItem): void => {
		if (item.target?.floorId && item.target.floorId !== floor().id) {
			props.store.dispatch({ type: 'floor/select', floorId: item.target.floorId });
		}

		if (item.target?.elementId) {
			const selectionActions = props.selectionActions();

			props.store.dispatch({
				type: 'selection/set',
				selection: { id: item.target.elementId, kind: 'element' }
			});
			queueMicrotask(() => selectionActions?.fit());

			return;
		}

		if (item.target?.destinationId) {
			props.store.dispatch({
				type: 'selection/set',
				selection: { id: item.target.destinationId, kind: 'destination' }
			});
		}
	};
	const goToReadinessAction = (item: RouteReadinessItem): void => {
		switch (item.action) {
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
				revealReadinessTarget(item);
				setTool('door');
				break;

			case 'build-network':
				setView('build');
				break;

			case 'review-routes':
				revealReadinessTarget(item);
				props.store.dispatch({ type: 'workspace/set', workspace: 'preview' });
				break;

			case 'add-destinations': {
				const positionedDestinationIds = new Set(state().project.floors
					.flatMap((candidateFloor) => candidateFloor.elements)
					.filter((element) =>
						(element.type === 'location' || element.type === 'poi')
						&& Boolean(element.destinationId)
					)
					.map((element) => 'destinationId' in element ? element.destinationId : undefined)
					.filter((destinationId): destinationId is string => Boolean(destinationId)));
				const destination = state().project.destinations.find(
					(candidate) => candidate.id === item.target?.destinationId
				) ?? state().project.destinations.find((candidate) =>
					candidate.routeable !== false
					&& candidate.floor === floor().id
					&& !positionedDestinationIds.has(candidate.id)
				) ?? state().project.destinations.find((candidate) =>
					candidate.routeable !== false && !positionedDestinationIds.has(candidate.id)
				);

				props.store.dispatch({ type: 'workspace/set', workspace: 'map' });

				if (destination) {
					props.store.dispatch({
						type: 'selection/set',
						selection: { id: destination.id, kind: 'destination' }
					});
				}
				setTool('location');
				break;
			}
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
						'route-readiness--compact': state().workspace === 'route-edit' && view() !== 'build',
						'route-readiness--not-configured': readiness().status === 'not-configured',
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
										when={readiness().status === 'not-configured'}
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
							<small>Route network</small>
							<strong>{
								readiness().status === 'ready'
									? 'Ready for journey testing'
									: readiness().status === 'not-configured'
										? 'Route network not built'
										: `${attentionCount()} route setup item${attentionCount() === 1 ? '' : 's'} ${attentionCount() === 1 ? 'needs' : 'need'} attention`
							}</strong>
						</span>
					</div>
					<Show when={state().workspace !== 'route-edit' || view() === 'build'}>
						<div class="route-readiness__metrics">
							<span><strong>{readiness().walkableAreas}</strong> spaces</span>
							<span><strong>{readiness().origins}</strong> starts</span>
							<span><strong>{readiness().destinationAnchors}</strong> mapped</span>
							<span><strong>{readiness().connectedDestinations}/{readiness().routeableDestinations}</strong> reachable</span>
						</div>
					</Show>
					<Show when={readiness().status === 'not-configured' && view() === 'build'}>
						<p class="route-readiness__note">
							The map can publish without directions. Build a route network when visitors need turn-by-turn guidance.
						</p>
					</Show>
					<Show when={
						state().workspace === 'route-edit'
						&& view() === 'build'
						&& readiness().warnings.length > 0
					}>
						<div class="route-readiness__issues">
							<For each={readiness().warnings}>
								{(item) => (
									<button
										type="button"
										class="route-readiness__issue"
										onClick={() => goToReadinessAction(item)}
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
						<RouteSpaceView
							activeTool={() => state().activeTool}
							activateSmartTrace={activateSmartTrace}
							obstacleCount={obstacleCount}
							setTool={setTool}
							snapshot={props.snapshot}
							store={props.store}
							walkableCount={walkableCount}
						/>
					</Show>
					<Show when={view() === 'build'}>
						<RouteBuildView
							edgeCount={() => floorEdges().length}
							nodeCount={() => floorNodes().length}
							onBuild={props.onBuildRoutes}
							onOpenDiagnostic={revealBuildDiagnostic}
							onOpenRequirement={goToReadinessAction}
							readiness={readiness}
							report={routeBuildReport}
						/>
					</Show>
					<Show when={view() === 'edit'}>
						<RouteEditView
							activeTool={() => state().activeTool}
							selectionActions={props.selectionActions}
							setTool={setTool}
							snapshot={props.snapshot}
							store={props.store}
						/>
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
