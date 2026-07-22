export type WayfindingNodeKind = 'route' | 'location' | 'transition';

export type WayfindingEdgeKind = 'walk' | 'outdoor' | 'stairs' | 'elevator' | 'escalator' | 'shuttle';

export type WayfindingTraversal = 'outdoor-path' | 'crossing' | 'indoor-corridor' | 'open-area' | 'portal' | 'transition';

export type WayfindingReviewStatus = 'confirmed' | 'proposed';

export interface WayfindingPoint {
	x: number;
	y: number;
}

export interface WayfindingRoutePoint extends WayfindingPoint {
	levelId: string;
}

export type WayfindingWalkableMaskRun = [row: number, startColumn: number, endColumn: number];

export interface WayfindingWalkableMaskDocument {
	cellSize: number;
	columns: number;
	contractVersion: 1;
	height: number;
	mapId: string;
	originX?: number;
	originY?: number;
	reviewStatus: WayfindingReviewStatus;
	rows: number;
	walkableRuns: WayfindingWalkableMaskRun[];
	width: number;
}

export interface WayfindingNode {
	id: string;
	levelId: string;
	kind: WayfindingNodeKind;
	x: number;
	y: number;
	locationId?: string;
	semanticElementId?: string;
}

export interface WayfindingEdge {
	id: string;
	from: string;
	to: string;
	kind: WayfindingEdgeKind;
	accessible: boolean;
	bidirectional: boolean;
	corridorWidth?: number;
	distanceMeters?: number;
	geometry?: WayfindingPoint[];
	reviewStatus?: WayfindingReviewStatus;
	traversal?: WayfindingTraversal;
}

export interface WayfindingGraphDocument {
	contractVersion: 1 | 2;
	graphId: string;
	nodes: WayfindingNode[];
	edges: WayfindingEdge[];
}

export interface WayfindingRouteOptions {
	disabledEdgeIds?: ReadonlySet<string>;
	mapRatio?: number;
	profile?: 'standard' | 'step-free';
	walkingSpeedMetersPerSecond?: number;
}

export interface WayfindingRouteResult {
	distancePixels: number;
	edgeIds: string[];
	nodeIds: string[];
	path: WayfindingRoutePoint[];
	walkingDistance: number;
	walkingSeconds: number;
}

interface AdjacencyEntry {
	edge: WayfindingEdge;
	nodeId: string;
}

interface QueueNode {
	id: string;
	priority: number;
}

const pointDistance = (left: WayfindingPoint, right: WayfindingPoint): number => {
	return Math.hypot(right.x - left.x, right.y - left.y);
};

const edgePoints = (edge: WayfindingEdge, left: WayfindingNode, right: WayfindingNode): WayfindingPoint[] => {
	const points: WayfindingPoint[] = edge.geometry?.length ? edge.geometry : [left, right];

	return edge.from === left.id ? points : [...points].reverse();
};

const edgePixelDistance = (edge: WayfindingEdge, left: WayfindingNode, right: WayfindingNode): number => {
	if (left.levelId !== right.levelId) return 0;

	const points: WayfindingPoint[] = edgePoints(edge, left, right);

	return points.slice(1).reduce((total: number, point: WayfindingPoint, index: number): number => {
		return total + pointDistance(points[index], point);
	}, 0);
};

const edgeCost = (edge: WayfindingEdge, left: WayfindingNode, right: WayfindingNode, mapRatio: number): number => {
	return edge.distanceMeters ?? edgePixelDistance(edge, left, right) / Math.max(0.1, mapRatio);
};

export class WayfindingGraph {
	private readonly adjacency = new Map<string, AdjacencyEntry[]>();

	private readonly nodeById = new Map<string, WayfindingNode>();

	constructor(private readonly document: WayfindingGraphDocument) {
		for (const node of document.nodes) {
			this.nodeById.set(node.id, node);
			this.adjacency.set(node.id, []);
		}

		for (const edge of document.edges) {
			if (!this.nodeById.has(edge.from) || !this.nodeById.has(edge.to)) continue;

			this.adjacency.get(edge.from)!.push({ edge, nodeId: edge.to });

			if (edge.bidirectional) this.adjacency.get(edge.to)!.push({ edge, nodeId: edge.from });
		}
	}

	public node(id: string): WayfindingNode | undefined {
		return this.nodeById.get(id);
	}

	public locationNode(locationId: string): WayfindingNode | undefined {
		return this.document.nodes.find((node: WayfindingNode): boolean => node.kind === 'location' && node.locationId === locationId);
	}

