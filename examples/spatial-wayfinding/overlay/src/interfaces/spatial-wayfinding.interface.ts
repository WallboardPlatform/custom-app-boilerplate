import type { WayfindingGraphDocument, WayfindingPoint } from '@utils/wayfinding';
import type {
	WayfindingAlignment,
	WayfindingBuilding,
	WayfindingConnector,
	WayfindingLevelRole,
	WayfindingPresentationSettings
} from '@utils/wayfinding-contract';

export interface RuntimeAsset {
	bytes: Uint8Array;
	dataUrl: string;
	id: string;
	kind: 'background' | 'brand' | 'photo' | 'symbol';
	mimeType: string;
	name: string;
	naturalHeight?: number;
	naturalWidth?: number;
	path: string;
}

export interface RuntimeTranslation {
	description?: string;
	name?: string;
}

export interface RuntimeDestination {
	accessible?: boolean;
	brandAssetIds?: string[];
	category?: string;
	description?: string;
	entranceRefs?: Array<{ elementId: string; levelId: string }>;
	/** v1 package compatibility; normalized loaders populate levelId. */
	floor?: string;
	geometryRefs?: Array<{
		elementId: string;
		levelId: string;
		representation: 'area' | 'point';
	}>;
	hours?: string;
	id: string;
	levelId?: string;
	mapNumber?: string;
	name: string;
	phone?: string;
	photoAssetIds?: string[];
	routeable?: boolean;
	status?: string;
	symbolAssetIds?: string[];
	translations?: Record<string, RuntimeTranslation>;
	website?: string;
}

export interface RuntimePolygon {
	buildingId?: string;
	destinationId?: string;
	levelId?: string;
	geometry: WayfindingPoint[];
	id: string;
	label?: string;
	presentation?: {
		extrusionHeight?: number;
		fillColor?: string;
		fillOpacity?: number;
	};
	type: 'building' | 'location' | 'obstacle' | 'walkable';
}

export interface RuntimeDoor {
	angle: number;
	levelId?: string;
	id: string;
	length: number;
	locationId?: string;
	point: WayfindingPoint;
	type: 'door';
}

export interface RuntimeLabel {
	color?: string;
	fontFamily?: 'monospace' | 'sans-serif' | 'serif';
	levelId?: string;
	fontSize?: number;
	fontWeight?: 400 | 600 | 700;
	id: string;
	maxWidth?: number;
	outlineColor?: string;
	outlineWidth?: number;
	point: WayfindingPoint;
	text: string;
	textAnchor?: 'end' | 'middle' | 'start';
	type: 'label';
}

export interface RuntimeMedia {
	assetId: string;
	destinationId?: string;
	levelId?: string;
	height: number;
	id: string;
	point: WayfindingPoint;
	type: 'icon' | 'logo';
	width: number;
}

export interface RuntimeOrigin {
	facingDegrees: number;
	levelId?: string;
	id: string;
	label: string;
	point: WayfindingPoint;
	screenId: string;
	type: 'origin';
}

export interface RuntimePointOfInterest {
	category?: string;
	destinationId?: string;
	levelId?: string;
	id: string;
	label?: string;
	point: WayfindingPoint;
	type: 'poi';
}

export interface RuntimeTransition {
	accessible: boolean;
	connectionId: string;
	levelId?: string;
	id: string;
	kind: 'elevator' | 'escalator' | 'ramp' | 'stairs';
	label: string;
	point: WayfindingPoint;
	type: 'transition';
}

export type RuntimeElement =
	| RuntimeDoor
	| RuntimeLabel
	| RuntimeMedia
	| RuntimeOrigin
	| RuntimePointOfInterest
	| RuntimePolygon
	| RuntimeTransition;

export interface RuntimeProjectDefaults {
	iconSize: number;
	label: {
		color: string;
		fontFamily: 'monospace' | 'sans-serif' | 'serif';
		fontSize: number;
		fontWeight: 400 | 600 | 700;
		outlineColor: string;
		outlineWidth: number;
	};
	location: {
		extrusionHeight: number;
		fillColor: string;
		fillOpacity: number;
	};
	logoSize: number;
	origin: {
		animation2d: 'none' | 'pulse' | 'radar';
		animation3d: 'bounce' | 'none' | 'pulse';
		animationSpeed: number;
		color: string;
		markerAssetId?: string;
		markerSize2d?: number;
		markerSize3d?: number;
	};
	route: {
		animation: 'flow' | 'none' | 'pulse';
		animationSpeed: number;
		color: string;
		cornerRadius: number;
		lineWidth: number;
	};
}

export interface RuntimeLevel {
	alignment?: WayfindingAlignment;
	backgroundAssetId?: string;
	buildingId?: string;
	camera3d?: {
		azimuthDegrees: number;
		distance: number;
		pitchDegrees: number;
		targetX: number;
		targetY: number;
	};
	elements: RuntimeElement[];
	elevationMeters?: number;
	height: number;
	id: string;
	levelNumber?: number;
	name: string;
	order: number;
	role: WayfindingLevelRole;
	svg: string;
	/** Map units per real-world metre, authored in the Studio project. */
	unitsPerMeter?: number;
	width: number;
}

export interface WayfindingRuntimeBundle {
	assets: RuntimeAsset[];
	buildings: WayfindingBuilding[];
	categories: string[];
	defaultLanguage: string;
	defaults: RuntimeProjectDefaults;
	connectors: WayfindingConnector[];
	destinations: { Destinations: { rows: RuntimeDestination[] } };
	format: 'wallboard-wayfinding-runtime';
	formatVersion: 2;
	levels: RuntimeLevel[];
	graph: WayfindingGraphDocument;
	languages: Array<{ code: string; label: string }>;
	presentation: WayfindingPresentationSettings;
	siteLevelId?: string;
	manifest: {
		capabilities: {
			routing: boolean;
			stepFreeRouting: boolean;
		};
		generatedAt: string;
		projectId: string;
		projectName: string;
	};
}
