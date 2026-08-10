export type WayfindingViewerTarget =
	| { id: string; kind: 'building' }
	| { id: string; kind: 'destination' };

export interface WayfindingViewerAsset {
	dataUrl: string;
	id: string;
	kind: 'background' | 'icon' | 'logo' | 'marker' | 'photo';
	mimeType: string;
	name: string;
	naturalHeight?: number;
	naturalWidth?: number;
}

export interface WayfindingViewerTranslation {
	description?: string;
	name?: string;
}

export interface WayfindingViewerDestination {
	category?: string;
	description?: string;
	id: string;
	levelId: string;
	mapNumber?: string;
	name: string;
	photoAssetIds?: string[];
	symbolAssetId?: string;
	translations?: Record<string, WayfindingViewerTranslation>;
}

export interface WayfindingViewerBuilding {
	accessible: boolean;
	category?: string;
	defaultLevelId?: string;
	description?: string;
	id: string;
	name: string;
	photoAssetIds?: string[];
	siteLevelId: string;
	symbolAssetId?: string;
	translations?: Record<string, WayfindingViewerTranslation>;
}

export interface WayfindingViewerLevel {
	buildingId?: string;
	id: string;
	levelNumber?: number;
	name: string;
	role: 'building-floor' | 'site' | 'standalone';
}

export interface WayfindingViewerOrigin {
	id: string;
	label: string;
	levelId: string;
}

export interface WayfindingViewerLanguage {
	code: string;
	label: string;
}

export interface WayfindingViewerState {
	language: string;
	mode: 'journey' | 'site';
	originId?: string;
	profile: 'standard' | 'step-free';
	target?: WayfindingViewerTarget;
}

export interface WayfindingViewerOptions {
	language?: string;
	onSelection?: (target: WayfindingViewerTarget | undefined) => void;
	onStateChange?: (state: WayfindingViewerState) => void;
	onUnavailable?: (message: string) => void;
	originId?: string;
	profile?: 'standard' | 'step-free';
}

export class WayfindingViewer {
	readonly assets: readonly WayfindingViewerAsset[];
	readonly buildings: readonly WayfindingViewerBuilding[];
	readonly destinations: readonly WayfindingViewerDestination[];
	readonly guidanceSupported: boolean;
	readonly languages: readonly WayfindingViewerLanguage[];
	readonly levels: readonly WayfindingViewerLevel[];
	readonly origins: readonly WayfindingViewerOrigin[];
	readonly projectName: string;
	readonly state: WayfindingViewerState;
	destroy(): void;
	guidanceText(): string;
	replay(options?: { speak?: boolean }): void;
	resetCamera(): void;
	setLanguage(language: string): void;
	setOrigin(originId: string): void;
	setProfile(profile: 'standard' | 'step-free'): void;
	showSite(): void;
	speakGuidance(): void;
	startJourney(target: WayfindingViewerTarget, options?: { speak?: boolean }): boolean;
	stopGuidance(): void;
}

export function createWayfindingViewerFromArchive(
	host: HTMLElement,
	archive: Uint8Array,
	options?: WayfindingViewerOptions
): WayfindingViewer;
