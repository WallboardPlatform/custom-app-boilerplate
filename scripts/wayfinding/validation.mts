import type {
	WayfindingEdge,
	WayfindingGraphDocument,
	WayfindingNode,
	WayfindingPoint,
	WayfindingRouteResult,
	WayfindingWalkableMaskDocument
} from '../../src/utils/wayfinding.js';
import { WayfindingGraph } from '../../src/utils/wayfinding.js';
import {
	type DestinationMetadata,
	type ParsedWayfindingLocation,
	type ParsedWayfindingSvg
} from './model.mjs';
import { validateWalkableMaskStructure, WayfindingWalkableMask } from './walkable-mask.mjs';

export type WayfindingIssueSeverity = 'error' | 'warning';

export interface WayfindingIssue {
	code: string;
	message: string;
	references: string[];
	severity: WayfindingIssueSeverity;
}

export interface WayfindingRouteCheck {
	destinationId: string;
	edgeIds: string[];
	nodeCount: number;
	nodeIds: string[];
	reachable: boolean;
	stepFreeReachable: boolean | null;
	walkingDistance?: number;
}

export interface WayfindingValidationReport {
	generatedAt: string;
	graph: {
		edges: number;
		maxDegree: number;
		nodes: number;
	};
	highlightedRoute?: WayfindingRouteCheck;
	issues: WayfindingIssue[];
	map: {
		height: number;
		levels: number;
		locations: number;
		width: number;
	};
	routes: WayfindingRouteCheck[];
	summary: {
		errors: number;
		routeableDestinations: number;
		routesReachable: number;
		warnings: number;
	};
}

export interface WayfindingValidationOptions {
	destinations: DestinationMetadata[];
	graph: WayfindingGraphDocument;
	highlightDestinationId?: string;
	map: ParsedWayfindingSvg;
	startLocationId?: string;
	walkableMask?: WayfindingWalkableMaskDocument;
}

const addIssue = (
	issues: WayfindingIssue[],
	severity: WayfindingIssueSeverity,
	code: string,
	message: string,
	references: string[] = []
): void => {
	issues.push({ code, message, references, severity });
};

const duplicateValues = (values: string[]): string[] => {
	const seen = new Set<string>();
	const duplicates = new Set<string>();

	for (const value of values) {
		if (seen.has(value)) duplicates.add(value);
		seen.add(value);
	}

	return [...duplicates].sort();
};

const validateMapStructure = (map: ParsedWayfindingSvg, issues: WayfindingIssue[]): void => {
	const forbiddenTags = new Set(['script', 'foreignObject', 'iframe', 'object']);

	if (map.viewBox[2] <= 0 || map.viewBox[3] <= 0 || map.width <= 0 || map.height <= 0) {
		addIssue(issues, 'error', 'map-coordinate-space-invalid', 'SVG dimensions and viewBox width/height must be positive.');
	}

	if (map.locations.length === 0) {
		addIssue(issues, 'error', 'location-annotations-missing', 'No element has a stable data-wayfinding-location-id annotation.');
	}

	for (const element of map.elements) {
		if (forbiddenTags.has(element.tag)) {
			addIssue(issues, 'error', 'executable-svg-content', `SVG element '${element.tag}' is not allowed in generated maps.`, [element.attributes.id ?? element.tag]);
		}

		for (const [name, value] of Object.entries(element.attributes)) {
			if (/^on/i.test(name)) {
				addIssue(issues, 'error', 'svg-event-handler', `SVG event attribute '${name}' is not allowed.`, [element.attributes.id ?? element.tag, name]);
			}

			if (/^(?:href|xlink:href)$/i.test(name) && /^\s*javascript:/i.test(value)) {
				addIssue(issues, 'error', 'unsafe-svg-url', `SVG attribute '${name}' contains an unsafe URL.`, [element.attributes.id ?? element.tag, name]);
			}
		}
	}

	for (const id of duplicateValues(map.ids)) {
		addIssue(issues, 'error', 'duplicate-svg-id', `SVG id '${id}' is not unique.`, [id]);
	}

	for (const locationId of duplicateValues(map.locations.map((location: ParsedWayfindingLocation): string => location.locationId))) {
		addIssue(issues, 'error', 'duplicate-location-annotation', `Wayfinding location '${locationId}' is annotated more than once. Wrap multipart geometry in one annotated group.`, [locationId]);
	}

	for (const location of map.locations) {
		if (!location.attributes.id) {
			addIssue(issues, 'error', 'location-element-id-missing', `Wayfinding location '${location.locationId}' requires a stable SVG element id.`, [location.locationId]);
		}
	}
};

