import {
	Box,
	Frame,
	SquareDashedMousePointer
} from 'lucide-solid';
import { Show, type Accessor, type JSX } from 'solid-js';

import type {
	EditorSnapshot,
	EditorStore
} from '../../../editor-core/types';
import { Button } from '../ui';

interface StageToolbarProps {
	onFit: () => void;
	snapshot: Accessor<EditorSnapshot>;
	store: EditorStore;
	threeDimensionalReady: Accessor<boolean>;
}

export const StageToolbar = (props: StageToolbarProps): JSX.Element => (
	<div class="stage-toolbar" aria-label="Viewport controls">
		<div class="view-switcher" role="group" aria-label="Map view">
			<button
				type="button"
				aria-pressed={props.snapshot().state.viewMode === '2d'}
				classList={{ active: props.snapshot().state.viewMode === '2d' }}
				onClick={() => props.store.dispatch({ type: 'view/set', viewMode: '2d' })}
			>
				<SquareDashedMousePointer size={16} />
				<span>2D</span>
			</button>
			<Show when={props.threeDimensionalReady()}>
				<button
					type="button"
					aria-pressed={props.snapshot().state.viewMode === '3d'}
					classList={{ active: props.snapshot().state.viewMode === '3d' }}
					onClick={() => props.store.dispatch({ type: 'view/set', viewMode: '3d' })}
				>
					<Box size={16} />
					<span>3D</span>
				</button>
			</Show>
		</div>
		<Button class="stage-action" size="compact" tone="overlay" onClick={() => props.onFit()}>
			<Frame size={16} />
			<span>Fit</span>
		</Button>
	</div>
);
