import {
	WayfindingGraph,
	type WayfindingEdge,
	type WayfindingGraphDocument,
	type WayfindingNode,
	type WayfindingPoint,
	type WayfindingWalkableMaskDocument
} from '../../src/utils/wayfinding.js';
import {
	assessWayfindingProject,
	type WayfindingGuidanceMode,
	type WayfindingProjectAssessment,
	type WayfindingProjectDocument
} from './project.mjs';
import { parseWayfindingSvg } from './model.mjs';
import { validateWalkableMaskStructure, WayfindingWalkableMask } from './walkable-mask.mjs';

export type WayfindingStudioElementStatus = 'confirmed' | 'proposed';
export type WayfindingStudioProvenance = 'ai-draft' | 'customer-source' | 'imported' | 'reviewer-authored';
export type WayfindingTransitionKind = 'elevator' | 'escalator' | 'stairs';
export type WayfindingStudioFontFamily = 'monospace' | 'sans-serif' | 'serif';
export type WayfindingStudioTextAnchor = 'end' | 'middle' | 'start';

export interface WayfindingStudioCamera3d {
	azimuthDegrees: number;
	distance: number;
	pitchDegrees: number;
	targetX: number;
	targetY: number;
}

export interface WayfindingStudioPolygonPresentation {
	extrusionHeight?: number;
	fillColor?: string;
	fillOpacity?: number;
}

export interface WayfindingStudioPresentationDefaults {
	icon: {
		height: number;
		width: number;
	};
	label: {
		color: string;
		fontFamily: WayfindingStudioFontFamily;
		fontSize: number;
		fontWeight: 400 | 600 | 700;
		outlineColor: string;
		outlineWidth: number;
	};
	logo: {
		height: number;
		width: number;
	};
	polygons: Record<WayfindingStudioPolygonElement['type'], Required<WayfindingStudioPolygonPresentation>>;
	route: {
		color: string;
		cornerRounding: number;
		width: number;
	};
}

export interface WayfindingStudioAsset {
	dataUrl: string;
	id: string;
	kind: 'background' | 'icon' | 'logo';
	mimeType: string;
	name: string;
}

export interface WayfindingStudioElementBase {
	floorId: string;
	id: string;
	provenance: WayfindingStudioProvenance;
	status: WayfindingStudioElementStatus;
}

export interface WayfindingStudioPolygonElement extends WayfindingStudioElementBase {
	geometry: WayfindingPoint[];
	label?: string;
	presentation?: WayfindingStudioPolygonPresentation;
	type: 'location' | 'obstacle' | 'walkable';
	destinationId?: string;
}

export interface WayfindingStudioDoorElement extends WayfindingStudioElementBase {
	angle: number;
	length: number;
	locationId?: string;
	point: WayfindingPoint;
	type: 'door';
}

export interface WayfindingStudioPointElement extends WayfindingStudioElementBase {
	category?: string;
	destinationId?: string;
	label?: string;
	point: WayfindingPoint;
	type: 'poi';
}

export interface WayfindingStudioOriginElement extends WayfindingStudioElementBase {
	defaultLanguage?: string;
	facingDegrees: number;
	label: string;
	point: WayfindingPoint;
	screenId: string;
	type: 'origin';
}

export interface WayfindingStudioTransitionElement extends WayfindingStudioElementBase {
	accessible: boolean;
	connectionId: string;
	kind: WayfindingTransitionKind;
	label: string;
	point: WayfindingPoint;
	type: 'transition';
}

export interface WayfindingStudioLabelElement extends WayfindingStudioElementBase {
	color?: string;
	fontFamily?: WayfindingStudioFontFamily;
	fontSize?: number;
	fontWeight?: 400 | 600 | 700;
	outlineColor?: string;
	outlineWidth?: number;
	point: WayfindingPoint;
	text: string;
	textAnchor?: WayfindingStudioTextAnchor;
	type: 'label';
}

export interface WayfindingStudioMediaElement extends WayfindingStudioElementBase {
	assetId: string;
	height: number;
	point: WayfindingPoint;
	type: 'icon' | 'logo';
	width: number;
}

export type WayfindingStudioElement =
	| WayfindingStudioDoorElement
	| WayfindingStudioLabelElement
	| WayfindingStudioMediaElement
	| WayfindingStudioOriginElement
	| WayfindingStudioPointElement
	| WayfindingStudioPolygonElement
	| WayfindingStudioTransitionElement;

export interface WayfindingStudioFloor {
	backgroundAssetId?: string;
	camera3d?: WayfindingStudioCamera3d;
	elements: WayfindingStudioElement[];
	height: number;
	id: string;
	name: string;
	order: number;
	walkableMask?: WayfindingWalkableMaskDocument;
	width: number;
}

export interface WayfindingStudioDestination extends Record<string, unknown> {
	accessible?: boolean;
	category?: string;
	description?: string;
	floor?: string;
	id: string;
	name: string;
	routeable?: boolean;
}

export interface WayfindingStudioProject {
	assets: WayfindingStudioAsset[];
	contractVersion: 1;
	createdAt: string;
	delivery: WayfindingProjectDocument;
	destinations: WayfindingStudioDestination[];
	floors: WayfindingStudioFloor[];
	graph: WayfindingGraphDocument;
	name: string;
	presentation?: WayfindingStudioPresentationDefaults;
	projectId: string;
	updatedAt: string;
}

export interface WayfindingStudioIssue {
	code: string;
	elementIds: string[];
	message: string;
	severity: 'error' | 'warning';
}

export interface WayfindingRuntimeBundle {
	assets: WayfindingStudioAsset[];
	contractVersion: 1;
	destinations: { Destinations: { rows: WayfindingStudioDestination[] } };
	floors: Array<{
		backgroundAssetId?: string;
		camera3d?: WayfindingStudioCamera3d;
		elements: WayfindingStudioElement[];
		height: number;
		id: string;
		name: string;
		order: number;
		svg: string;
		width: number;
	}>;
	graph: WayfindingGraphDocument;
	manifest: {
		deliveryMode: WayfindingGuidanceMode;
		generatedAt: string;
		projectId: string;
		sourceContractVersion: number;
		targetMode: WayfindingGuidanceMode;
	};
	presentation: WayfindingStudioPresentationDefaults;
}

const now = (): string => new Date().toISOString();

