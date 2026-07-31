import {
	erodeWalkableMask,
	extractSkeletonNetwork,
	skeletonizeWalkableMask
} from '../centerline.mts';
import {
	synchronizeWayfindingStudioGraph,
	type WayfindingStudioDoorElement,
	type WayfindingStudioElement,
	type WayfindingStudioFloor,
	type WayfindingStudioPolygonElement,
	type WayfindingStudioProject
} from '../studio-project.mts';
import type {
	WayfindingEdge,
	WayfindingNode,
	WayfindingPoint
} from '../../../src/utils/wayfinding.js';

export interface RouteBuildOptions {
	cellSize?: number;
	clearanceCells?: number;
}

export interface RouteBuildDiagnostic {
	code:
		| 'connector-missing'
		| 'door-location-misaligned'
		| 'manual-segment-disconnected'
		| 'network-disconnected'
		| 'route-geometry-invalid';
	elementId?: string;
	message: string;
	nodeId: string;
	severity: 'error' | 'warning';
}

export interface RouteBuildResult {
	connectedSemanticNodes: number;
	diagnostics: RouteBuildDiagnostic[];
	diff: RouteBuildDiff;
	edges: number;
	nodes: number;
	project: WayfindingStudioProject;
	stages: RouteBuildStageReport[];
	totalSemanticNodes: number;
}

export type RouteBuildStageId =
	| 'clearance'
	| 'entrance-connection'
	| 'pruning'
	| 'safe-simplification'
	| 'space-normalization'
	| 'topology'
	| 'validation';

export interface RouteBuildStageReport {
	id: RouteBuildStageId;
	metrics: Record<string, number>;
}

export interface RouteBuildDiff {
	generatedEdgesAfter: number;
	generatedEdgesBefore: number;
	generatedNodesAfter: number;
	generatedNodesBefore: number;
	manualEdgesPreserved: number;
	manualNodesPreserved: number;
}

const isGeneratedRouteEdge = (edge: WayfindingEdge): boolean =>
	edge.authoringOwnership === 'generated';

const isGeneratedRouteNode = (node: WayfindingNode): boolean =>
	node.authoringOwnership === 'generated';

const pointInPolygon = (point: WayfindingPoint, polygon: readonly WayfindingPoint[]): boolean => {
	let inside = false;

	for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
		const left = polygon[index];
		const right = polygon[previous];
		const crosses = (left.y > point.y) !== (right.y > point.y)
			&& point.x < (right.x - left.x) * (point.y - left.y) / (right.y - left.y) + left.x;

		if (crosses) inside = !inside;
	}

	return inside;
};

const activeAt = (mask: Uint8Array, columns: number, rows: number, column: number, row: number): boolean =>
	column >= 0 && row >= 0 && column < columns && row < rows && mask[row * columns + column] === 1;

interface MaskPathQueueItem {
	cost: number;
	direction: number;
	index: number;
}

const pushMaskPathQueue = (
	queue: MaskPathQueueItem[],
	item: MaskPathQueueItem
): void => {
	let index = queue.length;
	queue.push(item);

	while (index > 0) {
		const parent = Math.floor((index - 1) / 2);

		if (queue[parent].cost <= item.cost) break;
		queue[index] = queue[parent];
		index = parent;
	}

	queue[index] = item;
};

const popMaskPathQueue = (queue: MaskPathQueueItem[]): MaskPathQueueItem | undefined => {
	if (queue.length === 0) return undefined;
	const first = queue[0];
	const last = queue.pop()!;

	if (queue.length === 0) return first;
	let index = 0;

	while (true) {
		const left = index * 2 + 1;
		const right = left + 1;

		if (left >= queue.length) break;
		const child = right < queue.length && queue[right].cost < queue[left].cost ? right : left;

		if (queue[child].cost >= last.cost) break;
		queue[index] = queue[child];
		index = child;
	}

	queue[index] = last;

	return first;
};

const cardinalMaskNeighbors = (
	index: number,
	mask: Uint8Array,
	columns: number,
	rows: number
): Array<{ direction: number; index: number }> => {
	const column = index % columns;
	const row = Math.floor(index / columns);
	const candidates = [
		{ column, direction: 0, row: row - 1 },
		{ column: column + 1, direction: 1, row },
		{ column, direction: 2, row: row + 1 },
		{ column: column - 1, direction: 3, row }
	];

	return candidates
		.filter((candidate) => activeAt(mask, columns, rows, candidate.column, candidate.row))
		.map((candidate) => ({
			direction: candidate.direction,
			index: candidate.row * columns + candidate.column
		}));
};

const directionForVector = (vector: WayfindingPoint): number =>
	Math.abs(vector.x) >= Math.abs(vector.y)
		? (vector.x >= 0 ? 1 : 3)
		: (vector.y >= 0 ? 2 : 0);

const turnAwarePathToSkeleton = (
	mask: Uint8Array,
	skeleton: Uint8Array,
	columns: number,
	rows: number,
	startIndex: number,
	initialDirection = -1
): number[] => {
	if (mask[startIndex] !== 1) return [];
	const queue: MaskPathQueueItem[] = [];
	const startKey = startIndex * 5 + initialDirection + 1;
	const costs = new Map<number, number>([[startKey, 0]]);
	const previous = new Map<number, number>();
	pushMaskPathQueue(queue, { cost: 0, direction: initialDirection, index: startIndex });
	let targetKey: number | undefined;

	while (queue.length > 0) {
		const current = popMaskPathQueue(queue)!;
		const currentKey = current.index * 5 + current.direction + 1;

		if (current.cost !== costs.get(currentKey)) continue;

		if (skeleton[current.index] === 1) {
			targetKey = currentKey;
			break;
		}

		for (const neighbor of cardinalMaskNeighbors(current.index, mask, columns, rows)) {
			const directionDifference = current.direction < 0
				? 0
				: Math.abs(current.direction - neighbor.direction);
			const turnCost = current.direction < 0 || directionDifference === 0
				? 0
				: directionDifference === 2
					? 10
					: 2.75;
			const boundaryPenalty = (
				4 - cardinalMaskNeighbors(neighbor.index, mask, columns, rows).length
			) * 0.3;
			const cost = current.cost + 1 + turnCost + boundaryPenalty;
			const key = neighbor.index * 5 + neighbor.direction + 1;

			if (cost >= (costs.get(key) ?? Number.POSITIVE_INFINITY)) continue;
			costs.set(key, cost);
			previous.set(key, currentKey);
			pushMaskPathQueue(queue, {
				cost,
				direction: neighbor.direction,
				index: neighbor.index
			});
		}
	}

	if (targetKey === undefined) return [];
	const path = [Math.floor(targetKey / 5)];
	let currentKey = targetKey;

	while (currentKey !== startKey) {
		const previousKey = previous.get(currentKey);

		if (previousKey === undefined) return [];
		currentKey = previousKey;
		path.push(Math.floor(currentKey / 5));
	}

	return path.reverse();
};

