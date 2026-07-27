import {
	AlertTriangle,
	Box,
	ChevronRight,
	CircleHelp,
	Clock3,
	Frame,
	ImagePlus,
	PanelLeftOpen,
	PanelRightClose,
	PanelRightOpen,
	ShieldAlert,
	SquareDashedMousePointer,
	X
} from 'lucide-solid';
import {
	createEffect,
	createMemo,
	createSignal,
	For,
	lazy,
	onCleanup,
	onMount,
	Show,
	Suspense,
	type JSX
} from 'solid-js';
import {
	createWayfindingRuntimeBundle,
	createWayfindingStudioProject,
	validateWayfindingStudioDelivery,
	validateWayfindingStudioProject,
	type WayfindingStudioDestination,
	type WayfindingStudioIssue,
	type WayfindingStudioProject
} from '../../studio-project.mts';
import { BrowserPersistenceAdapter } from '../../editor-core/persistence';
import { buildFloorRouteNetwork } from '../../editor-core/route-builder.mts';
import {
	elementDisplayName,
	selectedElement
} from '../../editor-core/selectors';
import { createEditorStore } from '../../editor-core/store';
import type { EditorStore } from '../../editor-core/types';
import { Canvas2d } from './Canvas2d';
import { AppBar } from './components/AppBar';
import {
	DestinationInspector,
	ElementInspector,
	Problems,
	ProjectOverview
} from './components/InspectorContent';
import { ProjectPanel } from './components/ProjectPanel';
import { RoutePanel } from './components/RoutePanel';
import { ShortcutsDialog } from './components/ShortcutsDialog';
import { StatusBar } from './components/StatusBar';
import { ToolRail } from './components/ToolRail';
import { updateProject } from './components/project-edit';
import { VisitorPanel } from './components/VisitorPanel';
import { IconButton } from './ui';
import './styles/app.scss';

const Scene3dView = lazy(async () => {
	const module = await import('./Scene3dView');

	return { default: module.Scene3dView };
});

interface ToastState {
	message: string;
	tone: 'danger' | 'info' | 'success' | 'warning';
}

interface ConfirmState {
	body: string;
	confirmLabel: string;
	title: string;
}

