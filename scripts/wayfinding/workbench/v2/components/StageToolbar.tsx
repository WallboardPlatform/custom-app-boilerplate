import {
	Box,
	Frame,
	Network,
	SquareDashedMousePointer
} from 'lucide-solid';
import { Show, type Accessor, type JSX } from 'solid-js';

import type {
	EditorSnapshot,
	EditorStore
} from '../../../editor-core/types';

interface StageToolbarProps {
	onFit: () => void;
	snapshot: Accessor<EditorSnapshot>;
	store: EditorStore;
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
			<button
				type="button"
				aria-pressed={props.snapshot().state.viewMode === '3d'}
				classList={{ active: props.snapshot().state.viewMode === '3d' }}
				onClick={() => props.store.dispatch({ type: 'view/set', viewMode: '3d' })}
			>
				<Box size={16} />
				<span>3D</span>
			</button>
		</div>
		<button type="button" class="button compact stage-action" onClick={() => props.onFit()}>
			<Frame size={16} />
			<span>Fit</span>
		</button>
		<Show when={props.snapshot().state.workspace === 'route-preview'}>
			<button
				type="button"
				class="button compact stage-action stage-network-toggle"
				classList={{ active: props.snapshot().state.layerVisibility['route-network'] }}
				aria-pressed={props.snapshot().state.layerVisibility['route-network']}
				title="Show the authored route graph behind the visitor route"
				onClick={() => props.store.dispatch({
						type: 'layer/set',
						layerId: 'route-network',
						visible: !props.snapshot().state.layerVisibility['route-network']
					})}
			>
				<Network size={15} />
				<span>Route graph</span>
			</button>
		</Show>
	</div>
);