const pointToSegmentDistance = (
	point: WayfindingPoint,
	left: WayfindingPoint,
	right: WayfindingPoint
): number => {
	const dx = right.x - left.x;
	const dy = right.y - left.y;
	const lengthSquared = dx * dx + dy * dy;

	if (lengthSquared <= 0.000001) return Math.hypot(point.x - left.x, point.y - left.y);

	const ratio = Math.max(0, Math.min(1, (
		(point.x - left.x) * dx + (point.y - left.y) * dy
	) / lengthSquared));
	const projected = {
		x: left.x + dx * ratio,
		y: left.y + dy * ratio
	};

	return Math.hypot(point.x - projected.x, point.y - projected.y);
};

const shortcutPreservesShape = (
	points: readonly WayfindingPoint[],
	start: number,
	end: number,
	maxDeviation: number
): boolean => {
	const left = points[start];
	const right = points[end];

	for (let index = start + 1; index < end; index += 1) {
		if (pointToSegmentDistance(points[index], left, right) > maxDeviation) return false;
	}

	return true;
};

const segmentContained = (
	left: WayfindingPoint,
	right: WayfindingPoint,
	mask: Uint8Array,
	columns: number,
	rows: number,
	cellSize: number
): boolean => {
	const distance = Math.hypot(right.x - left.x, right.y - left.y);
	const steps = Math.max(1, Math.ceil(distance / Math.max(1, cellSize * 0.45)));

	for (let step = 0; step <= steps; step += 1) {
		const ratio = step / steps;
		const column = Math.floor((left.x + (right.x - left.x) * ratio) / cellSize);
		const row = Math.floor((left.y + (right.y - left.y) * ratio) / cellSize);

		if (!activeAt(mask, columns, rows, column, row)) return false;
	}

	return true;
};

const simplifyContained = (
	points: WayfindingPoint[],
	mask: Uint8Array,
	columns: number,
	rows: number,
	cellSize: number
): WayfindingPoint[] => {
	if (points.length <= 2) return points;

	const result: WayfindingPoint[] = [points[0]];
	let start = 0;
	const maxDeviation = Math.max(2, cellSize * 1.65);

	while (start < points.length - 1) {
		let end = points.length - 1;

		while (
			end > start + 1
			&& (
				!segmentContained(points[start], points[end], mask, columns, rows, cellSize)
				|| !shortcutPreservesShape(points, start, end, maxDeviation)
			)
		) {
			end -= 1;
		}

		result.push(points[end]);
		start = end;
	}

	return result;
};

interface SemanticConnector {
	anchorIndex?: number;
	approachDirection?: WayfindingPoint;
	geometry: WayfindingPoint[];
}

const connectorForPoint = (
	point: WayfindingPoint,
	mask: Uint8Array,
	skeleton: Uint8Array,
	columns: number,
	rows: number,
	cellSize: number
): SemanticConnector => {
	const column = Math.floor(point.x / cellSize);
	const row = Math.floor(point.y / cellSize);
	const startIndex = activeAt(mask, columns, rows, column, row)
		? row * columns + column
		: undefined;
	const path = startIndex === undefined
		? []
		: turnAwarePathToSkeleton(mask, skeleton, columns, rows, startIndex);
	const pathPoints = path.map((index) => pointForIndex(index, columns, cellSize));
	const geometry = pathPoints.length === 0
		? []
		: [
			point,
			...pathPoints.filter((candidate, index) =>
				index > 0
				|| Math.hypot(candidate.x - point.x, candidate.y - point.y) > cellSize * 0.2
			)
		];

	return {
		anchorIndex: path[path.length - 1],
		geometry
	};
};

const pointToPolygonBoundaryDistance = (
	point: WayfindingPoint,
	polygon: readonly WayfindingPoint[]
): number => polygon.reduce((minimum, start, index) =>
		Math.min(
			minimum,
			pointToSegmentDistance(point, start, polygon[(index + 1) % polygon.length])
		),
	Number.POSITIVE_INFINITY);

const rayPolygonBoundaryDistance = (
	start: WayfindingPoint,
	direction: WayfindingPoint,
	polygon: readonly WayfindingPoint[]
): number | undefined => {
	let nearest: number | undefined;

	for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
		const left = polygon[previous];
		const right = polygon[index];
		const segment = { x: right.x - left.x, y: right.y - left.y };
		const denominator = direction.x * segment.y - direction.y * segment.x;

		if (Math.abs(denominator) < 0.000001) continue;
		const offset = { x: left.x - start.x, y: left.y - start.y };
		const distance = (offset.x * segment.y - offset.y * segment.x) / denominator;
		const segmentRatio = (offset.x * direction.y - offset.y * direction.x) / denominator;

		if (distance < 0 || segmentRatio < 0 || segmentRatio > 1) continue;

		if (nearest === undefined || distance < nearest) nearest = distance;
	}

	return nearest;
};

