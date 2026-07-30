import type { WayfindingStudioPolygonElement } from '../../../studio-project.mts';
import type { EditorTool } from '../../../editor-core/types';
import type { WayfindingPoint } from '../../../../../src/utils/wayfinding.js';

export type DragInteraction =
	| {
		cameraStart: { offsetX: number; offsetY: number; scale: number };
		kind: 'pan';
		pointerId: number;
		start: WayfindingPoint;
	}
	| {
		elementType: WayfindingStudioPolygonElement['type'];
		kind: 'freehand';
		points: WayfindingPoint[];
		pointerId: number;
	}
	| {
		elementId: string;
		kind: 'point';
		moved: boolean;
		original: WayfindingPoint;
		point: WayfindingPoint;
		pointerId: number;
		start: WayfindingPoint;
	}
	| {
		angle: number;
		elementId: string;
		kind: 'direction';
		moved: boolean;
		origin: WayfindingPoint;
		pointerId: number;
		property: 'angle' | 'facingDegrees';
	}
	| {
		aspectRatio: number;
		elementId: string;
		height: number;
		kind: 'media-resize';
		moved: boolean;
		origin: WayfindingPoint;
		originalHeight: number;
		originalWidth: number;
		pointerId: number;
		width: number;
	}
	| {
		elementId: string;
		geometry: WayfindingPoint[];
		inserted?: boolean;
		kind: 'polygon';
		moved: boolean;
		original: WayfindingPoint[];
		pointerId: number;
		start: WayfindingPoint;
		vertexIndex?: number;
	}
	| {
		geometry: WayfindingPoint[];
		geometryIndex: number;
		inserted?: boolean;
		kind: 'graph-edge-point';
		moved: boolean;
		original: WayfindingPoint[];
		pointerId: number;
		routeEdgeId: string;
		start: WayfindingPoint;
	}
	| {
		kind: 'graph-node';
		moved: boolean;
		nodeId: string;
		original: WayfindingPoint;
		point: WayfindingPoint;
		pointerId: number;
		start: WayfindingPoint;
	};

export const POLYGON_TOOLS = new Set<EditorTool>(['location', 'walkable', 'obstacle']);
export const POINT_TOOLS = new Set<EditorTool>(['door', 'poi', 'origin', 'transition', 'label', 'icon', 'logo']);

export const polygonTypeForTool = (tool: EditorTool): WayfindingStudioPolygonElement['type'] | undefined =>
	POLYGON_TOOLS.has(tool) ? tool as WayfindingStudioPolygonElement['type'] : undefined;

export const toolFromShortcut = (key: string, routeWorkspace: boolean): EditorTool | undefined => {
	const keyMap: Record<string, EditorTool> = routeWorkspace
		? { a: 'route-node', b: 'obstacle', e: 'route-edge', f: 'freehand', h: 'pan', v: 'select', w: 'walkable' }
		: {
			b: 'obstacle',
			d: 'door',
			f: 'freehand',
			g: 'logo',
			h: 'pan',
			i: 'icon',
			l: 'label',
			p: 'poi',
			r: 'location',
			t: 'transition',
			v: 'select',
			w: 'walkable',
			y: 'origin'
		};

	return keyMap[key];
};

export const isEditableTarget = (target: EventTarget | null): boolean =>
	target instanceof HTMLElement
	&& (target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName));
