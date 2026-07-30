import {
	Copy,
	ChevronRight,
	Eye,
	EyeOff,
	Focus,
	Layers2,
	Trash2,
	Search
} from 'lucide-solid';
import {
	createMemo,
	createSignal,
	For,
	Show,
	untrack,
	type Accessor,
	type JSX
} from 'solid-js';

import {
	elementDisplayName,
	selectedFloor
} from '../../../editor-core/selectors';
import type { WayfindingStudioElement } from '../../../studio-project.mts';
import type {
	EditorLayerId,
	EditorSnapshot,
	EditorStore
} from '../../../editor-core/types';
import type { CanvasSelectionActions } from '../Canvas2d';

interface ObjectTreeProps {
	actions: Accessor<CanvasSelectionActions | undefined>;
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
	const displayName = (element: WayfindingStudioElement): string =>
		elementDisplayName(element, state().project);
	const selectElement = (id: string): void => {
		props.store.dispatch({
			type: 'selection/set',
			selection: { id, kind: 'element' }
		});
	};
	const runElementAction = (
		id: string,
		action: (actions: CanvasSelectionActions) => void
	): void => {
		selectElement(id);
		queueMicrotask(() => {
			const actions = untrack(() => props.actions());

			if (actions) action(actions);
		});
	};
	const soloLayer = (layerId: EditorLayerId): void => {
		for (const candidate of props.layerOrder) {
			props.store.dispatch({
				type: 'layer/set',
				layerId: candidate,
				visible: candidate === layerId
			});
		}
	};
	const grouped = createMemo(() => {
		const normalizedQuery = searchableText(query());

		return props.layerOrder
			.map((layerId) => ({
				items: floor().elements.filter((element) =>
					element.type === layerId
					&& (!normalizedQuery || searchableText(`${displayName(element)} ${element.id}`).includes(normalizedQuery))
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
									aria-label={`Show only ${props.layerLabels[group.layerId]}`}
									title="Show only this layer"
									onClick={(event) => {
										event.preventDefault();
										event.stopPropagation();
										soloLayer(group.layerId);
									}}
								>
									<Layers2 size={14} />
								</button>
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
									<div
										class="object-item"
										classList={{
											active: state().selection?.kind === 'element'
												&& state().selection?.id === element.id
										}}
										aria-label={displayName(element)}
										onClick={() => selectElement(element.id)}
										onKeyDown={(event) => {
											if (event.key === 'Enter' || event.key === ' ') {
												event.preventDefault();
												selectElement(element.id);
											}
										}}
										role="button"
										tabIndex={0}
									>
										<span class="object-item-copy">
											<strong>{displayName(element)}</strong>
											<small>{element.status}</small>
										</span>
										<span class="object-item-actions">
											<button
												type="button"
												aria-label={`Focus ${displayName(element)}`}
												title="Focus on canvas"
												onClick={(event) => {
													event.stopPropagation();
													runElementAction(element.id, (actions) => actions.fit());
												}}
											><Focus size={14} /></button>
											<button
												type="button"
												aria-label={`Duplicate ${displayName(element)}`}
												title="Duplicate"
												onClick={(event) => {
													event.stopPropagation();
													runElementAction(element.id, (actions) => actions.duplicate());
												}}
											><Copy size={14} /></button>
											<button
												type="button"
												class="danger"
												aria-label={`Delete ${displayName(element)}`}
												title="Delete"
												onClick={(event) => {
													event.stopPropagation();
													runElementAction(element.id, (actions) => actions.delete());
												}}
											><Trash2 size={14} /></button>
										</span>
									</div>
								)}</For>
							</div>
						</details>
					)}</For>
				</div>
			</Show>
		</div>
	);
};