const pointMaskIndex = (
	point: WayfindingPoint,
	mask: Uint8Array,
	columns: number,
	rows: number,
	cellSize: number
): number | undefined => {
	const column = Math.floor(point.x / cellSize);
	const row = Math.floor(point.y / cellSize);

	return activeAt(mask, columns, rows, column, row)
		? row * columns + column
		: undefined;
};

const doorCorridorDirection = (
	door: WayfindingStudioDoorElement,
	location: WayfindingStudioPolygonElement,
	mask: Uint8Array,
	columns: number,
	rows: number,
	cellSize: number
): WayfindingPoint => {
	const radians = door.angle * Math.PI / 180;
	const normals: [WayfindingPoint, WayfindingPoint] = [
		{ x: -Math.sin(radians), y: Math.cos(radians) },
		{ x: Math.sin(radians), y: -Math.cos(radians) }
	];
	const probeDistance = Math.max(cellSize * 1.5, door.length * 0.75);
	const insideLocation = normals.map((normal) => pointInPolygon({
		x: door.point.x + normal.x * probeDistance,
		y: door.point.y + normal.y * probeDistance
	}, location.geometry));

	if (insideLocation[0] !== insideLocation[1]) {
		return insideLocation[0] ? normals[1] : normals[0];
	}
	const score = (normal: WayfindingPoint): number => {
		let result = 0;

		for (let step = 1; step <= 8; step += 1) {
			const point = {
				x: door.point.x + normal.x * cellSize * step / 2,
				y: door.point.y + normal.y * cellSize * step / 2
			};

			if (pointMaskIndex(point, mask, columns, rows, cellSize) !== undefined) result += 2;

			if (pointInPolygon(point, location.geometry)) result -= 3;
		}

		return result;
	};

	return score(normals[0]) >= score(normals[1]) ? normals[0] : normals[1];
};

const removeCollinearPoints = (points: WayfindingPoint[]): WayfindingPoint[] => {
	if (points.length <= 2) return points;
	const result: WayfindingPoint[] = [points[0]];

	for (let index = 1; index < points.length - 1; index += 1) {
		const previous = result[result.length - 1];
		const current = points[index];
		const next = points[index + 1];
		const left = { x: current.x - previous.x, y: current.y - previous.y };
		const right = { x: next.x - current.x, y: next.y - current.y };
		const cross = left.x * right.y - left.y * right.x;
		const dot = left.x * right.x + left.y * right.y;

		if (Math.abs(cross) <= 0.001 && dot >= 0) continue;
		result.push(current);
	}

	result.push(points[points.length - 1]);
	const compacted: WayfindingPoint[] = [];

	for (const candidate of result) {
		const previous = compacted[compacted.length - 1];

		if (
			previous
			&& Math.hypot(candidate.x - previous.x, candidate.y - previous.y) <= 0.01
		) continue;
		compacted.push(candidate);
	}

	return compacted;
};

const geometryLength = (points: readonly WayfindingPoint[]): number =>
	points.slice(1).reduce((total, point, index) =>
		total + Math.hypot(point.x - points[index].x, point.y - points[index].y), 0
	);

const retainShortestAnchorPaths = (
	edges: readonly WayfindingEdge[],
	rootIds: readonly string[],
	anchorIds: ReadonlySet<string>
): { edgeIds: Set<string>; nodeIds: Set<string> } => {
	const adjacency = new Map<string, Array<{ edge: WayfindingEdge; nodeId: string; weight: number }>>();

	for (const edge of edges) {
		const reviewedGeometryPreference = edge.authoringOwnership === 'generated' ? 1 : 0.2;
		const weight = Math.max(
			0.001,
			geometryLength(edge.geometry ?? []) * reviewedGeometryPreference
		);
		adjacency.set(edge.from, [
			...(adjacency.get(edge.from) ?? []),
			{ edge, nodeId: edge.to, weight }
		]);

		if (edge.bidirectional) {
			adjacency.set(edge.to, [
				...(adjacency.get(edge.to) ?? []),
				{ edge, nodeId: edge.from, weight }
			]);
		}
	}

	for (const entries of adjacency.values()) {
		entries.sort((left, right) => left.weight - right.weight || left.edge.id.localeCompare(right.edge.id));
	}
	const edgeIds = new Set<string>();
	const nodeIds = new Set<string>();

	for (const rootId of [...new Set(rootIds)].sort()) {
		const costs = new Map<string, number>([[rootId, 0]]);
		const previousByNodeId = new Map<string, { edgeId: string; nodeId: string }>();
		const queue: Array<{ cost: number; nodeId: string }> = [{ cost: 0, nodeId: rootId }];

		while (queue.length > 0) {
			queue.sort((left, right) => left.cost - right.cost || left.nodeId.localeCompare(right.nodeId));
			const current = queue.shift()!;

			if (current.cost !== costs.get(current.nodeId)) continue;

			for (const candidate of adjacency.get(current.nodeId) ?? []) {
				const cost = current.cost + candidate.weight;
				const existingCost = costs.get(candidate.nodeId);

				if (existingCost !== undefined && cost >= existingCost - 0.000001) continue;
				costs.set(candidate.nodeId, cost);
				previousByNodeId.set(candidate.nodeId, {
					edgeId: candidate.edge.id,
					nodeId: current.nodeId
				});
				queue.push({ cost, nodeId: candidate.nodeId });
			}
		}
		nodeIds.add(rootId);

		for (const anchorId of [...anchorIds].sort()) {
			if (!costs.has(anchorId)) continue;
			let nodeId = anchorId;
			nodeIds.add(nodeId);

			while (nodeId !== rootId) {
				const previous = previousByNodeId.get(nodeId);

				if (!previous) break;
				edgeIds.add(previous.edgeId);
				nodeIds.add(previous.nodeId);
				nodeId = previous.nodeId;
			}
		}
	}

	return { edgeIds, nodeIds };
};