const DEFAULT_PRESENTATION: WayfindingStudioPresentationDefaults = {
	icon: { height: 64, width: 64 },
	label: {
		color: '#17201f',
		fontFamily: 'sans-serif',
		fontSize: 24,
		fontWeight: 600,
		outlineColor: '#ffffff',
		outlineWidth: 0
	},
	logo: { height: 96, width: 160 },
	polygons: {
		location: { extrusionHeight: 18, fillColor: '#f4c95d', fillOpacity: 0.72 },
		obstacle: { extrusionHeight: 24, fillColor: '#31403d', fillOpacity: 0.76 },
		walkable: { extrusionHeight: 0, fillColor: '#55bfa7', fillOpacity: 0.28 }
	},
	route: { color: '#f04438', cornerRounding: 18, width: 7 }
};

export const resolveWayfindingStudioPresentation = (
	project?: Pick<WayfindingStudioProject, 'presentation'>
): WayfindingStudioPresentationDefaults => {
	const value: WayfindingStudioPresentationDefaults | undefined = project?.presentation;

	return {
		icon: { ...DEFAULT_PRESENTATION.icon, ...value?.icon },
		label: { ...DEFAULT_PRESENTATION.label, ...value?.label },
		logo: { ...DEFAULT_PRESENTATION.logo, ...value?.logo },
		polygons: {
			location: { ...DEFAULT_PRESENTATION.polygons.location, ...value?.polygons?.location },
			obstacle: { ...DEFAULT_PRESENTATION.polygons.obstacle, ...value?.polygons?.obstacle },
			walkable: { ...DEFAULT_PRESENTATION.polygons.walkable, ...value?.polygons?.walkable }
		},
		route: { ...DEFAULT_PRESENTATION.route, ...value?.route }
	};
};

const evidenceItem = (
	provenance: 'customer-provided' | 'ai-inferred' | 'image-analysis'
): WayfindingProjectDocument['evidence']['accessibility'] => ({ provenance, status: 'unavailable' });

export const createWayfindingStudioProject = (projectId = 'wayfinding-project'): WayfindingStudioProject => {
	const timestamp: string = now();

	return {
		assets: [],
		contractVersion: 1,
		createdAt: timestamp,
		delivery: {
			contractVersion: 1,
			evidence: {
				accessibility: evidenceItem('customer-provided'),
				currentLocationAnchors: evidenceItem('customer-provided'),
				destinationAnchors: evidenceItem('ai-inferred'),
				destinationMetadata: evidenceItem('customer-provided'),
				entranceApproaches: evidenceItem('ai-inferred'),
				levelTransitions: evidenceItem('ai-inferred'),
				orientation: evidenceItem('customer-provided'),
				routeTopology: evidenceItem('ai-inferred'),
				walkableSpace: evidenceItem('image-analysis')
			},
			guidance: { allowFallback: true, stepFreeRequired: false, targetMode: 'highlight' },
			projectId,
			source: { equivalentRedrawAllowed: true, kind: 'floor-plan', levels: 1, presentation: 'source-overlay' }
		},
		destinations: [],
		floors: [{ elements: [], height: 1080, id: 'level-0', name: 'Level 0', order: 0, width: 1920 }],
		graph: { contractVersion: 2, edges: [], graphId: `${projectId}-graph`, nodes: [] },
		name: 'Wayfinding project',
		presentation: resolveWayfindingStudioPresentation(),
		projectId,
		updatedAt: timestamp
	};
};

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

export const parseWayfindingStudioProject = (value: unknown): WayfindingStudioProject => {
	if (!isRecord(value)
		|| value.contractVersion !== 1
		|| !Array.isArray(value.assets)
		|| !Array.isArray(value.destinations)
		|| !Array.isArray(value.floors)
		|| value.floors.some((floor: unknown): boolean => !isRecord(floor) || !Array.isArray(floor.elements))
		|| !isRecord(value.graph)
		|| !Array.isArray(value.graph.nodes)
		|| !Array.isArray(value.graph.edges)
		|| !isRecord(value.delivery)
		|| !isRecord(value.delivery.source)
		|| !isRecord(value.delivery.guidance)
		|| !isRecord(value.delivery.evidence)) {
		throw new Error('The selected file is not a Wallboard Wayfinding Studio project.');
	}

	const project: WayfindingStudioProject = value as unknown as WayfindingStudioProject;
	const errors: WayfindingStudioIssue[] = validateWayfindingStudioProject(project).filter((issue): boolean => issue.severity === 'error');

	if (errors.length > 0) throw new Error(errors.map((issue): string => issue.message).join(' '));

	return project;
};

export const migrateWayfindingArtifacts = (
	delivery: WayfindingProjectDocument,
	graph?: WayfindingGraphDocument,
	destinations: WayfindingStudioDestination[] = []
): WayfindingStudioProject => {
	const project: WayfindingStudioProject = createWayfindingStudioProject(delivery.projectId);
	project.delivery = structuredClone(delivery);
	project.delivery.source.levels = Math.max(1, delivery.source.levels);
	project.floors = Array.from({ length: project.delivery.source.levels }, (_, index: number): WayfindingStudioFloor => ({
		elements: [],
		height: 1080,
		id: `level-${index}`,
		name: `Level ${index}`,
		order: index,
		width: 1920
	}));
	project.graph = graph ? structuredClone(graph) : project.graph;
	project.destinations = structuredClone(destinations);
	project.name = delivery.projectId;

	return project;
};

