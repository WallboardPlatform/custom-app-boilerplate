import type { WayfindingGraphDocument, WayfindingPoint } from './wayfinding';

export type WayfindingLevelRole = 'site' | 'building-floor' | 'standalone';
export type WayfindingConnectorKind = 'entrance' | 'elevator' | 'stairs' | 'escalator' | 'ramp';
export type WayfindingBuildingTapBehavior = 'focus-actions' | 'enter-immediately';
export type WayfindingOverviewMode = 'site' | 'exploded-3d';
export type WayfindingElementStatus = 'confirmed' | 'proposed';
export type WayfindingProvenance = 'ai-draft' | 'customer-source' | 'reviewer-authored';

export interface WayfindingAlignment {
	rotationDegrees: number;
	scale: number;
	siteLevelId: string;
	x: number;
	y: number;
}

export interface WayfindingCamera3d {
	azimuthDegrees: number;
	distance: number;
	pitchDegrees: number;
	targetX: number;
	targetY: number;
}

export interface WayfindingElementBase {
	id: string;
	levelId: string;
	provenance: WayfindingProvenance;
	status: WayfindingElementStatus;
}

export interface WayfindingPolygonElement extends WayfindingElementBase {
	buildingId?: string;
	destinationId?: string;
	geometry: WayfindingPoint[];
	label?: string;
	presentation?: { extrusionHeight?: number; fillColor?: string; fillOpacity?: number };
	type: 'building' | 'location' | 'obstacle' | 'walkable';
}

export interface WayfindingDoorElement extends WayfindingElementBase {
	angle: number;
	id: string;
	length: number;
	locationId?: string;
	point: WayfindingPoint;
	type: 'door';
}

export interface WayfindingPointElement extends WayfindingElementBase {
	category?: string;
	destinationId?: string;
	label?: string;
	point: WayfindingPoint;
	type: 'poi';
}

export interface WayfindingOriginElement extends WayfindingElementBase {
	defaultLanguage?: string;
	facingDegrees: number;
	label: string;
	point: WayfindingPoint;
	screenId: string;
	type: 'origin';
}

/** Retained for imported standalone maps; new multi-level authoring uses connectors[]. */
export interface WayfindingTransitionElement extends WayfindingElementBase {
	accessible: boolean;
	connectionId: string;
	kind: Exclude<WayfindingConnectorKind, 'entrance'>;
	label: string;
	point: WayfindingPoint;
	type: 'transition';
}

export interface WayfindingLabelElement extends WayfindingElementBase {
	color?: string;
	fontFamily?: 'monospace' | 'sans-serif' | 'serif';
	fontSize?: number;
	fontWeight?: 400 | 600 | 700;
	outlineColor?: string;
	outlineWidth?: number;
	point: WayfindingPoint;
	text: string;
	textAnchor?: 'end' | 'middle' | 'start';
	type: 'label';
}

export interface WayfindingMediaElement extends WayfindingElementBase {
	assetId: string;
	destinationId?: string;
	height: number;
	point: WayfindingPoint;
	rotationDegrees?: number;
	type: 'icon' | 'logo';
	width: number;
}

export type WayfindingElement =
	| WayfindingDoorElement
	| WayfindingLabelElement
	| WayfindingMediaElement
	| WayfindingOriginElement
	| WayfindingPointElement
	| WayfindingPolygonElement
	| WayfindingTransitionElement;

export interface WayfindingLevel {
	alignment?: WayfindingAlignment;
	backgroundAssetId?: string;
	buildingId?: string;
	camera3d?: WayfindingCamera3d;
	elements: WayfindingElement[];
	elevationMeters?: number;
	height: number;
	id: string;
	levelNumber?: number;
	name: string;
	order: number;
	role: WayfindingLevelRole;
	unitsPerMeter?: number;
	width: number;
}

export interface WayfindingConnectorEndpoint {
	id: string;
	levelId: string;
	point: WayfindingPoint;
	role?: 'interior' | 'site';
}

export interface WayfindingConnector {
	accessible: boolean;
	bidirectional: boolean;
	endpoints: WayfindingConnectorEndpoint[];
	id: string;
	kind: WayfindingConnectorKind;
	label: string;
	provenance: WayfindingProvenance;
	status: WayfindingElementStatus;
}

export interface WayfindingBuilding {
	accessible?: boolean;
	category?: string;
	defaultLevelId?: string;
	description?: string;
	externalEntrances?: Array<{ accessible: boolean; id: string; label: string; point: WayfindingPoint }>;
	externalRouteBehavior?: 'nearest-entrance' | 'preferred-entrance';
	footprintElementId: string;
	heightMeters?: number;
	hours?: string;
	id: string;
	logoAssetId?: string;
	name: string;
	phone?: string;
	photoAssetIds?: string[];
	preferredEntranceConnectorId?: string;
	preferredExternalEntranceId?: string;
	siteLevelId: string;
	website?: string;
}

export interface WayfindingDestination {
	accessible?: boolean;
	category?: string;
	description?: string;
	hours?: string;
	id: string;
	levelId?: string;
	logoAssetId?: string;
	mapNumber?: string;
	name: string;
	phone?: string;
	photoAssetIds?: string[];
	routeable?: boolean;
	status?: string;
	symbolAssetId?: string;
	translations?: Record<string, { description?: string; name?: string }>;
	website?: string;
}

export interface WayfindingAsset {
	dataUrl: string;
	id: string;
	kind: 'background' | 'icon' | 'logo' | 'marker' | 'photo';
	mimeType: string;
	name: string;
	naturalHeight?: number;
	naturalWidth?: number;
}

export interface WayfindingPresentationSettings {
	buildingTapBehavior: WayfindingBuildingTapBehavior;
	defaultOverviewMode: WayfindingOverviewMode;
	enabledOverviewModes: WayfindingOverviewMode[];
}

export interface WayfindingStudioProjectV2 {
	assets: WayfindingAsset[];
	buildings: WayfindingBuilding[];
	categories?: string[];
	connectors: WayfindingConnector[];
	createdAt: string;
	defaultLanguage?: string;
	defaults?: Record<string, unknown>;
	destinations: WayfindingDestination[];
	format: 'wallboard-wayfinding-studio';
	formatVersion: 2;
	graph: WayfindingGraphDocument;
	languages?: Array<{ code: string; label: string }>;
	levels: WayfindingLevel[];
	name: string;
	presentation: WayfindingPresentationSettings;
	projectId: string;
	siteLevelId?: string;
	updatedAt: string;
}