const simplifyDoorConnector = (
	points: WayfindingPoint[],
	door: WayfindingStudioDoorElement,
	direction: WayfindingPoint,
	location: WayfindingStudioPolygonElement,
	mask: Uint8Array,
	columns: number,
	rows: number,
	cellSize: number
): WayfindingPoint[] => {
	if (points.length <= 2) return points;

	const segmentStaysInPortal = (left: WayfindingPoint, right: WayfindingPoint): boolean => {
		const length = Math.hypot(right.x - left.x, right.y - left.y);
		const startsAtDoor = Math.hypot(left.x - door.point.x, left.y - door.point.y) <= 0.01;
		const outwardAlignment = length > 0.001
			? (
				(right.x - left.x) * direction.x
				+ (right.y - left.y) * direction.y
			) / length
			: 1;

		if (
			startsAtDoor
			&& outwardAlignment >= 0.1
			&& length <= Math.max(door.length * 1.25, cellSize * 4)
		) return true;
		const samples = Math.max(1, Math.ceil(length / Math.max(1, cellSize * 0.35)));

		for (let sample = 0; sample <= samples; sample += 1) {
			const ratio = sample / samples;
			const point = {
				x: left.x + (right.x - left.x) * ratio,
				y: left.y + (right.y - left.y) * ratio
			};

			if (
				!pointInPolygon(point, location.geometry)
				&& pointMaskIndex(point, mask, columns, rows, cellSize) === undefined
			) return false;
		}

		return true;
	};
	const simplified = [points[0]];
	let index = 0;

	while (index < points.length - 1) {
		let nextIndex = index + 1;

		for (let candidate = points.length - 1; candidate > nextIndex; candidate -= 1) {
			if (!segmentStaysInPortal(points[index], points[candidate])) continue;
			nextIndex = candidate;
			break;
		}
		simplified.push(points[nextIndex]);
		index = nextIndex;
	}

	return simplified;
};

const connectorForDoor = (
	door: WayfindingStudioDoorElement,
	location: WayfindingStudioPolygonElement,
	mask: Uint8Array,
	skeleton: Uint8Array,
	columns: number,
	rows: number,
	cellSize: number
): SemanticConnector => {
	const direction = doorCorridorDirection(
		door,
		location,
		mask,
		columns,
		rows,
		cellSize
	);
	const boundaryDistance = pointInPolygon(door.point, location.geometry)
		? rayPolygonBoundaryDistance(door.point, direction, location.geometry) ?? 0
		: 0;
	const approachStart = {
		x: door.point.x + direction.x * boundaryDistance,
		y: door.point.y + direction.y * boundaryDistance
	};
	const approachIndices: number[] = [];
	const approachPoints: WayfindingPoint[] = [];
	const maximumSteps = Math.max(
		12,
		Math.ceil((door.length + boundaryDistance) * 2 / cellSize)
	);
	let enteredWalkable = false;

	for (let step = 1; step <= maximumSteps; step += 1) {
		const point = {
			x: approachStart.x + direction.x * cellSize * step / 2,
			y: approachStart.y + direction.y * cellSize * step / 2
		};
		const index = pointMaskIndex(point, mask, columns, rows, cellSize);

		if (index === undefined) {
			if (enteredWalkable) break;

			continue;
		}
		enteredWalkable = true;
		approachPoints.push(point);

		if (approachIndices[approachIndices.length - 1] !== index) {
			approachIndices.push(index);
		}

		if (approachIndices.length >= 2 && skeleton[index] === 1) break;
	}

	if (approachIndices.length === 0) {
		return {
			approachDirection: direction,
			geometry: []
		};
	}
	const startIndex = approachIndices[approachIndices.length - 1];
	const suffix = turnAwarePathToSkeleton(
		mask,
		skeleton,
		columns,
		rows,
		startIndex,
		directionForVector(direction)
	);
	const path = [
		...approachIndices,
		...suffix.slice(1)
	];
	const suffixPoints = suffix.slice(1)
		.map((index) => pointForIndex(index, columns, cellSize));
	const geometry = simplifyDoorConnector(removeCollinearPoints([
		door.point,
		...approachPoints,
		...suffixPoints
	]), door, direction, location, mask, columns, rows, cellSize);

	return {
		anchorIndex: path[path.length - 1],
		approachDirection: direction,
		geometry
	};
};

const polygonMask = (floor: WayfindingStudioFloor, cellSize: number): {
	columns: number;
	mask: Uint8Array;
	rows: number;
} => {
	const columns = Math.max(1, Math.ceil(floor.width / cellSize));
	const rows = Math.max(1, Math.ceil(floor.height / cellSize));
	const mask = new Uint8Array(columns * rows);
	const walkable = floor.elements.filter((element): element is WayfindingStudioPolygonElement => element.type === 'walkable');
	const obstacles = floor.elements.filter((element): element is WayfindingStudioPolygonElement => element.type === 'obstacle');
	const locations = floor.elements.filter((element): element is WayfindingStudioPolygonElement => element.type === 'location');

	for (let row = 0; row < rows; row += 1) {
		for (let column = 0; column < columns; column += 1) {
			const point = {
				x: Math.min(floor.width, (column + 0.5) * cellSize),
				y: Math.min(floor.height, (row + 0.5) * cellSize)
			};
			const allowed = walkable.some((area) => pointInPolygon(point, area.geometry))
				&& !obstacles.some((area) => pointInPolygon(point, area.geometry))
				&& !locations.some((area) => pointInPolygon(point, area.geometry));

			mask[row * columns + column] = allowed ? 1 : 0;
		}
	}

	return { columns, mask, rows };
};

const pointForIndex = (index: number, columns: number, cellSize: number): WayfindingPoint => ({
	x: (index % columns + 0.5) * cellSize,
	y: (Math.floor(index / columns) + 0.5) * cellSize
});

const edgeDistance = (points: readonly WayfindingPoint[], unitsPerMeter: number): number =>
	points.slice(1).reduce((total, point, index) =>
		total + Math.hypot(point.x - points[index].x, point.y - points[index].y), 0
	) / Math.max(0.1, unitsPerMeter);

const calibratedEdgeDistance = (
	points: readonly WayfindingPoint[],
	unitsPerMeter: number | undefined
): number | undefined => unitsPerMeter && unitsPerMeter > 0
	? edgeDistance(points, unitsPerMeter)
	: undefined;

