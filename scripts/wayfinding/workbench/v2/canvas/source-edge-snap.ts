import type { WayfindingPoint } from '../../../../../src/utils/wayfinding.js';
import type { RegionDetectionSource } from './regionDetection';

export interface SourceEdgeSnapOptions {
	mapHeight: number;
	mapWidth: number;
	point: WayfindingPoint;
	radius: number;
	source: RegionDetectionSource;
}

const channelDistance = (
	source: RegionDetectionSource,
	leftX: number,
	leftY: number,
	rightX: number,
	rightY: number
): number => {
	const clampedLeftX = Math.max(0, Math.min(source.width - 1, Math.round(leftX)));
	const clampedLeftY = Math.max(0, Math.min(source.height - 1, Math.round(leftY)));
	const clampedRightX = Math.max(0, Math.min(source.width - 1, Math.round(rightX)));
	const clampedRightY = Math.max(0, Math.min(source.height - 1, Math.round(rightY)));
	const leftIndex = (clampedLeftY * source.width + clampedLeftX) * 4;
	const rightIndex = (clampedRightY * source.width + clampedRightX) * 4;

	return Math.abs(source.data[leftIndex] - source.data[rightIndex])
		+ Math.abs(source.data[leftIndex + 1] - source.data[rightIndex + 1])
		+ Math.abs(source.data[leftIndex + 2] - source.data[rightIndex + 2]);
};

const edgeStrengthAt = (
	source: RegionDetectionSource,
	x: number,
	y: number
): number =>
	channelDistance(source, x - 1, y, x + 1, y)
	+ channelDistance(source, x, y - 1, x, y + 1);

export const snapPointToSourceEdge = ({
	mapHeight,
	mapWidth,
	point,
	radius,
	source
}: SourceEdgeSnapOptions): WayfindingPoint => {
	if (radius <= 0 || mapWidth <= 0 || mapHeight <= 0) return { ...point };
	const imagePoint = {
		x: point.x * source.width / mapWidth,
		y: point.y * source.height / mapHeight
	};
	const boundedRadius = Math.max(1, Math.min(48, radius));
	const stride = boundedRadius > 18 ? 2 : 1;
	let best = { ...imagePoint };
	let bestScore = edgeStrengthAt(source, imagePoint.x, imagePoint.y);

	for (let y = Math.round(imagePoint.y - boundedRadius); y <= imagePoint.y + boundedRadius; y += stride) {
		for (let x = Math.round(imagePoint.x - boundedRadius); x <= imagePoint.x + boundedRadius; x += stride) {
			if (x < 0 || y < 0 || x >= source.width || y >= source.height) continue;
			const distance = Math.hypot(x - imagePoint.x, y - imagePoint.y);

			if (distance > boundedRadius) continue;
			const score = edgeStrengthAt(source, x, y) - distance * 3;

			if (score <= bestScore) continue;
			best = { x, y };
			bestScore = score;
		}
	}

	return {
		x: best.x * mapWidth / source.width,
		y: best.y * mapHeight / source.height
	};
};