export const importAnnotatedWayfindingSvg = (
	project: WayfindingStudioProject,
	floorId: string,
	svg: string,
	status: WayfindingStudioElementStatus = 'proposed'
): number => {
	const floor: WayfindingStudioFloor | undefined = project.floors.find((candidate: WayfindingStudioFloor): boolean => candidate.id === floorId);

	if (!floor) throw new Error(`Floor '${floorId}' does not exist.`);
	const parsed = parseWayfindingSvg(svg);
	floor.width = parsed.viewBox[2];
	floor.height = parsed.viewBox[3];
	let imported = 0;

	for (const location of parsed.locations) {
		const attributes = location.attributes;
		const base = { destinationId: location.locationId, floorId, id: attributes.id || `imported-${location.locationId}`, provenance: 'imported' as const, status };

		if (location.tag === 'circle' && Number.isFinite(Number(attributes.cx)) && Number.isFinite(Number(attributes.cy))) {
			floor.elements.push({ ...base, point: { x: Number(attributes.cx), y: Number(attributes.cy) }, type: 'poi' });
			imported += 1;
		} else if (location.tag === 'rect' && ['x', 'y', 'width', 'height'].every((key: string): boolean => Number.isFinite(Number(attributes[key])))) {
			const x: number = Number(attributes.x);
			const y: number = Number(attributes.y);
			const width: number = Number(attributes.width);
			const height: number = Number(attributes.height);
			floor.elements.push({ ...base, geometry: [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }], type: 'location' });
			imported += 1;
		} else if (location.tag === 'polygon' && attributes.points) {
			const geometry: WayfindingPoint[] = attributes.points.trim().split(/\s+/u).map((pair: string): WayfindingPoint => {
				const [x, y] = pair.split(',').map(Number);

				return { x, y };
			}).filter((pointValue: WayfindingPoint): boolean => Number.isFinite(pointValue.x) && Number.isFinite(pointValue.y));

			if (geometry.length >= 3) {
				floor.elements.push({ ...base, geometry, type: 'location' });
				imported += 1;
			}
		}
	}

	return imported;
};

const duplicateIds = (ids: string[]): string[] => [...new Set(ids.filter((id: string, index: number): boolean => ids.indexOf(id) !== index))];
const managedNodeId = (elementId: string): string => `semantic:${elementId}`;
const finitePoint = (value: WayfindingPoint): boolean => Number.isFinite(value.x) && Number.isFinite(value.y);
const validColor = (value: string | undefined): boolean => value === undefined || /^#[0-9a-f]{6}$/iu.test(value);
const pointInFloor = (value: WayfindingPoint, floor: WayfindingStudioFloor): boolean => finitePoint(value)
	&& value.x >= 0
	&& value.y >= 0
	&& value.x <= floor.width
	&& value.y <= floor.height;

