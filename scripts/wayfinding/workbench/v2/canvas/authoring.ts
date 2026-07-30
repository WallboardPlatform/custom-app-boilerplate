import type {
	WayfindingStudioAsset,
	WayfindingStudioDestination,
	WayfindingStudioElement,
	WayfindingStudioFloor,
	WayfindingStudioPolygonElement,
	WayfindingStudioPolygonPresentation,
	WayfindingStudioProject,
	WayfindingStudioProjectDefaults
} from '../../../studio-project.mts';
import type {
	EditorSelection,
	EditorTool,
	EditorTransaction
} from '../../../editor-core/types';
import type {
	WayfindingNode,
	WayfindingPoint
} from '../../../../../src/utils/wayfinding.js';

export type AuthoringIdFactory = (prefix: string) => string;

export interface AuthoringResult {
	selection: EditorSelection;
	transaction: EditorTransaction;
}

export interface PointAuthoringResult extends AuthoringResult {
	element: WayfindingStudioElement;
}

const LOCATION_COLOR_PALETTE = [
	'#f4c95d',
	'#69c3b3',
	'#f29b7f',
	'#9ebce3',
	'#c4d79b',
	'#c5b1d8',
	'#f1b75e',
	'#80b9b0',
	'#e88777',
	'#8faed2',
	'#b4cc8c',
	'#b99bc7'
] as const;

let generatedId = 0;

export const createAuthoringId: AuthoringIdFactory = (prefix: string): string => {
	generatedId += 1;

	return `${prefix}-${Date.now().toString(36)}-${generatedId}`;
};

export const sampleSourceColor = (
	source: { data: Uint8ClampedArray; height: number; width: number } | undefined,
	point: WayfindingPoint
): string | undefined => {
	if (!source) return undefined;
	const x: number = Math.max(0, Math.min(source.width - 1, Math.floor(point.x)));
	const y: number = Math.max(0, Math.min(source.height - 1, Math.floor(point.y)));
	const index: number = (y * source.width + x) * 4;

	if (source.data[index + 3] === 0) return undefined;

	return `#${[source.data[index], source.data[index + 1], source.data[index + 2]]
		.map((value: number): string => value.toString(16).padStart(2, '0'))
		.join('')}`;
};

export const polygonPresentation = (options: {
	defaults: WayfindingStudioProjectDefaults;
	detectedColor?: string;
	elementType: WayfindingStudioPolygonElement['type'];
	inheritedColor?: string;
	locationCount: number;
}): WayfindingStudioPolygonPresentation => {
	if (options.elementType === 'walkable') return { ...options.defaults.walkable };

	if (options.elementType === 'obstacle') return { ...options.defaults.obstacle };
	const fillColor: string = options.defaults.locationColor.mode === 'fixed'
		? options.defaults.locationColor.fixedColor
		: options.defaults.locationColor.mode === 'random'
			? LOCATION_COLOR_PALETTE[options.locationCount % LOCATION_COLOR_PALETTE.length]
			: options.detectedColor
				?? options.inheritedColor
				?? options.defaults.location.fillColor
				?? options.defaults.locationColor.fixedColor;

	return { ...options.defaults.location, fillColor };
};

