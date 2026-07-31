import { Layers3 } from 'lucide-solid';
import { createMemo, For, Show, type Accessor, type JSX } from 'solid-js';

import type { EditorSnapshot, EditorStore } from '../../../editor-core/types';

export const FloorNavigator = (props: {
	snapshot: Accessor<EditorSnapshot>;
	store: EditorStore;
}): JSX.Element => {
	const floors = createMemo(() => [...props.snapshot().state.project.floors]
		.sort((left, right) => left.order - right.order));

	return (
		<Show when={floors().length > 1}>
			<nav class="floor-navigator" aria-label="Map floors">
				<header>
					<Layers3 size={15} aria-hidden="true" />
					<span>Floors</span>
				</header>
				<div class="floor-navigator__levels">
					<For each={floors()}>{(floor, index) => (
						<button
							type="button"
							classList={{ active: props.snapshot().state.currentFloorId === floor.id }}
							aria-current={props.snapshot().state.currentFloorId === floor.id ? 'page' : undefined}
							title={`Show ${floor.name}`}
							onClick={() => props.store.dispatch({ type: 'floor/select', floorId: floor.id })}
						>
							<span>{index() + 1}</span>
							<strong>{floor.name}</strong>
						</button>
					)}</For>
				</div>
			</nav>
		</Show>
	);
};
