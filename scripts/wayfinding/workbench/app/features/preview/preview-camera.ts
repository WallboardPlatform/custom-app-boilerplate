export interface PreviewCameraLayout {
	destinationOpen: boolean;
	detailOnRight: boolean;
	preview: boolean;
	viewportHeight: number;
	viewportWidth: number;
}

export interface PreviewCameraInsets {
	bottom: number;
	left: number;
	right: number;
	top: number;
}

export interface PreviewCameraOffset {
	x: number;
	y: number;
}

const NO_INSETS: PreviewCameraInsets = { bottom: 0, left: 0, right: 0, top: 0 };
const NO_OFFSET: PreviewCameraOffset = { x: 0, y: 0 };

const isTallPortraitRoute = (layout: PreviewCameraLayout): boolean =>
	layout.destinationOpen
	&& layout.viewportHeight >= 1_200
	&& layout.viewportHeight >= layout.viewportWidth * 1.45;

export const previewCameraInsets = (
	layout: PreviewCameraLayout
): PreviewCameraInsets => {
	if (!layout.preview) return NO_INSETS;

	if (isTallPortraitRoute(layout)) {
		return {
			bottom: Math.round(layout.viewportHeight * 0.45),
			left: 0,
			right: 0,
			top: 0
		};
	}

	if (layout.viewportWidth <= 980) return NO_INSETS;

	if (!layout.destinationOpen) {
		return layout.viewportWidth <= 1_480
			? { bottom: 0, left: 0, right: 410, top: 0 }
			: NO_INSETS;
	}

	const detailInset = layout.viewportWidth >= 3_000 ? 620 : 420;

	if (layout.detailOnRight) {
		return layout.viewportWidth <= 1_480
			? { bottom: 0, left: 0, right: detailInset, top: 0 }
			: NO_INSETS;
	}

	return { bottom: 0, left: detailInset, right: 0, top: 0 };
};

export const previewCameraOffset = (
	layout: PreviewCameraLayout
): PreviewCameraOffset => {
	if (!layout.preview || !layout.destinationOpen) return NO_OFFSET;

	if (layout.viewportWidth <= 980 && layout.viewportHeight <= 500) {
		return { x: 0, y: -Math.min(64, layout.viewportHeight * 0.16) };
	}

	if (isTallPortraitRoute(layout)) {
		return { x: 0, y: Math.min(80, layout.viewportHeight * 0.04) };
	}

	return NO_OFFSET;
};
