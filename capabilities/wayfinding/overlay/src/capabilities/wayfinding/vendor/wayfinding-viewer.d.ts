export type WayfindingViewerTarget =
	| { id: string; kind: 'building' }
	| { id: string; kind: 'destination' };

export type WayfindingViewerDimension = '2d' | '3d';

export type WayfindingViewerProfile = 'standard' | 'step-free';

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
	accessible?: boolean;
	category?: string;
	description?: string;
	id: string;
	levelId?: string;
	logoAssetId?: string;
	mapNumber?: string;
	name: string;
	photoAssetIds?: string[];
	routeable?: boolean;
	status?: string;
	symbolAssetId?: string;
	translations?: Record<string, WayfindingViewerTranslation>;
}

export interface WayfindingViewerBuilding {
	accessible?: boolean;
	category?: string;
	defaultLevelId?: string;
	description?: string;
	id: string;
	logoAssetId?: string;
	name: string;
	photoAssetIds?: string[];
	siteLevelId: string;
	status?: string;
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
	defaultLanguage?: string;
	id: string;
	label: string;
	levelId: string;
	screenId: string;
}

export interface WayfindingViewerLanguage {
	code: string;
	label: string;
}

export interface WayfindingViewerState {
	dimension: WayfindingViewerDimension;
	language: string;
	mode: 'journey' | 'route' | 'site';
	originId?: string;
	profile: WayfindingViewerProfile;
	target?: WayfindingViewerTarget;
}

export interface WayfindingViewerSpeaker {
	cancel(): void;
	speak(text: string, language?: string): void;
	readonly supported: boolean;
}

export interface WayfindingViewerOptions {
	dimension?: WayfindingViewerDimension;
	language?: string;
	onSelection?: (target: WayfindingViewerTarget | undefined) => void;
	onStateChange?: (state: WayfindingViewerState) => void;
	onUnavailable?: (message: string) => void;
	originId?: string;
	profile?: WayfindingViewerProfile;
	speaker?: WayfindingViewerSpeaker;
}

export interface WayfindingViewerStartOptions {
	speak?: boolean;
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
	previewRoute(target: WayfindingViewerTarget): boolean;
	replay(options?: WayfindingViewerStartOptions): void;
	resetCamera(): void;
	setDimension(dimension: WayfindingViewerDimension): void;
	setLanguage(language: string): void;
	setOrigin(originId: string): void;
	setProfile(profile: WayfindingViewerProfile): void;
	showSite(): void;
	speakGuidance(): void;
	startJourney(target: WayfindingViewerTarget, options?: WayfindingViewerStartOptions): boolean;
	stopGuidance(): void;
}

export function createWayfindingViewerFromArchive(
	host: HTMLElement,
	archive: Uint8Array,
	options?: WayfindingViewerOptions
): WayfindingViewer;
