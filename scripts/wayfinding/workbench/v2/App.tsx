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
	validateWayfindingStudioDelivery,
	validateWayfindingStudioProject,
	type WayfindingStudioDestination,
	type WayfindingStudioIssue
} from '../../studio-project.mts';
import {
	buildFloorRouteNetwork,
	type RouteBuildResult
} from '../../editor-core/route-builder.mts';
import {
	elementDisplayName,
	selectedElement
} from '../../editor-core/selectors';
import { createEditorStore } from '../../editor-core/store';
import type { EditorStore } from '../../editor-core/types';
import { Canvas2d, type CanvasSelectionActions } from './features/map';
import { AppBar } from './components/AppBar';
import type { StudioCommand } from './components/CommandPalette';
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
	createPreviewSession
} from './features/preview';
import { downloadPublishedRuntime } from './features/publishing';
import {
	RoutePanel,
	routeJourneyToDestination
} from './features/routing';
import {
	filterVisitorDestinations,
	visitorCategoryOptions,
	visitorFloorOptions
} from './visitor';
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
	const [shortcutsOpen, setShortcutsOpen] = createSignal(false);
	const [commandPaletteOpen, setCommandPaletteOpen] = createSignal(false);
	const [projectView, setProjectView] = createSignal<ProjectView>('content');
	const [exportIssues, setExportIssues] = createSignal<WayfindingStudioIssue[]>([]);
	const [routeBuildReport, setRouteBuildReport] = createSignal<RouteBuildResult>();
	const preview = createPreviewSession(
		store.getSnapshot().state.project.defaultLanguage ?? 'en'
	);
	let fitCanvas = (): void => undefined;
	let toastTimer: ReturnType<typeof setTimeout> | undefined;
	let previousWorkspace = store.getSnapshot().state.workspace;

	const state = createMemo(() => snapshot().state);
	const element = createMemo(() => selectedElement(state()));
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
	const selectedDestination = createMemo(() => {
		const selection = state().selection;

		if (selection?.kind === 'destination') {
			return state().project.destinations.find((candidate) => candidate.id === selection.id);
		}
		const selected = element();
		const destinationId = selected && 'destinationId' in selected ? selected.destinationId : undefined;

		return destinationId
			? state().project.destinations.find((candidate) => candidate.id === destinationId)
			: undefined;
	});
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
	const selectedRouteDestinationId = createMemo(() =>
		state().workspace === 'preview' ? preview.state().destinationId : undefined
	);
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
	const projectIssues = createMemo(() => validateWayfindingStudioProject(state().project));
	const deliveryIssues = createMemo(() => validateWayfindingStudioDelivery(state().project));
	const visitorFloors = createMemo(() =>
		visitorFloorOptions(state().project.floors, state().project.destinations)
	);
	const visitorOrigins = createMemo(() => state().project.floors.flatMap((floor) =>
		floor.elements
			.filter((element) => element.type === 'origin')
			.map((origin) => ({
				floorId: floor.id,
				floorName: floor.name,
				id: origin.id,
				label: origin.label || origin.screenId || origin.id
			}))
	));
	const visitorCategories = createMemo(() =>
		visitorCategoryOptions(state().project.destinations)
	);
	const visibleDestinations = createMemo(() => filterVisitorDestinations(
		state().project.destinations,
		{
			category: preview.state().category || undefined,
			floorId: preview.state().floorId || undefined,
			language: preview.state().language,
			query: preview.state().query
		}
	));
	const visitorRouteJourney = createMemo(() => routeJourneyToDestination(
		state().project,
		preview.state().destinationId,
		preview.state().profile,
		preview.state().originId
	));
	const clearPreviewDestination = (): void => {
		preview.setDestinationId(undefined);
		store.dispatch({ type: 'selection/clear' });
	};
	const selectPreviewDestination = (destination: WayfindingStudioDestination): void => {
		preview.setDestinationId(destination.routeable === false ? undefined : destination.id);

		if (destination.floor) {
			store.dispatch({ type: 'floor/select', floorId: destination.floor });
		}
		store.dispatch({
			type: 'selection/set',
			selection: { id: destination.id, kind: 'destination' }
		});
	};
	const selectPreviewDestinationById = (destinationId: string | undefined): void => {
		const destination = state().project.destinations.find((candidate) => candidate.id === destinationId);

		if (destination) selectPreviewDestination(destination);
		else clearPreviewDestination();
	};
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
			label: 'Show keyboard shortcuts',
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
		}
		previousWorkspace = workspace;
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
	const revealIssue = (issue: WayfindingStudioIssue): void => {
		setExportIssues([]);
		store.dispatch({ type: 'workspace/set', workspace: 'map' });
		store.dispatch({ type: 'panel/toggle', panelId: 'right', collapsed: false });
		const selection = issueSelection(issue, state().project);

		if (selection) store.dispatch({ type: 'selection/set', selection });
	};
	const buildRoutes = async (): Promise<void> => {
		const currentFloorId = state().currentFloorId;

		try {
			const result = buildFloorRouteNetwork(state().project, currentFloorId);
			const diff = result.diff;
			const replacesGeneratedTopology = diff.generatedEdgesBefore > 0 || diff.generatedNodesBefore > 0;

			if (replacesGeneratedTopology && !await confirm({
				body: 'Only Studio-generated topology will be replaced. Reviewed and hand-authored corrections remain intact, and the complete change can still be undone.',
				confirmLabel: 'Apply rebuild',
				details: [
					{
						label: 'Generated route points',
						value: `${diff.generatedNodesBefore} → ${diff.generatedNodesAfter}`
					},
					{
						label: 'Generated segments',
						value: `${diff.generatedEdgesBefore} → ${diff.generatedEdgesAfter}`
					},
					{
						label: 'Manual corrections preserved',
						value: `${diff.manualNodesPreserved} points · ${diff.manualEdgesPreserved} segments`
					},
					{
						label: 'Destination anchors connected',
						value: `${result.connectedSemanticNodes}/${result.totalSemanticNodes}`
					}
				],
				title: 'Review route build changes'
			})) return;

			store.dispatch({
				type: 'project/replace',
				label: replacesGeneratedTopology ? 'Rebuild route network' : 'Build route network',
				project: result.project
			});
			store.dispatch({ type: 'selection/clear' });
			store.dispatch({ type: 'tool/set', tool: 'select' });
			setRouteBuildReport(result);
			const blocked = result.totalSemanticNodes - result.connectedSemanticNodes;
			notify(
				blocked > 0
					? `Built ${result.edges} segments, but ${blocked} destination anchor${blocked === 1 ? '' : 's'} still need attention.`
					: `Built ${result.edges} route segments and connected all ${result.connectedSemanticNodes} destination anchors.`,
				blocked > 0 ? 'warning' : 'success'
			);
		} catch (error) {
			notify(error instanceof Error ? error.message : 'The route network could not be built.', 'danger');
		}
	};

	const exportRuntime = (): void => {
		try {
			downloadPublishedRuntime(state().project);
			notify('Published map downloaded.', 'success');
		} catch {
			const issues = deliveryIssues().filter((issue) => issue.severity === 'error');
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
		window.addEventListener('keydown', keydown);
		window.addEventListener('beforeunload', beforeUnload);
		onCleanup(() => {
			unsubscribe();
			stopPanelPreferencePersistence();
			window.removeEventListener('keydown', keydown);
			window.removeEventListener('beforeunload', beforeUnload);
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
				'left-collapsed': state().panels.left.collapsed,
				'narrow-layout': workspaceDensity() === 'narrow',
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
								onBuildRoutes={() => void buildRoutes()}
								routeBuildReport={routeBuildReport}
								routeOriginId={() => preview.state().originId}
								routeProfile={() => preview.state().profile}
								setRouteOriginId={preview.setOriginId}
								setRouteProfile={preview.setProfile}
								selectionActions={selectionActions}
								snapshot={snapshot}
								store={store}
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
					<ToolRail snapshot={snapshot} store={store} />
					<StageToolbar
						onFit={() => fitCanvas()}
						snapshot={snapshot}
						store={store}
						threeDimensionalReason={() => threeDimensionalReadiness().reasons[0]}
						threeDimensionalReady={() => threeDimensionalReadiness().ready}
					/>
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
							onNotify={notify}
							onPreviewDestinationSelect={selectPreviewDestinationById}
							registerFit={(fit) => {
								fitCanvas = fit;
							}}
							registerSelectionActions={setSelectionActions}
							routeDestinationId={selectedRouteDestinationId}
							routeOriginId={() => preview.state().originId}
							routeProfile={() => preview.state().profile}
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
							routeDestinationId={() => preview.state().destinationId}
							routeJourney={visitorRouteJourney}
							selected={selectedDestination}
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
						deliveryIssues={deliveryIssues}
						element={element}
						elementName={inspectorTitle}
						graphEdge={selectedGraphEdge}
						graphEdgeGeometryIndex={selectedGraphEdgeGeometryIndex}
						graphNode={selectedGraphNode}
						onPatchDestination={patchDestination}
						projectIssues={projectIssues}
						selectedDestination={selectedDestination}
						snapshot={snapshot}
						store={store}
					/>
				</Show>
			</div>

			<StatusBar snapshot={snapshot} onShowShortcuts={() => setShortcutsOpen(true)} />

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