const edgeKey = (edge: WayfindingEdge): string => edge.bidirectional
	? [edge.from, edge.to].sort().join('<->')
	: `${edge.from}->${edge.to}`;

const pointDistance = (left: WayfindingPoint, right: WayfindingPoint): number => {
	return Math.hypot(right.x - left.x, right.y - left.y);
};

const edgePoints = (edge: WayfindingEdge, from: WayfindingNode, to: WayfindingNode): WayfindingPoint[] => {
	return edge.geometry?.length ? edge.geometry : [from, to];
};

const polylineLength = (points: WayfindingPoint[]): number => {
	return points.slice(1).reduce((total: number, point: WayfindingPoint, index: number): number => {
		return total + pointDistance(points[index], point);
	}, 0);
};

const turnAngle = (left: WayfindingPoint, center: WayfindingPoint, right: WayfindingPoint): number => {
	const incoming = { x: center.x - left.x, y: center.y - left.y };
	const outgoing = { x: right.x - center.x, y: right.y - center.y };
	const denominator = Math.hypot(incoming.x, incoming.y) * Math.hypot(outgoing.x, outgoing.y);

	if (denominator === 0) return 0;

	const cosine = Math.max(-1, Math.min(1, (incoming.x * outgoing.x + incoming.y * outgoing.y) / denominator));

	return Math.acos(cosine) * 180 / Math.PI;
};

