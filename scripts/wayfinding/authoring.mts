import type {
	WayfindingEdge,
	WayfindingEdgeKind,
	WayfindingGraphDocument,
	WayfindingNode,
	WayfindingPoint,
	WayfindingTraversal
} from '../../src/utils/wayfinding.js';

export interface ProposedEdgeOptions {
	accessible?: boolean;
	bidirectional?: boolean;
	corridorWidth?: number;
	kind?: WayfindingEdgeKind;
	traversal?: WayfindingTraversal;
}

const uniqueId = (prefix: string, ids: ReadonlySet<string>): string => {
	let index = 1;

	while (ids.has(`${prefix}-${String(index).padStart(4, '0')}`)) index += 1;

	return `${prefix}-${String(index).padStart(4, '0')}`;
};

const copyPoint = (point: WayfindingPoint): WayfindingPoint => ({ x: point.x, y: point.y });

const distinctPoints = (points: WayfindingPoint[]): WayfindingPoint[] => points.reduce((result: WayfindingPoint[], point: WayfindingPoint): WayfindingPoint[] => {
	const previous: WayfindingPoint | undefined = result[result.length - 1];

	if (!previous || previous.x !== point.x || previous.y !== point.y) result.push(copyPoint(point));

	return result;
}, []);

export const upsertLocationAnchor = (
	document: WayfindingGraphDocument,
	locationId: string,
	point: WayfindingPoint,
	levelId: string
): WayfindingNode => {
	const existing: WayfindingNode | undefined = document.nodes.find((node: WayfindingNode): boolean => node.kind === 'location' && node.locationId === locationId);

	if (existing) {
		existing.levelId = levelId;
		existing.x = point.x;
		existing.y = point.y;

		for (const edge of document.edges) {
			if (!edge.geometry?.length) continue;

			if (edge.from === existing.id) edge.geometry[0] = copyPoint(point);

			if (edge.to === existing.id) edge.geometry[edge.geometry.length - 1] = copyPoint(point);

			if (edge.from === existing.id || edge.to === existing.id) edge.reviewStatus = 'proposed';
		}

		return existing;
	}

	const node: WayfindingNode = {
		id: uniqueId('location', new Set(document.nodes.map((candidate: WayfindingNode): string => candidate.id))),
		kind: 'location',
		levelId,
		locationId,
		...copyPoint(point)
	};

	document.nodes.push(node);

	return node;
};

export const addRouteNode = (document: WayfindingGraphDocument, point: WayfindingPoint, levelId: string): WayfindingNode => {
	const node: WayfindingNode = {
		id: uniqueId('route-manual', new Set(document.nodes.map((candidate: WayfindingNode): string => candidate.id))),
		kind: 'route',
		levelId,
		...copyPoint(point)
	};

	document.nodes.push(node);

	return node;
};

export const addProposedEdge = (
	document: WayfindingGraphDocument,
	fromNodeId: string,
	toNodeId: string,
	geometry: WayfindingPoint[],
	options: ProposedEdgeOptions = {}
): WayfindingEdge => {
	const from: WayfindingNode | undefined = document.nodes.find((node: WayfindingNode): boolean => node.id === fromNodeId);
	const to: WayfindingNode | undefined = document.nodes.find((node: WayfindingNode): boolean => node.id === toNodeId);

	if (!from || !to) throw new Error('A proposed edge requires existing start and end nodes.');

	if (from.id === to.id) throw new Error('A proposed edge cannot connect a node to itself.');

	const points: WayfindingPoint[] = distinctPoints([from, ...geometry.slice(1, -1), to]);

	if (points.length < 2) throw new Error('A proposed edge requires non-zero geometry.');

	const edge: WayfindingEdge = {
		accessible: options.accessible ?? false,
		bidirectional: options.bidirectional ?? true,
		corridorWidth: options.corridorWidth ?? 8,
		from: from.id,
		geometry: points,
		id: uniqueId('edge-manual', new Set(document.edges.map((candidate: WayfindingEdge): string => candidate.id))),
		kind: options.kind ?? 'walk',
		reviewStatus: 'proposed',
		to: to.id,
		traversal: options.traversal ?? 'open-area'
	};

	document.contractVersion = 2;
	document.edges.push(edge);

	return edge;
};
