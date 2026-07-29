import type { WayfindingPoint } from '../../../../../src/utils/wayfinding.js';
import { distanceToSegment } from './geometry';

export interface RegionDetectionOptions {
	closeGap: number;
	colorTolerance: number;
	detail: number;
	minimumOpening: number;
}

export interface RegionDetectionSource {
	data: Uint8ClampedArray;
	height: number;
	width: number;
}

export interface DetectedRegion {
	color: string;
	geometry: WayfindingPoint[];
}

interface BoundaryEdge {
	end: [number, number];
	start: [number, number];
}

interface ColorSample {
	b: number;
	g: number;
	r: number;
}

const pixelColorAt = (
	source: RegionDetectionSource,
	x: number,
	y: number
): ColorSample | undefined => {
	const column = Math.max(0, Math.min(source.width - 1, Math.floor(x)));
	const row = Math.max(0, Math.min(source.height - 1, Math.floor(y)));
	const index = (row * source.width + column) * 4;

	if (source.data[index + 3] === 0) return undefined;

	return {
		b: source.data[index + 2],
		g: source.data[index + 1],
		r: source.data[index]
	};
};

const colorDistance = (left: ColorSample, right: ColorSample): number =>
	Math.hypot(left.r - right.r, left.g - right.g, left.b - right.b);

const polygonArea = (points: WayfindingPoint[]): number => points.reduce(
	(area, point, index) => {
		const next = points[(index + 1) % points.length];

		return area + point.x * next.y - next.x * point.y;
	},
	0
) / 2;

const colorToHex = (color: ColorSample): string =>
	`#${[color.r, color.g, color.b]
		.map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0'))
		.join('')}`;

const distanceToLine = (
	point: WayfindingPoint,
	start: WayfindingPoint,
	end: WayfindingPoint
): number => {
	const length = Math.hypot(end.x - start.x, end.y - start.y);

	if (length === 0) return Math.hypot(point.x - start.x, point.y - start.y);

	return Math.abs(
		(end.x - start.x) * (start.y - point.y)
		- (start.x - point.x) * (end.y - start.y)
	) / length;
};

const lineProjection = (
	point: WayfindingPoint,
	start: WayfindingPoint,
	end: WayfindingPoint
): number => {
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	const lengthSquared = dx * dx + dy * dy;

	return lengthSquared === 0
		? 0
		: ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
};

const simplifyGeometry = (
	points: WayfindingPoint[],
	tolerance: number
): WayfindingPoint[] => {
	if (points.length <= 2) return points;
	const start = points[0];
	const end = points[points.length - 1];
	let splitIndex = -1;
	let maximumDistance = 0;

	for (let index = 1; index < points.length - 1; index += 1) {
		const distance = distanceToSegment(points[index], start, end);

		if (distance <= maximumDistance) continue;
		maximumDistance = distance;
		splitIndex = index;
	}

	if (maximumDistance <= tolerance || splitIndex < 0) return [start, end];
	const left = simplifyGeometry(points.slice(0, splitIndex + 1), tolerance);
	const right = simplifyGeometry(points.slice(splitIndex), tolerance);

	return [...left.slice(0, -1), ...right];
};

