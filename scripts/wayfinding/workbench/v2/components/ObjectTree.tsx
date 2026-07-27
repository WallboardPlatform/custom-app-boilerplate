import {
	ChevronRight,
	Eye,
	EyeOff,
	Search
} from 'lucide-solid';
import {
	createMemo,
	createSignal,
	For,
	Show,
	type Accessor,
	type JSX
} from 'solid-js';

import {
	elementDisplayName,
	selectedFloor
} from '../../../editor-core/selectors';
import type {
	EditorLayerId,
	EditorSnapshot,
	EditorStore
} from '../../../editor-core/types';

interface ObjectTreeProps {
	layerLabels: Record<EditorLayerId, string>;
	layerOrder: EditorLayerId[];
	snapshot: Accessor<EditorSnapshot>;
	store: EditorStore;
}

const searchableText = (value: string): string => value.trim().toLocaleLowerCase();

export const ObjectTree = (props: ObjectTreeProps): JSX.Element => {
	const [query, setQuery] = createSignal('');
	const state = createMemo(() => props.snapshot().state);
	const floor = createMemo(() => selectedFloor(state()));
	const grouped = createMemo(() => {
		const normalizedQuery = searchableText(query());

		return props.layerOrder
			.map((layerId) => ({
				items: floor().elements.filter((element) =>
					element.type === layerId
					&& (!normalizedQuery || searchableText(`${elementDisplayName(element)} ${element.id}`).includes(normalizedQuery))
				),
				layerId
			}))
			.filter((group) => group.items.length > 0);
	});

	return (
		<div class="object-browser">
			<label class="search-field">
				<Search size={15} />
				<input
					type="search"
					value={query()}
					placeholder="Search objects"
					onInput={(event) => setQuery(event.currentTarget.value)}
				/>
			</label>
			<Show
				when={grouped().length > 0}
				fallback={<p class="empty-copy">No matching objects on this floor.</p>}
			>
				<div class="object-groups">
					<For each={grouped()}>{(group) => (
						<details class="object-group" open>
							<summary>
								<ChevronRight size={14} />
								<span>{props.layerLabels[group.layerId]}</span>
								<small>{group.items.length}</small>
								<button
									type="button"
									class="icon-plain"
									aria-label={`${state().layerVisibility[group.layerId] ? 'Hide' : 'Show'} ${props.layerLabels[group.layerId]}`}
									onClick={(event) => {
										event.preventDefault();
										event.stopPropagation();
										props.store.dispatch({
											type: 'layer/set',
											layerId: group.layerId,
											visible: !state().layerVisibility[group.layerId]
										});
									}}
								>
									{state().layerVisibility[group.layerId] ? <Eye size={14} /> : <EyeOff size={14} />}
								</button>
							</summary>
							<div class="object-items">
								<For each={group.items}>{(element) => (
									<button
										type="button"
										class="object-item"
										classList={{
											active: state().selection?.kind === 'element'
												&& state().selection?.id === element.id
										}}
										onClick={() => props.store.dispatch({
											type: 'selection/set',
											selection: { id: element.id, kind: 'element' }
										})}
									>
										<span>{elementDisplayName(element)}</span>
										<small>{element.status}</small>
									</button>
								)}</For>
							</div>
						</details>
					)}</For>
				</div>
			</Show>
		</div>
	);
};
