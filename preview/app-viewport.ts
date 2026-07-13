import configJson from '../src/editor-assets/properties.json';

export interface AppViewport {
	width: number;
	height: number;
}

const parseDimension = (value: unknown, name: string): number => {
	const stringValue: string = String(value).trim();
	const parsed: number =
		typeof value === 'number'
			? value
			: /^\d+(?:\.\d+)?px$/.test(stringValue)
				? Number.parseFloat(stringValue)
				: Number.NaN;

	if (!Number.isFinite(parsed) || parsed <= 0) {
		throw new Error(`properties.json size.${name} must be a positive pixel value.`);
	}

	return Math.round(parsed);
};

export const appViewport: AppViewport = {
	width: parseDimension(configJson.size?.width, 'width'),
	height: parseDimension(configJson.size?.height, 'height')
};