export const buildPolygonAuthoring = (options: {
	createId?: AuthoringIdFactory;
	defaults: WayfindingStudioProjectDefaults;
	detectedColor?: string;
	elementType: WayfindingStudioPolygonElement['type'];
	floorId: string;
	geometry: WayfindingPoint[];
	inheritedColor?: string;
	label?: string;
	project: WayfindingStudioProject;
	selectedDestinationId?: string;
}): AuthoringResult => {
	const createId: AuthoringIdFactory = options.createId ?? createAuthoringId;
	const elementId: string = createId(options.elementType);
	const locationCount: number = options.project.floors.reduce(
		(count: number, floor: WayfindingStudioFloor): number =>
			count + floor.elements.filter((element: WayfindingStudioElement): boolean => element.type === 'location').length,
		0
	);
	const element: WayfindingStudioPolygonElement = {
		floorId: options.floorId,
		geometry: structuredClone(options.geometry),
		id: elementId,
		presentation: polygonPresentation({
			defaults: options.defaults,
			detectedColor: options.detectedColor,
			elementType: options.elementType,
			inheritedColor: options.inheritedColor,
			locationCount
		}),
		provenance: 'reviewer-authored',
		status: 'confirmed',
		type: options.elementType
	};
	const commands: EditorTransaction['commands'] = [];
	let label: string = options.label ?? `Create ${options.elementType}`;

	if (options.elementType === 'location') {
		const selectedDestination = options.selectedDestinationId
			? options.project.destinations.find((destination) => destination.id === options.selectedDestinationId)
			: undefined;
		const destinationId: string = selectedDestination?.id ?? createId('destination');
		const locationNumber: number = options.project.destinations.length + 1;
		element.destinationId = destinationId;
		label = selectedDestination
			? `Place ${selectedDestination.name}`
			: `Create Location ${locationNumber}`;

		if (selectedDestination) {
			commands.push({
				type: 'destination/patch',
				destinationId,
				patch: { floor: options.floorId }
			});
		} else {
			commands.push({
				type: 'destination/add',
				destination: {
					floor: options.floorId,
					id: destinationId,
					name: `Location ${locationNumber}`,
					routeable: true,
					status: 'confirmed'
				}
			});
		}
	}
	commands.push({ type: 'element/add', element, floorId: options.floorId });

	return {
		selection: { id: elementId, kind: 'element' },
		transaction: { commands, label }
	};
};

const destinationForPoint = (
	id: string,
	floorId: string,
	name: string
): WayfindingStudioDestination => ({
	floor: floorId,
	id,
	name,
	routeable: true,
	status: 'confirmed'
});

export const buildPointAuthoring = (options: {
	activeAsset?: WayfindingStudioAsset;
	createId?: AuthoringIdFactory;
	defaults: WayfindingStudioProjectDefaults;
	destinationCount: number;
	floorId: string;
	point: WayfindingPoint;
	selectedDestinationId?: string;
	tool: EditorTool;
}): PointAuthoringResult | undefined => {
	const createId: AuthoringIdFactory = options.createId ?? createAuthoringId;
	const base = {
		floorId: options.floorId,
		id: createId(options.tool),
		provenance: 'reviewer-authored' as const,
		status: 'confirmed' as const
	};
	const commands: EditorTransaction['commands'] = [];
	let element: WayfindingStudioElement | undefined;
	let label: string = `Create ${options.tool}`;

	if (options.tool === 'door') {
		element = { ...base, angle: 0, length: 42, point: options.point, type: 'door' };
	}

	if (options.tool === 'poi') {
		const destinationId: string = createId('destination');
		const locationNumber: number = options.destinationCount + 1;
		const name: string = `Point of interest ${locationNumber}`;
		element = { ...base, destinationId, label: name, point: options.point, type: 'poi' };
		commands.push({
			type: 'destination/add',
			destination: destinationForPoint(destinationId, options.floorId, name)
		});
		label = `Create point of interest ${locationNumber}`;
	}

	if (options.tool === 'origin') {
		element = {
			...base,
			facingDegrees: 0,
			label: 'You are here',
			point: options.point,
			screenId: createId('screen'),
			type: 'origin'
		};
	}

	if (options.tool === 'transition') {
		element = {
			...base,
			accessible: true,
			connectionId: createId('connection'),
			kind: 'stairs',
			label: 'Floor connection',
			point: options.point,
			type: 'transition'
		};
	}

	if (options.tool === 'label') {
		element = {
			...base,
			color: options.defaults.label.color,
			fontFamily: options.defaults.label.fontFamily,
			fontSize: options.defaults.label.fontSize,
			fontWeight: options.defaults.label.fontWeight,
			outlineColor: options.defaults.label.outlineColor,
			outlineWidth: options.defaults.label.outlineWidth,
			point: options.point,
			text: 'Label',
			textAnchor: 'middle',
			type: 'label'
		};
	}

	if (options.tool === 'icon' || options.tool === 'logo') {
		const asset: WayfindingStudioAsset | undefined = options.activeAsset;

		if (!asset || asset.kind !== options.tool) return undefined;
		const naturalWidth: number = Math.max(1, asset.naturalWidth ?? 64);
		const naturalHeight: number = Math.max(1, asset.naturalHeight ?? 64);
		const size: number = options.tool === 'icon' ? options.defaults.iconSize : options.defaults.logoSize;
		const scale: number = size / Math.max(naturalWidth, naturalHeight);
		element = {
			...base,
			assetId: asset.id,
			destinationId: options.selectedDestinationId,
			height: naturalHeight * scale,
			point: options.point,
			type: options.tool,
			width: naturalWidth * scale
		};
	}

	if (!element) return undefined;
	commands.push({ type: 'element/add', element, floorId: options.floorId });

	return {
		element,
		selection: { id: element.id, kind: 'element' },
		transaction: { commands, label }
	};
};