export const buildFloorRouteNetwork = (
	sourceProject: WayfindingStudioProject,
	floorId: string,
	options: RouteBuildOptions = {}
): RouteBuildResult => {
	const project = structuredClone(sourceProject);
	synchronizeWayfindingStudioGraph(project);
	const floor = project.floors.find((candidate) => candidate.id === floorId);

	if (!floor) throw new Error(`Floor '${floorId}' does not exist.`);

	const walkable = floor.elements.filter((element) => element.type === 'walkable');

	if (walkable.length === 0) {
		throw new Error('Draw or detect pedestrian space before building routes.');
	}

	const cellSize = Math.max(3, Math.min(24, Math.round(
		options.cellSize
			?? Math.max(floor.width, floor.height) / 220
	)));
	const { columns, mask, rows } = polygonMask(floor, cellSize);
	const normalizedWalkableCells = mask.reduce((total, value) => total + value, 0);
	const clearanceCells = Math.max(0, Math.min(4, Math.round(options.clearanceCells ?? 1)));
	const clearanceMask = erodeWalkableMask(mask, columns, rows, clearanceCells);
	const clearanceCount = clearanceMask.reduce((total, value) => total + value, 0);
	const networkMask = clearanceCount > 0 ? clearanceMask : mask;
	const rawSkeleton = skeletonizeWalkableMask(networkMask, columns, rows);
	const centerlineCells = rawSkeleton.reduce((total, value) => total + value, 0);
	const semanticElements = new Map<string, WayfindingStudioElement>(
		floor.elements.map((element) => [element.id, element])
	);
	const routeableDestinationIds = new Set(project.destinations
		.filter((destination) => destination.routeable !== false)
		.map((destination) => destination.id));
	const linkedDoorsByLocationId = new Map<string, WayfindingStudioDoorElement[]>();

	for (const door of floor.elements.filter(
		(element): element is WayfindingStudioDoorElement => element.type === 'door'
	)) {
		if (!door.locationId) continue;
		linkedDoorsByLocationId.set(door.locationId, [
			...(linkedDoorsByLocationId.get(door.locationId) ?? []),
			door
		]);
	}
	const semanticNodes = project.graph.nodes.filter((node) => {
		if (node.levelId !== floorId || !node.semanticElementId) return false;
		const element = semanticElements.get(node.semanticElementId);

		if (!element) return false;

		if (element.type === 'origin' || element.type === 'transition') return true;

		if (element.type === 'poi') {
			return Boolean(
				element.destinationId
				&& routeableDestinationIds.has(element.destinationId)
			);
		}

		return element.type === 'location'
			&& Boolean(
				element.destinationId
				&& routeableDestinationIds.has(element.destinationId)
				&& linkedDoorsByLocationId.has(element.id)
			);
	});
	const anchorIndexByNodeId = new Map<string, number>();
	const approachDirectionByNodeId = new Map<string, WayfindingPoint>();
	const connectorGeometryByNodeId = new Map<string, WayfindingPoint[]>();
	const diagnostics: RouteBuildDiagnostic[] = [];
	const sourceNodesById = new Map(project.graph.nodes.map((node) => [node.id, node]));
	const edgeTouchesFloor = (edge: WayfindingEdge): boolean =>
		sourceNodesById.get(edge.from)?.levelId === floorId
		|| sourceNodesById.get(edge.to)?.levelId === floorId;
	const manualFloorEdges = project.graph.edges.filter((edge) =>
		edgeTouchesFloor(edge) && !isGeneratedRouteEdge(edge)
	);
	const manualEndpointIds = new Set(manualFloorEdges.flatMap((edge) => [edge.from, edge.to]));
	const manualEndpointNodes = [...manualEndpointIds]
		.map((nodeId) => sourceNodesById.get(nodeId))
		.filter((node): node is WayfindingNode =>
			Boolean(node)
				&& node!.levelId === floorId
				&& !node!.semanticElementId
				&& !node!.locationId
				&& node!.kind === 'route'
		);
	const manualAnchorIndexByNodeId = new Map<string, number>();
	const manualConnectorGeometryByNodeId = new Map<string, WayfindingPoint[]>();
	const portalEndpointAllowance = Math.max(12, cellSize * 2.5);
	const manualEdgeIsContained = (edge: WayfindingEdge): boolean => {
		const from = sourceNodesById.get(edge.from);
		const to = sourceNodesById.get(edge.to);

		if (!from || !to) return false;
		const sourceGeometry = edge.geometry && edge.geometry.length >= 2
			? edge.geometry
			: [{ x: from.x, y: from.y }, { x: to.x, y: to.y }];
		const forwardDistance = Math.hypot(sourceGeometry[0].x - from.x, sourceGeometry[0].y - from.y)
			+ Math.hypot(
				sourceGeometry[sourceGeometry.length - 1].x - to.x,
				sourceGeometry[sourceGeometry.length - 1].y - to.y
			);
		const reverseDistance = Math.hypot(sourceGeometry[0].x - to.x, sourceGeometry[0].y - to.y)
			+ Math.hypot(
				sourceGeometry[sourceGeometry.length - 1].x - from.x,
				sourceGeometry[sourceGeometry.length - 1].y - from.y
			);
		const geometry = reverseDistance < forwardDistance
			? [...sourceGeometry].reverse()
			: sourceGeometry;
		const allowsPortalEndpoint = (node: WayfindingNode): boolean =>
			Boolean(node.semanticElementId || node.locationId || node.kind !== 'route');

		for (let index = 1; index < geometry.length; index += 1) {
			const left = geometry[index - 1];
			const right = geometry[index];
			const distance = Math.hypot(right.x - left.x, right.y - left.y);
			const steps = Math.max(1, Math.ceil(distance / Math.max(1, cellSize * 0.45)));

			for (let step = 0; step <= steps; step += 1) {
				const ratio = step / steps;
				const point = {
					x: left.x + (right.x - left.x) * ratio,
					y: left.y + (right.y - left.y) * ratio
				};

				if (pointMaskIndex(point, mask, columns, rows, cellSize) !== undefined) continue;
				const nearFromPortal = index === 1
					&& allowsPortalEndpoint(from)
					&& Math.hypot(point.x - from.x, point.y - from.y) <= portalEndpointAllowance;
				const nearToPortal = index === geometry.length - 1
					&& allowsPortalEndpoint(to)
					&& Math.hypot(point.x - to.x, point.y - to.y) <= portalEndpointAllowance;

				if (!nearFromPortal && !nearToPortal) return false;
			}
		}

		return true;
	};

	for (const edge of manualFloorEdges) {
		if (manualEdgeIsContained(edge)) continue;
		diagnostics.push({
			code: 'route-geometry-invalid',
			message: `Reviewed route segment ${edge.id} leaves the reviewed walkable space or crosses a blocked area.`,
			nodeId: edge.from,
			severity: 'error'
		});
	}

	for (const node of semanticNodes) {
		const semanticElement = node.semanticElementId
			? semanticElements.get(node.semanticElementId)
			: undefined;
		const associatedLocation = semanticElement?.type === 'location'
			? semanticElement
			: undefined;
		const associatedDoors = associatedLocation
			? linkedDoorsByLocationId.get(associatedLocation.id) ?? []
			: [];
		const alignedDoorCandidates = associatedLocation
			? associatedDoors.flatMap((door) => {
				const boundaryDistance = pointToPolygonBoundaryDistance(
					door.point,
					associatedLocation.geometry
				);
				const maximumBoundaryDistance = Math.max(
					12,
					door.length * 0.55,
					cellSize * 2.5
				);

				if (boundaryDistance > maximumBoundaryDistance) return [];
				const connector = connectorForDoor(
					door,
					associatedLocation,
					mask,
					rawSkeleton,
					columns,
					rows,
					cellSize
				);

				return connector.anchorIndex === undefined
					? []
					: [{ boundaryDistance, connector, door }];
			})
			: [];
		const selectedDoor = alignedDoorCandidates.sort((left, right) =>
			geometryLength(left.connector.geometry) - geometryLength(right.connector.geometry)
			|| left.boundaryDistance - right.boundaryDistance
			|| left.door.id.localeCompare(right.door.id)
		)[0];

		if (associatedLocation && !selectedDoor) {
			const hasAlignedDoor = associatedDoors.some((door) =>
				pointToPolygonBoundaryDistance(door.point, associatedLocation.geometry)
					<= Math.max(12, door.length * 0.55, cellSize * 2.5)
			);
			diagnostics.push({
				code: hasAlignedDoor ? 'connector-missing' : 'door-location-misaligned',
				elementId: associatedDoors[0]?.id ?? associatedLocation.id,
				message: hasAlignedDoor
					? `${associatedLocation.label ?? associatedLocation.id} has an entrance on its boundary, but the public side does not meet the reviewed walkable space. Extend the pedestrian area to the doorway.`
					: `${associatedLocation.label ?? associatedLocation.id} has no entrance on its boundary. Move or replace its linked entrance before rebuilding routes.`,
				nodeId: node.id,
				severity: 'error'
			});

			continue;
		}
		const connector = selectedDoor
			? selectedDoor.connector
			: connectorForPoint(node, mask, rawSkeleton, columns, rows, cellSize);

		if (selectedDoor) {
			node.x = selectedDoor.door.point.x;
			node.y = selectedDoor.door.point.y;
		}
		const anchorIndex = connector.anchorIndex;

		if (anchorIndex === undefined) {
			diagnostics.push({
				code: 'connector-missing',
				elementId: semanticElement?.id,
				message: `${semanticElement?.id ?? node.id} could not reach the reviewed walkable space.`,
				nodeId: node.id,
				severity: 'error'
			});

			continue;
		}
		anchorIndexByNodeId.set(node.id, anchorIndex);
		connectorGeometryByNodeId.set(node.id, connector.geometry);

		if (connector.approachDirection) {
			approachDirectionByNodeId.set(node.id, connector.approachDirection);
		}
	}

	for (const node of manualEndpointNodes) {
		const connector = connectorForPoint(node, mask, rawSkeleton, columns, rows, cellSize);

		if (connector.anchorIndex === undefined) {
			diagnostics.push({
				code: 'manual-segment-disconnected',
				message: `Reviewed route point ${node.id} is outside the reviewed walkable space. Move or remove the manual segment before rebuilding.`,
				nodeId: node.id,
				severity: 'error'
			});

			continue;
		}
		manualAnchorIndexByNodeId.set(node.id, connector.anchorIndex);
		manualConnectorGeometryByNodeId.set(node.id, connector.geometry);
	}

	const network = extractSkeletonNetwork(
		networkMask,
		columns,
		rows,
		new Set([
			...anchorIndexByNodeId.values(),
			...manualAnchorIndexByNodeId.values()
		])
	);
	const topologyPointCount = network.chains.reduce(
		(total, chain) => total + chain.indices.length,
		0
	);
	const nodeIdByIndex = new Map<number, string>();
	const generatedNodes: WayfindingNode[] = network.nodeIndices.map((index) => {
		const id = `generated:${floorId}:node:${index}`;
		nodeIdByIndex.set(index, id);

		return {
			authoringOwnership: 'generated',
			id,
			kind: 'route',
			levelId: floorId,
			...pointForIndex(index, columns, cellSize)
		};
	});
	const generatedEdges: WayfindingEdge[] = [];

	for (const [chainIndex, chain] of network.chains.entries()) {
		const from = nodeIdByIndex.get(chain.indices[0]);
		const to = nodeIdByIndex.get(chain.indices[chain.indices.length - 1]);

		if (!from || !to || from === to) continue;

		const geometry = simplifyContained(
			chain.indices.map((index) => pointForIndex(index, columns, cellSize)),
			networkMask,
			columns,
			rows,
			cellSize
		);
		generatedEdges.push({
			accessible: true,
			authoringOwnership: 'generated',
			bidirectional: true,
			distanceMeters: calibratedEdgeDistance(geometry, floor.unitsPerMeter),
			from,
			geometry,
			id: `generated:${floorId}:edge:${chainIndex}`,
			kind: 'walk',
			reviewStatus: 'proposed',
			to,
			traversal: 'indoor-corridor'
		});
	}

	const generatedNodeById = new Map(generatedNodes.map((node) => [node.id, node]));

	for (const node of semanticNodes) {
		const anchorIndex = anchorIndexByNodeId.get(node.id);
		const generatedNodeId = anchorIndex === undefined ? undefined : nodeIdByIndex.get(anchorIndex);
		const generatedNode = generatedNodeId ? generatedNodeById.get(generatedNodeId) : undefined;

		if (!generatedNodeId || !generatedNode || generatedNodeId === node.id) continue;

		const nodePoint = { x: node.x, y: node.y };
		const generatedPoint = { x: generatedNode.x, y: generatedNode.y };
		const connectorGeometry = connectorGeometryByNodeId.get(node.id) ?? [];
		const semanticElement = node.semanticElementId
			? semanticElements.get(node.semanticElementId)
			: undefined;
		const approachDirection = approachDirectionByNodeId.get(node.id);
		const directLength = Math.hypot(
			generatedPoint.x - nodePoint.x,
			generatedPoint.y - nodePoint.y
		);
		const directAlignment = approachDirection && directLength > 0.001
			? (
				(generatedPoint.x - nodePoint.x) * approachDirection.x
				+ (generatedPoint.y - nodePoint.y) * approachDirection.y
			) / directLength
			: 0;
		const firstWalkablePoint = connectorGeometry.find((point) =>
			Math.hypot(point.x - nodePoint.x, point.y - nodePoint.y) > cellSize * 0.2
		);
		const doorCanConnectDirectly = semanticElement?.type === 'location'
			&& Boolean(
				approachDirection
				&& firstWalkablePoint
				&& directAlignment >= 0.94
				&& segmentContained(
					firstWalkablePoint,
					generatedPoint,
					mask,
					columns,
					rows,
					cellSize
				)
			);
		const geometry = (
			semanticElement?.type !== 'location'
				&& segmentContained(nodePoint, generatedPoint, mask, columns, rows, cellSize)
		) || doorCanConnectDirectly
			? [nodePoint, generatedPoint]
			: removeCollinearPoints([
				nodePoint,
				...connectorGeometry.filter((point, index) =>
					index > 0
						|| Math.hypot(point.x - nodePoint.x, point.y - nodePoint.y) > 0.01
				),
				generatedPoint
			]);

		if (geometry.length === 1) geometry.push({ x: generatedNode.x, y: generatedNode.y });
		generatedEdges.push({
			accessible: true,
			authoringOwnership: 'generated',
			bidirectional: true,
			distanceMeters: calibratedEdgeDistance(geometry, floor.unitsPerMeter),
			from: node.id,
			geometry,
			id: `generated:${floorId}:connector:${node.id}`,
			kind: 'walk',
			reviewStatus: 'proposed',
			to: generatedNodeId,
			traversal: 'portal'
		});
	}

	for (const node of manualEndpointNodes) {
		const anchorIndex = manualAnchorIndexByNodeId.get(node.id);
		const generatedNodeId = anchorIndex === undefined ? undefined : nodeIdByIndex.get(anchorIndex);
		const generatedNode = generatedNodeId ? generatedNodeById.get(generatedNodeId) : undefined;

		if (!generatedNodeId || !generatedNode || generatedNodeId === node.id) continue;
		const nodePoint = { x: node.x, y: node.y };
		const generatedPoint = { x: generatedNode.x, y: generatedNode.y };
		const connectorGeometry = manualConnectorGeometryByNodeId.get(node.id) ?? [];
		const geometry = segmentContained(nodePoint, generatedPoint, mask, columns, rows, cellSize)
			? [nodePoint, generatedPoint]
			: removeCollinearPoints([
				nodePoint,
				...connectorGeometry.filter((point, index) =>
					index > 0
						|| Math.hypot(point.x - nodePoint.x, point.y - nodePoint.y) > 0.01
				),
				generatedPoint
			]);

		generatedEdges.push({
			accessible: true,
			authoringOwnership: 'generated',
			bidirectional: true,
			distanceMeters: calibratedEdgeDistance(geometry, floor.unitsPerMeter),
			from: node.id,
			geometry,
			id: `generated:${floorId}:manual-connector:${node.id}`,
			kind: 'walk',
			reviewStatus: 'proposed',
			to: generatedNodeId,
			traversal: 'indoor-corridor'
		});
	}

	if (anchorIndexByNodeId.size + manualAnchorIndexByNodeId.size >= 2) {
		const connectedAnchorIds = new Set(semanticNodes
			.filter((node) => anchorIndexByNodeId.has(node.id))
			.map((node) => node.id));
		const routeTargetIds = new Set([
			...connectedAnchorIds,
			...manualAnchorIndexByNodeId.keys()
		]);
		const originIds = semanticNodes
			.filter((node) =>
				connectedAnchorIds.has(node.id)
					&& semanticElements.get(node.semanticElementId ?? '')?.type === 'origin'
			)
			.map((node) => node.id)
			.sort();
		const rootIds = originIds.length > 0 ? originIds : [[...routeTargetIds].sort()[0]];
		const paths = retainShortestAnchorPaths(
			[...generatedEdges, ...manualFloorEdges],
			rootIds,
			routeTargetIds
		);
		const retainedEdges = generatedEdges.filter((edge) => paths.edgeIds.has(edge.id));
		const retainedNodeIds = new Set(retainedEdges.flatMap((edge) => [edge.from, edge.to]));

		generatedEdges.splice(0, generatedEdges.length, ...retainedEdges);
		generatedNodes.splice(
			0,
			generatedNodes.length,
			...generatedNodes.filter((node) => retainedNodeIds.has(node.id))
		);
	}

	const generatedEdgesBefore = project.graph.edges.filter((edge) =>
		edgeTouchesFloor(edge) && isGeneratedRouteEdge(edge)
	);
	const generatedNodesBefore = project.graph.nodes.filter((node) =>
		node.levelId === floorId
		&& !node.semanticElementId
		&& isGeneratedRouteNode(node)
		&& !manualEndpointIds.has(node.id)
	);
	const retainedNodes = project.graph.nodes
		.filter((node) =>
			node.levelId !== floorId
			|| Boolean(node.semanticElementId)
			|| !isGeneratedRouteNode(node)
			|| manualEndpointIds.has(node.id)
		)
		.map((node) =>
			manualEndpointIds.has(node.id) && !node.semanticElementId
				? { ...node, authoringOwnership: 'manual' as const }
				: node
		);
	const retainedNodeIds = new Set(retainedNodes.map((node) => node.id));
	const retainedNodeById = new Map(retainedNodes.map((node) => [node.id, node]));
	const retainedEdges = project.graph.edges.filter((edge) =>
		!edgeTouchesFloor(edge) || !isGeneratedRouteEdge(edge)
	);
	const retainedEdgeIds = new Set(retainedEdges.map((edge) => edge.id));
	const nextGeneratedNodes = generatedNodes.filter((node) => !retainedNodeIds.has(node.id));
	const nextGeneratedEdges = generatedEdges
		.filter((edge) => !retainedEdgeIds.has(edge.id))
		.map((edge): WayfindingEdge => {
			const geometry = edge.geometry?.map((point) => ({ ...point }));
			const from = retainedNodeById.get(edge.from);
			const to = retainedNodeById.get(edge.to);

			if (geometry && from) geometry[0] = { x: from.x, y: from.y };

			if (geometry && to) geometry[geometry.length - 1] = { x: to.x, y: to.y };

			return geometry
				? {
					...edge,
					distanceMeters: calibratedEdgeDistance(geometry, floor.unitsPerMeter),
					geometry
				}
				: edge;
		});
	const simplifiedPointCount = nextGeneratedEdges.reduce(
		(total, edge) => total + (edge.geometry?.length ?? 2),
		0
	);
	project.graph = {
		...project.graph,
		edges: [...retainedEdges, ...nextGeneratedEdges],
		nodes: [...retainedNodes, ...nextGeneratedNodes]
	};
	const adjacency = new Map<string, Set<string>>();

	for (const edge of project.graph.edges) {
		if (!adjacency.has(edge.from)) adjacency.set(edge.from, new Set());

		if (!adjacency.has(edge.to)) adjacency.set(edge.to, new Set());
		adjacency.get(edge.from)!.add(edge.to);

		if (edge.bidirectional) adjacency.get(edge.to)!.add(edge.from);
	}
	const originNodeIds = semanticNodes
		.filter((node) => semanticElements.get(node.semanticElementId ?? '')?.type === 'origin')
		.map((node) => node.id);
	const reachableNodeIds = new Set(originNodeIds);
	const reachabilityQueue = [...originNodeIds];

	for (let cursor = 0; cursor < reachabilityQueue.length; cursor += 1) {
		for (const neighbor of adjacency.get(reachabilityQueue[cursor]) ?? []) {
			if (reachableNodeIds.has(neighbor)) continue;
			reachableNodeIds.add(neighbor);
			reachabilityQueue.push(neighbor);
		}
	}
	const connectedSemanticNodes = semanticNodes.filter((node) =>
		anchorIndexByNodeId.has(node.id) && reachableNodeIds.has(node.id)
	).length;

	for (const node of semanticNodes) {
		if (
			!anchorIndexByNodeId.has(node.id)
			|| reachableNodeIds.has(node.id)
			|| originNodeIds.includes(node.id)
		) continue;
		const semanticElement = semanticElements.get(node.semanticElementId ?? '');

		diagnostics.push({
			code: 'network-disconnected',
			elementId: semanticElement?.id,
			message: `${semanticElement?.id ?? node.id} reaches walkable space but is disconnected from every origin.`,
			nodeId: node.id,
			severity: 'error'
		});
	}

	return {
		connectedSemanticNodes,
		diagnostics,
		diff: {
			generatedEdgesAfter: nextGeneratedEdges.length,
			generatedEdgesBefore: generatedEdgesBefore.length,
			generatedNodesAfter: nextGeneratedNodes.length,
			generatedNodesBefore: generatedNodesBefore.length,
			manualEdgesPreserved: manualFloorEdges.length,
			manualNodesPreserved: retainedNodes.filter((node) =>
				node.levelId === floorId
				&& !node.semanticElementId
				&& !isGeneratedRouteNode(node)
			).length
		},
		edges: nextGeneratedEdges.length,
		nodes: nextGeneratedNodes.length,
		project,
		stages: [
			{
				id: 'space-normalization',
				metrics: {
					cellSize,
					columns,
					rows,
					walkableCells: normalizedWalkableCells
				}
			},
			{
				id: 'clearance',
				metrics: {
					clearanceCells,
					retainedCells: networkMask.reduce((total, value) => total + value, 0)
				}
			},
			{
				id: 'topology',
				metrics: {
					centerlineCells,
					chains: network.chains.length,
					junctions: network.nodeIndices.length
				}
			},
			{
				id: 'entrance-connection',
				metrics: {
					connected: connectedSemanticNodes,
					requested: semanticNodes.length
				}
			},
			{
				id: 'pruning',
				metrics: {
					edges: nextGeneratedEdges.length,
					nodes: nextGeneratedNodes.length
				}
			},
			{
				id: 'safe-simplification',
				metrics: {
					inputPoints: topologyPointCount,
					outputPoints: simplifiedPointCount
				}
			},
			{
				id: 'validation',
				metrics: {
					errors: diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length,
					warnings: diagnostics.filter((diagnostic) => diagnostic.severity === 'warning').length
				}
			}
		],
		totalSemanticNodes: semanticNodes.length
	};
};