const removeShallowBoundaryDetails = (
	points: WayfindingPoint[],
	gridSize: number,
	cleanupDistance: number
): WayfindingPoint[] => {
	if (points.length < 6 || cleanupDistance <= 0) return points;
	const xs = points.map((point) => point.x);
	const ys = points.map((point) => point.y);
	const minimumDimension = Math.max(
		gridSize,
		Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
	);
	const maximumChord = Math.max(gridSize * 8, cleanupDistance * 8, Math.min(96, minimumDimension * 0.2));
	const maximumDepth = Math.max(gridSize * 4, cleanupDistance * 2, Math.min(48, minimumDimension * 0.11));
	const lineTolerance = Math.max(gridSize * 2.5, cleanupDistance, minimumDimension * 0.008);
	const cleaned = [...points];
	let changed = true;
	let pass = 0;

	while (changed && pass < 8 && cleaned.length >= 6) {
		changed = false;
		pass += 1;

		for (let startIndex = 1; startIndex < cleaned.length - 3 && !changed; startIndex += 1) {
			for (
				let endIndex = startIndex + 3;
				endIndex < Math.min(cleaned.length - 1, startIndex + 8);
				endIndex += 1
			) {
				const start = cleaned[startIndex];
				const end = cleaned[endIndex];
				const previous = cleaned[startIndex - 1];
				const next = cleaned[endIndex + 1];
				const chord = Math.hypot(end.x - start.x, end.y - start.y);

				if (chord < gridSize * 2 || chord > maximumChord) continue;

				if (
					distanceToLine(previous, start, end) > lineTolerance
					|| distanceToLine(next, start, end) > lineTolerance
				) continue;

				if (
					lineProjection(previous, start, end) > 0.05
					|| lineProjection(next, start, end) < 0.95
				) continue;
				const detail = cleaned.slice(startIndex, endIndex + 1);
				const maximumDeviation = Math.max(
					...detail.slice(1, -1).map((candidate) => distanceToLine(candidate, start, end))
				);
				const pathLength = detail.slice(1).reduce(
					(length, candidate, index) => length + Math.hypot(
						candidate.x - detail[index].x,
						candidate.y - detail[index].y
					),
					0
				);

				if (maximumDeviation > maximumDepth || pathLength < chord * 1.35) continue;
				cleaned.splice(startIndex + 1, endIndex - startIndex - 1);
				changed = true;
				break;
			}
		}
	}

	return cleaned;
};

const removeRedundantPolygonPoints = (
	points: WayfindingPoint[],
	tolerance: number
): WayfindingPoint[] => {
	const cleaned = [...points];
	let changed = true;

	while (changed && cleaned.length > 3) {
		changed = false;

		for (let index = 0; index < cleaned.length; index += 1) {
			const previous = cleaned[(index - 1 + cleaned.length) % cleaned.length];
			const current = cleaned[index];
			const next = cleaned[(index + 1) % cleaned.length];

			if (
				Math.hypot(current.x - previous.x, current.y - previous.y) > tolerance
				&& distanceToSegment(current, previous, next) > tolerance
			) continue;
			cleaned.splice(index, 1);
			changed = true;
			break;
		}
	}

	return cleaned;
};

const morphRegionMask = (
	source: Uint8Array,
	columns: number,
	rows: number,
	radius: number,
	operation: 'dilate' | 'erode'
): Uint8Array => {
	if (radius <= 0) return source.slice();
	const result = new Uint8Array(source.length);
	const offsets: Array<[number, number]> = [];

	for (let dy = -radius; dy <= radius; dy += 1) {
		for (let dx = -radius; dx <= radius; dx += 1) {
			if (dx * dx + dy * dy <= radius * radius) offsets.push([dx, dy]);
		}
	}

	for (let row = 0; row < rows; row += 1) {
		for (let column = 0; column < columns; column += 1) {
			const index = row * columns + column;

			if (source[index] !== 1) continue;

			if (operation === 'dilate') {
				for (const [dx, dy] of offsets) {
					const targetColumn = column + dx;
					const targetRow = row + dy;

					if (
						targetColumn < 0
						|| targetRow < 0
						|| targetColumn >= columns
						|| targetRow >= rows
					) continue;
					result[targetRow * columns + targetColumn] = 1;
				}

				continue;
			}
			let survives = true;

			for (const [dx, dy] of offsets) {
				const targetColumn = column + dx;
				const targetRow = row + dy;

				if (
					targetColumn < 0
					|| targetRow < 0
					|| targetColumn >= columns
					|| targetRow >= rows
					|| source[targetRow * columns + targetColumn] !== 1
				) {
					survives = false;
					break;
				}
			}

			if (survives) result[index] = 1;
		}
	}

	return result;
};

const closeRegionMask = (
	source: Uint8Array,
	columns: number,
	rows: number,
	gapCells: number
): Uint8Array => {
	const radius = Math.max(0, Math.ceil(gapCells / 2));

	return radius === 0
		? source.slice()
		: morphRegionMask(
			morphRegionMask(source, columns, rows, radius, 'dilate'),
			columns,
			rows,
			radius,
			'erode'
		);
};