	public routePath(result: Pick<WayfindingRouteResult, 'edgeIds' | 'nodeIds'>): WayfindingRoutePoint[] {
		const path: WayfindingRoutePoint[] = [];

		for (let index = 1; index < result.nodeIds.length; index += 1) {
			const left: WayfindingNode | undefined = this.nodeById.get(result.nodeIds[index - 1]);
			const right: WayfindingNode | undefined = this.nodeById.get(result.nodeIds[index]);
			const edge: WayfindingEdge | undefined = this.document.edges.find((candidate: WayfindingEdge): boolean => candidate.id === result.edgeIds[index - 1]);

			if (!left || !right || !edge || left.levelId !== right.levelId) continue;

			for (const point of edgePoints(edge, left, right)) {
				const previous: WayfindingRoutePoint | undefined = path[path.length - 1];

				if (previous && previous.levelId === left.levelId && previous.x === point.x && previous.y === point.y) continue;

				path.push({ ...point, levelId: left.levelId });
			}
		}

		return path;
	}

	public route(startId: string, destinationId: string, options: WayfindingRouteOptions = {}): WayfindingRouteResult | undefined {
		const start: WayfindingNode | undefined = this.nodeById.get(startId);
		const destination: WayfindingNode | undefined = this.nodeById.get(destinationId);

		if (!start || !destination) return undefined;

		if (startId === destinationId) {
			return {
				distancePixels: 0,
				edgeIds: [],
				nodeIds: [startId],
				path: [{ levelId: start.levelId, x: start.x, y: start.y }],
				walkingDistance: 0,
				walkingSeconds: 0
			};
		}

		const mapRatio: number = Math.max(0.1, options.mapRatio ?? 1);
		const disabledEdgeIds: ReadonlySet<string> = options.disabledEdgeIds ?? new Set<string>();
		const distances = new Map<string, number>();
		const previous = new Map<string, { edgeId: string; nodeId: string }>();
		const queue: QueueNode[] = [];

		for (const id of this.nodeById.keys()) {
			const priority: number = id === startId ? 0 : Number.POSITIVE_INFINITY;
			distances.set(id, priority);
			queue.push({ id, priority });
		}

		while (queue.length > 0) {
			queue.sort((left: QueueNode, right: QueueNode): number => left.priority - right.priority);
			const current: QueueNode = queue.shift()!;

			if (!Number.isFinite(current.priority)) break;

			if (current.id === destinationId) break;

			for (const neighbor of this.adjacency.get(current.id) ?? []) {
				if (disabledEdgeIds.has(neighbor.edge.id)) continue;

				if (options.profile === 'step-free' && !neighbor.edge.accessible) continue;

				const currentNode: WayfindingNode = this.nodeById.get(current.id)!;
				const neighborNode: WayfindingNode = this.nodeById.get(neighbor.nodeId)!;
				const candidate: number = current.priority + edgeCost(neighbor.edge, currentNode, neighborNode, mapRatio);

				if (candidate >= (distances.get(neighbor.nodeId) ?? Number.POSITIVE_INFINITY)) continue;

				distances.set(neighbor.nodeId, candidate);
				previous.set(neighbor.nodeId, { edgeId: neighbor.edge.id, nodeId: current.id });
				const queued: QueueNode | undefined = queue.find((node: QueueNode): boolean => node.id === neighbor.nodeId);

				if (queued) queued.priority = candidate;
			}
		}

		if (!previous.has(destinationId)) return undefined;

		const nodeIds: string[] = [destinationId];
		const edgeIds: string[] = [];
		let cursor: string = destinationId;

		while (previous.has(cursor)) {
			const step = previous.get(cursor)!;
			edgeIds.unshift(step.edgeId);
			cursor = step.nodeId;
			nodeIds.unshift(cursor);
		}

		let distancePixels = 0;
		let walkingDistance = 0;

		for (let index = 1; index < nodeIds.length; index += 1) {
			const left: WayfindingNode = this.nodeById.get(nodeIds[index - 1])!;
			const right: WayfindingNode = this.nodeById.get(nodeIds[index])!;
			const edge: WayfindingEdge = this.document.edges.find((candidate: WayfindingEdge): boolean => candidate.id === edgeIds[index - 1])!;
			const pixels: number = edgePixelDistance(edge, left, right);
			distancePixels += pixels;
			walkingDistance += edge.distanceMeters ?? pixels / mapRatio;
		}

		const roundedDistance: number = Math.max(1, Math.round(walkingDistance));
		const walkingSpeed: number = Math.max(0.1, options.walkingSpeedMetersPerSecond ?? 1.4);

		return {
			distancePixels,
			edgeIds,
			nodeIds,
			path: this.routePath({ edgeIds, nodeIds }),
			walkingDistance: roundedDistance,
			walkingSeconds: Math.max(1, Math.round(roundedDistance / walkingSpeed))
		};
	}
}
