import {
	ImagePlus,
	PanelLeftOpen,
	PanelRightOpen
} from 'lucide-solid';
import {
	createEffect,
	createMemo,
	createSignal,
	lazy,
	onCleanup,
	onMount,
	Show,
	Suspense,
	type JSX
} from 'solid-js';
import {
	validateWayfindingStudioPublish,
	type WayfindingStudioDestination,
	type WayfindingStudioIssue
} from '../../studio-project.mts';
import {
	elementDisplayName,
	selectedElement
} from '../../editor-core/selectors';
import { createEditorStore } from '../../editor-core/store';
import type { EditorStore } from '../../editor-core/types';
import { Canvas2d, type CanvasSelectionActions } from './features/map';
import { AppBar } from './components/AppBar';
import type { StudioCommand } from './components/CommandPalette';
import { FloorNavigator } from './components/FloorNavigator';
import { InspectorPanel } from './components/InspectorPanel';
import { ProjectPanel, type ProjectView } from './components/ProjectPanel';
import { SelectionToolbar } from './components/SelectionToolbar';
import { StageToolbar } from './components/StageToolbar';
import { StatusBar } from './components/StatusBar';
import { ToolRail } from './components/ToolRail';
import { updateProject } from './components/project-edit';
import {
	type ConfirmState,
	type RepairReportState,
	type ToastState,
	WorkbenchOverlays
} from './components/WorkbenchOverlays';
import {
	getThreeDimensionalReadiness,
	VisitorDestinationCard,
	VisitorPanel,
	usePreviewWorkspace
} from './features/preview';
import { downloadPublishedRuntime } from './features/publishing';
import {
	RoutePanel,
	type RouteWorkspaceView,
	useRouteBuildWorkflow
} from './features/routing';
import { issueSelection } from './issues';
import {
	createEditorStateWithPanelPreferences,
	persistPanelWidthPreferences
} from './panel-preferences';
import { useResponsiveWorkspace } from './useResponsiveWorkspace';
import { useProjectLifecycle } from './useProjectLifecycle';
import './styles/app.scss';

const Scene3dView = lazy(async () => {
	const module = await import('./Scene3dView');

	return { default: module.Scene3dView };
});