const findFloodSeed = (
	traversable: Uint8Array,
	columns: number,
	rows: number,
	seedColumn: number,
	seedRow: number,
	minimumOpeningCells: number
): [number, number] | undefined => {
	if (traversable[seedRow * columns + seedColumn] === 1) return [seedColumn, seedRow];
	const searchRadius = Math.max(2, minimumOpeningCells + 1);
	let nearest: [number, number] | undefined;
	let nearestDistance = Number.POSITIVE_INFINITY;

	for (
		let row = Math.max(0, seedRow - searchRadius);
		row <= Math.min(rows - 1, seedRow + searchRadius);
		row += 1
	) {
		for (
			let column = Math.max(0, seedColumn - searchRadius);
			column <= Math.min(columns - 1, seedColumn + searchRadius);
			column += 1
		) {
			if (traversable[row * columns + column] !== 1) continue;
			const distance = (column - seedColumn) ** 2 + (row - seedRow) ** 2;

			if (distance >= nearestDistance) continue;
			nearest = [column, row];
			nearestDistance = distance;
		}
	}

	return nearest;
};

const traceOuterBoundary = (
	region: Uint8Array,
	columns: number,
	rows: number,
	gridSize: number
): WayfindingPoint[] | undefined => {
	const boundaryEdges: BoundaryEdge[] = [];
	const inside = (column: number, row: number): boolean =>
		column >= 0
		&& row >= 0
		&& column < columns
		&& row < rows
		&& region[row * columns + column] === 1;

	for (let row = 0; row < rows; row += 1) {
		for (let column = 0; column < columns; column += 1) {
			if (!inside(column, row)) continue;

			if (!inside(column, row - 1)) boundaryEdges.push({ start: [column, row], end: [column + 1, row] });

			if (!inside(column + 1, row)) boundaryEdges.push({ start: [column + 1, row], end: [column + 1, row + 1] });

			if (!inside(column, row + 1)) boundaryEdges.push({ start: [column + 1, row + 1], end: [column, row + 1] });

			if (!inside(column - 1, row)) boundaryEdges.push({ start: [column, row + 1], end: [column, row] });
		}
	}

	const key = ([x, y]: [number, number]): string => `${x}:${y}`;
	const outgoing = new Map<string, number[]>();

	for (const [index, edge] of boundaryEdges.entries()) {
		outgoing.set(key(edge.start), [...(outgoing.get(key(edge.start)) ?? []), index]);
	}
	const unused = new Set(boundaryEdges.map((_, index) => index));
	const loops: WayfindingPoint[][] = [];

	while (unused.size > 0) {
		const firstIndex = unused.values().next().value as number;
		const first = boundaryEdges[firstIndex];
		const loop: WayfindingPoint[] = [{ x: first.start[0] * gridSize, y: first.start[1] * gridSize }];
		let edgeIndex: number | undefined = firstIndex;
		let guard = 0;

		while (edgeIndex !== undefined && guard < boundaryEdges.length + 1) {
			guard += 1;
			const edge: BoundaryEdge = boundaryEdges[edgeIndex];

			unused.delete(edgeIndex);
			loop.push({ x: edge.end[0] * gridSize, y: edge.end[1] * gridSize });

			if (key(edge.end) === key(first.start)) break;
			edgeIndex = (outgoing.get(key(edge.end)) ?? []).find((candidate) => unused.has(candidate));
		}

		if (loop.length >= 4) loops.push(loop);
	}

	return loops.sort(
		(left, right) => Math.abs(polygonArea(right)) - Math.abs(polygonArea(left))
	)[0];
};

