import {
	WayfindingGraph,
	type WayfindingEdge,
	type WayfindingGraphDocument,
	type WayfindingNode,
	type WayfindingPoint,
	type WayfindingWalkableMaskDocument
} from '../../src/utils/wayfinding.js';
import {
	type WayfindingGuidanceMode,
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

export type WayfindingStudioLocationColorMode = 'fixed' | 'inherited' | 'random';
export type WayfindingStudioPedestrianSpaceSource = 'mask' | 'polygons';

export interface WayfindingStudioProjectDefaults {
	iconSize: number;
	label: {
		color: string;
		fontFamily: WayfindingStudioFontFamily;
		fontSize: number;
		fontWeight: 400 | 600 | 700;
		outlineColor: string;
		outlineWidth: number;
	};
	location: Required<WayfindingStudioPolygonPresentation>;
	locationColor: {
		fixedColor: string;
		mode: WayfindingStudioLocationColorMode;
	};
	logoSize: number;
	obstacle: Required<WayfindingStudioPolygonPresentation>;
	origin: {
		animation2d: 'none' | 'pulse' | 'radar';
		animation3d: 'bounce' | 'none' | 'pulse';
		animationSpeed: number;
		color: string;
	};
	route: {
		animation: 'flow' | 'none' | 'pulse';
		animationSpeed: number;
		color: string;
		cornerRadius: number;
		lineWidth: number;
	};
	walkable: Required<WayfindingStudioPolygonPresentation>;
}

export interface WayfindingStudioLanguage {
	code: string;
	label: string;
}

export interface WayfindingStudioTranslation {
	description?: string;
	name?: string;
}

export interface WayfindingStudioAsset {
	dataUrl: string;
	id: string;
	kind: 'background' | 'icon' | 'logo' | 'photo';
	mimeType: string;
	name: string;
	naturalHeight?: number;
	naturalWidth?: number;
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
	destinationId?: string;
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
	pedestrianSpaceSource?: WayfindingStudioPedestrianSpaceSource;
	/** Floor-plan units per real-world metre. Absent means the floor is uncalibrated and route distances have no physical meaning. */
	unitsPerMeter?: number;
	walkableMask?: WayfindingWalkableMaskDocument;
	width: number;
}

export interface WayfindingStudioDestination extends Record<string, unknown> {
	accessible?: boolean;
	category?: string;
	description?: string;
	floor?: string;
	hours?: string;
	id: string;
	logoAssetId?: string;
	mapNumber?: string;
	name: string;
	phone?: string;
	photoAssetIds?: string[];
	routeable?: boolean;
	status?: string;
	translations?: Record<string, WayfindingStudioTranslation>;
	website?: string;
}

export interface WayfindingStudioProject {
	assets: WayfindingStudioAsset[];
	categories?: string[];
	contractVersion: 1;
	createdAt: string;
	defaultLanguage?: string;
	defaults?: WayfindingStudioProjectDefaults;
	delivery: WayfindingProjectDocument;
	destinations: WayfindingStudioDestination[];
	floors: WayfindingStudioFloor[];
	graph: WayfindingGraphDocument;
	languages?: WayfindingStudioLanguage[];
	name: string;
	projectId: string;
	updatedAt: string;
}

export interface WayfindingStudioIssue {
	code: string;
	elementIds: string[];
	message: string;
	severity: 'error' | 'warning';
}

export interface WayfindingStudioRepair {
	code: 'clipped-polygon' | 'clamped-element' | 'clamped-graph-node' | 'clipped-edge';
	elementIds: string[];
	message: string;
}

export interface WayfindingRuntimeBundle {
	assets: WayfindingStudioAsset[];
	categories: string[];
	contractVersion: 1;
	defaultLanguage: string;
	defaults: WayfindingStudioProjectDefaults;
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
		unitsPerMeter?: number;
		width: number;
	}>;
	graph: WayfindingGraphDocument;
	languages: WayfindingStudioLanguage[];
	manifest: {
		deliveryMode: WayfindingGuidanceMode;
		generatedAt: string;
		projectId: string;
		sourceContractVersion: number;
		targetMode: WayfindingGuidanceMode;
	};
}

const now = (): string => new Date().toISOString();