export const buildRouteEdgeAuthoring = (options: {
	cameraScale: number;
	createId?: AuthoringIdFactory;
	floorId: string;
	nodes: WayfindingNode[];
	points: WayfindingPoint[];
}): AuthoringResult | undefined => {
	if (options.points.length < 2) return undefined;
	const createId: AuthoringIdFactory = options.createId ?? createAuthoringId;
	const snapDistance: number = 22 / options.cameraScale;
	const nearestNode = (point: WayfindingPoint): WayfindingNode | undefined => options.nodes
		.map((node: WayfindingNode) => ({
			distance: Math.hypot(node.x - point.x, node.y - point.y),
			node
		}))
		.filter((candidate): boolean => candidate.distance <= snapDistance)
		.sort((left, right): number => left.distance - right.distance)[0]?.node;
	const firstCandidate: WayfindingPoint = options.points[0];
	const lastCandidate: WayfindingPoint = options.points.at(-1)!;
	const fromNode: WayfindingNode | undefined = nearestNode(firstCandidate);
	const toNode: WayfindingNode | undefined = nearestNode(lastCandidate);
	const fromId: string = fromNode?.id ?? createId('route-node');
	const toId: string = toNode?.id ?? createId('route-node');
	const edgeId: string = createId('route-edge');
	const first: WayfindingPoint = fromNode ? { x: fromNode.x, y: fromNode.y } : firstCandidate;
	const last: WayfindingPoint = toNode ? { x: toNode.x, y: toNode.y } : lastCandidate;
	const geometry: WayfindingPoint[] = [first, ...options.points.slice(1, -1), last];
	const commands: EditorTransaction['commands'] = [];

	if (!fromNode) {
		commands.push({
			type: 'graph/node-add',
			node: {
				authoringOwnership: 'manual',
				id: fromId,
				kind: 'route',
				levelId: options.floorId,
				...first
			}
		});
	}

	if (!toNode) {
		commands.push({
			type: 'graph/node-add',
			node: {
				authoringOwnership: 'manual',
				id: toId,
				kind: 'route',
				levelId: options.floorId,
				...last
			}
		});
	}
	commands.push({
		type: 'graph/edge-add',
		edge: {
			accessible: true,
			authoringOwnership: 'manual',
			bidirectional: true,
			from: fromId,
			geometry,
			id: edgeId,
			kind: 'walk',
			reviewStatus: 'confirmed',
			to: toId
		}
	});

	return {
		selection: { id: edgeId, kind: 'graph-edge' },
		transaction: { commands, label: 'Create route segment' }
	};
};