export const detectFlatRegionBoundary = (
	source: RegionDetectionSource,
	point: WayfindingPoint,
	options: RegionDetectionOptions
): DetectedRegion | undefined => {
	const gridSize = Math.max(2, Math.round(Math.max(source.width, source.height) / 900));
	const columns = Math.ceil(source.width / gridSize);
	const rows = Math.ceil(source.height / gridSize);
	const seedColumn = Math.max(0, Math.min(columns - 1, Math.floor(point.x / gridSize)));
	const seedRow = Math.max(0, Math.min(rows - 1, Math.floor(point.y / gridSize)));
	const seedColor = pixelColorAt(
		source,
		(seedColumn + 0.5) * gridSize,
		(seedRow + 0.5) * gridSize
	);

	if (!seedColor) return undefined;
	const candidate = new Uint8Array(columns * rows);
	const threshold = Math.max(8, options.colorTolerance);

	for (let row = 0; row < rows; row += 1) {
		for (let column = 0; column < columns; column += 1) {
			const color = pixelColorAt(
				source,
				(column + 0.5) * gridSize,
				(row + 0.5) * gridSize
			);

			if (color && colorDistance(color, seedColor) <= threshold) {
				candidate[row * columns + column] = 1;
			}
		}
	}

	const minimumOpeningCells = Math.max(0, Math.ceil(options.minimumOpening / gridSize));
	const openingRadius = Math.max(0, Math.floor((minimumOpeningCells - 1) / 2));
	const traversable = openingRadius > 0
		? morphRegionMask(candidate, columns, rows, openingRadius, 'erode')
		: candidate.slice();
	const floodSeed = findFloodSeed(
		traversable,
		columns,
		rows,
		seedColumn,
		seedRow,
		minimumOpeningCells
	);

	if (!floodSeed) return undefined;
	let region: Uint8Array = new Uint8Array(columns * rows);
	const queued = new Uint8Array(columns * rows);
	const queue: Array<[number, number]> = [floodSeed];

	queued[floodSeed[1] * columns + floodSeed[0]] = 1;

	for (let cursor = 0; cursor < queue.length; cursor += 1) {
		const [column, row] = queue[cursor];
		const index = row * columns + column;

		if (traversable[index] !== 1) continue;
		region[index] = 1;

		for (const [nextColumn, nextRow] of [
			[column - 1, row],
			[column + 1, row],
			[column, row - 1],
			[column, row + 1]
		] as Array<[number, number]>) {
			if (
				nextColumn < 0
				|| nextRow < 0
				|| nextColumn >= columns
				|| nextRow >= rows
			) continue;
			const nextIndex = nextRow * columns + nextColumn;

			if (queued[nextIndex] === 1 || traversable[nextIndex] !== 1) continue;
			queued[nextIndex] = 1;
			queue.push([nextColumn, nextRow]);
		}
	}

	if (openingRadius > 0) {
		const restored = morphRegionMask(region, columns, rows, openingRadius, 'dilate');

		for (let index = 0; index < region.length; index += 1) {
			region[index] = restored[index] === 1 && candidate[index] === 1 ? 1 : 0;
		}
	}

	region = closeRegionMask(
		region,
		columns,
		rows,
		Math.max(0, Math.ceil(options.closeGap / gridSize))
	);
	const regionSize = region.reduce((sum, value) => sum + value, 0);

	if (regionSize < 12 || regionSize > columns * rows * 0.48) return undefined;
	const averageColor: ColorSample = { b: 0, g: 0, r: 0 };

	for (let row = 0; row < rows; row += 1) {
		for (let column = 0; column < columns; column += 1) {
			if (region[row * columns + column] !== 1) continue;
			const color = pixelColorAt(
				source,
				(column + 0.5) * gridSize,
				(row + 0.5) * gridSize
			);

			if (!color) continue;
			averageColor.r += color.r;
			averageColor.g += color.g;
			averageColor.b += color.b;
		}
	}

	averageColor.r /= regionSize;
	averageColor.g /= regionSize;
	averageColor.b /= regionSize;
	const outer = traceOuterBoundary(region, columns, rows, gridSize);

	if (!outer) return undefined;
	const simplified = simplifyGeometry(
		outer.slice(0, -1),
		Math.max(gridSize * 1.5, options.detail * 0.55, 3)
	);
	const geometry = removeRedundantPolygonPoints(
		removeShallowBoundaryDetails(simplified, gridSize, options.detail),
		Math.max(1, gridSize * 1.25, options.detail * 0.35)
	);

	return geometry.length >= 3
		? { color: colorToHex(averageColor), geometry }
		: undefined;
};
