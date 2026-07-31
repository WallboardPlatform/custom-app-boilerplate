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
	let currentDensity: WorkspaceDensity = 'wide';
	let pendingPanelClose: 'left' | 'right' | undefined;
	let previousDensity: WorkspaceDensity = 'wide';
	let previousPanels = store.getSnapshot().state.panels;

	const applyWidth = (width: number): void => {
		const nextDensity = densityForWidth(width);
		currentDensity = nextDensity;
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
		const unsubscribe = store.subscribe((snapshot) => {
			const panels = snapshot.state.panels;
			const bothOpen = !panels.left.collapsed && !panels.right.collapsed;

			if (currentDensity !== 'wide' && bothOpen) {
				const leftOpened = previousPanels.left.collapsed && !panels.left.collapsed;
				const panelToClose = leftOpened ? 'right' : 'left';

				previousPanels = panels;

				if (!pendingPanelClose) {
					pendingPanelClose = panelToClose;
					queueMicrotask(() => {
						const requestedPanel = pendingPanelClose;

						pendingPanelClose = undefined;

						if (!requestedPanel || currentDensity === 'wide') return;
						const currentPanels = store.getSnapshot().state.panels;

						if (currentPanels.left.collapsed || currentPanels.right.collapsed) return;
						store.dispatch({
							type: 'panel/toggle',
							panelId: requestedPanel,
							collapsed: true
						});
					});
				}

				return;
			}
			previousPanels = panels;
		});
		queueMicrotask(() => applyWidth(window.innerWidth));
		const onResize = (): void => applyWidth(window.innerWidth);
		window.addEventListener('resize', onResize);
		onCleanup(() => {
			unsubscribe();
			window.removeEventListener('resize', onResize);
		});
	});

	return density;
};
