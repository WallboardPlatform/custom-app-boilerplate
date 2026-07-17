export interface FontSizeSearchOptions {
	minimum: number;
	maximum: number;
	fits: (fontSize: number) => boolean;
}

export interface TextFitOptions {
	minFontSize: number;
	maxFontSize: number;
	safetyMarginPx?: number;
	widthOnly?: boolean;
}

const normalizeFontSize = (value: number, fallback: number): number => {
	return Number.isFinite(value) ? Math.max(1, Math.round(value)) : fallback;
};

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
	const configuredSafetyMargin: number = options.safetyMarginPx ?? 2;
	const safetyMargin: number = Number.isFinite(configuredSafetyMargin) ? Math.max(0, configuredSafetyMargin) : 2;
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

			const fitsWidth: boolean = element.scrollWidth <= availableWidth - safetyMargin;
			const fitsHeight: boolean = options.widthOnly || element.scrollHeight <= availableHeight - safetyMargin;

			return fitsWidth && fitsHeight;
		}
	});

	element.style.fontSize = `${size}px`;

	return size;
};