const downloadJson = (value: unknown, fileName: string): void => {
	const url: string = URL.createObjectURL(new Blob(
		[`${JSON.stringify(value, undefined, 2)}\n`],
		{ type: 'application/json' }
	));
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
	const persistence = new BrowserPersistenceAdapter();
	const [snapshot, setSnapshot] = createSignal(store.getSnapshot());
	const [toast, setToast] = createSignal<ToastState>();
	const [confirmState, setConfirmState] = createSignal<ConfirmState>();
	const [confirmResolver, setConfirmResolver] = createSignal<(value: boolean) => void>();
	const [pointer, setPointer] = createSignal<{ x: number; y: number }>();
	const [visitorQuery, setVisitorQuery] = createSignal('');
	const [shortcutsOpen, setShortcutsOpen] = createSignal(false);
	const [recoveryProject, setRecoveryProject] = createSignal<WayfindingStudioProject>();
	const [exportIssues, setExportIssues] = createSignal<WayfindingStudioIssue[]>([]);
	const [visitorLanguage, setVisitorLanguage] = createSignal(
		store.getSnapshot().state.project.defaultLanguage ?? 'en'
	);
	let fitCanvas = (): void => undefined;
	let autosaveTimer: ReturnType<typeof setTimeout> | undefined;
	let toastTimer: ReturnType<typeof setTimeout> | undefined;

	const state = createMemo(() => snapshot().state);
	const element = createMemo(() => selectedElement(state()));
	const currentFloor = createMemo(() =>
		state().project.floors.find((floor) => floor.id === state().currentFloorId)
		?? state().project.floors[0]
	);
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
	const projectIssues = createMemo(() => validateWayfindingStudioProject(state().project));
	const deliveryIssues = createMemo(() => validateWayfindingStudioDelivery(state().project));
	const visibleDestinations = createMemo(() => {
		const query = visitorQuery().trim().toLocaleLowerCase();
		const destinations = state().project.destinations;

		if (!query) return destinations;

		return destinations.filter((destination) =>
			[
				destination.translations?.[visitorLanguage()]?.name ?? destination.name,
				destination.translations?.[visitorLanguage()]?.description ?? destination.description,
				destination.category,
				destination.mapNumber
			].some((value) => value?.toLocaleLowerCase().includes(query))
		);
	});
	createEffect(() => {
		const available = state().project.languages ?? [];

		if (available.some((language) => language.code === visitorLanguage())) return;
		setVisitorLanguage(state().project.defaultLanguage ?? available[0]?.code ?? 'en');
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

	const save = async (forceSaveAs = false): Promise<void> => {
		store.dispatch({ type: 'document/saving' });

		try {
			const result = await persistence.saveProject(state().project, {
				forceSaveAs,
				suggestedName: state().project.name
			});
			store.dispatch({
				type: 'document/mark-saved',
				fileName: result.fileName,
				savedAt: new Date().toISOString()
			});
			await persistence.clearRecovery();
			notify(`Saved ${result.fileName}`, 'success');
		} catch (error) {
			store.dispatch({ type: 'document/error' });
			notify(error instanceof Error ? error.message : 'The project could not be saved.', 'danger');
		}
	};

	const open = async (): Promise<void> => {
		if (state().document.dirty && !await confirm({
			body: 'Opening another project will replace the unsaved project currently in the editor.',
			confirmLabel: 'Open project',
			title: 'Replace unsaved work?'
		})) return;

		try {
			const opened = await persistence.openProject();

			if (!opened) return;
			store.dispatch({
				type: 'project/load',
				project: opened.project,
				fileName: opened.fileName,
				openedFrom: 'file'
			});
			notify(`Opened ${opened.fileName}`, 'success');
			queueMicrotask(fitCanvas);
		} catch (error) {
			notify(error instanceof Error ? error.message : 'This project file could not be opened.', 'danger');
		}
	};

	const newProject = async (): Promise<void> => {
		if (state().document.dirty && !await confirm({
			body: 'Creating a new project will replace the unsaved project currently in the editor.',
			confirmLabel: 'Create project',
			title: 'Replace unsaved work?'
		})) return;
		store.dispatch({
			type: 'project/load',
			project: createWayfindingStudioProject(`wayfinding-${Date.now()}`),
			openedFrom: 'new'
		});
		queueMicrotask(fitCanvas);
	};
	const restoreRecovery = (): void => {
		const project = recoveryProject();

		if (!project) return;
		store.dispatch({ type: 'project/load', project, openedFrom: 'browser-recovery' });
		setRecoveryProject(undefined);
		notify('Restored your local editing session.', 'success');
		queueMicrotask(fitCanvas);
	};
	const discardRecovery = (): void => {
		void persistence.clearRecovery();
		setRecoveryProject(undefined);
		notify('Local recovery discarded.', 'info');
	};
	const revealIssue = (issue: WayfindingStudioIssue): void => {
		const id = issue.elementIds[0];

		setExportIssues([]);
		store.dispatch({ type: 'workspace/set', workspace: 'map' });
		store.dispatch({ type: 'panel/toggle', panelId: 'right', collapsed: false });

		if (!id) return;
		const destination = state().project.destinations.some((candidate) => candidate.id === id);
		store.dispatch({
			type: 'selection/set',
			selection: { id, kind: destination ? 'destination' : 'element' }
		});
	};
	const deleteFloor = async (floorId: string, floorName: string): Promise<void> => {
		if (!await confirm({
			body: `${floorName} and every object authored on it will be removed. This can be undone until the project is closed.`,
			confirmLabel: 'Delete floor',
			title: `Delete ${floorName}?`
		})) return;
		store.dispatch({ type: 'floor/remove', floorId });
		notify(`${floorName} deleted.`, 'info');
		queueMicrotask(fitCanvas);
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
			notify(`Built ${result.edges} route segments from ${result.nodes} network nodes.`, 'success');
		} catch (error) {
			notify(error instanceof Error ? error.message : 'The route network could not be built.', 'danger');
		}
	};

	const exportRuntime = (): void => {
		try {
			const bundle = createWayfindingRuntimeBundle(state().project);
			downloadJson(bundle, `${safeFileStem(state().project.name)}.runtime.json`);
			notify('Runtime bundle exported.', 'success');
		} catch {
			const issues = deliveryIssues().filter((issue) => issue.severity === 'error');
			setExportIssues(issues);
			notify(issues.length
				? `Runtime export needs ${issues.length} correction${issues.length === 1 ? '' : 's'}.`
				: 'Runtime export failed.', 'danger');
			store.dispatch({ type: 'panel/toggle', panelId: 'right', collapsed: false });
		}
	};

	onMount(() => {
		const unsubscribe = store.subscribe(setSnapshot);
		const keydown = (event: KeyboardEvent): void => {
			if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 's') {
				event.preventDefault();
				void save(event.shiftKey);
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
		void persistence.loadRecovery().then((project) => {
			const currentState = store.getSnapshot().state;

			if (!project || currentState.document.openedFrom !== 'new' || currentState.document.dirty) return;
			setRecoveryProject(project);
		});
	});

	createEffect(() => {
		const project = state().project;
		const dirty = state().document.dirty;

		if (autosaveTimer) clearTimeout(autosaveTimer);

		if (!dirty) return;
		autosaveTimer = setTimeout(() => {
			void persistence.saveRecovery(project);
		}, 750);
	});

	onCleanup(() => {
		if (autosaveTimer) clearTimeout(autosaveTimer);

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
				'left-collapsed': state().panels.left.collapsed,
				'right-collapsed': state().panels.right.collapsed
			}}
		>
			<AppBar
				onExportRuntime={exportRuntime}
				onSave={(forceSaveAs) => void save(forceSaveAs)}
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
								snapshot={snapshot}
								store={store}
							/>
						}
					>
						<ProjectPanel
							onDeleteFloor={(floorId, floorName) => void deleteFloor(floorId, floorName)}
							onNew={() => void newProject()}
							onNotify={notify}
							onOpen={() => void open()}
							snapshot={snapshot}
							store={store}
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
					<div class="stage-toolbar">
						<div class="view-switcher" role="group" aria-label="Map view">
							<button
								type="button"
								aria-pressed={state().viewMode === '2d'}
								classList={{ active: state().viewMode === '2d' }}
								onClick={() => store.dispatch({ type: 'view/set', viewMode: '2d' })}
							><SquareDashedMousePointer size={16} /> 2D</button>
							<button
								type="button"
								aria-pressed={state().viewMode === '3d'}
								classList={{ active: state().viewMode === '3d' }}
								onClick={() => store.dispatch({ type: 'view/set', viewMode: '3d' })}
							><Box size={16} /> 3D</button>
						</div>
						<button type="button" class="button compact" onClick={() => fitCanvas()}>
							<Frame size={16} /> Fit
						</button>
						<Show when={state().workspace === 'route-preview'}>
							<label class="inline-toggle">
								<input
									type="checkbox"
									checked={state().layerVisibility['route-network']}
									onChange={(event) => store.dispatch({
										type: 'layer/set',
										layerId: 'route-network',
										visible: event.currentTarget.checked
									})}
								/>
								Show route network
							</label>
						</Show>
					</div>
					<Show
						when={state().viewMode === '2d'}
						fallback={(
							<Suspense fallback={<div class="scene-loading">Loading 3D view...</div>}>
								<Scene3dView snapshot={snapshot} store={store} />
							</Suspense>
						)}
					>
						<Canvas2d
							registerFit={(fit) => {
								fitCanvas = fit;
							}}
							snapshot={snapshot}
							store={store}
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
									onClick={() => document.querySelector<HTMLInputElement>('[data-floor-background-input]')?.click()}
								>
									<ImagePlus size={16} /> Choose image
								</button>
							</div>
						</Show>
					</Show>
					<Show when={state().workspace === 'visitor-preview'}>
						<VisitorPanel
							assets={() => state().project.assets}
							destinations={visibleDestinations}
							floors={() => state().project.floors}
							language={visitorLanguage}
							languages={() => state().project.languages ?? []}
							layerVisible={(layerId) => state().layerVisibility[layerId]}
							query={visitorQuery}
							selected={selectedDestination}
							setLanguage={setVisitorLanguage}
							setQuery={setVisitorQuery}
							store={store}
						/>
					</Show>
					<div class="coordinate-readout">
						{pointer() ? `x ${Math.round(pointer()!.x)}  y ${Math.round(pointer()!.y)}` : 'x --  y --'}
					</div>
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

					<aside class="right-panel panel-shell">
						<div class="panel-title">
							<span>
								<small>Inspector</small>
								<strong>{element() ? elementDisplayName(element()!) : selectedDestination()?.name ?? 'Project overview'}</strong>
							</span>
							<IconButton icon={PanelRightClose} label="Close inspector panel" onClick={() => store.dispatch({ type: 'panel/toggle', panelId: 'right' })} />
						</div>
						<div class="panel-scroll">
							<Show
								when={element()}
								fallback={
									<Show
										when={selectedDestination()}
										fallback={<ProjectOverview issues={deliveryIssues} snapshot={snapshot} />}
									>
										<DestinationInspector
											assets={state().project.assets}
											categories={state().project.categories ?? []}
											defaultLanguage={state().project.defaultLanguage ?? 'en'}
											destination={selectedDestination()!}
											floors={state().project.floors}
											languages={state().project.languages ?? []}
											patch={patchDestination}
										/>
									</Show>
								}
							>
								<>
								<ElementInspector element={element()!} projectAssets={state().project.assets} store={store} />
									<Show when={selectedDestination()}>
										<DestinationInspector
											assets={state().project.assets}
											categories={state().project.categories ?? []}
											defaultLanguage={state().project.defaultLanguage ?? 'en'}
											destination={selectedDestination()!}
											floors={state().project.floors}
											languages={state().project.languages ?? []}
											patch={patchDestination}
										/>
									</Show>
								</>
							</Show>
							<Problems issues={projectIssues} store={store} />
						</div>
					</aside>
				</Show>
			</div>

			<StatusBar snapshot={snapshot} onShowShortcuts={() => setShortcutsOpen(true)} />

			<Show when={toast()}>
				<div class="toast" role="status" aria-live="polite" classList={{ [toast()!.tone]: true }}>
					<span>{toast()!.message}</span>
					<button type="button" aria-label="Dismiss message" onClick={() => setToast(undefined)}><X size={16} /></button>
				</div>
			</Show>

			<Show when={confirmState()}>
				<div class="modal-backdrop" role="presentation">
					<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
						<div class="dialog-icon"><CircleHelp size={20} /></div>
						<h2 id="confirm-title">{confirmState()!.title}</h2>
						<p>{confirmState()!.body}</p>
						<div class="dialog-actions">
							<button type="button" class="button" onClick={() => resolveConfirm(false)}>Cancel</button>
							<button type="button" class="button primary" onClick={() => resolveConfirm(true)}>
								{confirmState()!.confirmLabel}
							</button>
						</div>
					</div>
				</div>
			</Show>
			<Show when={recoveryProject()}>
				<div class="modal-backdrop" role="presentation">
					<div class="dialog recovery-dialog" role="dialog" aria-modal="true" aria-labelledby="recovery-title">
						<div class="dialog-icon"><Clock3 size={20} /></div>
						<h2 id="recovery-title">Restore unsaved local work?</h2>
						<p>
							The browser has a recovery copy of <strong>{recoveryProject()!.name}</strong>.
							Restore it before starting a new project, or discard it permanently.
						</p>
						<div class="dialog-actions">
							<button type="button" class="button danger-ghost" onClick={discardRecovery}>Discard recovery</button>
							<button type="button" class="button primary" onClick={restoreRecovery}>Restore work</button>
						</div>
					</div>
				</div>
			</Show>
			<Show when={exportIssues().length > 0}>
				<div class="modal-backdrop" role="presentation">
					<div class="dialog export-dialog" role="dialog" aria-modal="true" aria-labelledby="export-title">
						<div class="dialog-icon danger"><ShieldAlert size={20} /></div>
						<h2 id="export-title">Runtime bundle needs attention</h2>
						<p>Correct these project issues, then export again. Select an issue to open the relevant map object.</p>
						<div class="export-issue-list">
							<For each={exportIssues()}>{(issue) => (
								<button type="button" onClick={() => revealIssue(issue)}>
									<AlertTriangle size={16} />
									<span><strong>{issue.message}</strong><small>{issue.elementIds.length ? 'Open affected item' : 'Open project settings'}</small></span>
									<ChevronRight size={16} />
								</button>
							)}</For>
						</div>
						<div class="dialog-actions">
							<button type="button" class="button" onClick={() => setExportIssues([])}>Close</button>
						</div>
					</div>
				</div>
			</Show>
			<Show when={shortcutsOpen()}>
				<ShortcutsDialog onClose={() => setShortcutsOpen(false)} />
			</Show>
		</div>
	);
};

export default App;