const App = (): JSX.Element => {
	const store: EditorStore = createEditorStore(createEditorStateWithPanelPreferences());
	const workspaceDensity = useResponsiveWorkspace(store);
	const [snapshot, setSnapshot] = createSignal(store.getSnapshot());
	const [toast, setToast] = createSignal<ToastState>();
	const [confirmState, setConfirmState] = createSignal<ConfirmState>();
	const [confirmResolver, setConfirmResolver] = createSignal<(value: boolean) => void>();
	const [repairReport, setRepairReport] = createSignal<RepairReportState>();
	const [pointer, setPointer] = createSignal<{ x: number; y: number }>();
	const [canvasZoomScale, setCanvasZoomScale] = createSignal<number>();
	const [shortcutsOpen, setShortcutsOpen] = createSignal(false);
	const [commandPaletteOpen, setCommandPaletteOpen] = createSignal(false);
	const [projectView, setProjectView] = createSignal<ProjectView>('content');
	const [exportIssues, setExportIssues] = createSignal<WayfindingStudioIssue[]>([]);
	const [routeWorkspaceView, setRouteWorkspaceView] = createSignal<RouteWorkspaceView>('space');
	const [widePreviewSplit, setWidePreviewSplit] = createSignal(window.innerWidth > 1_480);
	let fitCanvas = (): void => undefined;
	let toastTimer: ReturnType<typeof setTimeout> | undefined;
	let previousWorkspace = store.getSnapshot().state.workspace;

	const state = createMemo(() => snapshot().state);
	const element = createMemo(() => selectedElement(state()));
	const previewWorkspace = usePreviewWorkspace({
		element,
		setRouteWorkspaceView,
		snapshot,
		store
	});
	const preview = previewWorkspace.session;
	const currentFloor = createMemo(() =>
		state().project.floors.find((floor) => floor.id === state().currentFloorId)
		?? state().project.floors[0]
	);
	const threeDimensionalReadiness = createMemo(() =>
		getThreeDimensionalReadiness(state().project, state().currentFloorId)
	);
	const [selectionActions, setSelectionActions] = createSignal<CanvasSelectionActions>();
	const openProjectSetup = (): void => {
		store.dispatch({ type: 'workspace/set', workspace: 'map' });

		if (store.getSnapshot().state.panels.left.collapsed) {
			store.dispatch({ type: 'panel/toggle', panelId: 'left' });
		}
		setProjectView('setup');
	};
	const startFloorPlanUpload = (): void => {
		openProjectSetup();
		queueMicrotask(() =>
			document.querySelector<HTMLInputElement>('#floor-background-input')?.click()
		);
	};
	const canvasIsEmpty = createMemo(() =>
		!currentFloor().backgroundAssetId && currentFloor().elements.length === 0
	);
	const selectedDestination = previewWorkspace.selectedDestination;
	const selectedGraphNode = createMemo(() => {
		const selection = state().selection;

		return selection?.kind === 'graph-node'
			? state().project.graph.nodes.find((candidate) => candidate.id === selection.id)
			: undefined;
	});
	const selectedGraphEdge = createMemo(() => {
		const selection = state().selection;

		return selection?.kind === 'graph-edge'
			? state().project.graph.edges.find((candidate) => candidate.id === selection.id)
			: undefined;
	});
	const selectedGraphEdgeGeometryIndex = createMemo(() => {
		const selection = state().selection;

		return selection?.kind === 'graph-edge' ? selection.geometryIndex : undefined;
	});
	const selectedRouteDestinationId = previewWorkspace.routeDestinationId;
	const inspectorTitle = createMemo(() =>
		element()
			? elementDisplayName(element()!, state().project)
			: selectedDestination()?.name
				?? selectedGraphNode()?.id
				?? selectedGraphEdge()?.id
				?? (
					state().workspace === 'route-edit'
						? 'Route network'
						: state().workspace === 'preview'
							? 'Preview'
							: 'Project overview'
				)
	);
	const publishIssues = createMemo(() => validateWayfindingStudioPublish(state().project));
	const visitorFloors = previewWorkspace.floors;
	const visitorOrigins = previewWorkspace.origins;
	const visitorCategories = previewWorkspace.categories;
	const visibleDestinations = previewWorkspace.visibleDestinations;
	const visitorDetailSide = createMemo<'left' | 'right'>(() =>
		widePreviewSplit() ? 'left' : previewWorkspace.detailSide()
	);
	const visitorRouteJourney = previewWorkspace.routeJourney;
	const visitorRouteUnavailableGuidance = previewWorkspace.routeUnavailableGuidance;
	const repairPreviewRoute = previewWorkspace.repairRoute;
	const clearPreviewDestination = previewWorkspace.clearDestination;
	const selectPreviewDestination = previewWorkspace.selectDestination;
	const selectPreviewDestinationById = previewWorkspace.selectDestinationById;
	const studioCommands = createMemo<StudioCommand[]>(() => [
		{
			group: 'File',
			id: 'new-project',
			keywords: ['create', 'blank'],
			label: 'Create a new project',
			run: (): void => void lifecycle.newProject()
		},
		{
			group: 'File',
			id: 'open-project',
			keywords: ['import', 'file'],
			label: 'Open a project file',
			run: (): void => {
				openProjectSetup();
				void lifecycle.open();
			},
			shortcut: 'Ctrl O'
		},
		{
			group: 'Project',
			id: 'project-settings',
			keywords: ['name', 'file', 'background'],
			label: 'Open project settings',
			run: openProjectSetup
		},
		{
			group: 'Project',
			id: 'manage-floors',
			keywords: ['level', 'background', 'add floor'],
			label: 'Manage floors',
			run: openProjectSetup
		},
		{
			group: 'Workspace',
			id: 'workspace-map',
			keywords: ['objects', 'rooms', 'destinations'],
			label: 'Open map workspace',
			run: (): void => store.dispatch({ type: 'workspace/set', workspace: 'map' }),
			shortcut: '1'
		},
		{
			group: 'Workspace',
			id: 'workspace-route-edit',
			keywords: ['network', 'nodes', 'edges'],
			label: 'Open route editor',
			run: (): void => store.dispatch({ type: 'workspace/set', workspace: 'route-edit' }),
			shortcut: '2'
		},
		{
			group: 'Workspace',
			id: 'workspace-preview',
			keywords: ['simulate', 'directions'],
			label: 'Open Preview',
			run: (): void => store.dispatch({ type: 'workspace/set', workspace: 'preview' }),
			shortcut: '3'
		},
		{
			group: 'View',
			id: 'fit-map',
			label: 'Fit map to canvas',
			run: (): void => fitCanvas(),
			shortcut: 'F'
		},
		{
			group: 'View',
			id: 'view-2d',
			label: 'Switch to 2D editor',
			run: (): void => store.dispatch({ type: 'view/set', viewMode: '2d' })
		},
		...(threeDimensionalReadiness().ready ? [{
			group: 'View',
			id: 'view-3d',
			label: 'Switch to 3D preview',
			run: (): void => store.dispatch({ type: 'view/set', viewMode: '3d' })
		} satisfies StudioCommand] : []),
		{
			group: 'View',
			id: 'toggle-left-panel',
			label: state().panels.left.collapsed ? 'Show left panel' : 'Hide left panel',
			run: (): void => store.dispatch({ type: 'panel/toggle', panelId: 'left' })
		},
		{
			group: 'View',
			id: 'toggle-right-panel',
			label: state().panels.right.collapsed ? 'Show inspector' : 'Hide inspector',
			run: (): void => store.dispatch({ type: 'panel/toggle', panelId: 'right' })
		},
		{
			disabled: !snapshot().canUndo,
			group: 'Edit',
			id: 'undo',
			label: 'Undo last edit',
			run: (): void => store.undo(),
			shortcut: 'Ctrl Z'
		},
		{
			disabled: !snapshot().canRedo,
			group: 'Edit',
			id: 'redo',
			label: 'Redo last edit',
			run: (): void => store.redo(),
			shortcut: 'Ctrl Shift Z'
		},
		{
			group: 'File',
			id: 'save',
			label: 'Save project',
			run: (): void => void lifecycle.save(false),
			shortcut: 'Ctrl S'
		},
		{
			group: 'File',
			id: 'save-as',
			label: 'Save project as',
			run: (): void => void lifecycle.save(true),
			shortcut: 'Ctrl Shift S'
		},
		{
			group: 'File',
			id: 'export-runtime',
			label: 'Publish map',
			run: (): void => exportRuntime()
		},
		{
			group: 'Help',
			id: 'shortcuts',
			label: 'Open Studio help',
			run: (): void => {
				setShortcutsOpen(true);
			},
			shortcut: '?'
		}
	]);
	createEffect(() => {
		const available = state().project.languages ?? [];

		if (available.some((language) => language.code === preview.state().language)) return;
		preview.setLanguage(state().project.defaultLanguage ?? available[0]?.code ?? 'en');
	});
	createEffect(() => {
		const workspace = state().workspace;

		if (workspace === 'preview' && previousWorkspace !== 'preview') {
			setToast(undefined);
			window.requestAnimationFrame(() => fitCanvas());
		}
		previousWorkspace = workspace;
	});
	createEffect(() => {
		const editingRouteGeometry = state().workspace === 'route-edit'
			&& (routeWorkspaceView() === 'space' || routeWorkspaceView() === 'edit');

		if (editingRouteGeometry && state().viewMode === '3d') {
			store.dispatch({ type: 'view/set', viewMode: '2d' });
		}
	});
	createEffect(() => {
		if (preview.state().category && !visitorCategories().includes(preview.state().category)) {
			preview.setCategory('');
		}

		if (preview.state().floorId && !visitorFloors().some((floor) => floor.id === preview.state().floorId)) {
			preview.setFloorId('');
		}

		if (
			preview.state().destinationId
			&& !state().project.destinations.some((destination) => destination.id === preview.state().destinationId)
		) {
			preview.setDestinationId(undefined);
		}

		if (!visitorOrigins().some((origin) => origin.id === preview.state().originId)) {
			preview.setOriginId(visitorOrigins()[0]?.id);
		}
	});
	createEffect(() => {
		if (state().workspace !== 'preview') return;
		const destination = selectedDestination();

		// Floor navigation clears the editor selection. That must not erase an
		// active journey: Preview owns its transient destination independently.
		if (!destination) return;
		preview.setDestinationId(destination.routeable === false ? undefined : destination.id);
	});
	createEffect(() => {
		if (state().viewMode === '3d' && !threeDimensionalReadiness().ready) {
			store.dispatch({ type: 'view/set', viewMode: '2d' });
		}
	});

	const notify = (message: string, tone: ToastState['tone'] = 'info'): void => {
		if (toastTimer) clearTimeout(toastTimer);
		setToast({ message, tone });
		toastTimer = setTimeout(() => setToast(undefined), 4_800);
	};
	const confirm = (next: ConfirmState): Promise<boolean> => new Promise((resolve): void => {
		setConfirmState(next);
		setConfirmResolver(() => resolve);
	});
	const resolveConfirm = (value: boolean): void => {
		confirmResolver()?.(value);
		setConfirmResolver(undefined);
		setConfirmState(undefined);
	};
	const lifecycle = useProjectLifecycle({
		confirm,
		notify,
		onFit: () => fitCanvas(),
		onRepairs: (fileName, repairs) => setRepairReport({ fileName, repairs }),
		snapshot,
		store
	});
	const routeBuild = useRouteBuildWorkflow({
		confirm,
		currentFloorId: () => state().currentFloorId,
		notify,
		project: () => state().project,
		store
	});
	const revealIssue = (issue: WayfindingStudioIssue): void => {
		setExportIssues([]);
		store.dispatch({ type: 'workspace/set', workspace: 'map' });
		store.dispatch({ type: 'panel/toggle', panelId: 'right', collapsed: false });
		const selection = issueSelection(issue, state().project);

		if (selection) store.dispatch({ type: 'selection/set', selection });
	};
	const exportRuntime = (): void => {
		try {
			downloadPublishedRuntime(state().project);
			notify('Published map downloaded.', 'success');
		} catch {
			const issues = publishIssues().filter((issue) => issue.severity === 'error');
			setExportIssues(issues);
			notify(issues.length
				? `Publishing needs ${issues.length} correction${issues.length === 1 ? '' : 's'}.`
				: 'The map could not be published.', 'danger');
			store.dispatch({ type: 'panel/toggle', panelId: 'right', collapsed: false });
		}
	};

	onMount(() => {
		const unsubscribe = store.subscribe(setSnapshot);
		const stopPanelPreferencePersistence = persistPanelWidthPreferences(store);
		const keydown = (event: KeyboardEvent): void => {
			if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 's') {
				event.preventDefault();
				void lifecycle.save(event.shiftKey);
			}

			if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'k') {
				event.preventDefault();
				setCommandPaletteOpen(true);
			}

			if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'z') {
				event.preventDefault();

				if (event.shiftKey) store.redo();
				else store.undo();
			}
		};
		const beforeUnload = (event: BeforeUnloadEvent): void => {
			if (!state().document.dirty) return;
			event.preventDefault();
		};
		const updateWidePreviewSplit = (): void => {
			setWidePreviewSplit(window.innerWidth > 1_480);
		};
		window.addEventListener('keydown', keydown);
		window.addEventListener('beforeunload', beforeUnload);
		window.addEventListener('resize', updateWidePreviewSplit);
		onCleanup(() => {
			unsubscribe();
			stopPanelPreferencePersistence();
			window.removeEventListener('keydown', keydown);
			window.removeEventListener('beforeunload', beforeUnload);
			window.removeEventListener('resize', updateWidePreviewSplit);
		});
	});

	onCleanup(() => {
		if (toastTimer) clearTimeout(toastTimer);
	});

	const patchDestination = (destination: WayfindingStudioDestination, patch: Partial<WayfindingStudioDestination>): void => {
		updateProject(store, snapshot(), 'Update destination', (project): void => {
			const index = project.destinations.findIndex((candidate) => candidate.id === destination.id);

			if (index >= 0) project.destinations[index] = { ...project.destinations[index], ...patch };
		});
	};

	return (
		<div
			class="workbench"
			style={{
				'--panel-width-left': `${state().panels.left.width}px`,
				'--panel-width-right': `${state().panels.right.width}px`
			}}
			classList={{
				'compact-layout': workspaceDensity() === 'compact',
				'has-selection': Boolean(state().selection),
				'left-collapsed': state().panels.left.collapsed,
				'narrow-layout': workspaceDensity() === 'narrow',
				'preview-destination-open': state().workspace === 'preview' && Boolean(selectedDestination()),
				'preview-route-active': state().workspace === 'preview'
					&& Boolean(selectedDestination())
					&& selectedRouteDestinationId() === selectedDestination()?.id,
				'preview-detail-left': state().workspace === 'preview'
					&& Boolean(selectedDestination())
					&& visitorDetailSide() === 'left',
				'preview-detail-right': state().workspace === 'preview'
					&& Boolean(selectedDestination())
					&& visitorDetailSide() === 'right',
				'right-collapsed': state().panels.right.collapsed,
				'preview-workspace': state().workspace === 'preview'
			}}
		>
			<AppBar
				onExportRuntime={exportRuntime}
				onOpenCommands={() => setCommandPaletteOpen(true)}
				onOpenProject={openProjectSetup}
				onSave={(forceSaveAs) => void lifecycle.save(forceSaveAs)}
				snapshot={snapshot}
				store={store}
			/>

			<div class="work-area">
				<Show when={state().workspace !== 'preview'}>
					<Show
						when={state().workspace === 'map'}
						fallback={
							<RoutePanel
								onBuildRoutes={() => void routeBuild.buildRoutes()}
								routeBuildReport={routeBuild.report}
								routeOriginId={() => preview.state().originId}
								routeProfile={() => preview.state().profile}
								setRouteOriginId={preview.setOriginId}
								setRouteProfile={preview.setProfile}
								selectionActions={selectionActions}
								snapshot={snapshot}
								store={store}
								view={routeWorkspaceView}
								setView={setRouteWorkspaceView}
							/>
						}
					>
						<ProjectPanel
							onDeleteFloor={(floorId, floorName) => void lifecycle.deleteFloor(floorId, floorName)}
							onNew={() => void lifecycle.newProject()}
							onNotify={notify}
							onOpen={() => void lifecycle.open()}
							onOpenFile={(file) => void lifecycle.openFile(file)}
							selectionActions={selectionActions}
							snapshot={snapshot}
							store={store}
							view={projectView}
							setView={setProjectView}
						/>
					</Show>

					<Show when={state().panels.left.collapsed}>
						<button
							type="button"
							class="panel-reopen left"
							aria-label="Open project panel"
							onClick={() => store.dispatch({ type: 'panel/toggle', panelId: 'left' })}
						><PanelLeftOpen size={18} /></button>
					</Show>
				</Show>

				<main class="stage">
					<ToolRail
						routeWorkspaceView={routeWorkspaceView}
						snapshot={snapshot}
						store={store}
					/>
					<StageToolbar
						onFit={() => fitCanvas()}
						snapshot={snapshot}
						store={store}
						threeDimensionalReason={() =>
							state().workspace === 'route-edit'
							&& (routeWorkspaceView() === 'space' || routeWorkspaceView() === 'edit')
								? '3D is available in Build and Test. Pedestrian-space and network geometry are edited precisely in 2D.'
								: threeDimensionalReadiness().reasons[0]
						}
						threeDimensionalReady={() =>
							threeDimensionalReadiness().ready
							&& !(
								state().workspace === 'route-edit'
								&& (routeWorkspaceView() === 'space' || routeWorkspaceView() === 'edit')
							)
						}
					/>
					<FloorNavigator snapshot={snapshot} store={store} />
					<Show when={state().workspace !== 'preview' && state().viewMode === '2d'}>
						<SelectionToolbar
							actions={selectionActions}
							label={inspectorTitle}
							snapshot={snapshot}
						/>
					</Show>
					<Show
						when={state().viewMode === '2d'}
						fallback={(
							<Suspense fallback={<div class="scene-loading">Loading 3D view...</div>}>
								<Scene3dView
									registerFit={(fit) => {
										fitCanvas = fit;
									}}
									routeDestinationId={selectedRouteDestinationId}
									routeOriginId={() => preview.state().originId}
									routeProfile={() => preview.state().profile}
									snapshot={snapshot}
									store={store}
									visitorLanguage={() => preview.state().language}
								/>
							</Suspense>
						)}
					>
						<Canvas2d
							onCameraScaleChange={setCanvasZoomScale}
							onNotify={notify}
							onPreviewDestinationSelect={selectPreviewDestinationById}
							previewDetailSide={visitorDetailSide}
							registerFit={(fit) => {
								fitCanvas = fit;
							}}
							registerSelectionActions={setSelectionActions}
							routeDestinationId={selectedRouteDestinationId}
							routeOriginId={() => preview.state().originId}
							routeProfile={() => preview.state().profile}
							routeWorkspaceView={routeWorkspaceView}
							snapshot={snapshot}
							store={store}
							visitorDestinations={visibleDestinations}
							visitorLanguage={() => preview.state().language}
							showRouteNetwork={() => preview.state().diagnosticLayers.routeNetwork}
							onPointerCoordinate={setPointer}
						/>
						<Show when={canvasIsEmpty() && state().workspace === 'map'}>
							<div class="canvas-empty-state">
								<div class="empty-state-icon"><ImagePlus size={24} /></div>
								<strong>Add a floor plan</strong>
								<span>Start with a map image, then trace destinations and pedestrian space.</span>
								<button
									type="button"
									class="wb-studio-action primary"
									onClick={startFloorPlanUpload}
								>
									<ImagePlus size={16} /> Choose image
								</button>
							</div>
						</Show>
					</Show>
					<Show when={state().workspace === 'preview'}>
						<VisitorPanel
							assets={() => state().project.assets}
							categories={visitorCategories}
							category={() => preview.state().category}
							destinations={visibleDestinations}
							floorFilter={() => preview.state().floorId}
							floors={visitorFloors}
							language={() => preview.state().language}
							languages={() => state().project.languages ?? []}
							layerVisible={(layerId) => state().layerVisibility[layerId]}
							onClearDestination={clearPreviewDestination}
							onSelectDestination={selectPreviewDestination}
							query={() => preview.state().query}
							routeOriginId={() => preview.state().originId}
							routeOrigins={visitorOrigins}
							routeProfile={() => preview.state().profile}
							selected={selectedDestination}
							setCategory={preview.setCategory}
							setFloorFilter={(floorId) => {
								preview.setFloorId(floorId);

								if (floorId) store.dispatch({ type: 'floor/select', floorId });
							}}
							setLanguage={preview.setLanguage}
							setQuery={preview.setQuery}
							setRouteOriginId={preview.setOriginId}
							setRouteProfile={preview.setProfile}
							simulationOpen={() => preview.state().simulationOpen}
							setSimulationOpen={preview.setSimulationOpen}
							showRouteNetwork={() => preview.state().diagnosticLayers.routeNetwork}
							setShowRouteNetwork={(visible) => preview.setDiagnosticLayer('routeNetwork', visible)}
							store={store}
						/>
						<VisitorDestinationCard
							assets={() => state().project.assets}
							floors={visitorFloors}
							language={() => preview.state().language}
							onRepairRoute={repairPreviewRoute}
							routeDestinationId={() => preview.state().destinationId}
							routeJourney={visitorRouteJourney}
							routeUnavailableGuidance={visitorRouteUnavailableGuidance}
							selected={selectedDestination}
							side={visitorDetailSide}
							setFloorFilter={(floorId) => {
								preview.setFloorId(floorId);
								store.dispatch({ type: 'floor/select', floorId });
							}}
							setRouteDestinationId={preview.setDestinationId}
							store={store}
						/>
					</Show>
					<Show when={state().workspace !== 'preview'}>
						<div class="coordinate-readout">
							{pointer() ? `x ${Math.round(pointer()!.x)}  y ${Math.round(pointer()!.y)}` : 'x --  y --'}
						</div>
					</Show>
				</main>

				<Show when={state().workspace !== 'preview'}>
					<Show when={state().panels.right.collapsed}>
						<button
							type="button"
							class="panel-reopen right"
							aria-label="Open inspector panel"
							onClick={() => store.dispatch({ type: 'panel/toggle', panelId: 'right' })}
						><PanelRightOpen size={18} /></button>
					</Show>

					<InspectorPanel
						publishIssues={publishIssues}
						element={element}
						elementName={inspectorTitle}
						graphEdge={selectedGraphEdge}
						graphEdgeGeometryIndex={selectedGraphEdgeGeometryIndex}
						graphNode={selectedGraphNode}
						onPatchDestination={patchDestination}
						selectedDestination={selectedDestination}
						snapshot={snapshot}
						store={store}
					/>
				</Show>
			</div>

			<StatusBar
				onShowShortcuts={() => setShortcutsOpen(true)}
				snapshot={snapshot}
				zoomScale={canvasZoomScale}
			/>

			<WorkbenchOverlays
				commandPaletteOpen={commandPaletteOpen}
				commands={studioCommands}
				confirmState={confirmState}
				exportIssues={exportIssues}
				onCloseCommandPalette={() => setCommandPaletteOpen(false)}
				onCloseExportIssues={() => setExportIssues([])}
				onCloseRepairReport={() => setRepairReport(undefined)}
				onCloseShortcuts={() => setShortcutsOpen(false)}
				onDiscardRecovery={lifecycle.discardRecovery}
				onDismissToast={() => setToast(undefined)}
				onResolveConfirm={resolveConfirm}
				onRestoreRecovery={lifecycle.restoreRecovery}
				onRevealIssue={revealIssue}
				recoveryProject={lifecycle.recoveryProject}
				repairReport={repairReport}
				shortcutsOpen={shortcutsOpen}
				toast={toast}
			/>
		</div>
	);
};

export default App;
