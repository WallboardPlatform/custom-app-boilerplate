export interface FontSizeSearchOptions {
	minimum: number;
	maximum: number;
	fits: (fontSize: number) => boolean;
}

export interface TextFitOptions {
	minFontSize: number;
	maxFontSize: number;
	widthOnly?: boolean;
}

const normalizeFontSize = (value: number, fallback: number): number => {
	return Number.isFinite(value) ? Math.max(1, Math.round(value)) : fallback;
};

/**
 * `scrollWidth`/`scrollHeight` are clamped to the client box: they equal it when the content
 * fits and exceed it only when the content overflows. They can never report that the content
 * is *narrower* than the box.
 *
 * That is why this compares against the box directly rather than against a shrunken budget.
 * A previous safety margin subtracted a few pixels from the available extent, which no
 * candidate size could ever satisfy for an element that fills its container — the search
 * rejected everything and pinned the element to `minFontSize`. Text silently collapsed to its
 * floor, and the font-floor gate still passed because floor-pinned text is exactly at the floor.
 */
const fitsAxis = (scrollExtent: number, available: number): boolean => scrollExtent <= available;

export const findLargestFittingFontSize = (options: FontSizeSearchOptions): number => {
	let low: number = normalizeFontSize(options.minimum, 1);
	let high: number = Math.max(low, normalizeFontSize(options.maximum, low));
	let result: number = low;

	while (low <= high) {
		const candidate: number = Math.floor((low + high) / 2);

		if (options.fits(candidate)) {
			result = candidate;
			low = candidate + 1;
		} else {
			high = candidate - 1;
		}
	}

	return result;
};

export const fitTextElement = (element: HTMLElement, options: TextFitOptions): number => {
	const minimum: number = normalizeFontSize(options.minFontSize, 1);
	const maximum: number = Math.max(minimum, normalizeFontSize(options.maxFontSize, minimum));
	const availableWidth: number = element.clientWidth;
	const availableHeight: number = element.clientHeight;

	if (availableWidth <= 0 || (!options.widthOnly && availableHeight <= 0)) {
		return minimum;
	}

	const size: number = findLargestFittingFontSize({
		minimum,
		maximum,
		fits: (fontSize: number): boolean => {
			element.style.fontSize = `${fontSize}px`;

			return fitsAxis(element.scrollWidth, availableWidth)
				&& (options.widthOnly || fitsAxis(element.scrollHeight, availableHeight));
		}
	});

	element.style.fontSize = `${size}px`;

	return size;
};
