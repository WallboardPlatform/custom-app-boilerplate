import type { WayfindingPoint } from '../../../../../src/utils/wayfinding.js';

const pointDistance = (left: WayfindingPoint, right: WayfindingPoint): number =>
	Math.hypot(left.x - right.x, left.y - right.y);

const distanceToLine = (
	point: WayfindingPoint,
	start: WayfindingPoint,
	end: WayfindingPoint
): number => {
	const dx = end.x - start.x;
	const dy = end.y - start.y;

	if (dx === 0 && dy === 0) return pointDistance(point, start);
	const t = Math.max(0, Math.min(1, (
		(point.x - start.x) * dx + (point.y - start.y) * dy
	) / (dx * dx + dy * dy)));

	return pointDistance(point, {
		x: start.x + t * dx,
		y: start.y + t * dy
	});
};

const simplifySection = (
	points: WayfindingPoint[],
	startIndex: number,
	endIndex: number,
	tolerance: number,
	keep: Set<number>
): void => {
	let furthestDistance = 0;
	let furthestIndex = -1;

	for (let index = startIndex + 1; index < endIndex; index += 1) {
		const distance = distanceToLine(points[index], points[startIndex], points[endIndex]);

		if (distance > furthestDistance) {
			furthestDistance = distance;
			furthestIndex = index;
		}
	}

	if (furthestIndex < 0 || furthestDistance <= tolerance) return;
	keep.add(furthestIndex);
	simplifySection(points, startIndex, furthestIndex, tolerance, keep);
	simplifySection(points, furthestIndex, endIndex, tolerance, keep);
};

const removeRedundantClosedVertices = (
	points: WayfindingPoint[],
	tolerance: number
): WayfindingPoint[] => {
	const simplified = [...points];
	let changed = true;

	while (changed && simplified.length > 3) {
		changed = false;

		for (let index = 0; index < simplified.length; index += 1) {
			const previous = simplified[(index - 1 + simplified.length) % simplified.length];
			const current = simplified[index];
			const next = simplified[(index + 1) % simplified.length];

			if (distanceToLine(current, previous, next) > tolerance) continue;
			simplified.splice(index, 1);
			changed = true;
			break;
		}
	}

	return simplified;
};

export const appendFreehandPoint = (
	points: WayfindingPoint[],
	point: WayfindingPoint,
	minimumDistance: number
): WayfindingPoint[] => points.length === 0
	|| pointDistance(points[points.length - 1], point) >= minimumDistance
	? [...points, point]
	: points;

export const simplifyFreehandPolygon = (
	points: WayfindingPoint[],
	tolerance: number
): WayfindingPoint[] => {
	if (points.length < 3) return points;
	const closedPoints = pointDistance(points[0], points[points.length - 1]) <= tolerance
		? points.slice(0, -1)
		: points;

	if (closedPoints.length < 3) return closedPoints;
	const keep = new Set<number>([0, closedPoints.length - 1]);
	simplifySection(closedPoints, 0, closedPoints.length - 1, tolerance, keep);

	return removeRedundantClosedVertices([...keep]
		.sort((left, right) => left - right)
		.map((index) => closedPoints[index]), tolerance);
};