export const validateWayfindingStudioProject = (project: WayfindingStudioProject): WayfindingStudioIssue[] => {
	const issues: WayfindingStudioIssue[] = [];
	const presentation: WayfindingStudioPresentationDefaults = resolveWayfindingStudioPresentation(project);
	const floorIds: string[] = project.floors.map((floor: WayfindingStudioFloor): string => floor.id);
	const elementIds: string[] = project.floors.flatMap((floor: WayfindingStudioFloor): string[] => floor.elements.map((element: WayfindingStudioElement): string => element.id));
	const assetIds: Set<string> = new Set(project.assets.map((asset: WayfindingStudioAsset): string => asset.id));
	const assetsById = new Map(project.assets.map((asset): [string, WayfindingStudioAsset] => [asset.id, asset]));
	const destinationIds: Set<string> = new Set(project.destinations.map((destination: WayfindingStudioDestination): string => destination.id));
	const elementsById = new Map(project.floors.flatMap((floor): Array<[string, WayfindingStudioElement]> => floor.elements.map((element): [string, WayfindingStudioElement] => [element.id, element])));

	for (const id of duplicateIds([...floorIds, ...elementIds, ...project.assets.map((asset): string => asset.id)])) {
		issues.push({ code: 'duplicate-id', elementIds: [id], message: `Stable id '${id}' is duplicated.`, severity: 'error' });
	}

	if (project.floors.length === 0) issues.push({ code: 'missing-floor', elementIds: [], message: 'At least one floor is required.', severity: 'error' });

	if (project.delivery.projectId !== project.projectId) issues.push({ code: 'delivery-project-id-mismatch', elementIds: [], message: `Delivery project id '${project.delivery.projectId}' does not match '${project.projectId}'.`, severity: 'error' });

	if (project.delivery.source.levels !== project.floors.length) issues.push({ code: 'source-level-count-mismatch', elementIds: [], message: `Delivery metadata declares ${project.delivery.source.levels} level(s), but the project contains ${project.floors.length}.`, severity: 'error' });

	for (const [type, polygon] of Object.entries(presentation.polygons)) {
		if (!validColor(polygon.fillColor)) issues.push({ code: 'invalid-default-polygon-color', elementIds: [], message: `Default ${type} fill color must use a six-digit hex value.`, severity: 'error' });

		if (!Number.isFinite(polygon.fillOpacity) || polygon.fillOpacity < 0 || polygon.fillOpacity > 1) issues.push({ code: 'invalid-default-polygon-opacity', elementIds: [], message: `Default ${type} opacity must be between 0 and 1.`, severity: 'error' });

		if (!Number.isFinite(polygon.extrusionHeight) || polygon.extrusionHeight < 0 || polygon.extrusionHeight > 100) issues.push({ code: 'invalid-default-polygon-height', elementIds: [], message: `Default ${type} visual height must be between 0 and 100.`, severity: 'error' });
	}

	if (!validColor(presentation.label.color) || !validColor(presentation.label.outlineColor)) issues.push({ code: 'invalid-default-label-color', elementIds: [], message: 'Default label colors must use six-digit hex values.', severity: 'error' });

	if (!Number.isFinite(presentation.label.fontSize) || presentation.label.fontSize < 6 || presentation.label.fontSize > 512) issues.push({ code: 'invalid-default-label-size', elementIds: [], message: 'Default label size must be between 6 and 512.', severity: 'error' });

	if (!Number.isFinite(presentation.icon.width) || !Number.isFinite(presentation.icon.height) || presentation.icon.width < 8 || presentation.icon.height < 8) issues.push({ code: 'invalid-default-icon-size', elementIds: [], message: 'Default icon dimensions must be at least 8.', severity: 'error' });

	if (!Number.isFinite(presentation.logo.width) || !Number.isFinite(presentation.logo.height) || presentation.logo.width < 8 || presentation.logo.height < 8) issues.push({ code: 'invalid-default-logo-size', elementIds: [], message: 'Default logo dimensions must be at least 8.', severity: 'error' });

	if (!validColor(presentation.route.color)) issues.push({ code: 'invalid-route-color', elementIds: [], message: 'Route color must use a six-digit hex value.', severity: 'error' });

	if (!Number.isFinite(presentation.route.width) || presentation.route.width < 1 || presentation.route.width > 40) issues.push({ code: 'invalid-route-width', elementIds: [], message: 'Route width must be between 1 and 40.', severity: 'error' });

	if (!Number.isFinite(presentation.route.cornerRounding) || presentation.route.cornerRounding < 0 || presentation.route.cornerRounding > 50) issues.push({ code: 'invalid-route-rounding', elementIds: [], message: 'Route corner rounding must be between 0 and 50 percent.', severity: 'error' });

	for (const order of duplicateIds(project.floors.map((floor): string => String(floor.order)))) issues.push({ code: 'duplicate-floor-order', elementIds: project.floors.filter((floor): boolean => String(floor.order) === order).map((floor): string => floor.id), message: `Floor order '${order}' is duplicated.`, severity: 'error' });

	for (const id of duplicateIds(project.destinations.map((destination): string => destination.id))) issues.push({ code: 'duplicate-destination-id', elementIds: [id], message: `Destination id '${id}' is duplicated.`, severity: 'error' });

	for (const destination of project.destinations) {
		if (destination.floor && !floorIds.includes(destination.floor)) issues.push({ code: 'destination-floor-missing', elementIds: [destination.id], message: `Destination '${destination.id}' references missing floor '${destination.floor}'.`, severity: 'error' });
	}

	for (const screenId of duplicateIds(project.floors.flatMap((floor): string[] => floor.elements.filter((element): element is WayfindingStudioOriginElement => element.type === 'origin').map((origin): string => origin.screenId)))) issues.push({ code: 'duplicate-screen-id', elementIds: [screenId], message: `Installed-screen id '${screenId}' is duplicated.`, severity: 'error' });

	for (const floor of project.floors) {
		if (!(floor.width > 0) || !(floor.height > 0)) issues.push({ code: 'invalid-floor-size', elementIds: [floor.id], message: `Floor '${floor.id}' needs a positive coordinate size.`, severity: 'error' });

		if (floor.backgroundAssetId && !assetIds.has(floor.backgroundAssetId)) issues.push({ code: 'missing-background', elementIds: [floor.id], message: `Floor '${floor.id}' references a missing background asset.`, severity: 'error' });

		if (floor.camera3d && (
			!Number.isFinite(floor.camera3d.azimuthDegrees)
			|| !Number.isFinite(floor.camera3d.distance)
			|| floor.camera3d.distance <= 0
			|| !Number.isFinite(floor.camera3d.pitchDegrees)
			|| floor.camera3d.pitchDegrees < 5
			|| floor.camera3d.pitchDegrees > 85
			|| !Number.isFinite(floor.camera3d.targetX)
			|| !Number.isFinite(floor.camera3d.targetY)
		)) issues.push({ code: 'invalid-3d-camera', elementIds: [floor.id], message: `Floor '${floor.id}' has invalid 3D camera settings.`, severity: 'error' });

		for (const element of floor.elements) {
			if (element.floorId !== floor.id) issues.push({ code: 'floor-mismatch', elementIds: [element.id], message: `Element '${element.id}' belongs to '${element.floorId}' but is stored on '${floor.id}'.`, severity: 'error' });

			if ('geometry' in element && element.geometry.length < 3) issues.push({ code: 'open-polygon', elementIds: [element.id], message: `Polygon '${element.id}' needs at least three points.`, severity: 'error' });

			if ('geometry' in element && element.geometry.some((value: WayfindingPoint): boolean => !pointInFloor(value, floor))) issues.push({ code: 'polygon-outside-floor', elementIds: [element.id], message: `Polygon '${element.id}' contains an invalid or out-of-bounds point.`, severity: 'error' });

			if ('geometry' in element && element.presentation) {
				if (!validColor(element.presentation.fillColor)) issues.push({ code: 'invalid-polygon-color', elementIds: [element.id], message: `Polygon '${element.id}' fill color must use a six-digit hex value.`, severity: 'error' });

				if (element.presentation.fillOpacity !== undefined && (!Number.isFinite(element.presentation.fillOpacity) || element.presentation.fillOpacity < 0 || element.presentation.fillOpacity > 1)) issues.push({ code: 'invalid-polygon-opacity', elementIds: [element.id], message: `Polygon '${element.id}' fill opacity must be between 0 and 1.`, severity: 'error' });

				if (element.presentation.extrusionHeight !== undefined && (!Number.isFinite(element.presentation.extrusionHeight) || element.presentation.extrusionHeight < 0 || element.presentation.extrusionHeight > 100)) issues.push({ code: 'invalid-polygon-height', elementIds: [element.id], message: `Polygon '${element.id}' visual height must be between 0 and 100.`, severity: 'error' });
			}

			if ('point' in element && !pointInFloor(element.point, floor)) issues.push({ code: 'element-outside-floor', elementIds: [element.id], message: `Element '${element.id}' has an invalid or out-of-bounds point.`, severity: 'error' });

			if (element.type === 'label') {
				if (element.fontSize !== undefined && (!Number.isFinite(element.fontSize) || element.fontSize < 6 || element.fontSize > 512)) issues.push({ code: 'invalid-label-font-size', elementIds: [element.id], message: `Text label '${element.id}' font size must be between 6 and 512.`, severity: 'error' });

				if (element.outlineWidth !== undefined && (!Number.isFinite(element.outlineWidth) || element.outlineWidth < 0 || element.outlineWidth > 16)) issues.push({ code: 'invalid-label-outline-width', elementIds: [element.id], message: `Text label '${element.id}' outline width must be between 0 and 16.`, severity: 'error' });

				if (!validColor(element.color) || !validColor(element.outlineColor)) issues.push({ code: 'invalid-label-color', elementIds: [element.id], message: `Text label '${element.id}' colors must use six-digit hex values.`, severity: 'error' });
			}

			if ((element.type === 'location' || element.type === 'poi') && element.destinationId && !destinationIds.has(element.destinationId)) issues.push({ code: 'missing-destination', elementIds: [element.id, element.destinationId], message: `Element '${element.id}' references missing destination '${element.destinationId}'.`, severity: 'error' });

			if (element.type === 'door' && element.locationId) {
				const location: WayfindingStudioElement | undefined = elementsById.get(element.locationId);

				if (location?.type !== 'location' || location.floorId !== floor.id) issues.push({ code: 'invalid-door-location', elementIds: [element.id, element.locationId], message: `Door '${element.id}' must reference a location on the same floor.`, severity: 'error' });
			}

			if ((element.type === 'icon' || element.type === 'logo') && !assetIds.has(element.assetId)) issues.push({ code: 'missing-media', elementIds: [element.id], message: `Element '${element.id}' references a missing asset.`, severity: 'error' });

			if ((element.type === 'icon' || element.type === 'logo') && assetsById.get(element.assetId)?.kind !== element.type) issues.push({ code: 'media-kind-mismatch', elementIds: [element.id, element.assetId], message: `Element '${element.id}' must reference a ${element.type} asset.`, severity: 'error' });

			if ((element.type === 'icon' || element.type === 'logo') && (!(element.width > 0) || !(element.height > 0) || element.point.x + element.width > floor.width || element.point.y + element.height > floor.height)) issues.push({ code: 'invalid-media-bounds', elementIds: [element.id], message: `Media element '${element.id}' needs positive dimensions fully inside its floor.`, severity: 'error' });
		}

		if (floor.walkableMask) {
			for (const message of validateWalkableMaskStructure(floor.walkableMask)) issues.push({ code: 'invalid-walkable-mask', elementIds: [floor.id], message: `Floor '${floor.id}' walkable mask: ${message}.`, severity: 'error' });

			if (floor.walkableMask.width !== floor.width || floor.walkableMask.height !== floor.height) issues.push({ code: 'walkable-mask-size-mismatch', elementIds: [floor.id], message: `Floor '${floor.id}' walkable mask dimensions do not match the floor.`, severity: 'error' });
		}
	}

	const connectionGroups = new Map<string, WayfindingStudioTransitionElement[]>();

	for (const transition of project.floors.flatMap((floor): WayfindingStudioTransitionElement[] => floor.elements.filter((element): element is WayfindingStudioTransitionElement => element.type === 'transition'))) {
		connectionGroups.set(transition.connectionId, [...(connectionGroups.get(transition.connectionId) ?? []), transition]);
	}

	for (const [connectionId, transitions] of connectionGroups) {
		if (transitions.length < 2) issues.push({ code: 'unpaired-transition', elementIds: transitions.map((item): string => item.id), message: `Transition '${connectionId}' is present on only one floor.`, severity: 'warning' });

		if (new Set(transitions.map((transition): string => transition.floorId)).size !== transitions.length) issues.push({ code: 'duplicate-transition-floor', elementIds: transitions.map((item): string => item.id), message: `Transition '${connectionId}' has multiple anchors on the same floor.`, severity: 'error' });
	}

	for (const id of duplicateIds(project.graph.nodes.map((node): string => node.id))) issues.push({ code: 'duplicate-graph-node', elementIds: [id], message: `Graph node '${id}' is duplicated.`, severity: 'error' });

	for (const id of duplicateIds(project.graph.edges.map((edge): string => edge.id))) issues.push({ code: 'duplicate-graph-edge', elementIds: [id], message: `Graph edge '${id}' is duplicated.`, severity: 'error' });
	const nodeIds: Set<string> = new Set(project.graph.nodes.map((node: { id: string }): string => node.id));
	const nodesById = new Map(project.graph.nodes.map((node): [string, WayfindingNode] => [node.id, node]));

	for (const node of project.graph.nodes) {
		const floor: WayfindingStudioFloor | undefined = project.floors.find((candidate): boolean => candidate.id === node.levelId);

		if (!floor) issues.push({ code: 'graph-node-floor-missing', elementIds: [node.id], message: `Graph node '${node.id}' references missing floor '${node.levelId}'.`, severity: 'error' });
		else if (!pointInFloor(node, floor)) issues.push({ code: 'graph-node-outside-floor', elementIds: [node.id], message: `Graph node '${node.id}' is outside floor '${node.levelId}'.`, severity: 'error' });

		if (node.semanticElementId && !elementsById.has(node.semanticElementId)) issues.push({ code: 'graph-semantic-element-missing', elementIds: [node.id, node.semanticElementId], message: `Graph node '${node.id}' references missing semantic element '${node.semanticElementId}'.`, severity: 'error' });

		if (node.locationId && !destinationIds.has(node.locationId)) issues.push({ code: 'graph-destination-missing', elementIds: [node.id, node.locationId], message: `Graph node '${node.id}' references missing destination '${node.locationId}'.`, severity: 'error' });
	}

	for (const edge of project.graph.edges) {
		if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) issues.push({ code: 'orphan-edge', elementIds: [edge.id], message: `Edge '${edge.id}' references a missing node.`, severity: 'error' });
		const from: WayfindingNode | undefined = nodesById.get(edge.from);
		const to: WayfindingNode | undefined = nodesById.get(edge.to);

		if (from && to && from.levelId === to.levelId) {
			const floor: WayfindingStudioFloor | undefined = project.floors.find((candidate): boolean => candidate.id === from.levelId);

			if (floor && (edge.geometry ?? []).some((value: WayfindingPoint): boolean => !pointInFloor(value, floor))) issues.push({ code: 'edge-outside-floor', elementIds: [edge.id], message: `Edge '${edge.id}' contains an invalid or out-of-bounds point.`, severity: 'error' });
		}
	}

	return issues;
};