const orientation = (a: WayfindingPoint, b: WayfindingPoint, c: WayfindingPoint): number => {
	return (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
};

const crosses = (leftA: WayfindingPoint, leftB: WayfindingPoint, rightA: WayfindingPoint, rightB: WayfindingPoint): boolean => {
	const o1: number = orientation(leftA, leftB, rightA);
	const o2: number = orientation(leftA, leftB, rightB);
	const o3: number = orientation(rightA, rightB, leftA);
	const o4: number = orientation(rightA, rightB, leftB);

	return o1 * o2 < 0 && o3 * o4 < 0;
};

const validateGraph = (
	graph: WayfindingGraphDocument,
	map: ParsedWayfindingSvg,
	issues: WayfindingIssue[],
	walkableMaskDocument?: WayfindingWalkableMaskDocument
): number => {
	const nodeById = new Map<string, WayfindingNode>();
	const degree = new Map<string, number>();
	const [viewBoxX, viewBoxY, viewBoxWidth, viewBoxHeight] = map.viewBox;
	const walkableMask: WayfindingWalkableMask | undefined = walkableMaskDocument ? new WayfindingWalkableMask(walkableMaskDocument) : undefined;

	if (graph.contractVersion === 2 && !walkableMaskDocument) {
		addIssue(issues, 'warning', 'walkable-mask-missing', 'Version 2 graph geometry has no independent reviewed walkable mask.');
	}

	if (walkableMaskDocument) {
		for (const error of validateWalkableMaskStructure(walkableMaskDocument)) {
			addIssue(issues, 'error', 'walkable-mask-invalid', `Walkable mask ${error}.`, [walkableMaskDocument.mapId]);
		}

		if (walkableMaskDocument.reviewStatus === 'proposed') {
			addIssue(issues, 'warning', 'walkable-mask-review-required', 'The walkable mask is still proposed and must be confirmed against the source map.', [walkableMaskDocument.mapId]);
		}

		if (
			Math.abs((walkableMaskDocument.originX ?? 0) - viewBoxX) > 0.01
			|| Math.abs((walkableMaskDocument.originY ?? 0) - viewBoxY) > 0.01
			|| Math.abs(walkableMaskDocument.width - viewBoxWidth) > 0.01
			|| Math.abs(walkableMaskDocument.height - viewBoxHeight) > 0.01
		) {
			addIssue(issues, 'error', 'walkable-mask-map-mismatch', 'Walkable mask bounds do not match the SVG viewBox.', [walkableMaskDocument.mapId]);
		}
	}

	for (const id of duplicateValues(graph.nodes.map((node: WayfindingNode): string => node.id))) {
		addIssue(issues, 'error', 'duplicate-graph-node', `Graph node '${id}' is not unique.`, [id]);
	}

	for (const node of graph.nodes) {
		nodeById.set(node.id, node);
		degree.set(node.id, 0);

		if (node.x < viewBoxX || node.x > viewBoxX + viewBoxWidth || node.y < viewBoxY || node.y > viewBoxY + viewBoxHeight) {
			addIssue(issues, 'error', 'graph-node-outside-viewbox', `Graph node '${node.id}' is outside the SVG viewBox.`, [node.id]);
		}
	}

	for (const id of duplicateValues(graph.edges.map((edge: WayfindingEdge): string => edge.id))) {
		addIssue(issues, 'error', 'duplicate-edge-id', `Graph edge '${id}' is not unique.`, [id]);
	}

	for (const key of duplicateValues(graph.edges.map(edgeKey))) {
		addIssue(issues, 'error', 'duplicate-edge', `Graph contains duplicate connection '${key}'.`, [key]);
	}

	const validEdges: Array<{ edge: WayfindingEdge; from: WayfindingNode; points: WayfindingPoint[]; to: WayfindingNode; pixels: number }> = [];

	for (const edge of graph.edges) {
		const from: WayfindingNode | undefined = nodeById.get(edge.from);
		const to: WayfindingNode | undefined = nodeById.get(edge.to);

		if (!from || !to) {
			addIssue(issues, 'error', 'edge-node-missing', `Edge '${edge.id}' references a missing node.`, [edge.id, edge.from, edge.to]);

			continue;
		}

		if (edge.from === edge.to) {
			addIssue(issues, 'error', 'edge-self-loop', `Edge '${edge.id}' connects a node to itself.`, [edge.id, edge.from]);

			continue;
		}

		if (from.levelId !== to.levelId) {
			if (edge.distanceMeters === undefined) {
				addIssue(
					issues,
					'error',
					'cross-level-distance-missing',
					`Cross-level edge '${edge.id}' requires distanceMeters so it cannot become a zero-cost route.`,
					[edge.id, from.levelId, to.levelId]
				);
			}

			if (from.kind !== 'transition' || to.kind !== 'transition') {
				addIssue(issues, 'error', 'cross-level-transition-node-required', `Cross-level edge '${edge.id}' must connect transition nodes.`, [edge.id, from.id, to.id]);
			}

			if (!['stairs', 'elevator', 'escalator', 'shuttle'].includes(edge.kind)) {
				addIssue(issues, 'error', 'cross-level-edge-kind-invalid', `Cross-level edge '${edge.id}' must use a floor-transition kind.`, [edge.id, edge.kind]);
			}
		}

		const points: WayfindingPoint[] = edgePoints(edge, from, to);

		if (graph.contractVersion === 2 && from.levelId === to.levelId) {
			if (!edge.geometry) {
				addIssue(issues, 'error', 'edge-geometry-required', `Version 2 edge '${edge.id}' requires authored centerline geometry.`, [edge.id]);
			} else {
				if (pointDistance(points[0], from) > 0.75) {
					addIssue(issues, 'error', 'edge-geometry-start-mismatch', `Edge '${edge.id}' geometry does not start at node '${from.id}'.`, [edge.id, from.id]);
				}

				if (pointDistance(points[points.length - 1], to) > 0.75) {
					addIssue(issues, 'error', 'edge-geometry-end-mismatch', `Edge '${edge.id}' geometry does not end at node '${to.id}'.`, [edge.id, to.id]);
				}
			}

			if (edge.corridorWidth === undefined) {
				addIssue(issues, 'error', 'edge-corridor-width-required', `Version 2 edge '${edge.id}' requires the reviewed walkable corridor width.`, [edge.id]);
			}

			if (edge.reviewStatus === 'proposed') {
				addIssue(issues, 'warning', 'edge-review-required', `Edge '${edge.id}' is still proposed and must be confirmed against the source map.`, [edge.id]);
			}
		}

		for (const [index, point] of points.entries()) {
			if (point.x < viewBoxX || point.x > viewBoxX + viewBoxWidth || point.y < viewBoxY || point.y > viewBoxY + viewBoxHeight) {
				addIssue(issues, 'error', 'edge-geometry-outside-viewbox', `Edge '${edge.id}' geometry point ${index} is outside the SVG viewBox.`, [edge.id, String(index)]);
			}
		}

		for (let index = 1; index < points.length; index += 1) {
			const isAlignedLevelTransition = from.levelId !== to.levelId
				&& points.length === 2
				&& index === 1
				&& ['elevator', 'escalator', 'stairs'].includes(edge.kind);

			if (pointDistance(points[index - 1], points[index]) <= 0.01 && !isAlignedLevelTransition) {
				addIssue(issues, 'error', 'edge-geometry-zero-segment', `Edge '${edge.id}' contains a zero-length centerline segment.`, [edge.id, String(index - 1)]);
			}
		}

		if (edge.kind !== 'stairs' && edge.kind !== 'escalator') {
			for (let index = 1; index < points.length - 1; index += 1) {
				if (turnAngle(points[index - 1], points[index], points[index + 1]) > 145) {
					addIssue(issues, 'warning', 'edge-backtracking-review', `Edge '${edge.id}' reverses direction near geometry point ${index}; review it for an AI-generated zigzag.`, [edge.id, String(index)]);
				}
			}
		}

		if (walkableMask && from.levelId === to.levelId && edge.geometry && edge.corridorWidth !== undefined) {
			const outside = walkableMask.outsideCorridor(points, edge.corridorWidth);

			if (outside.length > 0) {
				const first = outside[0];
				addIssue(
					issues,
					'error',
					'edge-outside-walkable-space',
					`Edge '${edge.id}' leaves confirmed walkable space near (${Math.round(first.x)}, ${Math.round(first.y)}); ${outside.length} sampled cell(s) fail.`,
					[edge.id, String(first.column), String(first.row)]
				);
			}
		}

		degree.set(from.id, (degree.get(from.id) ?? 0) + 1);
		degree.set(to.id, (degree.get(to.id) ?? 0) + 1);
		validEdges.push({ edge, from, pixels: from.levelId === to.levelId ? polylineLength(points) : 0, points, to });
	}

	const lengths: number[] = validEdges.map((item): number => item.pixels).filter((length: number): boolean => length > 0).sort((a: number, b: number): number => a - b);
	const medianLength: number = lengths[Math.floor(lengths.length / 2)] ?? 0;
	const suspiciousLength: number = Math.max(120, medianLength * 4);

	for (const item of validEdges.filter((candidate): boolean => candidate.pixels > suspiciousLength)) {
		addIssue(issues, 'warning', 'long-edge-review', `Edge '${item.edge.id}' is ${Math.round(item.pixels)} SVG units long and should be reviewed for a shortcut.`, [item.edge.id]);
	}

	for (const item of validEdges) {
		const directDistance: number = pointDistance(item.points[0], item.points[item.points.length - 1]);

		if (directDistance > 12 && item.pixels / directDistance > 2.25) {
			addIssue(issues, 'warning', 'edge-excessive-detour-review', `Edge '${item.edge.id}' is more than 2.25x its endpoint distance; split or simplify it if this is not an intentional switchback.`, [item.edge.id]);
		}
	}

	for (let leftIndex = 0; leftIndex < validEdges.length; leftIndex += 1) {
		for (let rightIndex = leftIndex + 1; rightIndex < validEdges.length; rightIndex += 1) {
			const left = validEdges[leftIndex];
			const right = validEdges[rightIndex];
			const leftIsSingleLevel: boolean = left.from.levelId === left.to.levelId;
			const rightIsSingleLevel: boolean = right.from.levelId === right.to.levelId;

			if (!leftIsSingleLevel || !rightIsSingleLevel || left.from.levelId !== right.from.levelId) continue;

			if ([right.from.id, right.to.id].includes(left.from.id) || [right.from.id, right.to.id].includes(left.to.id)) continue;

			let crossing = false;

			for (let leftPoint = 1; leftPoint < left.points.length && !crossing; leftPoint += 1) {
				for (let rightPoint = 1; rightPoint < right.points.length && !crossing; rightPoint += 1) {
					crossing = crosses(left.points[leftPoint - 1], left.points[leftPoint], right.points[rightPoint - 1], right.points[rightPoint]);
				}
			}

			if (crossing) {
				addIssue(issues, 'warning', 'edge-crossing-without-node', `Edges '${left.edge.id}' and '${right.edge.id}' cross without a shared node.`, [left.edge.id, right.edge.id]);
			}
		}
	}

	const maxDegree: number = Math.max(0, ...degree.values());
	const highDegreeNodes: Array<[string, number]> = [...degree.entries()].filter(([, value]): boolean => value > 8);

	for (const node of graph.nodes.filter((candidate: WayfindingNode): boolean => candidate.kind === 'location')) {
		if ((degree.get(node.id) ?? 0) > 1) {
			addIssue(issues, 'error', 'location-node-used-as-transit', `Location node '${node.id}' has more than one edge and can become an unrelated route shortcut. Attach it as a leaf entrance node.`, [node.id]);
		}
	}

	for (const [nodeId, value] of highDegreeNodes.slice(0, 25)) {
		addIssue(issues, 'warning', 'high-node-degree', `Node '${nodeId}' has degree ${value}; inspect for unintended shortcuts.`, [nodeId]);
	}

	if (highDegreeNodes.length > 25) {
		addIssue(issues, 'warning', 'high-node-degree-summary', `${highDegreeNodes.length - 25} additional nodes have degree above 8.`);
	}

	return maxDegree;
};

const validateDestinations = (
	destinations: DestinationMetadata[],
	graph: WayfindingGraphDocument,
	map: ParsedWayfindingSvg,
	issues: WayfindingIssue[]
): void => {
	const locationIds = new Set(map.locations.map((location: ParsedWayfindingLocation): string => location.locationId));
	const locationById = new Map(map.locations.map((location: ParsedWayfindingLocation): [string, ParsedWayfindingLocation] => [location.locationId, location]));
	const graphLocationIds = new Set(graph.nodes.filter((node: WayfindingNode): boolean => node.kind === 'location')
		.map((node: WayfindingNode): string | undefined => node.locationId)
		.filter((id): id is string => Boolean(id)));

	for (const node of graph.nodes.filter((candidate: WayfindingNode): boolean => candidate.kind === 'location')) {
		if (node.locationId && !locationIds.has(node.locationId)) {
			addIssue(issues, 'error', 'graph-location-shape-missing', `Graph location node '${node.id}' references missing SVG location '${node.locationId}'.`, [node.id, node.locationId]);
		}

		const location: ParsedWayfindingLocation | undefined = node.locationId ? locationById.get(node.locationId) : undefined;

		if (location?.levelId && location.levelId !== node.levelId) {
			addIssue(issues, 'error', 'graph-location-level-mismatch', `Graph location node '${node.id}' is on '${node.levelId}', but its SVG target is on '${location.levelId}'.`, [node.id, node.locationId!, node.levelId, location.levelId]);
		}
	}

	for (const id of duplicateValues(destinations.map((destination: DestinationMetadata): string => destination.id))) {
		addIssue(issues, 'error', 'duplicate-destination-id', `Destination '${id}' appears more than once in metadata.`, [id]);
	}

	for (const destination of destinations) {
		if (destination.routeable && !locationIds.has(destination.id)) {
			addIssue(issues, 'error', 'destination-location-missing', `Routeable destination '${destination.id}' has no SVG location shape.`, [destination.id]);
		}

		if (destination.routeable && !graphLocationIds.has(destination.id)) {
			addIssue(issues, 'error', 'destination-route-node-missing', `Routeable destination '${destination.id}' has no graph location node.`, [destination.id]);
		}

		if (destination.routeable && destination.accessible === null) {
			addIssue(issues, 'warning', 'destination-accessibility-unverified', `Destination '${destination.id}' has no verified accessibility value.`, [destination.id]);
		}
	}

	const metadataIds = new Set(destinations.map((destination: DestinationMetadata): string => destination.id));

	for (const location of map.locations) {
		if (!metadataIds.has(location.locationId)) {
			addIssue(issues, 'warning', 'location-content-missing', `Location '${location.locationId}' has no companion metadata row.`, [location.locationId]);
		}
	}
};

const routeChecks = (
	destinations: DestinationMetadata[],
	graphDocument: WayfindingGraphDocument,
	startLocationId: string | undefined,
	issues: WayfindingIssue[]
): WayfindingRouteCheck[] => {
	if (!startLocationId) {
		addIssue(issues, 'warning', 'start-location-unspecified', 'No start location was supplied, so route coverage was not evaluated.');

		return [];
	}

	const graph = new WayfindingGraph(graphDocument);
	const nodeById = new Map(graphDocument.nodes.map((node: WayfindingNode): [string, WayfindingNode] => [node.id, node]));
	const locationNodeById = new Map(graphDocument.nodes.filter((node: WayfindingNode): boolean => node.kind === 'location')
		.map((node: WayfindingNode): [string, WayfindingNode] => [node.locationId!, node]));
	const startNode: WayfindingNode | undefined = locationNodeById.get(startLocationId);

	if (!startNode) {
		addIssue(issues, 'error', 'start-location-node-missing', `Start location '${startLocationId}' has no graph location node.`, [startLocationId]);

		return [];
	}

	return destinations.filter((destination: DestinationMetadata): boolean => destination.routeable).map((destination: DestinationMetadata): WayfindingRouteCheck => {
		const destinationNode: WayfindingNode | undefined = locationNodeById.get(destination.id);
		const standard: WayfindingRouteResult | undefined = destinationNode ? graph.route(startNode.id, destinationNode.id) : undefined;
		const stepFree: WayfindingRouteResult | undefined = destinationNode
			? graph.route(startNode.id, destinationNode.id, { profile: 'step-free' })
			: undefined;

		if (!standard) {
			addIssue(issues, 'error', 'destination-unreachable', `Destination '${destination.id}' is marked routeable but cannot be reached from '${startLocationId}'.`, [startLocationId, destination.id]);
		}

		for (const intermediateNodeId of standard?.nodeIds.slice(1, -1) ?? []) {
			const intermediateNode: WayfindingNode | undefined = nodeById.get(intermediateNodeId);

			if (intermediateNode?.kind === 'location') {
				addIssue(issues, 'error', 'route-uses-unrelated-location', `Route to '${destination.id}' passes through location '${intermediateNode.locationId ?? intermediateNode.id}'. Destination entrances must not be graph shortcuts.`, [destination.id, intermediateNode.id]);
			}
		}

		if (destination.accessible === true && standard && !stepFree) {
			addIssue(issues, 'warning', 'accessible-route-unavailable', `Accessible destination '${destination.id}' has no step-free route from '${startLocationId}'.`, [startLocationId, destination.id]);
		}

		return {
			destinationId: destination.id,
			edgeIds: standard?.edgeIds ?? [],
			nodeCount: standard?.nodeIds.length ?? 0,
			nodeIds: standard?.nodeIds ?? [],
			reachable: Boolean(standard),
			stepFreeReachable: Boolean(stepFree),
			walkingDistance: standard?.walkingDistance
		};
	});
};

export const validateWayfinding = (options: WayfindingValidationOptions): WayfindingValidationReport => {
	const issues: WayfindingIssue[] = [];
	validateMapStructure(options.map, issues);
	const maxDegree: number = validateGraph(options.graph, options.map, issues, options.walkableMask);
	validateDestinations(options.destinations, options.graph, options.map, issues);
	const routes: WayfindingRouteCheck[] = routeChecks(options.destinations, options.graph, options.startLocationId, issues);
	const highlightedRoute: WayfindingRouteCheck | undefined = options.highlightDestinationId
		? routes.find((route: WayfindingRouteCheck): boolean => route.destinationId === options.highlightDestinationId && route.reachable)
		: routes.find((route: WayfindingRouteCheck): boolean => route.reachable && route.nodeIds.length > 1);

	if (options.highlightDestinationId && !highlightedRoute) {
		addIssue(issues, 'warning', 'highlighted-route-unavailable', `Requested highlighted route '${options.highlightDestinationId}' is unavailable.`, [options.highlightDestinationId]);
	}
	const routeableDestinations: number = options.destinations.filter((destination: DestinationMetadata): boolean => destination.routeable).length;

	return {
		generatedAt: new Date().toISOString(),
		graph: {
			edges: options.graph.edges.length,
			maxDegree,
			nodes: options.graph.nodes.length
		},
		highlightedRoute,
		issues,
		map: {
			height: options.map.height,
			levels: new Set(options.graph.nodes.map((node: WayfindingNode): string => node.levelId)).size,
			locations: options.map.locations.length,
			width: options.map.width
		},
		routes,
		summary: {
			errors: issues.filter((issue: WayfindingIssue): boolean => issue.severity === 'error').length,
			routeableDestinations,
			routesReachable: routes.filter((route: WayfindingRouteCheck): boolean => route.reachable).length,
			warnings: issues.filter((issue: WayfindingIssue): boolean => issue.severity === 'warning').length
		}
	};
};
