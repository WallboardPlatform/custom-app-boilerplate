import type {
	WayfindingEdge,
	WayfindingGraphDocument,
	WayfindingNode,
	WayfindingRouteResult
} from '../../src/utils/wayfinding.js';
import { WayfindingGraph } from '../../src/utils/wayfinding.js';
import {
	type DestinationMetadata,
	type ParsedWayfindingLocation,
	type ParsedWayfindingSvg
} from './model.mjs';

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
		generationMode: 'explicit' | 'legacy-proximity';
		maxDegree: number;
		nodes: number;
	};
	highlightedRoute?: WayfindingRouteCheck;
	issues: WayfindingIssue[];
	map: {
		height: number;
		levels: number;
		locations: number;
		pointNodes: number;
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

	if (map.contractMode === 'unannotated') {
		addIssue(issues, 'error', 'location-annotations-missing', 'No element has a stable data-wayfinding-location-id annotation.');
	} else if (map.contractMode === 'legacy-import') {
		addIssue(issues, 'warning', 'legacy-map-import', 'This SVG uses the legacy seven-group Map format. It is accepted only as migration input; new maps use data-wayfinding-location-id annotations.');
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

	for (const location of map.locations.filter((candidate: ParsedWayfindingLocation): boolean => candidate.source === 'native')) {
		if (!location.attributes.id) {
			addIssue(issues, 'error', 'location-element-id-missing', `Wayfinding location '${location.locationId}' requires a stable SVG element id.`, [location.locationId]);
		}
	}
};

const edgeKey = (edge: WayfindingEdge): string => edge.bidirectional
	? [edge.from, edge.to].sort().join('<->')
	: `${edge.from}->${edge.to}`;

const orientation = (a: WayfindingNode, b: WayfindingNode, c: WayfindingNode): number => {
	return (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
};

const crosses = (leftA: WayfindingNode, leftB: WayfindingNode, rightA: WayfindingNode, rightB: WayfindingNode): boolean => {
	if (leftA.levelId !== leftB.levelId || leftA.levelId !== rightA.levelId || rightA.levelId !== rightB.levelId) return false;

	const o1: number = orientation(leftA, leftB, rightA);
	const o2: number = orientation(leftA, leftB, rightB);
	const o3: number = orientation(rightA, rightB, leftA);
	const o4: number = orientation(rightA, rightB, leftB);

	return o1 * o2 < 0 && o3 * o4 < 0;
};

const validateGraph = (graph: WayfindingGraphDocument, map: ParsedWayfindingSvg, issues: WayfindingIssue[]): number => {
	const nodeById = new Map<string, WayfindingNode>();
	const degree = new Map<string, number>();
	const [viewBoxX, viewBoxY, viewBoxWidth, viewBoxHeight] = map.viewBox;

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

	const validEdges: Array<{ edge: WayfindingEdge; from: WayfindingNode; to: WayfindingNode; pixels: number }> = [];

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

		degree.set(from.id, (degree.get(from.id) ?? 0) + 1);
		degree.set(to.id, (degree.get(to.id) ?? 0) + 1);
		validEdges.push({ edge, from, pixels: from.levelId === to.levelId ? Math.hypot(to.x - from.x, to.y - from.y) : 0, to });
	}

	const lengths: number[] = validEdges.map((item): number => item.pixels).filter((length: number): boolean => length > 0).sort((a: number, b: number): number => a - b);
	const medianLength: number = lengths[Math.floor(lengths.length / 2)] ?? 0;
	const suspiciousLength: number = Math.max(120, medianLength * 4);

	for (const item of validEdges.filter((candidate): boolean => candidate.pixels > suspiciousLength)) {
		addIssue(issues, 'warning', 'long-edge-review', `Edge '${item.edge.id}' is ${Math.round(item.pixels)} SVG units long and should be reviewed for a shortcut.`, [item.edge.id]);
	}

	const crossingLimit = graph.generation?.mode === 'legacy-proximity' ? 25 : Number.POSITIVE_INFINITY;
	let crossingCount = 0;

	for (let leftIndex = 0; leftIndex < validEdges.length; leftIndex += 1) {
		for (let rightIndex = leftIndex + 1; rightIndex < validEdges.length; rightIndex += 1) {
			const left = validEdges[leftIndex];
			const right = validEdges[rightIndex];

			if ([right.from.id, right.to.id].includes(left.from.id) || [right.from.id, right.to.id].includes(left.to.id)) continue;

			if (!crosses(left.from, left.to, right.from, right.to)) continue;

			crossingCount += 1;

			if (crossingCount <= crossingLimit) {
				addIssue(issues, 'warning', 'edge-crossing-without-node', `Edges '${left.edge.id}' and '${right.edge.id}' cross without a shared node.`, [left.edge.id, right.edge.id]);
			}
		}
	}

	if (crossingCount > crossingLimit) {
		addIssue(issues, 'warning', 'edge-crossing-summary', `${crossingCount - crossingLimit} additional edge crossings require visual graph review.`);
	}

	const maxDegree: number = Math.max(0, ...degree.values());
	const highDegreeNodes: Array<[string, number]> = [...degree.entries()].filter(([, value]): boolean => value > 8);

	for (const [nodeId, value] of highDegreeNodes.slice(0, 25)) {
		addIssue(issues, 'warning', 'high-node-degree', `Node '${nodeId}' has degree ${value}; inspect for proximity shortcuts.`, [nodeId]);
	}

	if (highDegreeNodes.length > 25) {
		addIssue(issues, 'warning', 'high-node-degree-summary', `${highDegreeNodes.length - 25} additional nodes have degree above 8.`);
	}

	if (graph.generation?.mode === 'legacy-proximity') {
		addIssue(issues, 'warning', 'legacy-proximity-fallback', 'This graph was inferred by global proximity for migration analysis and is not accepted as safe explicit topology.');
		addIssue(issues, 'warning', 'legacy-accessibility-unverified', 'Legacy proximity edges have unknown accessibility; step-free route coverage is not evaluated.');
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
		if (!locationIds.has(destination.id)) {
			addIssue(issues, 'error', 'destination-location-missing', `Destination '${destination.id}' has no SVG location shape.`, [destination.id]);
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
	const accessibilityVerified: boolean = graphDocument.generation?.mode !== 'legacy-proximity';
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
		const stepFree: WayfindingRouteResult | undefined = accessibilityVerified && destinationNode
			? graph.route(startNode.id, destinationNode.id, { profile: 'step-free' })
			: undefined;

		if (!standard) {
			addIssue(issues, 'error', 'destination-unreachable', `Destination '${destination.id}' is marked routeable but cannot be reached from '${startLocationId}'.`, [startLocationId, destination.id]);
		}

		if (accessibilityVerified && destination.accessible === true && standard && !stepFree) {
			addIssue(issues, 'warning', 'accessible-route-unavailable', `Accessible destination '${destination.id}' has no step-free route from '${startLocationId}'.`, [startLocationId, destination.id]);
		}

		return {
			destinationId: destination.id,
			edgeIds: standard?.edgeIds ?? [],
			nodeCount: standard?.nodeIds.length ?? 0,
			nodeIds: standard?.nodeIds ?? [],
			reachable: Boolean(standard),
			stepFreeReachable: accessibilityVerified ? Boolean(stepFree) : null,
			walkingDistance: standard?.walkingDistance
		};
	});
};

export const validateWayfinding = (options: WayfindingValidationOptions): WayfindingValidationReport => {
	const issues: WayfindingIssue[] = [];
	validateMapStructure(options.map, issues);
	const maxDegree: number = validateGraph(options.graph, options.map, issues);
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
			generationMode: options.graph.generation?.mode ?? 'explicit',
			maxDegree,
			nodes: options.graph.nodes.length
		},
		highlightedRoute,
		issues,
		map: {
			height: options.map.height,
			levels: new Set(options.graph.nodes.map((node: WayfindingNode): string => node.levelId)).size,
			locations: options.map.locations.length,
			pointNodes: options.map.levels.reduce((sum: number, level): number => sum + level.pointNodes.length, 0),
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
