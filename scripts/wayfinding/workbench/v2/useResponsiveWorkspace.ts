import {
	createSignal,
	onCleanup,
	onMount,
	type Accessor
} from 'solid-js';
import type { EditorStore } from '../../editor-core/types';

export type WorkspaceDensity = 'compact' | 'narrow' | 'wide';

const densityForWidth = (width: number): WorkspaceDensity => {
	if (width <= 900) return 'narrow';

	if (width <= 1240) return 'compact';

	return 'wide';
};

export const useResponsiveWorkspace = (
	store: EditorStore
): Accessor<WorkspaceDensity> => {
	const [density, setDensity] = createSignal<WorkspaceDensity>('wide');
	let previousDensity: WorkspaceDensity = 'wide';

	const applyWidth = (width: number): void => {
		const nextDensity = densityForWidth(width);
		setDensity(nextDensity);

		if (nextDensity === previousDensity) return;

		const panels = store.getSnapshot().state.panels;

		if (nextDensity !== 'wide' && !panels.right.collapsed) {
			store.dispatch({ type: 'panel/toggle', panelId: 'right', collapsed: true });
		}

		if (nextDensity === 'narrow' && !panels.left.collapsed) {
			store.dispatch({ type: 'panel/toggle', panelId: 'left', collapsed: true });
		}
		previousDensity = nextDensity;
	};

	onMount(() => {
		queueMicrotask(() => applyWidth(window.innerWidth));
		const onResize = (): void => applyWidth(window.innerWidth);
		window.addEventListener('resize', onResize);
		onCleanup(() => window.removeEventListener('resize', onResize));
	});

	return density;
};
