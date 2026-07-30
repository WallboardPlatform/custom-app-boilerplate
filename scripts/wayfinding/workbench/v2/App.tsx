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
	createWayfindingMapPackage,
	WAYFINDING_MAP_PACKAGE_EXTENSION,
	WAYFINDING_MAP_PACKAGE_MIME_TYPE
} from '../../runtime-package.mts';
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
import { Canvas2d } from './Canvas2d';
import type { CanvasSelectionActions } from './Canvas2d';
import { AppBar } from './components/AppBar';
import type { StudioCommand } from './components/CommandPalette';
import { InspectorPanel } from './components/InspectorPanel';
import { ProjectPanel, type ProjectView } from './components/ProjectPanel';
import { RoutePanel } from './components/RoutePanel';
import { SelectionToolbar } from './components/SelectionToolbar';
import { StageToolbar } from './components/StageToolbar';
import { StatusBar } from './components/StatusBar';
import { ToolRail } from './components/ToolRail';
import { updateProject } from './components/project-edit';
import { VisitorPanel } from './components/VisitorPanel';
import {
	type ConfirmState,
	type RepairReportState,
	type ToastState,
	WorkbenchOverlays
} from './components/WorkbenchOverlays';
import {
	routeJourneyToDestination,
	type VisitorRouteProfile
} from './route';
import {
	filterVisitorDestinations,
	visitorCategoryOptions,
	visitorFloorOptions
} from './visitor';
import { issueSelection } from './issues';
import { useResponsiveWorkspace } from './useResponsiveWorkspace';
import { useProjectLifecycle } from './useProjectLifecycle';
import './styles/app.scss';

const Scene3dView = lazy(async () => {
	const module = await import('./Scene3dView');

	return { default: module.Scene3dView };
});

const downloadBytes = (
	value: Uint8Array,
	fileName: string,
	mimeType: string
): void => {
	const buffer = new ArrayBuffer(value.byteLength);
	new Uint8Array(buffer).set(value);
	const url: string = URL.createObjectURL(new Blob([buffer], { type: mimeType }));
	const anchor: HTMLAnchorElement = document.createElement('a');
	anchor.href = url;
	anchor.download = fileName;
	anchor.click();
	URL.revokeObjectURL(url);
};

const safeFileStem = (value: string): string =>
	value.trim().replaceAll(/[^a-zA-Z0-9._-]+/g, '-').replaceAll(/^-+|-+$/g, '') || 'wayfinding-project';

