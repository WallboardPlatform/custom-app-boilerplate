import type { HlsConstructor } from '../types';

export const __hlsTypeMarker: never;

declare global {
	interface Window {
		Hls?: HlsConstructor;
	}
}
