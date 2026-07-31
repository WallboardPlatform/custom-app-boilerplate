import {
	createEffect,
	createSignal,
	onCleanup,
	onMount,
	type Accessor
} from 'solid-js';

import {
	createWayfindingStudioProject,
	type WayfindingStudioProject,
	type WayfindingStudioRepair
} from '../../studio-project.mts';
import { BrowserPersistenceAdapter } from '../../editor-core/persistence';
import type {
	EditorSnapshot,
	EditorState,
	EditorStore
} from '../../editor-core/types';

interface ConfirmRequest {
	body: string;
	confirmLabel: string;
	title: string;
}

interface ProjectLifecycleOptions {
	confirm: (request: ConfirmRequest) => Promise<boolean>;
	notify: (message: string, tone?: 'danger' | 'info' | 'success' | 'warning') => void;
	onFit: () => void;
	onRepairs: (fileName: string, repairs: WayfindingStudioRepair[]) => void;
	snapshot: Accessor<EditorSnapshot>;
	store: EditorStore;
}

export interface ProjectLifecycle {
	deleteFloor: (floorId: string, floorName: string) => Promise<void>;
	discardRecovery: () => void;
	newProject: () => Promise<void>;
	open: () => Promise<void>;
	openFile: (file: File) => Promise<void>;
	recoveryProject: Accessor<WayfindingStudioProject | undefined>;
	restoreRecovery: () => void;
	save: (forceSaveAs?: boolean) => Promise<void>;
}

export const useProjectLifecycle = (options: ProjectLifecycleOptions): ProjectLifecycle => {
	const persistence = new BrowserPersistenceAdapter();
	const [recoveryProject, setRecoveryProject] = createSignal<WayfindingStudioProject>();
	let autosaveTimer: ReturnType<typeof setTimeout> | undefined;

	const fitAfterRender = (): void => queueMicrotask(options.onFit);
	const currentState = (): EditorState => options.snapshot().state;

	const save = async (forceSaveAs = false): Promise<void> => {
		options.store.dispatch({ type: 'document/saving' });

		try {
			const result = await persistence.saveProject(currentState().project, {
				forceSaveAs,
				suggestedName: currentState().project.name
			});
			options.store.dispatch({
				type: 'document/mark-saved',
				fileName: result.fileName,
				savedAt: new Date().toISOString()
			});
			await persistence.clearRecovery();
			options.notify(`Saved ${result.fileName}`, 'success');
		} catch (error) {
			options.store.dispatch({ type: 'document/error' });
			options.notify(error instanceof Error ? error.message : 'The project could not be saved.', 'danger');
		}
	};

	const loadOpenedProject = (
		opened: {
			fileName: string;
			project: WayfindingStudioProject;
			repairs: WayfindingStudioRepair[];
		},
		openedFrom: 'browser-recovery' | 'file' = 'file'
	): void => {
		options.store.dispatch({
			type: 'project/load',
			project: opened.project,
			fileName: opened.fileName,
			openedFrom
		});

		if (opened.repairs.length > 0) options.onRepairs(opened.fileName, opened.repairs);
		options.notify(`Opened ${opened.fileName}`, 'success');
		fitAfterRender();
	};

	const confirmProjectReplacement = async (): Promise<boolean> =>
		!currentState().document.dirty || await options.confirm({
			body: 'Opening another project will replace the unsaved project currently in the editor.',
			confirmLabel: 'Open project',
			title: 'Replace unsaved work?'
		});

	const open = async (): Promise<void> => {
		if (!await confirmProjectReplacement()) return;

		try {
			const opened = await persistence.openProject();

			if (opened) loadOpenedProject(opened);
		} catch (error) {
			options.notify(error instanceof Error ? error.message : 'This project file could not be opened.', 'danger');
		}
	};

	const openFile = async (file: File): Promise<void> => {
		if (!await confirmProjectReplacement()) return;

		try {
			loadOpenedProject(await persistence.openProjectFile(file));
		} catch (error) {
			options.notify(error instanceof Error ? error.message : 'This project file could not be opened.', 'danger');
		}
	};

	const newProject = async (): Promise<void> => {
		if (
			currentState().document.dirty
			&& !await options.confirm({
				body: 'Creating a new project will replace the unsaved project currently in the editor.',
				confirmLabel: 'Create project',
				title: 'Replace unsaved work?'
			})
		) return;

		await persistence.clearRecovery();
		persistence.resetProjectTarget();
		options.store.dispatch({
			type: 'project/load',
			project: createWayfindingStudioProject(`wayfinding-${Date.now()}`),
			openedFrom: 'new'
		});
		fitAfterRender();
	};

	const restoreRecovery = (): void => {
		const project = recoveryProject();

		if (!project) return;
		options.store.dispatch({ type: 'project/load', project, openedFrom: 'browser-recovery' });
		setRecoveryProject(undefined);
		options.notify('Restored your local editing session.', 'success');
		fitAfterRender();
	};

	const discardRecovery = (): void => {
		void persistence.clearRecovery();
		persistence.resetProjectTarget();
		setRecoveryProject(undefined);
		options.notify('Local recovery discarded.', 'info');
	};

	const deleteFloor = async (floorId: string, floorName: string): Promise<void> => {
		if (!await options.confirm({
			body: `${floorName} and every object authored on it will be removed. This can be undone until the project is closed.`,
			confirmLabel: 'Delete floor',
			title: `Delete ${floorName}?`
		})) return;

		options.store.dispatch({ type: 'floor/remove', floorId });
		options.notify(`${floorName} deleted.`, 'info');
		fitAfterRender();
	};

	onMount(() => {
		void persistence.loadRecovery().then((project) => {
			const editorState = options.store.getSnapshot().state;

			if (!project || editorState.document.openedFrom !== 'new' || editorState.document.dirty) return;
			setRecoveryProject(project);
		});
	});

	createEffect(() => {
		const project = currentState().project;
		const dirty = currentState().document.dirty;

		if (autosaveTimer) clearTimeout(autosaveTimer);

		if (!dirty) return;

		autosaveTimer = setTimeout(() => {
			void persistence.saveRecovery(project);
		}, 750);
	});

	onCleanup(() => {
		if (autosaveTimer) clearTimeout(autosaveTimer);
	});

	return {
		deleteFloor,
		discardRecovery,
		newProject,
		open,
		openFile,
		recoveryProject,
		restoreRecovery,
		save
	};
};
