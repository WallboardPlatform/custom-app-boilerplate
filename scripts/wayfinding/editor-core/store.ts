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

export const createEditorStore = (initialState: EditorState = createEditorState()): EditorStore => {
	let state: EditorState = initialState;
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
	const commit = (commands: EditorCommand[], label: string): void => {
		if (commands.length === 0) return;
		const tracksProject: boolean = commands.some(isProjectCommand);

		if (tracksProject) undoStack.push({ label, project: cloneProject(state.project) });
		let next: EditorState = state;

		for (const command of commands) next = applyEditorCommand(next, command);

		if (next === state) {
			if (tracksProject) undoStack.pop();

			return;
		}
		state = next;

		if (tracksProject) redoStack.length = 0;
		emit();
	};

	return {
		dispatch(command: EditorCommand): void {
			commit([command], command.type);
		},
		getSnapshot: snapshot,
		redo(): void {
			const entry: HistoryEntry | undefined = redoStack.pop();

			if (!entry) return;
			undoStack.push({ label: entry.label, project: cloneProject(state.project) });
			state = applyEditorCommand(state, { type: 'project/replace', project: entry.project, label: entry.label });
			emit();
		},
		run(transaction: EditorTransaction): void {
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
			const entry: HistoryEntry | undefined = undoStack.pop();

			if (!entry) return;
			redoStack.push({ label: entry.label, project: cloneProject(state.project) });
			state = applyEditorCommand(state, { type: 'project/replace', project: entry.project, label: entry.label });
			emit();
		}
	};
};
