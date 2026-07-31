import { CircleHelp } from 'lucide-solid';
import { createMemo, type Accessor, type JSX } from 'solid-js';

import { selectedFloor } from '../../../editor-core/selectors';
import type { EditorSnapshot } from '../../../editor-core/types';

interface StatusBarProps {
	onShowShortcuts: () => void;
	snapshot: Accessor<EditorSnapshot>;
	zoomScale?: Accessor<number | undefined>;
}

export const StatusBar = (props: StatusBarProps): JSX.Element => {
	const state = createMemo(() => props.snapshot().state);
	const floor = createMemo(() => selectedFloor(state()));

	return (
		<footer class="status-bar">
			<span class="document-state" classList={{ dirty: state().document.dirty }}>
				{state().document.saveState === 'saving'
					? 'Saving...'
					: state().document.dirty
						? 'Unsaved changes'
						: state().document.fileName
							? `Saved to ${state().document.fileName}`
							: 'Local draft'}
			</span>
			<span>{floor().name}</span>
			<span>
				{state().viewMode === '3d'
					? '3D'
					: `${Math.round((
						props.zoomScale?.()
							?? state().camera2dByFloor[floor().id]?.scale
							?? 1
					) * 100)}%`}
			</span>
			<span class="status-spacer" />
			<button type="button" class="status-help" onClick={() => props.onShowShortcuts()}>
				<CircleHelp size={14} /> Help
			</button>
		</footer>
	);
};
