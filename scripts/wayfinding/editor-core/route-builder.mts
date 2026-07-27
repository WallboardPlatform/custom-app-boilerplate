import {
	extractSkeletonNetwork,
	nearestSkeletonIndex,
	skeletonizeWalkableMask
} from '../centerline.mts';
import {
	synchronizeWayfindingStudioGraph,
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
}

export interface RouteBuildResult {
	edges: number;
	nodes: number;
	project: WayfindingStudioProject;
}

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

	while (start < points.length - 1) {
		let end = points.length - 1;

		while (end > start + 1 && !segmentContained(points[start], points[end], mask, columns, rows, cellSize)) {
			end -= 1;
		}

		result.push(points[end]);
		start = end;
	}

	return result;
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

	if (walkable.length === 0) throw new Error('Draw at least one walkable area before building routes.');

	const cellSize = Math.max(3, Math.min(24, Math.round(options.cellSize ?? Math.max(floor.width, floor.height) / 220)));
	const { columns, mask, rows } = polygonMask(floor, cellSize);
	const rawSkeleton = skeletonizeWalkableMask(mask, columns, rows);
	const semanticNodes = project.graph.nodes.filter((node) => node.levelId === floorId && Boolean(node.semanticElementId));
	const anchorIndexByNodeId = new Map<string, number>();

	for (const node of semanticNodes) {
		const nearest = nearestSkeletonIndex(rawSkeleton, columns, {
			column: Math.max(0, Math.min(columns - 1, Math.floor(node.x / cellSize))),
			row: Math.max(0, Math.min(rows - 1, Math.floor(node.y / cellSize)))
		});

		if (nearest !== undefined) anchorIndexByNodeId.set(node.id, nearest);
	}

	const network = extractSkeletonNetwork(mask, columns, rows, new Set(anchorIndexByNodeId.values()));
	const nodeIdByIndex = new Map<number, string>();
	const generatedNodes: WayfindingNode[] = network.nodeIndices.map((index) => {
		const id = `generated:${floorId}:node:${index}`;
		nodeIdByIndex.set(index, id);

		return {
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
			mask,
			columns,
			rows,
			cellSize
		);
		generatedEdges.push({
			accessible: true,
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

	for (const node of semanticNodes) {
		const anchorIndex = anchorIndexByNodeId.get(node.id);
		const generatedNodeId = anchorIndex === undefined ? undefined : nodeIdByIndex.get(anchorIndex);
		const generatedNode = generatedNodes.find((candidate) => candidate.id === generatedNodeId);

		if (!generatedNodeId || !generatedNode || generatedNodeId === node.id) continue;

		const geometry = [{ x: node.x, y: node.y }, { x: generatedNode.x, y: generatedNode.y }];
		generatedEdges.push({
			accessible: true,
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

	const removedNodeIds = new Set(project.graph.nodes
		.filter((node) => node.levelId === floorId && !node.semanticElementId)
		.map((node) => node.id));
	const retainedNodes = project.graph.nodes.filter((node) => node.levelId !== floorId || Boolean(node.semanticElementId));
	const retainedEdges = project.graph.edges.filter((edge) =>
		!removedNodeIds.has(edge.from)
		&& !removedNodeIds.has(edge.to)
		&& !edge.id.startsWith(`generated:${floorId}:`)
	);
	project.graph = {
		...project.graph,
		edges: [...retainedEdges, ...generatedEdges],
		nodes: [...retainedNodes, ...generatedNodes]
	};

	return {
		edges: generatedEdges.length,
		nodes: generatedNodes.length,
		project
	};
};