export const createWayfindingStudioProjectDefaults = (): WayfindingStudioProjectDefaults => ({
	iconSize: 72,
	label: {
		color: '#17201f',
		fontFamily: 'sans-serif',
		fontSize: 24,
		fontWeight: 600,
		outlineColor: '#ffffff',
		outlineWidth: 0
	},
	location: { extrusionHeight: 18, fillColor: '#f4c95d', fillOpacity: 0.72 },
	locationColor: { fixedColor: '#f4c95d', mode: 'inherited' },
	logoSize: 96,
	obstacle: { extrusionHeight: 24, fillColor: '#31403d', fillOpacity: 0.76 },
	origin: {
		animation2d: 'radar',
		animation3d: 'bounce',
		animationSpeed: 48,
		color: '#138b75'
	},
	route: {
		animation: 'flow',
		animationSpeed: 48,
		color: '#246bfd',
		cornerRadius: 18,
		lineWidth: 9
	},
	walkable: { extrusionHeight: 0, fillColor: '#55bfa7', fillOpacity: 0.28 }
});

export const wayfindingStudioProjectDefaults = (project: WayfindingStudioProject): WayfindingStudioProjectDefaults => {
	const fallback: WayfindingStudioProjectDefaults = createWayfindingStudioProjectDefaults();
	const defaults: Partial<WayfindingStudioProjectDefaults> = project.defaults ?? {};

	return {
		iconSize: defaults.iconSize ?? fallback.iconSize,
		label: { ...fallback.label, ...defaults.label },
		location: { ...fallback.location, ...defaults.location },
		locationColor: { ...fallback.locationColor, ...defaults.locationColor },
		logoSize: defaults.logoSize ?? fallback.logoSize,
		obstacle: { ...fallback.obstacle, ...defaults.obstacle },
		origin: { ...fallback.origin, ...defaults.origin },
		route: { ...fallback.route, ...defaults.route },
		walkable: { ...fallback.walkable, ...defaults.walkable }
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
		defaultLanguage: 'en',
		defaults: createWayfindingStudioProjectDefaults(),
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
		categories: ['Accessibility', 'Dining', 'Events', 'Parking', 'Restrooms', 'Services', 'Shopping'],
		destinations: [],
		floors: [{ elements: [], height: 1080, id: 'level-0', name: 'Level 0', order: 0, pedestrianSpaceSource: 'polygons', width: 1920 }],
		graph: { contractVersion: 2, edges: [], graphId: `${projectId}-graph`, nodes: [] },
		languages: [{ code: 'en', label: 'English' }],
		name: 'Wayfinding project',
		projectId,
		updatedAt: timestamp
	};
};

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

const assertWayfindingStudioProjectShape: (value: unknown) => asserts value is WayfindingStudioProject = (value: unknown): asserts value is WayfindingStudioProject => {
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
};

export const parseWayfindingStudioProject = (value: unknown): WayfindingStudioProject => {
	assertWayfindingStudioProjectShape(value);

	const project: WayfindingStudioProject = JSON.parse(JSON.stringify(value)) as WayfindingStudioProject;
	project.categories = Array.from(new Set([
		...(Array.isArray(project.categories) ? project.categories.filter((category): category is string => typeof category === 'string') : []),
		...project.destinations.map((destination): string | undefined => destination.category).filter((category): category is string => Boolean(category))
	])).map((category): string => category.trim()).filter(Boolean).sort((left, right): number => left.localeCompare(right));
	project.languages = Array.from(new Map(
		(Array.isArray(project.languages) ? project.languages : [])
			.filter((language): language is WayfindingStudioLanguage => isRecord(language) && typeof language.code === 'string' && typeof language.label === 'string')
			.map((language): WayfindingStudioLanguage => ({ code: language.code.trim().toLowerCase(), label: language.label.trim() }))
			.filter((language): boolean => Boolean(language.code && language.label))
			.map((language): [string, WayfindingStudioLanguage] => [language.code, language])
	).values());

	if (project.languages.length === 0) project.languages.push({ code: 'en', label: 'English' });
	project.defaultLanguage = project.languages.some((language): boolean => language.code === project.defaultLanguage)
		? project.defaultLanguage
		: project.languages[0].code;

	for (const destination of project.destinations) {
		const legacyEnglishName: unknown = destination.englishName;

		if (typeof legacyEnglishName === 'string' && legacyEnglishName.trim()) {
			destination.translations = {
				...(destination.translations ?? {}),
				en: {
					...(isRecord(destination.translations?.en) ? destination.translations.en : {}),
					name: destination.translations?.en?.name || legacyEnglishName.trim()
				}
			};
		}
		delete destination.englishName;
	}
	project.defaults = wayfindingStudioProjectDefaults(project);

	for (const floor of project.floors) {
		if (floor.unitsPerMeter !== undefined && (!Number.isFinite(floor.unitsPerMeter) || floor.unitsPerMeter <= 0)) {
			delete floor.unitsPerMeter;
		}

		if (floor.pedestrianSpaceSource !== 'mask' && floor.pedestrianSpaceSource !== 'polygons') {
			floor.pedestrianSpaceSource = floor.elements.some((element): boolean => element.type === 'walkable')
				? 'polygons'
				: floor.walkableMask ? 'mask' : 'polygons';
		}
	}
	const errors: WayfindingStudioIssue[] = validateWayfindingStudioProject(project).filter((issue): boolean => issue.severity === 'error');

	if (errors.length > 0) throw new Error(errors.map((issue): string => issue.message).join(' '));

	return project;
};

