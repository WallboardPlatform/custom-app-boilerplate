import {
	Box,
	Frame,
	SquareDashedMousePointer
} from 'lucide-solid';
import { type Accessor, type JSX } from 'solid-js';

import type {
	EditorSnapshot,
	EditorStore
} from '../../../editor-core/types';
import { Button } from '../ui';

interface StageToolbarProps {
	onFit: () => void;
	snapshot: Accessor<EditorSnapshot>;
	store: EditorStore;
	threeDimensionalReason: Accessor<string | undefined>;
	threeDimensionalReady: Accessor<boolean>;
}

export const StageToolbar = (props: StageToolbarProps): JSX.Element => (
	<div class="stage-toolbar" aria-label="Viewport controls">
		<div class="view-switcher" role="group" aria-label="Map view">
			<button
				type="button"
				aria-label="2D"
				aria-pressed={props.snapshot().state.viewMode === '2d'}
				classList={{ active: props.snapshot().state.viewMode === '2d' }}
				onClick={() => props.store.dispatch({ type: 'view/set', viewMode: '2d' })}
			>
				<SquareDashedMousePointer size={16} />
				<span>2D</span>
			</button>
			<button
				type="button"
				aria-label="3D"
				aria-disabled={!props.threeDimensionalReady()}
				aria-pressed={props.snapshot().state.viewMode === '3d'}
				classList={{ active: props.snapshot().state.viewMode === '3d' }}
				title={props.threeDimensionalReady()
					? 'Switch to 3D'
					: `3D preview needs attention: ${props.threeDimensionalReason() ?? 'Complete the active floor.'}`}
				onClick={() => {
					if (props.threeDimensionalReady()) {
						props.store.dispatch({ type: 'view/set', viewMode: '3d' });
					}
				}}
			>
				<Box size={16} />
				<span>3D</span>
			</button>
		</div>
		<Button ariaLabel="Fit" class="stage-action" size="compact" tone="overlay" onClick={() => props.onFit()}>
			<Frame size={16} />
			<span>Fit</span>
		</Button>
	</div>
);