export const validateWayfindingStudioDelivery = (project: WayfindingStudioProject): WayfindingStudioIssue[] => {
	const issues: WayfindingStudioIssue[] = validateWayfindingStudioProject(project);
	const assessment: WayfindingProjectAssessment = assessWayfindingProject(project.delivery);

	if (!assessment.deliveryAllowed || assessment.deliveryMode === 'blocked') {
		issues.push({ code: 'delivery-evidence-blocked', elementIds: [], message: assessment.issues.filter((issue): boolean => issue.severity === 'blocker').map((issue): string => issue.message).join(' ') || 'Confirmed evidence does not support a runtime delivery mode.', severity: 'error' });

		return issues;
	}

	for (const issue of assessment.issues.filter((candidate): boolean => candidate.severity === 'warning')) issues.push({ code: issue.code, elementIds: [], message: issue.message, severity: 'warning' });

	if (assessment.deliveryMode === 'route') {
		const origins: WayfindingStudioOriginElement[] = project.floors.flatMap((floor): WayfindingStudioOriginElement[] => floor.elements.filter((element): element is WayfindingStudioOriginElement => element.type === 'origin'));
		const destinations: WayfindingStudioDestination[] = project.destinations.filter((destination): boolean => destination.routeable !== false);
		const elementsById = new Map(project.floors.flatMap((floor): Array<[string, WayfindingStudioElement]> => floor.elements.map((element): [string, WayfindingStudioElement] => [element.id, element])));
		const reportedUnconfirmedElements = new Set<string>();
		const requireConfirmedElement = (element: WayfindingStudioElement | undefined): void => {
			if (!element || element.status === 'confirmed' || reportedUnconfirmedElements.has(element.id)) return;
			reportedUnconfirmedElements.add(element.id);
			issues.push({ code: 'unconfirmed-route-element', elementIds: [element.id], message: `Route-critical element '${element.id}' must be reviewer-confirmed before route delivery.`, severity: 'error' });
		};

		if (origins.length === 0) issues.push({ code: 'missing-route-origin', elementIds: [], message: 'Route delivery requires at least one authored origin.', severity: 'error' });

		if (destinations.length === 0) issues.push({ code: 'missing-route-destination', elementIds: [], message: 'Route delivery requires at least one routeable destination.', severity: 'error' });
		const routing = new WayfindingGraph(project.graph);

		for (const origin of origins) requireConfirmedElement(origin);

		for (const destination of destinations) {
			const destinationNode: WayfindingNode | undefined = routing.locationNode(destination.id);

			if (!destinationNode) {
				issues.push({ code: 'missing-destination-node', elementIds: [destination.id], message: `Routeable destination '${destination.id}' has no graph anchor.`, severity: 'error' });

				continue;
			}
			const destinationElement: WayfindingStudioElement | undefined = destinationNode.semanticElementId ? elementsById.get(destinationNode.semanticElementId) : undefined;
			requireConfirmedElement(destinationElement);

			if (destinationElement?.type === 'location') {
				const door: WayfindingStudioDoorElement | undefined = project.floors.flatMap((floor): WayfindingStudioElement[] => floor.elements).find((element): element is WayfindingStudioDoorElement => element.type === 'door' && element.locationId === destinationElement.id);

				if (!door) issues.push({ code: 'missing-location-door', elementIds: [destinationElement.id], message: `Routeable location '${destination.name}' must terminate at a reviewed door or approach.`, severity: 'error' });
				else requireConfirmedElement(door);
			}

			for (const origin of origins) {
				const originNodeId: string = managedNodeId(origin.id);
				const route = routing.route(originNodeId, destinationNode.id);

				if (!route) {
					issues.push({ code: 'disconnected-route', elementIds: [origin.id, destination.id], message: `No confirmed route connects '${origin.label}' to '${destination.name}'.`, severity: 'error' });
				} else {
					for (const nodeId of route.nodeIds) {
						const semanticElementId: string | undefined = routing.node(nodeId)?.semanticElementId;

						if (semanticElementId) requireConfirmedElement(elementsById.get(semanticElementId));
					}
				}

				if (project.delivery.guidance.stepFreeRequired && !routing.route(originNodeId, destinationNode.id, { profile: 'step-free' })) {
					issues.push({ code: 'disconnected-step-free-route', elementIds: [origin.id, destination.id], message: `No step-free route connects '${origin.label}' to '${destination.name}'.`, severity: 'error' });
				}
			}
		}

		for (const edge of project.graph.edges.filter((candidate): boolean => !candidate.id.startsWith('semantic-transition:'))) {
			if (edge.reviewStatus !== 'confirmed') issues.push({ code: 'unconfirmed-route-edge', elementIds: [edge.id], message: `Route edge '${edge.id}' must be reviewer-confirmed before route delivery.`, severity: 'error' });
			const from: WayfindingNode | undefined = project.graph.nodes.find((node): boolean => node.id === edge.from);
			const to: WayfindingNode | undefined = project.graph.nodes.find((node): boolean => node.id === edge.to);

			if (!from || !to || from.levelId !== to.levelId) continue;
			const floor: WayfindingStudioFloor | undefined = project.floors.find((candidate): boolean => candidate.id === from.levelId);

			if (!floor?.walkableMask) {
				issues.push({ code: 'missing-route-mask', elementIds: [edge.id, from.levelId], message: `Route edge '${edge.id}' requires a confirmed walkable-space mask for floor '${from.levelId}'.`, severity: 'error' });

				continue;
			}

			if (floor.walkableMask.reviewStatus !== 'confirmed') issues.push({ code: 'unconfirmed-route-mask', elementIds: [edge.id, floor.id], message: `Walkable-space mask for floor '${floor.id}' must be reviewer-confirmed before route delivery.`, severity: 'error' });
			const points: WayfindingPoint[] = edge.geometry?.length ? edge.geometry : [from, to];

			if (new WayfindingWalkableMask(floor.walkableMask).outsideCorridor(points, edge.corridorWidth ?? floor.walkableMask.cellSize).length > 0) issues.push({ code: 'route-leaves-walkable-space', elementIds: [edge.id, floor.id], message: `Route edge '${edge.id}' leaves the confirmed walkable-space mask.`, severity: 'error' });
		}
	}

	return issues;
};

