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
	code: 'connector-fallback' | 'connector-missing' | 'network-disconnected';
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

const maskNeighbors = (
	index: number,
	mask: Uint8Array,
	columns: number,
	rows: number
): number[] => {
	const column = index % columns;
	const row = Math.floor(index / columns);
	const neighbors: number[] = [];

	for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
		for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
			if (columnOffset === 0 && rowOffset === 0) continue;
			const nextColumn = column + columnOffset;
			const nextRow = row + rowOffset;

			if (!activeAt(mask, columns, rows, nextColumn, nextRow)) continue;

			if (columnOffset !== 0 && rowOffset !== 0) {
				const horizontal = activeAt(mask, columns, rows, column + columnOffset, row);
				const vertical = activeAt(mask, columns, rows, column, row + rowOffset);

				// Never cut diagonally across a blocked corner.
				if (!horizontal || !vertical) continue;
			}

			neighbors.push(nextRow * columns + nextColumn);
		}
	}

	return neighbors;
};

const nearestActiveIndex = (
	mask: Uint8Array,
	columns: number,
	point: { column: number; row: number }
): number | undefined => {
	let nearestIndex: number | undefined;
	let nearestDistance = Number.POSITIVE_INFINITY;

	for (let index = 0; index < mask.length; index += 1) {
		if (mask[index] !== 1) continue;
		const column = index % columns;
		const row = Math.floor(index / columns);
		const distance = (column - point.column) ** 2 + (row - point.row) ** 2;

		if (distance >= nearestDistance) continue;
		nearestDistance = distance;
		nearestIndex = index;
	}

	return nearestIndex;
};

