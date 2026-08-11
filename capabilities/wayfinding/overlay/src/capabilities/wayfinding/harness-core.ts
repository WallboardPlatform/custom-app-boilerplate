import type {
	WayfindingViewer,
	WayfindingViewerAsset,
	WayfindingViewerBuilding,
	WayfindingViewerDestination,
	WayfindingViewerDimension,
	WayfindingViewerLanguage,
	WayfindingViewerLevel,
	WayfindingViewerOptions,
	WayfindingViewerOrigin,
	WayfindingViewerProfile,
	WayfindingViewerSpeaker,
	WayfindingViewerStartOptions,
	WayfindingViewerState,
	WayfindingViewerTarget
} from './vendor/wayfinding-viewer.js';

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

export interface WayfindingHarnessCatalog {
	assets: readonly WayfindingViewerAsset[];
	buildings: readonly WayfindingViewerBuilding[];
	destinations: readonly WayfindingViewerDestination[];
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
	createViewer(
		host: HTMLElement,
		archive: Uint8Array,
		options: WayfindingViewerOptions
	): WayfindingViewer;
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

const errorMessage = (cause: unknown): string => cause instanceof Error
	? cause.message
	: 'The published wayfinding map could not be opened.';

const sameTarget = (
	left: WayfindingViewerTarget | undefined,
	right: WayfindingViewerTarget | undefined
): boolean => left?.id === right?.id && left?.kind === right?.kind;

const catalogFromViewer = (viewer: WayfindingViewer): WayfindingHarnessCatalog => ({
	assets: viewer.assets,
	buildings: viewer.buildings,
	destinations: viewer.destinations,
	languages: viewer.languages,
	levels: viewer.levels,
	origins: viewer.origins,
	projectName: viewer.projectName
});

export class WayfindingHarnessController implements WayfindingHarness {
	private activeLoad = 0;

	private destroyed = false;

	private currentCatalog?: WayfindingHarnessCatalog;

	private currentError?: string;

	private currentNotice?: string;

	private currentStatus: WayfindingHarnessStatus = 'idle';

	private currentViewerState?: WayfindingViewerState;

	private viewer?: WayfindingViewer;

	public constructor(
		private readonly host: HTMLElement,
		private readonly options: WayfindingHarnessOptions,
		private readonly dependencies: WayfindingHarnessDependencies
	) {}

	public get catalog(): WayfindingHarnessCatalog | undefined {
		return this.currentCatalog;
	}

	public get guidanceSupported(): boolean {
		return this.viewer?.guidanceSupported ?? false;
	}

	public get guidanceText(): string {
		return this.viewer?.guidanceText() ?? '';
	}

	public get snapshot(): WayfindingHarnessSnapshot {
		return {
			catalog: this.currentCatalog,
			error: this.currentError,
			notice: this.currentNotice,
			selectedTarget: this.currentViewerState?.target,
			status: this.currentStatus,
			viewerState: this.currentViewerState
		};
	}

	public clearNotice(): void {
		if (!this.currentNotice) return;
		this.currentNotice = undefined;
		this.emitSnapshot();
	}

	public destroy(): void {
		if (this.destroyed) return;
		this.destroyed = true;
		this.activeLoad += 1;
		this.viewer?.destroy();
		this.viewer = undefined;
		this.currentCatalog = undefined;
		this.currentError = undefined;
		this.currentNotice = undefined;
		this.currentViewerState = undefined;
		this.currentStatus = 'destroyed';
		this.emitSnapshot();
	}

	public isTargetAvailable(target: WayfindingViewerTarget): WayfindingTargetAvailability {
		return this.options.resolveTargetAvailability?.(target) ?? { available: true };
	}