const escapeXml = (value: string): string => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll('\'', '&apos;');
const number = (value: number): string => Number(value.toFixed(3)).toString();
const point = (value: WayfindingPoint): string => `${number(value.x)},${number(value.y)}`;
const attrs = (element: WayfindingStudioElement): string => `id="${escapeXml(element.id)}" data-wayfinding-level="${escapeXml(element.floorId)}" data-review-status="${element.status}" data-provenance="${element.provenance}"`;
const labelFontFamilies: Record<WayfindingStudioFontFamily, string> = {
	monospace: 'Courier New, monospace',
	'sans-serif': 'Arial, sans-serif',
	serif: 'Georgia, serif'
};

export const renderWayfindingFloorSvg = (project: WayfindingStudioProject, floorId: string): string => {
	const floor: WayfindingStudioFloor | undefined = project.floors.find((candidate): boolean => candidate.id === floorId);

	if (!floor) throw new Error(`Floor '${floorId}' does not exist.`);
	const presentation: WayfindingStudioPresentationDefaults = resolveWayfindingStudioPresentation(project);
	const assetById = new Map(project.assets.map((asset): [string, WayfindingStudioAsset] => [asset.id, asset]));
	const elements = (type: WayfindingStudioElement['type']): WayfindingStudioElement[] => floor.elements.filter((element): boolean => element.type === type);
	const polygon = (element: WayfindingStudioPolygonElement): string => {
		const presentation = element.presentation;
		const presentationAttributes = [
			presentation?.extrusionHeight !== undefined ? ` data-extrusion-height="${number(presentation.extrusionHeight)}"` : '',
			presentation?.fillColor ? ` fill="${escapeXml(presentation.fillColor)}"` : '',
			presentation?.fillOpacity !== undefined ? ` fill-opacity="${number(presentation.fillOpacity)}"` : ''
		].join('');

		return `<polygon ${attrs(element)}${element.destinationId ? ` data-wayfinding-location-id="${escapeXml(element.destinationId)}"` : ''}${presentationAttributes} points="${element.geometry.map(point).join(' ')}"/>`;
	};
	const background: WayfindingStudioAsset | undefined = floor.backgroundAssetId ? assetById.get(floor.backgroundAssetId) : undefined;
	const media = (element: WayfindingStudioMediaElement): string => {
		const asset: WayfindingStudioAsset | undefined = assetById.get(element.assetId);

		return asset ? `<image ${attrs(element)} href="${escapeXml(asset.dataUrl)}" x="${number(element.point.x)}" y="${number(element.point.y)}" width="${number(element.width)}" height="${number(element.height)}"/>` : '';
	};
	const door = (item: WayfindingStudioElement): string => {
		const value = item as WayfindingStudioDoorElement;
		const radians = value.angle * Math.PI / 180;
		const dx = Math.cos(radians) * value.length / 2;
		const dy = Math.sin(radians) * value.length / 2;

		return `<line ${attrs(value)} x1="${number(value.point.x - dx)}" y1="${number(value.point.y - dy)}" x2="${number(value.point.x + dx)}" y2="${number(value.point.y + dy)}"/>`;
	};
	const poi = (item: WayfindingStudioElement): string => {
		const value = item as WayfindingStudioPointElement;

		return `<circle ${attrs(value)}${value.destinationId ? ` data-wayfinding-location-id="${escapeXml(value.destinationId)}"` : ''} cx="${number(value.point.x)}" cy="${number(value.point.y)}" r="9"/>`;
	};
	const origin = (item: WayfindingStudioElement): string => {
		const value = item as WayfindingStudioOriginElement;

		return `<g ${attrs(value)} data-screen-id="${escapeXml(value.screenId)}" data-facing-degrees="${number(value.facingDegrees)}"><circle cx="${number(value.point.x)}" cy="${number(value.point.y)}" r="14"/><path d="M ${number(value.point.x)} ${number(value.point.y - 26)} l -8 14 h 16 z" transform="rotate(${number(value.facingDegrees)} ${number(value.point.x)} ${number(value.point.y)})"/></g>`;
	};
	const transition = (item: WayfindingStudioElement): string => {
		const value = item as WayfindingStudioTransitionElement;

		return `<circle ${attrs(value)} data-connection-id="${escapeXml(value.connectionId)}" data-transition-kind="${value.kind}" cx="${number(value.point.x)}" cy="${number(value.point.y)}" r="12"/>`;
	};
	const label = (item: WayfindingStudioElement): string => {
		const value = item as WayfindingStudioLabelElement;
		const outlineWidth = value.outlineWidth ?? presentation.label.outlineWidth;

		return `<text ${attrs(value)} x="${number(value.point.x)}" y="${number(value.point.y)}" fill="${escapeXml(value.color ?? presentation.label.color)}" font-family="${escapeXml(labelFontFamilies[value.fontFamily ?? presentation.label.fontFamily])}" font-size="${number(value.fontSize ?? presentation.label.fontSize)}" font-weight="${value.fontWeight ?? presentation.label.fontWeight}" text-anchor="${value.textAnchor ?? 'start'}"${outlineWidth > 0 ? ` stroke="${escapeXml(value.outlineColor ?? presentation.label.outlineColor)}" stroke-width="${number(outlineWidth)}" stroke-linejoin="round" paint-order="stroke fill"` : ''}>${escapeXml(value.text)}</text>`;
	};

	return [
		`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${number(floor.width)} ${number(floor.height)}" width="${number(floor.width)}" height="${number(floor.height)}">`,
		`<g id="Background">${background ? `<image id="background-${escapeXml(floor.id)}" href="${escapeXml(background.dataUrl)}" x="0" y="0" width="${number(floor.width)}" height="${number(floor.height)}" preserveAspectRatio="none"/>` : ''}</g>`,
		`<g id="Walkable" fill="${presentation.polygons.walkable.fillColor}" fill-opacity="${number(presentation.polygons.walkable.fillOpacity)}" stroke="#16836f">${elements('walkable').map((item): string => polygon(item as WayfindingStudioPolygonElement)).join('')}</g>`,
		`<g id="Obstacles" fill="${presentation.polygons.obstacle.fillColor}" fill-opacity="${number(presentation.polygons.obstacle.fillOpacity)}" stroke="#151c1b">${elements('obstacle').map((item): string => polygon(item as WayfindingStudioPolygonElement)).join('')}</g>`,
		`<g id="Locations" fill="${presentation.polygons.location.fillColor}" fill-opacity="${number(presentation.polygons.location.fillOpacity)}" stroke="#c88716">${elements('location').map((item): string => polygon(item as WayfindingStudioPolygonElement)).join('')}</g>`,
		`<g id="Doors" stroke="#17201f" stroke-width="4">${elements('door').map(door).join('')}</g>`,
		`<g id="POIs" fill="#2b6cb0">${elements('poi').map(poi).join('')}</g>`,
		`<g id="Origins" fill="#138b75">${elements('origin').map(origin).join('')}</g>`,
		`<g id="Transitions" fill="#ffffff" stroke="#17201f">${elements('transition').map(transition).join('')}</g>`,
		`<g id="Labels">${elements('label').map(label).join('')}</g>`,
		`<g id="Icons">${elements('icon').map((item): string => media(item as WayfindingStudioMediaElement)).join('')}</g>`,
		`<g id="Logos">${elements('logo').map((item): string => media(item as WayfindingStudioMediaElement)).join('')}</g>`,
		'</svg>'
	].join('');
};

