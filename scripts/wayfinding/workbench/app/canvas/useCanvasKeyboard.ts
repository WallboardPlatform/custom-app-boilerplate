import type {
	EditorDraft,
	EditorSnapshot,
	EditorStore
} from '../../../editor-core/types';
import type { WayfindingPoint } from '../../../../../src/utils/wayfinding.js';
import {
	isRouteToolAvailable,
	type RouteWorkspaceView
} from '../features/routing/route-workspace';
import {
	isEditableTarget,
	toolFromShortcut
} from './interaction';

export interface CanvasKeyboardController {
	isSpaceHeld: () => boolean;
	keyDown: (event: KeyboardEvent) => void;
	keyUp: (event: KeyboardEvent) => void;
}

export const createCanvasKeyboardController = (options: {
	cancelInteraction: () => void;
	draft: () => EditorDraft | undefined;
	duplicateSelection: () => boolean;
	finishPolygonDraft: () => void;
	finishRouteDraft: () => void;
	notify?: (message: string, tone?: 'danger' | 'info' | 'success' | 'warning') => void;
	nudgeSelection: (delta: WayfindingPoint) => boolean;
	removeSelection: () => void;
	removeSelectionPoint: () => boolean;
	routeWorkspaceView: () => RouteWorkspaceView;
	snapshot: () => EditorSnapshot;
	store: EditorStore;
}): CanvasKeyboardController => {
	let spaceHeld = false;

	const keyDown = (event: KeyboardEvent): void => {
		if (isEditableTarget(event.target)) return;

		if (event.code === 'Space') {
			spaceHeld = true;
			event.preventDefault();

			return;
		}

		if (event.key === 'Escape') {
			options.cancelInteraction();

			return;
		}

		if (event.key === 'Enter') {
			if (options.draft()?.kind === 'polygon') options.finishPolygonDraft();

			if (options.draft()?.kind === 'route-edge') options.finishRouteDraft();

			return;
		}

		if (event.key === 'Delete' || event.key === 'Backspace') {
			event.preventDefault();
			const selection = options.snapshot().state.selection;
			const hasSelectedPoint = (
				selection?.kind === 'element' && selection.vertexIndex !== undefined
			) || (
				selection?.kind === 'graph-edge' && selection.geometryIndex !== undefined
			);

			if (hasSelectedPoint) {
				if (!options.removeSelectionPoint()) {
					options.notify?.(
						selection?.kind === 'graph-edge'
							? 'Route endpoints belong to their route points and cannot be removed.'
							: 'A room or area outline needs at least three points.',
						'warning'
					);
				}

				return;
			}
			options.removeSelection();

			return;
		}

		if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'd') {
			if (options.duplicateSelection()) event.preventDefault();

			return;
		}

		if (event.key.startsWith('Arrow')) {
			const distance = event.shiftKey ? 10 : 1;
			const delta = event.key === 'ArrowLeft'
				? { x: -distance, y: 0 }
				: event.key === 'ArrowRight'
					? { x: distance, y: 0 }
					: event.key === 'ArrowUp'
						? { x: 0, y: -distance }
						: { x: 0, y: distance };

			if (options.nudgeSelection(delta)) event.preventDefault();

			return;
		}

		const state = options.snapshot().state;
		const tool = toolFromShortcut(
			event.key.toLocaleLowerCase(),
			state.workspace === 'route-edit'
		);
		const toolAvailable = tool && (
			state.workspace !== 'route-edit'
			|| isRouteToolAvailable(options.routeWorkspaceView(), tool)
		);

		if (tool && toolAvailable && !event.ctrlKey && !event.metaKey && !event.altKey) {
			options.store.dispatch({ type: 'tool/set', tool });
		}
	};

	const keyUp = (event: KeyboardEvent): void => {
		if (event.code === 'Space') spaceHeld = false;
	};

	return {
		isSpaceHeld: () => spaceHeld,
		keyDown,
		keyUp
	};
};