const pathToSkeleton = (
	mask: Uint8Array,
	skeleton: Uint8Array,
	columns: number,
	rows: number,
	startIndex: number
): number[] => {
	const queue: number[] = [startIndex];
	const previous = new Int32Array(mask.length);
	previous.fill(-2);
	previous[startIndex] = -1;
	let targetIndex: number | undefined;

	for (let cursor = 0; cursor < queue.length; cursor += 1) {
		const currentIndex = queue[cursor];

		if (skeleton[currentIndex] === 1) {
			targetIndex = currentIndex;
			break;
		}

		for (const neighborIndex of maskNeighbors(currentIndex, mask, columns, rows)) {
			if (previous[neighborIndex] !== -2) continue;
			previous[neighborIndex] = currentIndex;
			queue.push(neighborIndex);
		}
	}

	if (targetIndex === undefined) return [];

	const path = [targetIndex];
	let currentIndex = targetIndex;

	while (previous[currentIndex] >= 0) {
		currentIndex = previous[currentIndex];
		path.push(currentIndex);
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

const straightPathToSkeleton = (
	mask: Uint8Array,
	skeleton: Uint8Array,
	columns: number,
	rows: number,
	startIndex: number,
	cellSize: number,
	direction?: WayfindingPoint
): number[] => {
	const start = pointForIndex(startIndex, columns, cellSize);
	let bestIndex: number | undefined;
	let bestScore = Number.POSITIVE_INFINITY;

	for (let index = 0; index < skeleton.length; index += 1) {
		if (skeleton[index] !== 1) continue;
		const target = pointForIndex(index, columns, cellSize);
		const dx = target.x - start.x;
		const dy = target.y - start.y;
		const distance = Math.hypot(dx, dy);

		if (distance <= cellSize * 0.25) return [startIndex];

		if (!segmentContained(start, target, mask, columns, rows, cellSize)) continue;
		const forward = direction
			? (dx * direction.x + dy * direction.y) / distance
			: 1;

		// A doorway must enter the corridor before it can turn along it.
		if (direction && forward < -0.05) continue;
		const lateralPenalty = direction ? Math.max(0, 1 - forward) * cellSize * 2 : 0;
		const score = distance + lateralPenalty;

		if (score >= bestScore) continue;
		bestIndex = index;
		bestScore = score;
	}

	return bestIndex === undefined ? [] : [startIndex, bestIndex];
};

interface SemanticConnector {
	anchorIndex?: number;
	approachDirection?: WayfindingPoint;
	path: number[];
	strategy: 'door-normal' | 'point-fallback';
}

const connectorForPoint = (
	point: WayfindingPoint,
	mask: Uint8Array,
	skeleton: Uint8Array,
	columns: number,
	rows: number,
	cellSize: number
): SemanticConnector => {
	const startIndex = nearestActiveIndex(mask, columns, {
		column: Math.max(0, Math.min(columns - 1, Math.floor(point.x / cellSize))),
		row: Math.max(0, Math.min(rows - 1, Math.floor(point.y / cellSize)))
	});
	const straightPath = startIndex === undefined
		? []
		: straightPathToSkeleton(mask, skeleton, columns, rows, startIndex, cellSize);
	const path = startIndex === undefined || straightPath.length > 0
		? straightPath
		: pathToSkeleton(mask, skeleton, columns, rows, startIndex);

	return {
		anchorIndex: path[path.length - 1],
		path,
		strategy: 'point-fallback'
	};
};

const connectorForDoor = (
	door: WayfindingStudioDoorElement,
	mask: Uint8Array,
	skeleton: Uint8Array,
	columns: number,
	rows: number,
	cellSize: number
): SemanticConnector => {
	const radians = door.angle * Math.PI / 180;
	const normals = [
		{ x: -Math.sin(radians), y: Math.cos(radians) },
		{ x: Math.sin(radians), y: -Math.cos(radians) }
	];
	const candidates: Array<SemanticConnector & { direction: WayfindingPoint; startIndex: number }> = [];
	const seen = new Set<number>();

	for (const direction of normals) {
		for (let step = 0.6; step <= 5; step += 0.5) {
			const point = {
				x: door.point.x + direction.x * cellSize * step,
				y: door.point.y + direction.y * cellSize * step
			};
			const column = Math.floor(point.x / cellSize);
			const row = Math.floor(point.y / cellSize);

			if (!activeAt(mask, columns, rows, column, row)) continue;
			const startIndex = row * columns + column;

			if (seen.has(startIndex)) continue;
			seen.add(startIndex);
			const straightPath = straightPathToSkeleton(
				mask,
				skeleton,
				columns,
				rows,
				startIndex,
				cellSize,
				direction
			);
			const path = straightPath.length > 0
				? straightPath
				: pathToSkeleton(mask, skeleton, columns, rows, startIndex);

			if (path.length === 0) continue;
			candidates.push({
				anchorIndex: path[path.length - 1],
				direction,
				path,
				startIndex,
				strategy: 'door-normal'
			});
			break;
		}
	}

	if (candidates.length === 0) {
		return connectorForPoint(door.point, mask, skeleton, columns, rows, cellSize);
	}

	candidates.sort((left, right) => {
		const pathDifference = left.path.length - right.path.length;

		if (pathDifference !== 0) return pathDifference;
		const leftPoint = pointForIndex(left.startIndex, columns, cellSize);
		const rightPoint = pointForIndex(right.startIndex, columns, cellSize);
		const leftAlignment = (leftPoint.x - door.point.x) * left.direction.x
			+ (leftPoint.y - door.point.y) * left.direction.y;
		const rightAlignment = (rightPoint.x - door.point.x) * right.direction.x
			+ (rightPoint.y - door.point.y) * right.direction.y;

		return rightAlignment - leftAlignment;
	});

	return {
		...candidates[0],
		approachDirection: candidates[0].direction,
		strategy: 'door-normal'
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

	for (let row = 0; row < rows; row += 1) {
		for (let column = 0; column < columns; column += 1) {
			const point = {
				x: Math.min(floor.width, (column + 0.5) * cellSize),
				y: Math.min(floor.height, (row + 0.5) * cellSize)
			};
			const allowed = walkable.some((area) => pointInPolygon(point, area.geometry))
				&& !obstacles.some((area) => pointInPolygon(point, area.geometry));

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
				&& !obstacles.some((area) => pointInPolygon(point, area.geometry));

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
	const semanticNodes = project.graph.nodes.filter((node) => node.levelId === floorId && Boolean(node.semanticElementId));
	const semanticElements = new Map<string, WayfindingStudioElement>(
		floor.elements.map((element) => [element.id, element])
	);
	const anchorIndexByNodeId = new Map<string, number>();
	const approachDirectionByNodeId = new Map<string, WayfindingPoint>();
	const connectorPathByNodeId = new Map<string, number[]>();
	const diagnostics: RouteBuildDiagnostic[] = [];

	for (const node of semanticNodes) {
		const semanticElement = node.semanticElementId
			? semanticElements.get(node.semanticElementId)
			: undefined;
		const associatedDoor = semanticElement?.type === 'door'
			? semanticElement
			: semanticElement?.type === 'location'
				? floor.elements.find((element): element is WayfindingStudioDoorElement =>
					element.type === 'door' && element.locationId === semanticElement.id
				)
				: undefined;
		const connector = associatedDoor
			? connectorForDoor(associatedDoor, mask, rawSkeleton, columns, rows, cellSize)
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

		if (associatedDoor && connector.strategy === 'point-fallback') {
			diagnostics.push({
				code: 'connector-fallback',
				elementId: associatedDoor.id,
				message: `${associatedDoor.id} was connected without using its doorway direction. Review this entrance.`,
				nodeId: node.id,
				severity: 'warning'
			});
		}
		anchorIndexByNodeId.set(node.id, anchorIndex);

		if (connector.approachDirection) {
			approachDirectionByNodeId.set(node.id, connector.approachDirection);
		}
		connectorPathByNodeId.set(node.id, connector.path);
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

		const maskPath = (connectorPathByNodeId.get(node.id) ?? [])
			.map((index) => pointForIndex(index, columns, cellSize));
		const containedPath = simplifyContained(maskPath, mask, columns, rows, cellSize);
		const nodePoint = { x: node.x, y: node.y };
		const generatedPoint = { x: generatedNode.x, y: generatedNode.y };
		const approachDirection = approachDirectionByNodeId.get(node.id);
		let geometry: WayfindingPoint[];

		if (
			!approachDirection
			&& segmentContained(nodePoint, generatedPoint, mask, columns, rows, cellSize)
		) {
			geometry = [nodePoint, generatedPoint];
		} else if (approachDirection) {
			const firstWalkablePoint = containedPath[0] ?? generatedPoint;
			const projectedDistance = (
				(firstWalkablePoint.x - node.x) * approachDirection.x
				+ (firstWalkablePoint.y - node.y) * approachDirection.y
			);
			const entryDistance = Math.max(
				cellSize * 0.75,
				Math.min(cellSize * 2, projectedDistance)
			);
			const alignedEntry = {
				x: node.x + approachDirection.x * entryDistance,
				y: node.y + approachDirection.y * entryDistance
			};

			if (
				segmentContained(nodePoint, alignedEntry, mask, columns, rows, cellSize)
				&& segmentContained(alignedEntry, generatedPoint, mask, columns, rows, cellSize)
			) {
				geometry = [nodePoint, alignedEntry, generatedPoint];
			} else {
				geometry = [
					nodePoint,
					...containedPath.filter((point, index) =>
						index > 0
							|| Math.hypot(point.x - node.x, point.y - node.y) > cellSize * 0.2
					)
				];
			}
		} else {
			geometry = [
				nodePoint,
				...containedPath.filter((point, index) =>
					index > 0
						|| Math.hypot(point.x - node.x, point.y - node.y) > cellSize * 0.2
				)
			];
		}

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
