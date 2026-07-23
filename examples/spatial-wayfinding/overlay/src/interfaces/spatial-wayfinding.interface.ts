import type { WayfindingGraphDocument, WayfindingPoint, WayfindingWalkableMaskDocument } from '@utils/wayfinding';

export interface RuntimeDestination {
	category: string;
	description: string;
	floor: string;
	id: string;
	name: string;
}

export interface RuntimePolygon {
	destinationId?: string;
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

export interface RuntimeLabel {
	color?: string;
	fontSize?: number;
	fontWeight?: 400 | 600 | 700;
	id: string;
	point: WayfindingPoint;
	text: string;
	type: 'label';
}

export interface RuntimeOrigin {
	facingDegrees: number;
	id: string;
	label: string;
	point: WayfindingPoint;
	screenId: string;
	type: 'origin';
}

export type RuntimeElement = RuntimeLabel | RuntimeOrigin | RuntimePolygon;

export interface RuntimeFloor {
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
	walkableMask?: WayfindingWalkableMaskDocument;
	width: number;
}

export interface WayfindingRuntimeBundle {
	contractVersion: 1;
	destinations: { Destinations: { rows: RuntimeDestination[] } };
	floors: RuntimeFloor[];
	graph: WayfindingGraphDocument;
	manifest: {
		deliveryMode: 'route';
		projectId: string;
		sourceContractVersion: 1;
		targetMode: 'route';
	};
	presentation?: {
		route: {
			animation: 'flow' | 'off';
			animationSpeed: number;
			color: string;
			cornerRounding: number;
			width: number;
		};
	};
}
