export interface CameraInsets {
	bottom: number;
	left: number;
	right: number;
	top: number;
}

export interface CameraLayoutRect {
	bottom: number;
	left: number;
	right: number;
	top: number;
}

export interface CameraOverlay {
	edge: keyof CameraInsets;
	rect: CameraLayoutRect;
	visible: boolean;
}

export const EMPTY_CAMERA_INSETS: CameraInsets = {
	bottom: 0,
	left: 0,
	right: 0,
	top: 0
};

export const calculateCameraInsets = (
	viewport: CameraLayoutRect,
	overlays: readonly CameraOverlay[],
	padding = 12
): CameraInsets => {
	const insets = { ...EMPTY_CAMERA_INSETS };

	for (const overlay of overlays) {
		const bounds = overlay.rect;
		const intersects = bounds.right > viewport.left
			&& bounds.left < viewport.right
			&& bounds.bottom > viewport.top
			&& bounds.top < viewport.bottom;

		if (!overlay.visible || !intersects) continue;
		const distance = overlay.edge === 'left'
			? bounds.right - viewport.left
			: overlay.edge === 'right'
				? viewport.right - bounds.left
				: overlay.edge === 'top'
					? bounds.bottom - viewport.top
					: viewport.bottom - bounds.top;

		insets[overlay.edge] = Math.max(
			insets[overlay.edge],
			Math.ceil(distance + padding)
		);
	}

	return insets;
};

const overlayElements = (
	workArea: Element,
	edge: keyof CameraInsets,
	selector: string
): CameraOverlay[] => [...workArea.querySelectorAll<HTMLElement>(selector)].map((element) => {
	const style = getComputedStyle(element);

	return {
		edge,
		rect: element.getBoundingClientRect(),
		visible: style.display !== 'none'
			&& style.visibility !== 'hidden'
			&& Number(style.opacity) > 0
	};
});

export const editorCameraInsets = (viewport: HTMLElement): CameraInsets => {
	const workArea = viewport.closest('.work-area');

	if (!workArea) return EMPTY_CAMERA_INSETS;

	return calculateCameraInsets(viewport.getBoundingClientRect(), [
		...overlayElements(workArea, 'left', '.left-panel, .tool-rail, .panel-reopen.left'),
		...overlayElements(workArea, 'right', '.right-panel, .floor-navigator, .panel-reopen.right'),
		...overlayElements(workArea, 'top', '.stage-toolbar'),
		...overlayElements(workArea, 'bottom', '.selection-toolbar')
	]);
};