	public async load(source: WayfindingMapSource): Promise<boolean> {
		if (this.destroyed) return false;
		this.activeLoad += 1;
		const loadId = this.activeLoad;

		this.viewer?.destroy();
		this.viewer = undefined;
		this.currentCatalog = undefined;
		this.currentError = undefined;
		this.currentNotice = undefined;
		this.currentViewerState = undefined;
		this.currentStatus = 'loading';
		this.emitSnapshot();

		try {
			const archive = await this.dependencies.readSource(source);

			if (this.destroyed || loadId !== this.activeLoad) return false;
			const viewer = this.dependencies.createViewer(this.host, archive, {
				dimension: this.options.dimension,
				language: this.options.language,
				onSelection: (target): void => this.handleSelection(loadId, target),
				onStateChange: (state): void => this.handleStateChange(loadId, state),
				onUnavailable: (message): void => this.handleUnavailable(loadId, message),
				originId: this.options.originId,
				profile: this.options.profile,
				speaker: this.options.speaker
			});

			if (this.destroyed || loadId !== this.activeLoad) {
				viewer.destroy();

				return false;
			}
			this.viewer = viewer;
			this.currentCatalog = catalogFromViewer(viewer);
			this.currentViewerState = viewer.state;
			this.currentStatus = 'ready';
			this.emitSnapshot();

			return true;
		} catch (cause: unknown) {
			if (this.destroyed || loadId !== this.activeLoad) return false;
			this.currentError = errorMessage(cause);
			this.currentStatus = 'error';
			this.emitSnapshot();

			return false;
		}
	}

	public previewRoute(target: WayfindingViewerTarget): boolean {
		if (!this.viewer || this.currentStatus !== 'ready') return false;
		this.currentNotice = undefined;
		const previewed = this.viewer.previewRoute(target);

		if (previewed && !sameTarget(this.currentViewerState?.target, target)) {
			this.currentViewerState = this.viewer.state;
			this.emitSnapshot();
		}

		return previewed;
	}

	public replay(options: WayfindingViewerStartOptions = {}): void {
		this.viewer?.replay(options);
	}

	public reset(): void {
		if (!this.viewer) return;
		this.currentNotice = undefined;
		this.viewer.showSite();
	}

	public resetCamera(): void {
		this.viewer?.resetCamera();
	}

	public setDimension(dimension: WayfindingViewerDimension): void {
		this.viewer?.setDimension(dimension);
	}

	public setLanguage(language: string): void {
		this.viewer?.setLanguage(language);
	}

	public setOrigin(originId: string): void {
		this.viewer?.setOrigin(originId);
	}

	public setProfile(profile: WayfindingViewerProfile): void {
		this.viewer?.setProfile(profile);
	}

	public speakGuidance(): void {
		this.viewer?.speakGuidance();
	}

	public startJourney(options: WayfindingViewerStartOptions = {}): boolean {
		const target = this.currentViewerState?.target;

		if (!this.viewer || !target || this.currentStatus !== 'ready') {
			this.unavailable('Select a destination before starting navigation.');

			return false;
		}
		const availability = this.isTargetAvailable(target);

		if (!availability.available) {
			this.unavailable(availability.message ?? 'This destination is currently unavailable.');

			return false;
		}
		this.currentNotice = undefined;

		return this.viewer.startJourney(target, { speak: options.speak !== false });
	}

	public stopGuidance(): void {
		this.viewer?.stopGuidance();
	}

	private emitSnapshot(): void {
		this.options.onSnapshot?.(this.snapshot);
	}

	private handleSelection(loadId: number, target: WayfindingViewerTarget | undefined): void {
		if (this.destroyed || loadId !== this.activeLoad) return;
		this.currentNotice = undefined;
		this.options.onSelection?.(target);
	}

	private handleStateChange(loadId: number, state: WayfindingViewerState): void {
		if (this.destroyed || loadId !== this.activeLoad) return;
		this.currentViewerState = state;
		this.emitSnapshot();
	}

	private handleUnavailable(loadId: number, message: string): void {
		if (this.destroyed || loadId !== this.activeLoad) return;
		this.unavailable(message);
	}

	private unavailable(message: string): void {
		this.currentNotice = message;
		this.emitSnapshot();
		this.options.onUnavailable?.(message);
	}
}