export const createWayfindingRuntimeBundle = (project: WayfindingStudioProject): WayfindingRuntimeBundle => {
	const errors: WayfindingStudioIssue[] = validateWayfindingStudioDelivery(project).filter((issue): boolean => issue.severity === 'error');

	if (errors.length > 0) throw new Error(errors.map((issue): string => issue.message).join(' '));
	const assessment: WayfindingProjectAssessment = assessWayfindingProject(project.delivery);

	if (!assessment.deliveryAllowed || assessment.deliveryMode === 'blocked') throw new Error('Runtime bundle cannot be created while delivery evidence is blocked.');
	const runtimeGraph: WayfindingGraphDocument = assessment.deliveryMode === 'route'
		? structuredClone(project.graph)
		: { contractVersion: 2, edges: [], graphId: `${project.graph.graphId}:${assessment.deliveryMode}`, nodes: [] };

	return {
		assets: structuredClone(project.assets),
		contractVersion: 1,
		destinations: { Destinations: { rows: structuredClone(project.destinations) } },
		floors: [...project.floors].sort((left, right): number => left.order - right.order).map((floor) => ({
			backgroundAssetId: floor.backgroundAssetId,
			camera3d: floor.camera3d ? structuredClone(floor.camera3d) : undefined,
			elements: structuredClone(floor.elements),
			height: floor.height,
			id: floor.id,
			name: floor.name,
			order: floor.order,
			svg: renderWayfindingFloorSvg(project, floor.id),
			width: floor.width
		})),
		graph: runtimeGraph,
		manifest: {
			deliveryMode: assessment.deliveryMode,
			generatedAt: project.updatedAt,
			projectId: project.projectId,
			sourceContractVersion: project.contractVersion,
			targetMode: assessment.targetMode
		},
		presentation: resolveWayfindingStudioPresentation(project)
	};
};