const clampPointToFloor = (point: WayfindingPoint, floor: WayfindingStudioFloor): WayfindingPoint => ({
	x: Math.max(0, Math.min(floor.width, point.x)),
	y: Math.max(0, Math.min(floor.height, point.y))
});

const clipPolygonBoundary = (
	points: WayfindingPoint[],
	inside: (point: WayfindingPoint) => boolean,
	intersection: (left: WayfindingPoint, right: WayfindingPoint) => WayfindingPoint
): WayfindingPoint[] => {
	const output: WayfindingPoint[] = [];

	for (let index = 0; index < points.length; index += 1) {
		const current: WayfindingPoint = points[index];
		const previous: WayfindingPoint = points[(index - 1 + points.length) % points.length];
		const currentInside: boolean = inside(current);
		const previousInside: boolean = inside(previous);

		if (currentInside) {
			if (!previousInside) output.push(intersection(previous, current));
			output.push(current);
		} else if (previousInside) output.push(intersection(previous, current));
	}

	return output;
};

const clipPolygonToFloor = (points: WayfindingPoint[], floor: WayfindingStudioFloor): WayfindingPoint[] => {
	let clipped: WayfindingPoint[] = points.filter(finitePoint);
	const verticalIntersection = (x: number) => (left: WayfindingPoint, right: WayfindingPoint): WayfindingPoint => {
		const ratio: number = (x - left.x) / (right.x - left.x);

		return { x, y: left.y + (right.y - left.y) * ratio };
	};
	const horizontalIntersection = (y: number) => (left: WayfindingPoint, right: WayfindingPoint): WayfindingPoint => {
		const ratio: number = (y - left.y) / (right.y - left.y);

		return { x: left.x + (right.x - left.x) * ratio, y };
	};

	clipped = clipPolygonBoundary(clipped, (point): boolean => point.x >= 0, verticalIntersection(0));
	clipped = clipPolygonBoundary(clipped, (point): boolean => point.x <= floor.width, verticalIntersection(floor.width));
	clipped = clipPolygonBoundary(clipped, (point): boolean => point.y >= 0, horizontalIntersection(0));
	clipped = clipPolygonBoundary(clipped, (point): boolean => point.y <= floor.height, horizontalIntersection(floor.height));

	return clipped.filter((point: WayfindingPoint, index: number): boolean => {
		const previous: WayfindingPoint | undefined = clipped[(index - 1 + clipped.length) % clipped.length];

		return !previous || point.x !== previous.x || point.y !== previous.y;
	});
};

