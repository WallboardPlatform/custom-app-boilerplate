import type { PdfPageDescriptor, PdfPageLayout, PdfViewerOptions } from './types';

const positive = (value: number, fallback: number): number => {
	return Number.isFinite(value) && value > 0 ? value : fallback;
};

export const calculatePdfPageLayout = (
	page: PdfPageDescriptor,
	containerWidth: number,
	containerHeight: number,
	options: PdfViewerOptions,
	zoom: number
): PdfPageLayout => {
	const nativeWidth: number = positive(page.width, 612);
	const nativeHeight: number = positive(page.height, 792);
	const pageInset: number = Math.max(0, options.pagePadding) * 2;
	const scrollbarInset: number = options.hideScrollbars ? 0 : 8;
	const availableWidth: number = Math.max(1, containerWidth - pageInset - scrollbarInset);
	const availableHeight: number = Math.max(1, containerHeight - pageInset - scrollbarInset);
	const widthRatio: number = availableWidth / nativeWidth;
	const heightRatio: number = availableHeight / nativeHeight;
	let renderScale = 1;
	let transformWidth = 1;
	let transformHeight = 1;

	switch (options.fit) {
		case 'actual':
			renderScale = 1;
			break;

		case 'width':
			renderScale = widthRatio;
			break;

		case 'height':
			renderScale = heightRatio;
			break;

		case 'fill':
			renderScale = Math.max(widthRatio, heightRatio);
			transformWidth = widthRatio / renderScale;
			transformHeight = heightRatio / renderScale;
			break;

		case 'cover':
			renderScale = options.scrollDirection === 'horizontal' ? heightRatio : widthRatio;
			break;

		case 'contain':
		default:
			renderScale = Math.min(widthRatio, heightRatio);
			break;
	}

	renderScale = Math.max(0.05, renderScale * zoom);
	const renderedWidth: number = Math.max(1, nativeWidth * renderScale);
	const renderedHeight: number = Math.max(1, nativeHeight * renderScale);

	return {
		height: Math.round(renderedHeight * transformHeight),
		renderScale,
		renderedHeight: Math.round(renderedHeight),
		renderedWidth: Math.round(renderedWidth),
		transformHeight,
		transformWidth,
		width: Math.round(renderedWidth * transformWidth)
	};
};

export const pageExtent = (layout: PdfPageLayout, options: PdfViewerOptions): number => {
	const pageSize: number = options.scrollDirection === 'horizontal' ? layout.width : layout.height;

	return pageSize + options.pagePadding + options.separatorSize;
};
