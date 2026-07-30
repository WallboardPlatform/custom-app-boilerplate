import {
	erodeWalkableMask,
	extractSkeletonNetwork,
	retainAnchorNetworkCore,
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
	code: 'connector-missing' | 'network-disconnected';
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

const generatedPrefix = (floorId: string): string => `generated:${floorId}:`;

const isGeneratedRouteElement = (
	element: Pick<WayfindingEdge | WayfindingNode, 'authoringOwnership' | 'id'>,
	floorId: string
): boolean => element.authoringOwnership === 'generated'
	|| (
		element.authoringOwnership === undefined
		&& element.id.startsWith(generatedPrefix(floorId))
	);

const pointInPolygon = (point: WayfindingPoint, polygon: readonly WayfindingPoint[]): boolean => {
	let inside = false;

	for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
		const left = polygon[index];
		const right = polygon[previous];
		const crosses = (left.y > point.y) !== (right.y > point.y)
			&& point.x < (right.x - left.x) * (point.y - left.y) / Math.max(0.000001, right.y - left.y) + left.x;

		if (crosses) inside = !inside;
	}

	return inside;
};

const activeAt = (mask: Uint8Array, columns: number, rows: number, column: number, row: number): boolean =>
	column >= 0 && row >= 0 && column < columns && row < rows && mask[row * columns + column] === 1;

const nearestActiveIndex = (
	mask: Uint8Array,
	columns: number,
	rows: number,
	point: { column: number; row: number },
	maximumRadius = 3
): number | undefined => {
	let nearestIndex: number | undefined;
	let nearestDistance = Number.POSITIVE_INFINITY;
	const minimumColumn = Math.max(0, point.column - maximumRadius);
	const maximumColumn = Math.min(columns - 1, point.column + maximumRadius);
	const minimumRow = Math.max(0, point.row - maximumRadius);
	const maximumRow = Math.min(rows - 1, point.row + maximumRadius);

	for (let row = minimumRow; row <= maximumRow; row += 1) {
		for (let column = minimumColumn; column <= maximumColumn; column += 1) {
			const index = row * columns + column;

			if (mask[index] !== 1) continue;
			const distance = (column - point.column) ** 2 + (row - point.row) ** 2;

			if (distance >= nearestDistance) continue;
			nearestDistance = distance;
			nearestIndex = index;
		}
	}

	return nearestIndex;
};

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
	const startIndex = nearestActiveIndex(mask, columns, rows, {
		column: Math.max(0, Math.min(columns - 1, Math.floor(point.x / cellSize))),
		row: Math.max(0, Math.min(rows - 1, Math.floor(point.y / cellSize)))
	});
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

	return result.filter((candidate, index) =>
		index === 0
			|| Math.hypot(
				candidate.x - result[index - 1].x,
				candidate.y - result[index - 1].y
			) > 0.01
	);
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
	const geometry = removeCollinearPoints([
		door.point,
		...approachPoints,
		...suffixPoints
	]);

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

