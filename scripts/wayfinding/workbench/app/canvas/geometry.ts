import type { EditorCamera2d } from '../../../editor-core/types';
import type { WayfindingPoint } from '../../../../../src/utils/wayfinding.js';

export interface ViewportSize {
	height: number;
	width: number;
}

export const clampPoint = (
	point: WayfindingPoint,
	width: number,
	height: number
): WayfindingPoint => ({
	x: Math.max(0, Math.min(width, point.x)),
	y: Math.max(0, Math.min(height, point.y))
});

export const distanceToSegment = (
	point: WayfindingPoint,
	start: WayfindingPoint,
	end: WayfindingPoint
): number => {
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	const lengthSquared = dx * dx + dy * dy;

	if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);
	const projection = Math.max(0, Math.min(
		1,
		((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
	));

	return Math.hypot(
		point.x - (start.x + projection * dx),
		point.y - (start.y + projection * dy)
	);
};

export const fitCamera = (
	viewport: ViewportSize,
	map: ViewportSize,
	padding?: number
): EditorCamera2d => {
	const resolvedPadding = padding ?? Math.min(
		64,
		Math.max(20, Math.min(viewport.width, viewport.height) * 0.06)
	);
	const usableWidth = Math.max(1, viewport.width - resolvedPadding * 2);
	const usableHeight = Math.max(1, viewport.height - resolvedPadding * 2);
	const scale = Math.max(0.08, Math.min(usableWidth / map.width, usableHeight / map.height));

	return {
		offsetX: (viewport.width - map.width * scale) / 2,
		offsetY: (viewport.height - map.height * scale) / 2,
		scale
	};
};

export const mapPointFromViewport = (
	point: WayfindingPoint,
	camera: EditorCamera2d,
	map: ViewportSize
): WayfindingPoint => clampPoint({
	x: (point.x - camera.offsetX) / camera.scale,
	y: (point.y - camera.offsetY) / camera.scale
}, map.width, map.height);

export const viewportPointFromMap = (
	point: WayfindingPoint,
	camera: EditorCamera2d
): WayfindingPoint => ({
	x: point.x * camera.scale + camera.offsetX,
	y: point.y * camera.scale + camera.offsetY
});

export const zoomCameraAt = (
	camera: EditorCamera2d,
	viewportPoint: WayfindingPoint,
	nextScale: number
): EditorCamera2d => {
	const mapPoint = mapPointFromViewport(
		viewportPoint,
		camera,
		{ height: Number.MAX_SAFE_INTEGER, width: Number.MAX_SAFE_INTEGER }
	);

	return {
		offsetX: viewportPoint.x - mapPoint.x * nextScale,
		offsetY: viewportPoint.y - mapPoint.y * nextScale,
		scale: nextScale
	};
};
