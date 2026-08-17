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

export type WayfindingMapSource =
	| ArrayBuffer
	| Uint8Array
	| string
	| (() => Promise<ArrayBuffer | Uint8Array | string>);

export type WayfindingHarnessStatus = 'destroyed' | 'error' | 'idle' | 'loading' | 'ready';

export interface WayfindingTargetAvailability {
	available: boolean;
	message?: string;
}

export interface WayfindingViewerDirectoryLevel {
	destinations: readonly WayfindingViewerDestination[];
	id: string;
	label: string;
}

export interface WayfindingViewerDirectoryGroup {
	building?: WayfindingViewerBuilding;
	id: string;
	label: string;
	levels: readonly WayfindingViewerDirectoryLevel[];
	type: 'building' | 'site' | 'standalone' | 'unassigned';
}

export interface WayfindingHarnessCatalog {
	assets: readonly WayfindingViewerAsset[];
	buildings: readonly WayfindingViewerBuilding[];
	destinations: readonly WayfindingViewerDestination[];
	directory: readonly WayfindingViewerDirectoryGroup[];
	languages: readonly WayfindingViewerLanguage[];
	levels: readonly WayfindingViewerLevel[];
	origins: readonly WayfindingViewerOrigin[];
	projectName: string;
}

export interface WayfindingHarnessSnapshot {
	catalog?: WayfindingHarnessCatalog;
	error?: string;
	notice?: string;
	selectedTarget?: WayfindingViewerTarget;
	status: WayfindingHarnessStatus;
	viewerState?: WayfindingViewerState;
}

export interface WayfindingHarnessOptions {
	dimension?: WayfindingViewerDimension;
	language?: string;
	onSelection?: (target: WayfindingViewerTarget | undefined) => void;
	onSnapshot?: (snapshot: WayfindingHarnessSnapshot) => void;
	onUnavailable?: (message: string) => void;
	originId?: string;
	profile?: WayfindingViewerProfile;
	resolveTargetAvailability?: (target: WayfindingViewerTarget) => WayfindingTargetAvailability;
	speaker?: WayfindingViewerSpeaker;
}

export interface WayfindingHarnessDependencies {
	createViewer(host: HTMLElement, archive: Uint8Array, options: WayfindingViewerOptions): WayfindingViewer;
	readSource(source: WayfindingMapSource): Promise<Uint8Array>;
}

export interface WayfindingHarness {
	readonly catalog: WayfindingHarnessCatalog | undefined;
	readonly guidanceSupported: boolean;
	readonly guidanceText: string;
	readonly snapshot: WayfindingHarnessSnapshot;
	clearNotice(): void;
	destroy(): void;
	isTargetAvailable(target: WayfindingViewerTarget): WayfindingTargetAvailability;
	load(source: WayfindingMapSource): Promise<boolean>;
	previewRoute(target: WayfindingViewerTarget): boolean;
	replay(options?: WayfindingViewerStartOptions): void;
	reset(): void;
	resetCamera(): void;
	setDimension(dimension: WayfindingViewerDimension): void;
	setLanguage(language: string): void;
	setOrigin(originId: string): void;
	setProfile(profile: WayfindingViewerProfile): void;
	speakGuidance(): void;
	startJourney(options?: WayfindingViewerStartOptions): boolean;
	stopGuidance(): void;
}

export class WayfindingHarnessController implements WayfindingHarness {
	constructor(host: HTMLElement, options: WayfindingHarnessOptions, dependencies?: WayfindingHarnessDependencies);
	readonly catalog: WayfindingHarnessCatalog | undefined;
	readonly guidanceSupported: boolean;
	readonly guidanceText: string;
	readonly snapshot: WayfindingHarnessSnapshot;
	clearNotice(): void;
	destroy(): void;
	isTargetAvailable(target: WayfindingViewerTarget): WayfindingTargetAvailability;
	load(source: WayfindingMapSource): Promise<boolean>;
	previewRoute(target: WayfindingViewerTarget): boolean;
	replay(options?: WayfindingViewerStartOptions): void;
	reset(): void;
	resetCamera(): void;
	setDimension(dimension: WayfindingViewerDimension): void;
	setLanguage(language: string): void;
	setOrigin(originId: string): void;
	setProfile(profile: WayfindingViewerProfile): void;
	speakGuidance(): void;
	startJourney(options?: WayfindingViewerStartOptions): boolean;
	stopGuidance(): void;
}

export function readWayfindingMapSource(source: WayfindingMapSource): Promise<Uint8Array>;
export function createWayfindingHarness(
	host: HTMLElement,
	options?: WayfindingHarnessOptions,
	dependencies?: WayfindingHarnessDependencies
): WayfindingHarness;

export const WAYFINDING_HANDOFF_VERSION: 1;

export interface WayfindingHandoff {
	appId: string;
	appVersion: string;
	datasourceId?: string;
	language?: string;
	mapPath?: string;
	originId?: string;
	profile?: WayfindingViewerProfile;
	server: string;
	target?: WayfindingViewerTarget;
	version: typeof WAYFINDING_HANDOFF_VERSION;
}

export interface PublicWayfindingResolution {
	appRootUrl?: string;
	mapUrl: string;
	resolverUrl: string;
	resourceUrls: readonly string[];
}

export interface PublicWayfindingResolverOptions {
	fetch?: typeof fetch;
	mapPath?: string;
}

export function normalizeWayfindingServer(value: string): string;
export function createWayfindingHandoffUrl(baseUrl: string, handoff: WayfindingHandoff): string;
export function parseWayfindingHandoff(input: string | URL | URLSearchParams): WayfindingHandoff;
export function resolvePublicWayfindingMap(
	handoff: Pick<WayfindingHandoff, 'appId' | 'appVersion' | 'mapPath' | 'server'>,
	options?: PublicWayfindingResolverOptions
): Promise<PublicWayfindingResolution>;
export function fetchPublicWayfindingMap(
	handoff: Pick<WayfindingHandoff, 'appId' | 'appVersion' | 'mapPath' | 'server'>,
	options?: PublicWayfindingResolverOptions
): Promise<{ archive: Uint8Array; etag?: string; resolution: PublicWayfindingResolution }>;