export const synchronizeWayfindingStudioGraph = (project: WayfindingStudioProject): void => {
	const elements: WayfindingStudioElement[] = project.floors.flatMap((floor): WayfindingStudioElement[] => floor.elements);
	const previousManagedIds: Set<string> = new Set(project.graph.nodes.filter((node: WayfindingNode): boolean => Boolean(node.semanticElementId)).map((node: WayfindingNode): string => node.id));
	const manualNodes: WayfindingNode[] = project.graph.nodes.filter((node: WayfindingNode): boolean => !node.semanticElementId);
	const managedNodes: WayfindingNode[] = [];

	for (const element of elements) {
		if (element.type === 'origin') {
			managedNodes.push({ id: managedNodeId(element.id), kind: 'route', levelId: element.floorId, semanticElementId: element.id, x: element.point.x, y: element.point.y });
		} else if (element.type === 'transition') {
			managedNodes.push({ id: managedNodeId(element.id), kind: 'transition', levelId: element.floorId, semanticElementId: element.id, x: element.point.x, y: element.point.y });
		} else if (element.type === 'poi' && element.destinationId) {
			managedNodes.push({ id: managedNodeId(element.id), kind: 'location', levelId: element.floorId, locationId: element.destinationId, semanticElementId: element.id, x: element.point.x, y: element.point.y });
		} else if (element.type === 'location' && element.destinationId) {
			const doors: WayfindingStudioDoorElement[] = elements.filter((candidate: WayfindingStudioElement): candidate is WayfindingStudioDoorElement => candidate.type === 'door' && candidate.floorId === element.floorId && candidate.locationId === element.id);

			if (doors.length === 0) {
				const anchor: WayfindingPoint = element.geometry[0] ?? { x: 0, y: 0 };

				managedNodes.push({ id: managedNodeId(element.id), kind: 'location', levelId: element.floorId, locationId: element.destinationId, semanticElementId: element.id, x: anchor.x, y: anchor.y });
			} else {
				for (const [doorIndex, door] of doors.entries()) {
					managedNodes.push({
						id: managedNodeId(doorIndex === 0 ? element.id : door.id),
						kind: 'location',
						levelId: element.floorId,
						locationId: element.destinationId,
						semanticElementId: doorIndex === 0 ? element.id : door.id,
						x: door.point.x,
						y: door.point.y
					});
				}
			}
		}
	}

	const retainedEdges: WayfindingEdge[] = project.graph.edges.filter((edge: WayfindingEdge): boolean => !edge.id.startsWith('semantic-transition:'));
	const transitionEdges: WayfindingEdge[] = [];
	const transitionGroups = new Map<string, WayfindingStudioTransitionElement[]>();

	for (const transition of elements.filter((element): element is WayfindingStudioTransitionElement => element.type === 'transition')) {
		transitionGroups.set(transition.connectionId, [...(transitionGroups.get(transition.connectionId) ?? []), transition]);
	}

	for (const [connectionId, transitions] of transitionGroups) {
		const ordered: WayfindingStudioTransitionElement[] = [...transitions].sort((left, right): number => {
			const leftOrder: number = project.floors.find((floor): boolean => floor.id === left.floorId)?.order ?? 0;
			const rightOrder: number = project.floors.find((floor): boolean => floor.id === right.floorId)?.order ?? 0;

			return leftOrder - rightOrder;
		});

		for (let index = 1; index < ordered.length; index += 1) {
			const from: WayfindingStudioTransitionElement = ordered[index - 1];
			const to: WayfindingStudioTransitionElement = ordered[index];
			transitionEdges.push({
				accessible: from.accessible && to.accessible,
				bidirectional: true,
				distanceMeters: 5,
				from: managedNodeId(from.id),
				id: `semantic-transition:${connectionId}:${index}`,
				kind: from.kind,
				reviewStatus: from.status === 'confirmed' && to.status === 'confirmed' ? 'confirmed' : 'proposed',
				to: managedNodeId(to.id),
				traversal: 'transition'
			});
		}
	}

	project.graph = {
		...project.graph,
		contractVersion: 2,
		edges: [...retainedEdges.filter((edge: WayfindingEdge): boolean => !previousManagedIds.has(edge.from) || managedNodes.some((node): boolean => node.id === edge.from))
			.filter((edge: WayfindingEdge): boolean => !previousManagedIds.has(edge.to) || managedNodes.some((node): boolean => node.id === edge.to)), ...transitionEdges],
		nodes: [...manualNodes, ...managedNodes]
	};
};

export const touchWayfindingStudioProject = (project: WayfindingStudioProject): void => {
	project.updatedAt = now();
	project.delivery.projectId = project.projectId;
	project.delivery.source.levels = project.floors.length;
};