export const repairWayfindingStudioProject = (value: unknown): { project: WayfindingStudioProject; repairs: WayfindingStudioRepair[] } => {
	assertWayfindingStudioProjectShape(value);
	const project: WayfindingStudioProject = JSON.parse(JSON.stringify(value)) as WayfindingStudioProject;
	const repairs: WayfindingStudioRepair[] = [];

	for (const floor of project.floors) {
		for (const element of floor.elements) {
			if ('geometry' in element && element.geometry.some((point: WayfindingPoint): boolean => !pointInFloor(point, floor))) {
				const clipped: WayfindingPoint[] = clipPolygonToFloor(element.geometry, floor);

				if (clipped.length < 3) throw new Error(`Polygon '${element.id}' lies outside floor '${floor.id}' and cannot be recovered automatically.`);
				element.geometry = clipped;
				element.status = 'proposed';
				repairs.push({
					code: 'clipped-polygon',
					elementIds: [element.id],
					message: `Clipped '${element.id}' to the ${floor.name} boundary. Review its edge before delivery.`
				});
			} else if ('point' in element && !pointInFloor(element.point, floor)) {
				element.point = clampPointToFloor(element.point, floor);
				element.status = 'proposed';
				repairs.push({
					code: 'clamped-element',
					elementIds: [element.id],
					message: `Moved '${element.id}' to the nearest point inside ${floor.name}.`
				});
			}
		}

		for (const node of project.graph.nodes.filter((candidate: WayfindingNode): boolean => candidate.levelId === floor.id)) {
			if (pointInFloor(node, floor)) continue;
			Object.assign(node, clampPointToFloor(node, floor));
			repairs.push({
				code: 'clamped-graph-node',
				elementIds: [node.id],
				message: `Moved route node '${node.id}' inside ${floor.name}.`
			});
		}

		for (const edge of project.graph.edges) {
			if (!edge.geometry?.some((point: WayfindingPoint): boolean => !pointInFloor(point, floor))) continue;
			const from: WayfindingNode | undefined = project.graph.nodes.find((node: WayfindingNode): boolean => node.id === edge.from);
			const to: WayfindingNode | undefined = project.graph.nodes.find((node: WayfindingNode): boolean => node.id === edge.to);

			if (from?.levelId !== floor.id || to?.levelId !== floor.id) continue;
			edge.geometry = edge.geometry.map((point: WayfindingPoint): WayfindingPoint => clampPointToFloor(point, floor));
			edge.reviewStatus = 'proposed';
			repairs.push({
				code: 'clipped-edge',
				elementIds: [edge.id],
				message: `Clipped route segment '${edge.id}' to ${floor.name}.`
			});
		}
	}

	const errors: WayfindingStudioIssue[] = validateWayfindingStudioProject(project).filter((issue): boolean => issue.severity === 'error');

	if (errors.length > 0) throw new Error(errors.map((issue): string => issue.message).join(' '));

	return { project, repairs };
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
const pointOnSegment = (pointValue: WayfindingPoint, start: WayfindingPoint, end: WayfindingPoint): boolean => {
	const lengthSquared: number = (end.x - start.x) ** 2 + (end.y - start.y) ** 2;

	if (lengthSquared === 0) return Math.hypot(pointValue.x - start.x, pointValue.y - start.y) <= 0.5;
	const ratio: number = Math.max(0, Math.min(1, (
		(pointValue.x - start.x) * (end.x - start.x)
		+ (pointValue.y - start.y) * (end.y - start.y)
	) / lengthSquared));

	return Math.hypot(
		pointValue.x - (start.x + ratio * (end.x - start.x)),
		pointValue.y - (start.y + ratio * (end.y - start.y))
	) <= 0.5;
};
const pointInPolygon = (pointValue: WayfindingPoint, polygon: WayfindingPoint[]): boolean => {
	let inside = false;

	for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
		const start: WayfindingPoint = polygon[previous];
		const end: WayfindingPoint = polygon[index];

		if (pointOnSegment(pointValue, start, end)) return true;

		if ((end.y > pointValue.y) !== (start.y > pointValue.y)
			&& pointValue.x < ((start.x - end.x) * (pointValue.y - end.y)) / (start.y - end.y) + end.x) inside = !inside;
	}

	return inside;
};
const pointInPolygonalPedestrianSpace = (
	pointValue: WayfindingPoint,
	walkableAreas: WayfindingStudioPolygonElement[],
	obstacles: WayfindingStudioPolygonElement[]
): boolean => walkableAreas.some((area): boolean => pointInPolygon(pointValue, area.geometry))
	&& !obstacles.some((area): boolean => pointInPolygon(pointValue, area.geometry));
const routeLeavesPolygonalPedestrianSpace = (
	points: WayfindingPoint[],
	corridorWidth: number,
	walkableAreas: WayfindingStudioPolygonElement[],
	obstacles: WayfindingStudioPolygonElement[]
): boolean => {
	const halfWidth: number = Math.max(0, corridorWidth / 2);
	const step: number = Math.max(1, Math.min(8, corridorWidth > 0 ? corridorWidth / 2 : 4));

	for (let index = 1; index < points.length; index += 1) {
		const start: WayfindingPoint = points[index - 1];
		const end: WayfindingPoint = points[index];
		const dx: number = end.x - start.x;
		const dy: number = end.y - start.y;
		const length: number = Math.hypot(dx, dy);
		const sampleCount: number = Math.max(1, Math.ceil(length / step));
		const normalX: number = length === 0 ? 0 : -dy / length;
		const normalY: number = length === 0 ? 0 : dx / length;

		for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
			const ratio: number = sampleIndex / sampleCount;
			const center: WayfindingPoint = { x: start.x + dx * ratio, y: start.y + dy * ratio };

			for (const offset of [0, -halfWidth, halfWidth]) {
				if (!pointInPolygonalPedestrianSpace({
					x: center.x + normalX * offset,
					y: center.y + normalY * offset
				}, walkableAreas, obstacles)) return true;
			}
		}
	}

	return false;
};

