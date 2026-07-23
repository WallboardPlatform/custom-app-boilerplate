import type { WayfindingPoint, WayfindingWalkableMaskDocument } from './wayfinding';

export interface RoutePosition {
	angle: number;
	point: WayfindingPoint;
}

type SegmentAllowed = (left: WayfindingPoint, right: WayfindingPoint) => boolean;

const distance = (left: WayfindingPoint, right: WayfindingPoint): number => Math.hypot(right.x - left.x, right.y - left.y);

const distinctPoints = (points: WayfindingPoint[]): WayfindingPoint[] => points.reduce<WayfindingPoint[]>((result, point): WayfindingPoint[] => {
	const previous: WayfindingPoint | undefined = result.at(-1);

	if (!previous || distance(previous, point) > 0.01) result.push({ x: point.x, y: point.y });

	return result;
}, []);

const segmentsAllowed = (points: WayfindingPoint[], allowed: SegmentAllowed): boolean => points
	.slice(1)
	.every((point: WayfindingPoint, index: number): boolean => allowed(points[index], point));

export const shortcutRoutePoints = (
	points: WayfindingPoint[],
	segmentAllowed: SegmentAllowed
): WayfindingPoint[] => {
	const source: WayfindingPoint[] = distinctPoints(points);

	if (source.length < 3) return source;
	const result: WayfindingPoint[] = [{ ...source[0] }];
	let cursor = 0;

	while (cursor < source.length - 1) {
		let nextIndex = cursor + 1;

		for (let candidate = source.length - 1; candidate > cursor + 1; candidate -= 1) {
			if (!segmentAllowed(source[cursor], source[candidate])) continue;
			nextIndex = candidate;
			break;
		}

		result.push({ ...source[nextIndex] });
		cursor = nextIndex;
	}

	return result;
};

export const routeSegmentWithinMask = (
	mask: WayfindingWalkableMaskDocument,
	left: WayfindingPoint,
	right: WayfindingPoint,
	requestedClearance = 0
): boolean => {
	const originX: number = mask.originX ?? 0;
	const originY: number = mask.originY ?? 0;
	const runsByRow = new Map<number, Array<[number, number]>>();

	for (const [row, startColumn, endColumn] of mask.walkableRuns) {
		const runs: Array<[number, number]> = runsByRow.get(row) ?? [];
		runs.push([startColumn, endColumn]);
		runsByRow.set(row, runs);
	}
	const contains = (point: WayfindingPoint): boolean => {
		const column: number = Math.floor((point.x - originX) / mask.cellSize);
		const row: number = Math.floor((point.y - originY) / mask.cellSize);

		return row >= 0
			&& row < mask.rows
			&& column >= 0
			&& column < mask.columns
			&& (runsByRow.get(row) ?? []).some(([startColumn, endColumn]): boolean => column >= startColumn && column <= endColumn);
	};
	const length: number = distance(left, right);

	if (length === 0) return true;
	const sampleCount: number = Math.max(2, Math.ceil(length / Math.max(1, mask.cellSize / 2)));
	const normalX: number = -(right.y - left.y) / length;
	const normalY: number = (right.x - left.x) / length;

	for (let index = 1; index < sampleCount; index += 1) {
		const ratio: number = index / sampleCount;
		const center: WayfindingPoint = {
			x: left.x + (right.x - left.x) * ratio,
			y: left.y + (right.y - left.y) * ratio
		};

		if (!contains(center)) return false;

		if (requestedClearance > 0 && index > 1 && index < sampleCount - 1) {
			if (!contains({ x: center.x + normalX * requestedClearance, y: center.y + normalY * requestedClearance })) return false;

			if (!contains({ x: center.x - normalX * requestedClearance, y: center.y - normalY * requestedClearance })) return false;
		}
	}

	return true;
};

export const presentRoutePoints = (
	points: WayfindingPoint[],
	roundingPercent: number,
	segmentAllowed: SegmentAllowed = (): boolean => true
): WayfindingPoint[] => {
	const source: WayfindingPoint[] = distinctPoints(points);

	if (source.length < 3 || roundingPercent <= 0) return source;
	const factor: number = Math.min(0.5, Math.max(0, roundingPercent / 100));
	const presented: WayfindingPoint[] = [{ ...source[0] }];

	for (let index = 1; index < source.length - 1; index += 1) {
		const previous: WayfindingPoint = source[index - 1];
		const corner: WayfindingPoint = source[index];
		const next: WayfindingPoint = source[index + 1];
		const incomingLength: number = distance(previous, corner);
		const outgoingLength: number = distance(corner, next);

		if (incomingLength === 0 || outgoingLength === 0) continue;
		const radius: number = Math.min(incomingLength, outgoingLength) * factor;
		const start: WayfindingPoint = {
			x: corner.x + (previous.x - corner.x) * radius / incomingLength,
			y: corner.y + (previous.y - corner.y) * radius / incomingLength
		};
		const end: WayfindingPoint = {
			x: corner.x + (next.x - corner.x) * radius / outgoingLength,
			y: corner.y + (next.y - corner.y) * radius / outgoingLength
		};
		const curve: WayfindingPoint[] = [start];

		for (let step = 1; step <= 8; step += 1) {
			const ratio: number = step / 8;
			const inverse: number = 1 - ratio;
			curve.push({
				x: inverse * inverse * start.x + 2 * inverse * ratio * corner.x + ratio * ratio * end.x,
				y: inverse * inverse * start.y + 2 * inverse * ratio * corner.y + ratio * ratio * end.y
			});
		}
		const candidate: WayfindingPoint[] = [presented.at(-1) as WayfindingPoint, ...curve];

		if (segmentsAllowed(candidate, segmentAllowed)) presented.push(...curve);
		else presented.push({ ...corner });
	}
	const last: WayfindingPoint = source.at(-1) as WayfindingPoint;

	if (distance(presented.at(-1) as WayfindingPoint, last) > 0.01) presented.push({ ...last });

	return presented;
};

export const routeLength = (points: WayfindingPoint[]): number => {
	const source: WayfindingPoint[] = distinctPoints(points);

	return source.slice(1).reduce((total: number, point: WayfindingPoint, index: number): number => total + distance(source[index], point), 0);
};

export const routePositionAt = (points: WayfindingPoint[], requestedDistance: number): RoutePosition | undefined => {
	const source: WayfindingPoint[] = distinctPoints(points);

	if (source.length < 2) return undefined;
	const totalLength: number = routeLength(source);
	let remaining: number = Math.max(0, Math.min(totalLength, requestedDistance));

	for (let index = 1; index < source.length; index += 1) {
		const left: WayfindingPoint = source[index - 1];
		const right: WayfindingPoint = source[index];
		const segmentLength: number = distance(left, right);

		if (remaining <= segmentLength || index === source.length - 1) {
			const ratio: number = segmentLength === 0 ? 0 : Math.min(1, remaining / segmentLength);

			return {
				angle: Math.atan2(right.y - left.y, right.x - left.x),
				point: {
					x: left.x + (right.x - left.x) * ratio,
					y: left.y + (right.y - left.y) * ratio
				}
			};
		}
		remaining -= segmentLength;
	}

	return undefined;
};

export const routeSvgPath = (points: WayfindingPoint[]): string => points.length === 0
	? ''
	: `M ${points.map((point: WayfindingPoint): string => `${Number(point.x.toFixed(3))} ${Number(point.y.toFixed(3))}`).join(' L ')}`;
