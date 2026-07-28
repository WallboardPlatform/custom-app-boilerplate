import type { TextInkMeasurement } from './text-ink-safety';

export interface VisualMetrics {
	rootWidth: number;
	rootHeight: number;
	visibleLeafNodes: number;
	contentWidthCoverage: number;
	contentHeightCoverage: number;
	horizontalOverflow: string[];
	verticalOverflow: string[];
	outsideRoot: string[];
	brokenImages: string[];
	textInkMeasurements: TextInkMeasurement[];
}

/**
 * Collects every geometric and asset fact the visual gate asserts on.
 *
 * This runs inside the page via `page.evaluate`, so it must stay self-contained: no imports, no
 * module-scope helpers, nothing but DOM globals. It lives in its own module so the gate can be
 * tested against synthetic DOM instead of only against whatever the examples happen to render —
 * every check here was written to catch a defect, and a check that no test can make fail is not
 * a check.
 */
export const collectVisualMetrics = (): VisualMetrics => {
	const root: HTMLElement | null = document.getElementById('wallboard-preview-root');

	if (!root) {
		throw new Error('Preview root was not found.');
	}

	const rootRect: DOMRect = root.getBoundingClientRect();
	const elements: HTMLElement[] = Array.from(root.querySelectorAll<HTMLElement>('*'));
	const horizontalOverflow: string[] = [];
	const verticalOverflow: string[] = [];
	const outsideRoot: string[] = [];
	const leafRects: DOMRect[] = [];
	const textInkMeasurements: TextInkMeasurement[] = [];
	const canvas: HTMLCanvasElement = document.createElement('canvas');
	const canvasContext: CanvasRenderingContext2D | null = canvas.getContext('2d');

	/**
	 * A broken image counts as a defect only when the widget leaves it on screen.
	 *
	 * This deliberately does not reuse the general visibility filter. That filter also rejects
	 * zero-size elements, and an image that fails to load has no intrinsic size, so it collapses
	 * to a 0x0 box and was always skipped — the check could never fire on the breakage it exists
	 * to catch, and only ever fired on images that were still loading but already had a laid-out
	 * box, which is a race rather than a defect.
	 *
	 * What does matter is whether the widget handled the failure. Removing the image from the
	 * DOM or hiding it behind a designed fallback is correct behaviour and must stay quiet;
	 * leaving a broken image rendered is the defect.
	 */
	const collectBrokenImages = (): string[] => {
		return Array.from(root.querySelectorAll('img'))
			.filter((image: HTMLImageElement): boolean => {
				if (!image.complete || image.naturalWidth > 0) {
					return false;
				}

				const imageStyle: CSSStyleDeclaration = window.getComputedStyle(image);

				return imageStyle.display !== 'none'
					&& imageStyle.visibility !== 'hidden'
					&& Number(imageStyle.opacity) !== 0;
			})
			.map((image: HTMLImageElement): string => describeElement(image));
	};

	const describeElement = (element: HTMLElement): string => {
		const id: string = element.id ? `#${element.id}` : '';
		const classes: string = Array.from(element.classList)
			.slice(0, 2)
			.map((className: string): string => `.${className}`)
			.join('');

		return `${element.tagName.toLowerCase()}${id}${classes}`;
	};

	const renderedText = (text: string, transform: string): string => {
		if (transform === 'uppercase') {
			return text.toUpperCase();
		}

		if (transform === 'lowercase') {
			return text.toLowerCase();
		}

		if (transform === 'capitalize') {
			return text.replace(/\b\S/g, (character: string): string => character.toUpperCase());
		}

		return text;
	};
	const clipsVerticalOverflow = (style: CSSStyleDeclaration): boolean => {
		return ['clip', 'hidden'].includes(style.overflowY)
			&& !['contents', 'inline'].includes(style.display);
	};

	for (const element of elements) {
		const style: CSSStyleDeclaration = window.getComputedStyle(element);
		const rect: DOMRect = element.getBoundingClientRect();
		const isVisible: boolean =
			style.display !== 'none' &&
			style.visibility !== 'hidden' &&
			Number(style.opacity) !== 0 &&
			rect.width > 0 &&
			rect.height > 0;

		if (!isVisible) {
			continue;
		}

		const allowsOffCanvasContent: boolean = Boolean(element.closest('[data-preview-allow-overflow]'));
		const clipsTextWithEllipsis: boolean =
			element.childElementCount === 0 &&
			style.textOverflow === 'ellipsis' &&
			['clip', 'hidden'].includes(style.overflowX);

		if (
			!allowsOffCanvasContent &&
			!clipsTextWithEllipsis &&
			element.clientWidth > 0 &&
			element.scrollWidth > element.clientWidth + 1
		) {
			horizontalOverflow.push(describeElement(element));
		}

		if (
			!allowsOffCanvasContent &&
			element.childElementCount > 0 &&
			element.clientHeight > 0 &&
			['auto', 'clip', 'hidden', 'scroll'].includes(style.overflowY) &&
			element.scrollHeight > element.clientHeight + 1
		) {
			verticalOverflow.push(describeElement(element));
		}

		if (
			!allowsOffCanvasContent &&
			element !== root &&
			(rect.left < rootRect.left - 1 ||
				rect.right > rootRect.right + 1 ||
				rect.top < rootRect.top - 1 ||
				rect.bottom > rootRect.bottom + 1)
		) {
			outsideRoot.push(describeElement(element));
		}

		const tagName: string = element.tagName.toLowerCase();
		const hasPaintedText: boolean = element.childElementCount === 0 && Boolean(element.textContent?.trim());
		const hasBackgroundImage: boolean = style.backgroundImage !== 'none';
		const isVisualLeaf: boolean =
			hasPaintedText || hasBackgroundImage || ['canvas', 'img', 'svg', 'video'].includes(tagName);

		if (isVisualLeaf) {
			leafRects.push(rect);
		}

		const text: string = element.textContent?.trim() ?? '';
		const lineHeight: number = Number.parseFloat(style.lineHeight);

		if (
			canvasContext
			&& element.childElementCount === 0
			&& text
			&& clipsVerticalOverflow(style)
			&& Number.isFinite(lineHeight)
		) {
			let visibleTop: number = rect.top;
			let visibleBottom: number = rect.bottom;
			let clippingAncestor: HTMLElement | null = element;

			while (clippingAncestor && clippingAncestor !== root.parentElement) {
				const ancestorStyle: CSSStyleDeclaration = window.getComputedStyle(clippingAncestor);

				if (clipsVerticalOverflow(ancestorStyle)) {
					const ancestorRect: DOMRect = clippingAncestor.getBoundingClientRect();

					visibleTop = Math.max(visibleTop, ancestorRect.top);
					visibleBottom = Math.min(visibleBottom, ancestorRect.bottom);
				}

				clippingAncestor = clippingAncestor.parentElement;
			}

			const intentionallyClippedByOverflowRegion: boolean =
				allowsOffCanvasContent &&
				(visibleTop > rect.top + 0.5 || visibleBottom < rect.bottom - 0.5);

			if (intentionallyClippedByOverflowRegion) {
				continue;
			}

			const range: Range = document.createRange();
			range.selectNodeContents(element);
			const lineTops: Set<number> = new Set(
				Array.from(range.getClientRects())
					.filter((lineRect: DOMRect): boolean => lineRect.width > 0 && lineRect.height > 0)
					.map((lineRect: DOMRect): number => Math.round(lineRect.top * 2) / 2)
			);
			const measuredText: string = renderedText(text, style.textTransform);
			canvasContext.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
			const textMetrics: TextMetrics = canvasContext.measureText(measuredText);

			textInkMeasurements.push({
				selector: describeElement(element),
				text: measuredText.length > 80 ? `${measuredText.slice(0, 77)}...` : measuredText,
				overflowY: style.overflowY,
				fontSize: Number.parseFloat(style.fontSize),
				lineHeight,
				boxHeight: rect.height,
				layoutHeight: element.offsetHeight || undefined,
				visibleHeight: Math.max(0, visibleBottom - visibleTop),
				borderTop: Number.parseFloat(style.borderTopWidth) || 0,
				borderBottom: Number.parseFloat(style.borderBottomWidth) || 0,
				paddingBottom: Number.parseFloat(style.paddingBottom) || 0,
				lineCount: Math.max(1, lineTops.size),
				actualAscent: textMetrics.actualBoundingBoxAscent,
				actualDescent: textMetrics.actualBoundingBoxDescent
			});
		}
	}

	const contentBounds = leafRects.reduce(
		(bounds, rect: DOMRect) => {
			return {
				left: Math.min(bounds.left, Math.max(rootRect.left, rect.left)),
				top: Math.min(bounds.top, Math.max(rootRect.top, rect.top)),
				right: Math.max(bounds.right, Math.min(rootRect.right, rect.right)),
				bottom: Math.max(bounds.bottom, Math.min(rootRect.bottom, rect.bottom))
			};
		},
		{
			left: rootRect.right,
			top: rootRect.bottom,
			right: rootRect.left,
			bottom: rootRect.top
		}
	);

	const contentWidth: number = Math.max(0, contentBounds.right - contentBounds.left);
	const contentHeight: number = Math.max(0, contentBounds.bottom - contentBounds.top);

	return {
		rootWidth: rootRect.width,
		rootHeight: rootRect.height,
		visibleLeafNodes: leafRects.length,
		contentWidthCoverage: Math.round((contentWidth / rootRect.width) * 100),
		contentHeightCoverage: Math.round((contentHeight / rootRect.height) * 100),
		horizontalOverflow: [...new Set(horizontalOverflow)],
		verticalOverflow: [...new Set(verticalOverflow)],
		outsideRoot: [...new Set(outsideRoot)],
		brokenImages: [...new Set(collectBrokenImages())],
		textInkMeasurements
	};
};
