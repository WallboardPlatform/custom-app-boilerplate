import type {
	Accessor,
	JSX
} from 'solid-js';

import type {
	EditorPanelId,
	EditorStore
} from '../../../editor-core/types';

interface PanelResizeHandleProps {
	panelId: EditorPanelId;
	store: EditorStore;
	width: Accessor<number>;
}

export const PanelResizeHandle = (props: PanelResizeHandleProps): JSX.Element => {
	const beginResize = (event: PointerEvent): void => {
		event.preventDefault();
		const startX = event.clientX;
		const startWidth = props.width();
		const direction = props.panelId === 'left' ? 1 : -1;
		const target = event.currentTarget as HTMLElement;
		target.setPointerCapture(event.pointerId);
		const move = (moveEvent: PointerEvent): void => {
			const width = startWidth + ((moveEvent.clientX - startX) * direction);
			props.store.dispatch({
				type: 'panel/resize',
				panelId: props.panelId,
				width
			});
		};
		const end = (): void => {
			target.removeEventListener('pointermove', move);
			target.removeEventListener('pointerup', end);
			target.removeEventListener('pointercancel', end);
		};
		target.addEventListener('pointermove', move);
		target.addEventListener('pointerup', end);
		target.addEventListener('pointercancel', end);
	};

	return (
		<div
			class={`panel-resize-handle panel-resize-handle--${props.panelId}`}
			role="separator"
			aria-label={`Resize ${props.panelId} panel`}
			aria-orientation="vertical"
			tabIndex={0}
			onPointerDown={beginResize}
			onKeyDown={(event) => {
				if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
				event.preventDefault();
				const visualDirection = event.key === 'ArrowRight' ? 1 : -1;
				const panelDirection = props.panelId === 'left' ? visualDirection : -visualDirection;
				props.store.dispatch({
					type: 'panel/resize',
					panelId: props.panelId,
					width: props.width() + (panelDirection * 16)
				});
			}}
		/>
	);
};
