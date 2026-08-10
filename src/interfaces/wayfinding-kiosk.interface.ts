import type {
	WayfindingViewerBuilding,
	WayfindingViewerDestination,
	WayfindingViewerTarget
} from '../vendor/wayfinding-viewer.js';

export type KioskPlace =
	| { entity: WayfindingViewerBuilding; kind: 'building'; target: WayfindingViewerTarget }
	| { entity: WayfindingViewerDestination; kind: 'destination'; target: WayfindingViewerTarget };

export interface DestinationLiveStatus {
	available: boolean;
	destinationId: string;
	note?: string;
	status?: string;
	waitMinutes?: number;
}

export type ThemePreset = 'custom' | 'dark' | 'light';
