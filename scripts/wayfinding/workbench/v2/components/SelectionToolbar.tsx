import {
	CircleMinus,
	CirclePlus,
	Copy,
	Focus,
	MousePointer2,
	Route,
	Sparkles,
	Trash2,
	X
} from 'lucide-solid';
import { Show, type Accessor, type JSX } from 'solid-js';

import type { EditorSnapshot } from '../../../editor-core/types';
import type { CanvasSelectionActions } from '../Canvas2d';

interface SelectionToolbarProps {
	actions: Accessor<CanvasSelectionActions | undefined>;
	label: Accessor<string>;
	snapshot: Accessor<EditorSnapshot>;
}

export const SelectionToolbar = (props: SelectionToolbarProps): JSX.Element => {
	const descriptor = (): ReturnType<CanvasSelectionActions['descriptor']> =>
		props.actions()?.descriptor();

	return (
		<Show when={props.snapshot().state.selection && props.actions() && descriptor()}>
			<div class="selection-toolbar" aria-label="Selection actions">
				<span class="selection-context">
					<MousePointer2 size={14} />
					<span>
						<strong>{props.label()}</strong>
						<Show when={(descriptor()?.pointCount ?? 0) > 1}>
							<small>{descriptor()?.pointCount} points</small>
						</Show>
					</span>
				</span>
				<div class="selection-action-group" aria-label="View selection">
					<Show when={descriptor()?.canFit}>
						<button type="button" onClick={() => props.actions()?.fit()} title="Focus selection">
							<Focus size={15} /><span>Focus</span>
						</button>
					</Show>
				</div>
				<div class="selection-action-group" aria-label="Edit selection">
					<Show when={descriptor()?.canAddPoint && descriptor()?.pointKind}>
						{(kind) => (
							<button
								type="button"
								onClick={() => props.actions()?.addPoint()}
								title={`Add ${kind()} after the selected point`}
							>
								<CirclePlus size={15} /><span>Add {kind()}</span>
							</button>
						)}
					</Show>
					<Show when={descriptor()?.canDuplicate}>
						<button type="button" onClick={() => props.actions()?.duplicate()} title="Duplicate selection">
							<Copy size={15} /><span>Duplicate</span>
						</button>
					</Show>
					<Show when={descriptor()?.canSimplify}>
						<button
							type="button"
							onClick={() => props.actions()?.simplify()}
							title="Remove tiny edges and redundant shape points"
						>
							<Sparkles size={15} /><span>Simplify shape</span>
						</button>
					</Show>
					<Show when={descriptor()?.canRepair}>
						<button
							type="button"
							onClick={() => props.actions()?.repair()}
							title="Remove spikes, redundant bends, and snap this segment to its endpoints"
						>
							<Sparkles size={15} />
							<span>Repair segment</span>
							<Show when={(descriptor()?.issueCount ?? 0) > 0}>
								<span class="selection-action-count">{descriptor()?.issueCount}</span>
							</Show>
						</button>
					</Show>
					<Show when={descriptor()?.canStraighten}>
						<button
							type="button"
							onClick={() => props.actions()?.straighten()}
							title="Replace this segment with a direct line between its route points"
						>
							<Route size={15} /><span>Straighten</span>
						</button>
					</Show>
				</div>
				<div class="selection-action-group selection-action-group-end" aria-label="Remove selection">
					<Show
						when={descriptor()?.canRemovePoint && descriptor()?.pointKind}
						fallback={(
							<Show when={descriptor()?.canDelete}>
								<button
									type="button"
									class="danger"
									onClick={() => props.actions()?.delete()}
									title="Delete selected object"
								>
									<Trash2 size={15} /><span>Delete</span>
								</button>
							</Show>
						)}
					>
						{(kind) => (
							<button
								type="button"
								class="danger"
								onClick={() => props.actions()?.removePoint()}
								title={`Remove selected ${kind()}`}
							>
								<CircleMinus size={15} /><span>Remove point</span>
							</button>
						)}
					</Show>
					<button type="button" class="icon-only" onClick={() => props.actions()?.clear()} title="Deselect">
						<X size={15} />
					</button>
				</div>
			</div>
		</Show>
	);
};