export const validateWayfindingStudioProject = (project: WayfindingStudioProject): WayfindingStudioIssue[] => {
	const issues: WayfindingStudioIssue[] = [];
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

	if (project.defaults) {
		const locationColor = project.defaults.locationColor;

		if (locationColor && !['fixed', 'inherited', 'random'].includes(locationColor.mode)) issues.push({ code: 'invalid-location-color-mode', elementIds: [], message: 'New-room color mode must be inherited, random, or fixed.', severity: 'error' });

		if (locationColor && !validColor(locationColor.fixedColor)) issues.push({ code: 'invalid-location-fixed-color', elementIds: [], message: 'New-room fixed color must use a six-digit hex value.', severity: 'error' });
	}

	for (const order of duplicateIds(project.floors.map((floor): string => String(floor.order)))) issues.push({ code: 'duplicate-floor-order', elementIds: project.floors.filter((floor): boolean => String(floor.order) === order).map((floor): string => floor.id), message: `Floor order '${order}' is duplicated.`, severity: 'error' });

	for (const id of duplicateIds(project.destinations.map((destination): string => destination.id))) issues.push({ code: 'duplicate-destination-id', elementIds: [id], message: `Destination id '${id}' is duplicated.`, severity: 'error' });

	for (const destination of project.destinations) {
		if (destination.floor && !floorIds.includes(destination.floor)) issues.push({ code: 'destination-floor-missing', elementIds: [destination.id], message: `Destination '${destination.id}' references missing floor '${destination.floor}'.`, severity: 'error' });

		if (destination.logoAssetId) {
			const asset: WayfindingStudioAsset | undefined = assetsById.get(destination.logoAssetId);

			if (!asset) issues.push({ code: 'missing-destination-logo', elementIds: [destination.id, destination.logoAssetId], message: `Destination '${destination.id}' references missing logo '${destination.logoAssetId}'.`, severity: 'error' });
			else if (asset.kind !== 'logo') issues.push({ code: 'destination-logo-kind-mismatch', elementIds: [destination.id, destination.logoAssetId], message: `Destination '${destination.id}' logo '${destination.logoAssetId}' must use a logo asset.`, severity: 'error' });
		}

		for (const assetId of destination.photoAssetIds ?? []) {
			const asset: WayfindingStudioAsset | undefined = assetsById.get(assetId);

			if (!asset) issues.push({ code: 'missing-destination-photo', elementIds: [destination.id, assetId], message: `Destination '${destination.id}' references missing photo '${assetId}'.`, severity: 'error' });
			else if (asset.kind !== 'photo') issues.push({ code: 'destination-photo-kind-mismatch', elementIds: [destination.id, assetId], message: `Destination '${destination.id}' photo '${assetId}' must use a photo asset.`, severity: 'error' });
		}
	}

	for (const screenId of duplicateIds(project.floors.flatMap((floor): string[] => floor.elements.filter((element): element is WayfindingStudioOriginElement => element.type === 'origin').map((origin): string => origin.screenId)))) issues.push({ code: 'duplicate-screen-id', elementIds: [screenId], message: `Installed-screen id '${screenId}' is duplicated.`, severity: 'error' });

	for (const floor of project.floors) {
		if (!(floor.width > 0) || !(floor.height > 0)) issues.push({ code: 'invalid-floor-size', elementIds: [floor.id], message: `Floor '${floor.id}' needs a positive coordinate size.`, severity: 'error' });

		if (floor.pedestrianSpaceSource !== undefined && floor.pedestrianSpaceSource !== 'mask' && floor.pedestrianSpaceSource !== 'polygons') issues.push({ code: 'invalid-pedestrian-space-source', elementIds: [floor.id], message: `Floor '${floor.id}' has an invalid pedestrian-space source.`, severity: 'error' });

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

			if ((element.type === 'icon' || element.type === 'logo') && element.destinationId && !destinationIds.has(element.destinationId)) issues.push({ code: 'missing-destination', elementIds: [element.id, element.destinationId], message: `Element '${element.id}' references missing destination '${element.destinationId}'.`, severity: 'error' });

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

	if (project.delivery.guidance.targetMode === 'route') {
		const origins: WayfindingStudioOriginElement[] = project.floors.flatMap((floor): WayfindingStudioOriginElement[] => floor.elements.filter((element): element is WayfindingStudioOriginElement => element.type === 'origin'));
		const destinations: WayfindingStudioDestination[] = project.destinations.filter((destination): boolean => destination.routeable !== false);
		const elementsById = new Map(project.floors.flatMap((floor): Array<[string, WayfindingStudioElement]> => floor.elements.map((element): [string, WayfindingStudioElement] => [element.id, element])));

		if (origins.length === 0) issues.push({ code: 'missing-route-origin', elementIds: [], message: 'Route delivery requires at least one authored origin.', severity: 'error' });

		if (destinations.length === 0) issues.push({ code: 'missing-route-destination', elementIds: [], message: 'Route delivery requires at least one routeable destination.', severity: 'error' });
		const routing = new WayfindingGraph(project.graph);

		for (const destination of destinations) {
			const destinationNode: WayfindingNode | undefined = routing.locationNode(destination.id);

			if (!destinationNode) {
				issues.push({ code: 'missing-destination-node', elementIds: [destination.id], message: `Routeable destination '${destination.id}' has no graph anchor.`, severity: 'error' });

				continue;
			}
			const destinationElement: WayfindingStudioElement | undefined = destinationNode.semanticElementId ? elementsById.get(destinationNode.semanticElementId) : undefined;

			if (destinationElement?.type === 'location') {
				const door: WayfindingStudioDoorElement | undefined = project.floors.flatMap((floor): WayfindingStudioElement[] => floor.elements).find((element): element is WayfindingStudioDoorElement => element.type === 'door' && element.locationId === destinationElement.id);

				if (!door) issues.push({ code: 'missing-location-door', elementIds: [destinationElement.id], message: `Routeable location '${destination.name}' must terminate at a linked door or approach.`, severity: 'error' });
			}

			for (const origin of origins) {
				const originNodeId: string = managedNodeId(origin.id);
				const route = routing.route(originNodeId, destinationNode.id);

				if (!route) {
					issues.push({ code: 'disconnected-route', elementIds: [origin.id, destination.id], message: `No route connects '${origin.label}' to '${destination.name}'.`, severity: 'error' });
				}

				if (project.delivery.guidance.stepFreeRequired && !routing.route(originNodeId, destinationNode.id, { profile: 'step-free' })) {
					issues.push({ code: 'disconnected-step-free-route', elementIds: [origin.id, destination.id], message: `No step-free route connects '${origin.label}' to '${destination.name}'.`, severity: 'error' });
				}
			}
		}

		for (const edge of project.graph.edges.filter((candidate): boolean => !candidate.id.startsWith('semantic-transition:'))) {
			const from: WayfindingNode | undefined = project.graph.nodes.find((node): boolean => node.id === edge.from);
			const to: WayfindingNode | undefined = project.graph.nodes.find((node): boolean => node.id === edge.to);

			if (!from || !to || from.levelId !== to.levelId) continue;
			const floor: WayfindingStudioFloor | undefined = project.floors.find((candidate): boolean => candidate.id === from.levelId);

			if (!floor) continue;
			const points: WayfindingPoint[] = edge.geometry?.length ? edge.geometry : [from, to];
			const source: WayfindingStudioPedestrianSpaceSource = floor.pedestrianSpaceSource
				?? (floor.elements.some((element): boolean => element.type === 'walkable') ? 'polygons' : 'mask');

			if (source === 'polygons') {
				const walkableAreas: WayfindingStudioPolygonElement[] = floor.elements.filter((element): element is WayfindingStudioPolygonElement => element.type === 'walkable');
				const obstacles: WayfindingStudioPolygonElement[] = floor.elements.filter((element): element is WayfindingStudioPolygonElement => element.type === 'obstacle');

				if (walkableAreas.length === 0) {
					issues.push({ code: 'missing-route-pedestrian-area', elementIds: [edge.id, floor.id], message: `Route edge '${edge.id}' requires an authored pedestrian area on floor '${floor.id}'.`, severity: 'error' });

					continue;
				}

				const validationWidth: number = edge.traversal === 'portal' ? 0 : edge.corridorWidth ?? 0;

				if (routeLeavesPolygonalPedestrianSpace(points, validationWidth, walkableAreas, obstacles)) {
					issues.push({ code: 'route-leaves-walkable-space', elementIds: [edge.id, floor.id], message: `Route edge '${edge.id}' leaves the authored pedestrian area.`, severity: 'error' });
				}

				continue;
			}

			if (!floor.walkableMask) {
				issues.push({ code: 'missing-route-mask', elementIds: [edge.id, from.levelId], message: `Route edge '${edge.id}' requires a saved painted pedestrian mask for floor '${from.levelId}'.`, severity: 'error' });

				continue;
			}

			const validationWidth: number = edge.traversal === 'portal' ? 0 : edge.corridorWidth ?? floor.walkableMask.cellSize;

			if (new WayfindingWalkableMask(floor.walkableMask).outsideCorridor(points, validationWidth).length > 0) issues.push({ code: 'route-leaves-walkable-space', elementIds: [edge.id, floor.id], message: `Route edge '${edge.id}' leaves the painted walkable-space mask.`, severity: 'error' });
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

export const renderWayfindingFloorSvg = (
	project: WayfindingStudioProject,
	floorId: string,
	assetHref: (asset: WayfindingStudioAsset) => string = (asset): string => asset.dataUrl
): string => {
	const floor: WayfindingStudioFloor | undefined = project.floors.find((candidate): boolean => candidate.id === floorId);

	if (!floor) throw new Error(`Floor '${floorId}' does not exist.`);
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

		return asset ? `<image ${attrs(element)}${element.destinationId ? ` data-wayfinding-location-id="${escapeXml(element.destinationId)}"` : ''} href="${escapeXml(assetHref(asset))}" x="${number(element.point.x - element.width / 2)}" y="${number(element.point.y - element.height / 2)}" width="${number(element.width)}" height="${number(element.height)}" preserveAspectRatio="xMidYMid meet"/>` : '';
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
		const outlineWidth = value.outlineWidth ?? 0;

		return `<text ${attrs(value)} x="${number(value.point.x)}" y="${number(value.point.y)}" fill="${escapeXml(value.color ?? '#17201f')}" font-family="${escapeXml(labelFontFamilies[value.fontFamily ?? 'sans-serif'])}" font-size="${number(value.fontSize ?? 24)}" font-weight="${value.fontWeight ?? 600}" text-anchor="${value.textAnchor ?? 'start'}"${outlineWidth > 0 ? ` stroke="${escapeXml(value.outlineColor ?? '#ffffff')}" stroke-width="${number(outlineWidth)}" stroke-linejoin="round" paint-order="stroke fill"` : ''}>${escapeXml(value.text)}</text>`;
	};

	return [
		`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${number(floor.width)} ${number(floor.height)}" width="${number(floor.width)}" height="${number(floor.height)}">`,
		`<g id="Background">${background ? `<image id="background-${escapeXml(floor.id)}" href="${escapeXml(assetHref(background))}" x="0" y="0" width="${number(floor.width)}" height="${number(floor.height)}" preserveAspectRatio="none"/>` : ''}</g>`,
		`<g id="Walkable" fill="#66c2a5" fill-opacity="0.18" stroke="#16836f">${elements('walkable').map((item): string => polygon(item as WayfindingStudioPolygonElement)).join('')}</g>`,
		`<g id="Obstacles" fill="#151c1b" fill-opacity="0.22" stroke="#151c1b">${elements('obstacle').map((item): string => polygon(item as WayfindingStudioPolygonElement)).join('')}</g>`,
		`<g id="Locations" fill="#f4c95d" fill-opacity="0.2" stroke="#c88716">${elements('location').map((item): string => polygon(item as WayfindingStudioPolygonElement)).join('')}</g>`,
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
	const deliveryMode: WayfindingGuidanceMode = project.delivery.guidance.targetMode;
	const runtimeGraph: WayfindingGraphDocument = deliveryMode === 'route'
		? structuredClone(project.graph)
		: { contractVersion: 2, edges: [], graphId: `${project.graph.graphId}:${deliveryMode}`, nodes: [] };

	return {
		assets: structuredClone(project.assets),
		categories: structuredClone(project.categories ?? []),
		contractVersion: 1,
		defaultLanguage: project.defaultLanguage ?? 'en',
		defaults: structuredClone(wayfindingStudioProjectDefaults(project)),
		destinations: { Destinations: { rows: structuredClone(project.destinations) } },
		floors: [...project.floors].sort((left, right): number => left.order - right.order).map((floor) => ({
			backgroundAssetId: floor.backgroundAssetId,
			camera3d: floor.camera3d ? structuredClone(floor.camera3d) : undefined,
			elements: structuredClone(floor.elements),
			height: floor.height,
			id: floor.id,
			unitsPerMeter: floor.unitsPerMeter,
			name: floor.name,
			order: floor.order,
			svg: renderWayfindingFloorSvg(project, floor.id),
			width: floor.width
		})),
		graph: runtimeGraph,
		languages: structuredClone(project.languages ?? [{ code: 'en', label: 'English' }]),
		manifest: {
			deliveryMode,
			generatedAt: project.updatedAt,
			projectId: project.projectId,
			sourceContractVersion: project.contractVersion,
			targetMode: deliveryMode
		}
	};
};

export const synchronizeWayfindingStudioGraph = (project: WayfindingStudioProject): void => {
	const elements: WayfindingStudioElement[] = project.floors.flatMap((floor): WayfindingStudioElement[] => floor.elements);
	const previousManagedIds: Set<string> = new Set(project.graph.nodes.filter((node: WayfindingNode): boolean => Boolean(node.semanticElementId)).map((node: WayfindingNode): string => node.id));
	const manualNodes: WayfindingNode[] = project.graph.nodes.filter((node: WayfindingNode): boolean => !node.semanticElementId);
	const managedNodes: WayfindingNode[] = [];
	const locationById = new Map(elements
		.filter((element): element is WayfindingStudioPolygonElement => element.type === 'location')
		.map((element): [string, WayfindingStudioPolygonElement] => [element.id, element]));
	const primaryDoorByLocationId = new Map<string, WayfindingStudioDoorElement>();
	const canonicalNodeIdByManagedNodeId = new Map<string, string>();

	for (const door of elements.filter((element): element is WayfindingStudioDoorElement => element.type === 'door')) {
		if (!door.locationId || primaryDoorByLocationId.has(door.locationId)) continue;
		const location = locationById.get(door.locationId);

		if (location?.destinationId) primaryDoorByLocationId.set(location.id, door);
	}

	for (const element of elements) {
		if (element.type === 'origin') {
			managedNodes.push({ id: managedNodeId(element.id), kind: 'route', levelId: element.floorId, semanticElementId: element.id, x: element.point.x, y: element.point.y });
		} else if (element.type === 'transition') {
			managedNodes.push({ id: managedNodeId(element.id), kind: 'transition', levelId: element.floorId, semanticElementId: element.id, x: element.point.x, y: element.point.y });
		} else if (element.type === 'poi' && element.destinationId) {
			managedNodes.push({ id: managedNodeId(element.id), kind: 'location', levelId: element.floorId, locationId: element.destinationId, semanticElementId: element.id, x: element.point.x, y: element.point.y });
		} else if (element.type === 'door') {
			const primaryDoor = element.locationId
				? primaryDoorByLocationId.get(element.locationId)
				: undefined;

			if (primaryDoor?.id === element.id) {
				canonicalNodeIdByManagedNodeId.set(
					managedNodeId(element.id),
					managedNodeId(primaryDoor.locationId!)
				);

				continue;
			}
			managedNodes.push({ id: managedNodeId(element.id), kind: 'route', levelId: element.floorId, semanticElementId: element.id, x: element.point.x, y: element.point.y });
		} else if (element.type === 'location' && element.destinationId) {
			const door: WayfindingStudioDoorElement | undefined = primaryDoorByLocationId.get(element.id);
			const anchor: WayfindingPoint = door?.point ?? element.geometry[0] ?? { x: 0, y: 0 };
			managedNodes.push({ id: managedNodeId(element.id), kind: 'location', levelId: element.floorId, locationId: element.destinationId, semanticElementId: element.id, x: anchor.x, y: anchor.y });
		}
	}

	const retainedEdges: WayfindingEdge[] = project.graph.edges
		.filter((edge: WayfindingEdge): boolean => !edge.id.startsWith('semantic-transition:'))
		.map((edge: WayfindingEdge): WayfindingEdge => {
			const from: string = canonicalNodeIdByManagedNodeId.get(edge.from) ?? edge.from;
			const to: string = canonicalNodeIdByManagedNodeId.get(edge.to) ?? edge.to;

			return from === edge.from && to === edge.to
				? edge
				: { ...edge, from, to };
		})
		.filter((edge: WayfindingEdge): boolean => edge.from !== edge.to);
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
