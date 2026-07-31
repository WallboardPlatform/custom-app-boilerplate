import { createEditorState } from '../../editor-core/state';
import type {
	EditorPanelId,
	EditorState,
	EditorStore
} from '../../editor-core/types';

export const PANEL_WIDTH_STORAGE_KEY = 'wallboard.wayfinding-studio.panel-widths';

interface StoredPanelWidths {
	left: number;
	right: number;
	version: 1;
}

const panelIds: EditorPanelId[] = ['left', 'right'];
const validWidth = (value: unknown): value is number =>
	typeof value === 'number' && Number.isFinite(value) && value >= 240 && value <= 520;

const browserStorage = (): Storage | undefined => {
	try {
		return typeof window === 'undefined' ? undefined : window.localStorage;
	} catch {
		return undefined;
	}
};

const readStoredWidths = (): StoredPanelWidths | undefined => {
	const storage = browserStorage();

	if (!storage) return undefined;

	try {
		const value = JSON.parse(storage.getItem(PANEL_WIDTH_STORAGE_KEY) ?? 'null') as Partial<StoredPanelWidths> | null;

		if (
			value?.version !== 1
			|| !validWidth(value.left)
			|| !validWidth(value.right)
		) return undefined;

		return {
			left: value.left,
			right: value.right,
			version: 1
		};
	} catch {
		return undefined;
	}
};

export const createEditorStateWithPanelPreferences = (): EditorState => {
	const state = createEditorState();
	const stored = readStoredWidths();

	if (!stored) return state;

	for (const panelId of panelIds) state.panels[panelId].width = stored[panelId];

	return state;
};

export const persistPanelWidthPreferences = (store: EditorStore): (() => void) => {
	let timer: ReturnType<typeof setTimeout> | undefined;
	let previous = '';
	const unsubscribe = store.subscribe((snapshot) => {
		const serialized = JSON.stringify({
			left: snapshot.state.panels.left.width,
			right: snapshot.state.panels.right.width,
			version: 1
		} satisfies StoredPanelWidths);

		if (serialized === previous) return;
		previous = serialized;

		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			try {
				browserStorage()?.setItem(PANEL_WIDTH_STORAGE_KEY, serialized);
			} catch {
				// Editor preferences are best-effort and must never interrupt authoring.
			}
		}, 120);
	});

	return (): void => {
		unsubscribe();

		if (timer) clearTimeout(timer);
	};
};
