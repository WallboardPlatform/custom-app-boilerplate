import {
	applyEditorCommand,
	isProjectCommand
} from './commands';
import {
	cloneProject,
	createEditorState
} from './state';
import type {
	EditorCommand,
	EditorSnapshot,
	EditorState,
	EditorStore,
	EditorTransaction
} from './types';

interface HistoryEntry {
	label: string;
	project: EditorState['project'];
}

interface HistoryMerge {
	key: string;
	updatedAt: number;
}

export const createEditorStore = (initialState: EditorState = createEditorState()): EditorStore => {
	let state: EditorState = initialState;
	let historyMerge: HistoryMerge | undefined;
	const undoStack: HistoryEntry[] = [];
	const redoStack: HistoryEntry[] = [];
	const listeners = new Set<(snapshot: EditorSnapshot) => void>();

	const snapshot = (): EditorSnapshot => ({
		canRedo: redoStack.length > 0,
		canUndo: undoStack.length > 0,
		state
	});
	const emit = (): void => {
		const next: EditorSnapshot = snapshot();

		for (const listener of listeners) listener(next);
	};
	const commit = (commands: EditorCommand[], label: string, mergeKey?: string): void => {
		if (commands.length === 0) return;
		const tracksProject: boolean = commands.some(isProjectCommand);
		const now = Date.now();
		const mergesWithPrevious = Boolean(
			tracksProject
			&& mergeKey
			&& historyMerge?.key === mergeKey
			&& now - historyMerge.updatedAt <= 750
		);

		if (tracksProject && !mergesWithPrevious) {
			undoStack.push({ label, project: cloneProject(state.project) });
		}
		let next: EditorState = state;

		for (const command of commands) next = applyEditorCommand(next, command);

		if (next === state) {
			if (tracksProject && !mergesWithPrevious) undoStack.pop();

			return;
		}
		state = next;

		if (tracksProject) {
			redoStack.length = 0;
			historyMerge = mergeKey ? { key: mergeKey, updatedAt: now } : undefined;
		} else {
			historyMerge = undefined;
		}
		emit();
	};

	return {
		dispatch(command: EditorCommand): void {
			commit(
				[command],
				command.type,
				command.type === 'element/patch' && command.historyGroup
					? `${command.type}:${command.elementId}:${command.historyGroup}`
					: undefined
			);
		},
		getSnapshot: snapshot,
		redo(): void {
			historyMerge = undefined;
			const entry: HistoryEntry | undefined = redoStack.pop();

			if (!entry) return;
			undoStack.push({ label: entry.label, project: cloneProject(state.project) });
			state = applyEditorCommand(state, { type: 'project/replace', project: entry.project, label: entry.label });
			emit();
		},
		run(transaction: EditorTransaction): void {
			historyMerge = undefined;
			commit(transaction.commands, transaction.label);
		},
		subscribe(listener: (snapshot: EditorSnapshot) => void): () => void {
			listeners.add(listener);
			listener(snapshot());

			return (): void => {
				listeners.delete(listener);
			};
		},
		undo(): void {
			historyMerge = undefined;
			const entry: HistoryEntry | undefined = undoStack.pop();

			if (!entry) return;
			redoStack.push({ label: entry.label, project: cloneProject(state.project) });
			state = applyEditorCommand(state, { type: 'project/replace', project: entry.project, label: entry.label });
			emit();
		}
	};
};
