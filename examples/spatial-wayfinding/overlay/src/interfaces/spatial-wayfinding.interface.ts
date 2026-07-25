import type { WayfindingGraphDocument, WayfindingPoint } from '@utils/wayfinding';

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
	entranceRefs?: Array<{ elementId: string; floorId: string }>;
	floor?: string;
	geometryRefs?: Array<{
		elementId: string;
		floorId: string;
		representation: 'area' | 'point';
	}>;
	hours?: string;
	id: string;
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
	destinationId?: string;
	floorId?: string;
	geometry: WayfindingPoint[];
	id: string;
	label?: string;
	presentation?: {
		extrusionHeight?: number;
		fillColor?: string;
		fillOpacity?: number;
	};
	type: 'location' | 'obstacle' | 'walkable';
}

export interface RuntimeDoor {
	angle: number;
	floorId?: string;
	id: string;
	length: number;
	locationId?: string;
	point: WayfindingPoint;
	type: 'door';
}

export interface RuntimeLabel {
	color?: string;
	fontFamily?: 'monospace' | 'sans-serif' | 'serif';
	floorId?: string;
	fontSize?: number;
	fontWeight?: 400 | 600 | 700;
	id: string;
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
	floorId?: string;
	height: number;
	id: string;
	point: WayfindingPoint;
	type: 'icon' | 'logo';
	width: number;
}

export interface RuntimeOrigin {
	facingDegrees: number;
	floorId?: string;
	id: string;
	label: string;
	point: WayfindingPoint;
	screenId: string;
	type: 'origin';
}

export interface RuntimePointOfInterest {
	category?: string;
	destinationId?: string;
	floorId?: string;
	id: string;
	label?: string;
	point: WayfindingPoint;
	type: 'poi';
}

export interface RuntimeTransition {
	accessible: boolean;
	connectionId: string;
	floorId?: string;
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
	};
	route: {
		animation: 'flow' | 'none' | 'pulse';
		animationSpeed: number;
		color: string;
		cornerRadius: number;
		lineWidth: number;
	};
}

export interface RuntimeFloor {
	backgroundAssetId?: string;
	camera3d?: {
		azimuthDegrees: number;
		distance: number;
		pitchDegrees: number;
		targetX: number;
		targetY: number;
	};
	elements: RuntimeElement[];
	height: number;
	id: string;
	name: string;
	order: number;
	svg: string;
	width: number;
}

export interface WayfindingRuntimeBundle {
	assets: RuntimeAsset[];
	categories: string[];
	contractVersion: 1;
	defaultLanguage: string;
	defaults: RuntimeProjectDefaults;
	destinations: { Destinations: { rows: RuntimeDestination[] } };
	floors: RuntimeFloor[];
	graph: WayfindingGraphDocument;
	languages: Array<{ code: string; label: string }>;
	manifest: {
		deliveryMode: 'highlight' | 'route';
		generatedAt: string;
		projectId: string;
		projectName: string;
		sourceContractVersion: number;
		targetMode: 'highlight' | 'route';
	};
}