const documentMask = (floor: WayfindingStudioFloor, cellSize: number): {
	columns: number;
	mask: Uint8Array;
	rows: number;
} => {
	const document = floor.walkableMask;

	if (!document) return polygonMask(floor, cellSize);
	const source = new Uint8Array(document.columns * document.rows);

	for (const [row, startColumn, endColumn] of document.walkableRuns) {
		if (row < 0 || row >= document.rows) continue;

		for (
			let column = Math.max(0, startColumn);
			column <= Math.min(document.columns - 1, endColumn);
			column += 1
		) {
			source[row * document.columns + column] = 1;
		}
	}
	const columns = Math.max(1, Math.ceil(floor.width / cellSize));
	const rows = Math.max(1, Math.ceil(floor.height / cellSize));
	const mask = new Uint8Array(columns * rows);
	const originX = document.originX ?? 0;
	const originY = document.originY ?? 0;
	const obstacles = floor.elements.filter(
		(element): element is WayfindingStudioPolygonElement => element.type === 'obstacle'
	);
	const locations = floor.elements.filter(
		(element): element is WayfindingStudioPolygonElement => element.type === 'location'
	);

	for (let row = 0; row < rows; row += 1) {
		for (let column = 0; column < columns; column += 1) {
			const point = {
				x: Math.min(floor.width, (column + 0.5) * cellSize),
				y: Math.min(floor.height, (row + 0.5) * cellSize)
			};
			const sourceColumn = Math.floor((point.x - originX) / document.cellSize);
			const sourceRow = Math.floor((point.y - originY) / document.cellSize);
			const allowed = sourceColumn >= 0
				&& sourceRow >= 0
				&& sourceColumn < document.columns
				&& sourceRow < document.rows
				&& source[sourceRow * document.columns + sourceColumn] === 1
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
	const pedestrianSpaceSource = floor.pedestrianSpaceSource
		?? (walkable.length > 0 ? 'polygons' : floor.walkableMask ? 'mask' : 'polygons');
	const usesPaintedMask = pedestrianSpaceSource === 'mask'
		&& Boolean(floor.walkableMask?.walkableRuns.length);

	if (walkable.length === 0 && !usesPaintedMask) {
		throw new Error('Draw, detect, or import pedestrian space before building routes.');
	}

	const cellSize = Math.max(3, Math.min(24, Math.round(
		options.cellSize
			?? (usesPaintedMask ? floor.walkableMask?.cellSize : undefined)
			?? Math.max(floor.width, floor.height) / 220
	)));
	const { columns, mask, rows } = usesPaintedMask
		? documentMask(floor, cellSize)
		: polygonMask(floor, cellSize);
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
	const linkedDoorByLocationId = new Map<string, WayfindingStudioDoorElement>();

	for (const door of floor.elements.filter(
		(element): element is WayfindingStudioDoorElement => element.type === 'door'
	)) {
		if (!door.locationId || linkedDoorByLocationId.has(door.locationId)) continue;
		linkedDoorByLocationId.set(door.locationId, door);
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
				&& linkedDoorByLocationId.has(element.id)
			);
	});
	const anchorIndexByNodeId = new Map<string, number>();
	const approachDirectionByNodeId = new Map<string, WayfindingPoint>();
	const connectorGeometryByNodeId = new Map<string, WayfindingPoint[]>();
	const diagnostics: RouteBuildDiagnostic[] = [];

	for (const node of semanticNodes) {
		const semanticElement = node.semanticElementId
			? semanticElements.get(node.semanticElementId)
			: undefined;
		const associatedLocation = semanticElement?.type === 'location'
			? semanticElement
			: undefined;
		const associatedDoor = associatedLocation
			? linkedDoorByLocationId.get(associatedLocation.id)
			: undefined;
		const connector = associatedDoor && associatedLocation
			? connectorForDoor(
				associatedDoor,
				associatedLocation,
				mask,
				rawSkeleton,
				columns,
				rows,
				cellSize
			)
			: connectorForPoint(node, mask, rawSkeleton, columns, rows, cellSize);
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

	const network = extractSkeletonNetwork(networkMask, columns, rows, new Set(anchorIndexByNodeId.values()));
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
			distanceMeters: edgeDistance(geometry, floor.unitsPerMeter ?? 10),
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
			distanceMeters: edgeDistance(geometry, floor.unitsPerMeter ?? 10),
			from: node.id,
			geometry,
			id: `generated:${floorId}:connector:${node.id}`,
			kind: 'walk',
			reviewStatus: 'proposed',
			to: generatedNodeId,
			traversal: 'portal'
		});
	}

	if (anchorIndexByNodeId.size >= 2) {
		const core = retainAnchorNetworkCore(
			[
				...generatedNodes.map((node) => node.id),
				...semanticNodes.map((node) => node.id)
			],
			generatedEdges,
			new Set(semanticNodes
				.filter((node) => anchorIndexByNodeId.has(node.id))
				.map((node) => node.id))
		);
		const retainedEdges = generatedEdges.filter((edge) => core.edgeIds.has(edge.id));
		const retainedNodeIds = new Set(retainedEdges.flatMap((edge) => [edge.from, edge.to]));

		generatedEdges.splice(0, generatedEdges.length, ...retainedEdges);
		generatedNodes.splice(
			0,
			generatedNodes.length,
			...generatedNodes.filter((node) => retainedNodeIds.has(node.id))
		);
	}

	const nodesById = new Map(project.graph.nodes.map((node) => [node.id, node]));
	const edgeTouchesFloor = (edge: WayfindingEdge): boolean =>
		nodesById.get(edge.from)?.levelId === floorId
		|| nodesById.get(edge.to)?.levelId === floorId;
	const generatedEdgesBefore = project.graph.edges.filter((edge) =>
		edgeTouchesFloor(edge) && isGeneratedRouteElement(edge, floorId)
	);
	const manualFloorEdges = project.graph.edges.filter((edge) =>
		edgeTouchesFloor(edge) && !isGeneratedRouteElement(edge, floorId)
	);
	const manualEndpointIds = new Set(manualFloorEdges.flatMap((edge) => [edge.from, edge.to]));
	const generatedNodesBefore = project.graph.nodes.filter((node) =>
		node.levelId === floorId
		&& !node.semanticElementId
		&& isGeneratedRouteElement(node, floorId)
		&& !manualEndpointIds.has(node.id)
	);
	const retainedNodes = project.graph.nodes
		.filter((node) =>
			node.levelId !== floorId
			|| Boolean(node.semanticElementId)
			|| !isGeneratedRouteElement(node, floorId)
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
		!edgeTouchesFloor(edge) || !isGeneratedRouteElement(edge, floorId)
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
					distanceMeters: edgeDistance(geometry, floor.unitsPerMeter ?? 10),
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
				&& !isGeneratedRouteElement(node, floorId)
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
