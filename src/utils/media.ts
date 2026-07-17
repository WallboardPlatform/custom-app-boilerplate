export type MediaFit = 'cover' | 'contain' | 'blur-fill' | 'fill';

export interface MediaFitPolicy {
	foregroundFit: 'cover' | 'contain' | 'fill';
	showBlurBackground: boolean;
}

export const mediaFit = (value: unknown): MediaFit => {
	return value === 'contain' || value === 'blur-fill' || value === 'fill' ? value : 'cover';
};

export const resolveMediaFit = (value: unknown): MediaFitPolicy => {
	const fit: MediaFit = mediaFit(value);

	return {
		foregroundFit: fit === 'blur-fill' ? 'contain' : fit,
		showBlurBackground: fit === 'blur-fill'
	};
};
