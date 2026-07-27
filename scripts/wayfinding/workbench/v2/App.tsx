import {
	Box,
	CircleHelp,
	Frame,
	PanelLeftOpen,
	PanelRightClose,
	PanelRightOpen,
	SquareDashedMousePointer,
	X
} from 'lucide-solid';
import {
	createEffect,
	createMemo,
	createSignal,
	onCleanup,
	onMount,
	Show,
	type JSX
} from 'solid-js';
import {
	createWayfindingRuntimeBundle,
	createWayfindingStudioProject,
	validateWayfindingStudioDelivery,
	validateWayfindingStudioProject,
	type WayfindingStudioDestination
} from '../../studio-project.mts';
import { BrowserPersistenceAdapter } from '../../editor-core/persistence';
import {
	elementDisplayName,
	selectedElement
} from '../../editor-core/selectors';
import { createEditorStore } from '../../editor-core/store';
import type { EditorStore } from '../../editor-core/types';
import { Canvas2d } from './Canvas2d';
import { Scene3dView } from './Scene3dView';
import { AppBar } from './components/AppBar';
import {
	DestinationInspector,
	ElementInspector,
	Problems,
	ProjectOverview
} from './components/InspectorContent';
import { ProjectPanel } from './components/ProjectPanel';
import { ShortcutsDialog } from './components/ShortcutsDialog';
import { StatusBar } from './components/StatusBar';
import { updateProject } from './components/project-edit';
import { VisitorPanel } from './components/VisitorPanel';
import { IconButton } from './ui';
import './styles/app.scss';

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
	const [visitorLanguage, setVisitorLanguage] = createSignal(
		store.getSnapshot().state.project.defaultLanguage ?? 'en'
	);
	let fitCanvas = (): void => undefined;
	let autosaveTimer: ReturnType<typeof setTimeout> | undefined;
	let toastTimer: ReturnType<typeof setTimeout> | undefined;

	const state = createMemo(() => snapshot().state);
	const element = createMemo(() => selectedElement(state()));
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

	const exportRuntime = (): void => {
		try {
			const bundle = createWayfindingRuntimeBundle(state().project);
			downloadJson(bundle, `${safeFileStem(state().project.name)}.runtime.json`);
			notify('Runtime bundle exported.', 'success');
		} catch {
			const issues = deliveryIssues().filter((issue) => issue.severity === 'error');
			notify(issues.length
				? `${issues.length} issue${issues.length === 1 ? '' : 's'} must be resolved before export.`
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
			store.dispatch({ type: 'project/load', project, openedFrom: 'browser-recovery' });
			notify('Recovered your last local editing session.', 'info');
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
					<ProjectPanel
						onNew={() => void newProject()}
						onOpen={() => void open()}
						snapshot={snapshot}
						store={store}
					/>

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
						fallback={<Scene3dView snapshot={snapshot} store={store} />}
					>
						<Canvas2d
							registerFit={(fit) => {
								fitCanvas = fit;
							}}
							snapshot={snapshot}
							store={store}
							onPointerCoordinate={setPointer}
						/>
					</Show>
					<Show when={state().workspace === 'visitor-preview'}>
						<VisitorPanel
							destinations={visibleDestinations}
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
										<DestinationInspector destination={selectedDestination()!} patch={patchDestination} />
									</Show>
								}
							>
								<ElementInspector element={element()!} store={store} />
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
			<Show when={shortcutsOpen()}>
				<ShortcutsDialog onClose={() => setShortcutsOpen(false)} />
			</Show>
		</div>
	);
};

export default App;