const App = (): JSX.Element => {
	const store: EditorStore = createEditorStore();
	const workspaceDensity = useResponsiveWorkspace(store);
	const [snapshot, setSnapshot] = createSignal(store.getSnapshot());
	const [toast, setToast] = createSignal<ToastState>();
	const [confirmState, setConfirmState] = createSignal<ConfirmState>();
	const [confirmResolver, setConfirmResolver] = createSignal<(value: boolean) => void>();
	const [repairReport, setRepairReport] = createSignal<RepairReportState>();
	const [pointer, setPointer] = createSignal<{ x: number; y: number }>();
	const [visitorQuery, setVisitorQuery] = createSignal('');
	const [visitorCategory, setVisitorCategory] = createSignal('');
	const [visitorFloorFilter, setVisitorFloorFilter] = createSignal('');
	const [visitorRouteDestinationId, setVisitorRouteDestinationId] = createSignal<string>();
	const [visitorRouteOriginId, setVisitorRouteOriginId] = createSignal<string>();
	const [visitorRouteProfile, setVisitorRouteProfile] = createSignal<VisitorRouteProfile>('standard');
	const [shortcutsOpen, setShortcutsOpen] = createSignal(false);
	const [commandPaletteOpen, setCommandPaletteOpen] = createSignal(false);
	const [projectView, setProjectView] = createSignal<ProjectView>('content');
	const [exportIssues, setExportIssues] = createSignal<WayfindingStudioIssue[]>([]);
	const [routeBuildReport, setRouteBuildReport] = createSignal<RouteBuildResult>();
	const [visitorLanguage, setVisitorLanguage] = createSignal(
		store.getSnapshot().state.project.defaultLanguage ?? 'en'
	);
	let fitCanvas = (): void => undefined;
	let toastTimer: ReturnType<typeof setTimeout> | undefined;

	const state = createMemo(() => snapshot().state);
	const element = createMemo(() => selectedElement(state()));
	const currentFloor = createMemo(() =>
		state().project.floors.find((floor) => floor.id === state().currentFloorId)
		?? state().project.floors[0]
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
			document.querySelector<HTMLInputElement>('[data-floor-background-input]')?.click()
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
		state().workspace === 'visitor-preview'
			? visitorRouteDestinationId()
			: state().workspace === 'route-preview'
				? selectedDestination()?.id
				: undefined
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
						: state().workspace === 'route-preview'
							? 'Journey preview'
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
			category: visitorCategory() || undefined,
			floorId: visitorFloorFilter() || undefined,
			language: visitorLanguage(),
			query: visitorQuery()
		}
	));
	const visitorRouteJourney = createMemo(() => routeJourneyToDestination(
		state().project,
		visitorRouteDestinationId(),
		visitorRouteProfile(),
		visitorRouteOriginId()
	));
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
			id: 'workspace-route-preview',
			keywords: ['simulate', 'directions'],
			label: 'Open route preview',
			run: (): void => store.dispatch({ type: 'workspace/set', workspace: 'route-preview' }),
			shortcut: '3'
		},
		{
			group: 'Workspace',
			id: 'workspace-visitor-preview',
			keywords: ['directory', 'runtime', 'public'],
			label: 'Open visitor preview',
			run: (): void => store.dispatch({ type: 'workspace/set', workspace: 'visitor-preview' }),
			shortcut: '4'
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
		{
			group: 'View',
			id: 'view-3d',
			label: 'Switch to 3D preview',
			run: (): void => store.dispatch({ type: 'view/set', viewMode: '3d' })
		},
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

		if (available.some((language) => language.code === visitorLanguage())) return;
		setVisitorLanguage(state().project.defaultLanguage ?? available[0]?.code ?? 'en');
	});
	createEffect(() => {
		if (visitorCategory() && !visitorCategories().includes(visitorCategory())) {
			setVisitorCategory('');
		}

		if (visitorFloorFilter() && !visitorFloors().some((floor) => floor.id === visitorFloorFilter())) {
			setVisitorFloorFilter('');
		}

		if (
			visitorRouteDestinationId()
			&& !state().project.destinations.some((destination) => destination.id === visitorRouteDestinationId())
		) {
			setVisitorRouteDestinationId(undefined);
		}

		if (!visitorOrigins().some((origin) => origin.id === visitorRouteOriginId())) {
			setVisitorRouteOriginId(visitorOrigins()[0]?.id);
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
		const floorNodeIds = new Set(state().project.graph.nodes
			.filter((node) => node.levelId === currentFloorId)
			.map((node) => node.id));
		const existingEdges = state().project.graph.edges.filter((edge) =>
			floorNodeIds.has(edge.from) || floorNodeIds.has(edge.to)
		);

		if (existingEdges.length > 0 && !await confirm({
			body: `This replaces ${existingEdges.length} route segment${existingEdges.length === 1 ? '' : 's'} on the current floor, including manual adjustments. The change can be undone.`,
			confirmLabel: 'Rebuild routes',
			title: 'Replace the current route network?'
		})) return;

		try {
			const result = buildFloorRouteNetwork(state().project, currentFloorId);
			store.dispatch({
				type: 'project/replace',
				label: existingEdges.length ? 'Rebuild route network' : 'Build route network',
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
			const mapPackage = createWayfindingMapPackage(state().project);
			downloadBytes(
				mapPackage,
				`${safeFileStem(state().project.name)}${WAYFINDING_MAP_PACKAGE_EXTENSION}`,
				WAYFINDING_MAP_PACKAGE_MIME_TYPE
			);
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
			classList={{
				'compact-layout': workspaceDensity() === 'compact',
				'left-collapsed': state().panels.left.collapsed,
				'narrow-layout': workspaceDensity() === 'narrow',
				'right-collapsed': state().panels.right.collapsed,
				'visitor-workspace': state().workspace === 'visitor-preview'
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
				<Show when={state().workspace !== 'visitor-preview'}>
					<Show
						when={state().workspace === 'map'}
						fallback={
							<RoutePanel
								onBuildRoutes={() => void buildRoutes()}
								routeBuildReport={routeBuildReport}
								routeOriginId={visitorRouteOriginId}
								routeProfile={visitorRouteProfile}
								setRouteOriginId={setVisitorRouteOriginId}
								setRouteProfile={setVisitorRouteProfile}
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
					/>
					<Show when={state().workspace !== 'visitor-preview' && state().viewMode === '2d'}>
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
									routeOriginId={visitorRouteOriginId}
									routeProfile={visitorRouteProfile}
									snapshot={snapshot}
									store={store}
									visitorLanguage={visitorLanguage}
								/>
							</Suspense>
						)}
					>
						<Canvas2d
							onNotify={notify}
							registerFit={(fit) => {
								fitCanvas = fit;
							}}
							registerSelectionActions={setSelectionActions}
							routeDestinationId={selectedRouteDestinationId}
							routeOriginId={visitorRouteOriginId}
							routeProfile={visitorRouteProfile}
							snapshot={snapshot}
							store={store}
							visitorDestinations={visibleDestinations}
							visitorLanguage={visitorLanguage}
							onPointerCoordinate={setPointer}
						/>
						<Show when={canvasIsEmpty() && state().workspace === 'map'}>
							<div class="canvas-empty-state">
								<div class="empty-state-icon"><ImagePlus size={24} /></div>
								<strong>Add a floor plan</strong>
								<span>Start with a map image, then trace destinations and pedestrian space.</span>
								<button
									type="button"
									class="button primary"
									onClick={startFloorPlanUpload}
								>
									<ImagePlus size={16} /> Choose image
								</button>
							</div>
						</Show>
					</Show>
					<Show when={state().workspace === 'visitor-preview'}>
						<VisitorPanel
							assets={() => state().project.assets}
							categories={visitorCategories}
							category={visitorCategory}
							destinations={visibleDestinations}
							floorFilter={visitorFloorFilter}
							floors={visitorFloors}
							language={visitorLanguage}
							languages={() => state().project.languages ?? []}
							layerVisible={(layerId) => state().layerVisibility[layerId]}
							query={visitorQuery}
							routeDestinationId={visitorRouteDestinationId}
							routeJourney={visitorRouteJourney}
							routeOriginId={visitorRouteOriginId}
							routeOrigins={visitorOrigins}
							routeProfile={visitorRouteProfile}
							selected={selectedDestination}
							setCategory={setVisitorCategory}
							setFloorFilter={(floorId) => {
								setVisitorFloorFilter(floorId);

								if (floorId) store.dispatch({ type: 'floor/select', floorId });
							}}
							setLanguage={setVisitorLanguage}
							setQuery={setVisitorQuery}
							setRouteDestinationId={setVisitorRouteDestinationId}
							setRouteOriginId={setVisitorRouteOriginId}
							setRouteProfile={setVisitorRouteProfile}
							store={store}
						/>
					</Show>
					<Show when={state().workspace !== 'visitor-preview'}>
						<div class="coordinate-readout">
							{pointer() ? `x ${Math.round(pointer()!.x)}  y ${Math.round(pointer()!.y)}` : 'x --  y --'}
						</div>
					</Show>
				</main>

				<Show when={state().workspace !== 'visitor-preview'}>
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
