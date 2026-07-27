import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

import type { WayfindingGraphDocument } from '../../src/utils/wayfinding.js';
import type { WayfindingGuidanceMode } from './project.mjs';
import {
	renderWayfindingFloorSvg,
	validateWayfindingStudioDelivery,
	wayfindingStudioProjectDefaults,
	type WayfindingRuntimeBundle,
	type WayfindingStudioAsset,
	type WayfindingStudioCamera3d,
	type WayfindingStudioDestination,
	type WayfindingStudioDoorElement,
	type WayfindingStudioElement,
	type WayfindingStudioLanguage,
	type WayfindingStudioMediaElement,
	type WayfindingStudioProject
} from './studio-project.mjs';

export const WAYFINDING_MAP_FORMAT = 'wallboard-wayfinding-map';
export const WAYFINDING_MAP_PACKAGE_EXTENSION = '.wbmap';
export const WAYFINDING_MAP_PACKAGE_MIME_TYPE = 'application/vnd.wallboard.wayfinding-map+zip';

export type WayfindingPublishedAssetKind = 'background' | 'brand' | 'photo' | 'symbol';
export type WayfindingDestinationRepresentation = 'area' | 'point';

export interface WayfindingPublishedAsset {
	id: string;
	kind: WayfindingPublishedAssetKind;
	mimeType: string;
	name: string;
	naturalHeight?: number;
	naturalWidth?: number;
	path: string;
}

export interface WayfindingPublishedDestination extends WayfindingStudioDestination {
	brandAssetIds: string[];
	entranceRefs: Array<{ elementId: string; floorId: string }>;
	geometryRefs: Array<{
		elementId: string;
		floorId: string;
		representation: WayfindingDestinationRepresentation;
	}>;
	symbolAssetIds: string[];
}

export interface WayfindingPublishedFloor {
	backgroundAssetId?: string;
	camera3d?: WayfindingStudioCamera3d;
	height: number;
	id: string;
	name: string;
	order: number;
	scenePath: string;
	svgPath: string;
	/** Map units per real-world metre. Absent means the floor is uncalibrated and route distance has no physical meaning. */
	unitsPerMeter?: number;
	width: number;
}

export interface WayfindingMapDocument {
	assets: WayfindingPublishedAsset[];
	categories: string[];
	defaultLanguage: string;
	defaults: ReturnType<typeof wayfindingStudioProjectDefaults>;
	floors: WayfindingPublishedFloor[];
	languages: WayfindingStudioLanguage[];
	projectId: string;
	projectName: string;
}

export interface WayfindingMapManifest {
	contractVersion: 1;
	defaultLanguage: string;
	deliveryMode: WayfindingGuidanceMode;
	destinationsPath: 'data/destinations.json';
	format: typeof WAYFINDING_MAP_FORMAT;
	generatedAt: string;
	graphPath: 'routes/graph.json';
	mapPath: 'map.json';
	projectId: string;
	projectName: string;
	sourceContractVersion: number;
}

export interface WayfindingMapPackage {
	assets: Array<WayfindingPublishedAsset & { bytes: Uint8Array }>;
	destinations: WayfindingPublishedDestination[];
	floors: Array<WayfindingPublishedFloor & {
		elements: WayfindingStudioElement[];
		svg: string;
	}>;
	graph: WayfindingGraphDocument;
	manifest: WayfindingMapManifest;
	map: WayfindingMapDocument;
}

const MIME_EXTENSION: Record<string, string> = {
	'image/gif': 'gif',
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/svg+xml': 'svg',
	'image/webp': 'webp'
};

const safeSegment = (value: string): string => {
	const normalized: string = value
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-zA-Z0-9._-]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.toLowerCase();

	return normalized || 'item';
};

const jsonBytes = (value: unknown): Uint8Array => strToU8(`${JSON.stringify(value, null, 2)}\n`);

const dataUrlBytes = (dataUrl: string): Uint8Array => {
	const match: RegExpMatchArray | null = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);

	if (!match) throw new Error('Published assets must use valid data URLs.');
	const payload: string = match[3];

	if (!match[2]) return strToU8(decodeURIComponent(payload));
	const binary: string = atob(payload);
	const bytes = new Uint8Array(binary.length);

	for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);

	return bytes;
};

const bytesDataUrl = (mimeType: string, bytes: Uint8Array): string => {
	let binary = '';
	const chunkSize = 0x8000;

	for (let offset = 0; offset < bytes.length; offset += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
	}

	return `data:${mimeType};base64,${btoa(binary)}`;
};

const assetPath = (asset: WayfindingStudioAsset): string => {
	const extension: string = MIME_EXTENSION[asset.mimeType] ?? safeSegment(asset.name.split('.').pop() ?? 'bin');

	return `assets/${safeSegment(asset.id)}.${extension}`;
};

const publishedAssetKind = (kind: WayfindingStudioAsset['kind']): WayfindingPublishedAssetKind => {
	if (kind === 'icon') return 'symbol';

	if (kind === 'logo') return 'brand';

	return kind;
};

const publishedDestinations = (project: WayfindingStudioProject): WayfindingPublishedDestination[] => {
	const allElements: WayfindingStudioElement[] = project.floors.flatMap((floor): WayfindingStudioElement[] => floor.elements);
	const doors: WayfindingStudioDoorElement[] = allElements.filter((element): element is WayfindingStudioDoorElement => element.type === 'door');
	const media: WayfindingStudioMediaElement[] = allElements.filter((element): element is WayfindingStudioMediaElement => element.type === 'icon' || element.type === 'logo');

	return project.destinations.map((destination): WayfindingPublishedDestination => {
		const geometry = allElements.filter((element): boolean =>
			(element.type === 'location' || element.type === 'poi') && element.destinationId === destination.id
		);
		const locationElementIds = new Set(geometry.filter((element): boolean => element.type === 'location').map((element): string => element.id));

		return {
			...structuredClone(destination),
			brandAssetIds: media.filter((element): boolean => element.type === 'logo' && element.destinationId === destination.id).map((element): string => element.assetId),
			entranceRefs: doors
				.filter((door): boolean => Boolean(door.locationId && locationElementIds.has(door.locationId)))
				.map((door): { elementId: string; floorId: string } => ({ elementId: door.id, floorId: door.floorId })),
			geometryRefs: geometry.map((element) => ({
				elementId: element.id,
				floorId: element.floorId,
				representation: element.type === 'poi' ? 'point' : 'area'
			})),
			symbolAssetIds: media.filter((element): boolean => element.type === 'icon' && element.destinationId === destination.id).map((element): string => element.assetId)
		};
	});
};

const runtimeGraph = (project: WayfindingStudioProject): WayfindingGraphDocument => project.delivery.guidance.targetMode === 'route'
	? structuredClone(project.graph)
	: { contractVersion: 2, edges: [], graphId: `${project.graph.graphId}:${project.delivery.guidance.targetMode}`, nodes: [] };

const compileWayfindingMapPackage = (project: WayfindingStudioProject): WayfindingMapPackage => {
	const errors = validateWayfindingStudioDelivery(project).filter((issue): boolean => issue.severity === 'error');

	if (errors.length > 0) throw new Error(errors.map((issue): string => issue.message).join(' '));
	const publishedAssets: Array<WayfindingPublishedAsset & { bytes: Uint8Array }> = project.assets.map((asset) => ({
		id: asset.id,
		kind: publishedAssetKind(asset.kind),
		mimeType: asset.mimeType,
		name: asset.name,
		naturalHeight: asset.naturalHeight,
		naturalWidth: asset.naturalWidth,
		path: assetPath(asset),
		bytes: dataUrlBytes(asset.dataUrl)
	}));
	const assetPaths = new Map(publishedAssets.map((asset): [string, string] => [asset.id, asset.path]));
	const floors = [...project.floors].sort((left, right): number => left.order - right.order).map((floor) => {
		const safeId: string = safeSegment(floor.id);
		const descriptor: WayfindingPublishedFloor = {
			backgroundAssetId: floor.backgroundAssetId,
			camera3d: floor.camera3d ? structuredClone(floor.camera3d) : undefined,
			height: floor.height,
			id: floor.id,
			name: floor.name,
			order: floor.order,
			scenePath: `floors/${safeId}.scene.json`,
			svgPath: `floors/${safeId}.svg`,
			unitsPerMeter: floor.unitsPerMeter,
			width: floor.width
		};

		return {
			...descriptor,
			elements: structuredClone(floor.elements),
			svg: renderWayfindingFloorSvg(project, floor.id, (asset): string => `../${assetPaths.get(asset.id) ?? assetPath(asset)}`)
		};
	});
	const defaultLanguage: string = project.defaultLanguage ?? 'en';
	const manifest: WayfindingMapManifest = {
		contractVersion: 1,
		defaultLanguage,
		deliveryMode: project.delivery.guidance.targetMode,
		destinationsPath: 'data/destinations.json',
		format: WAYFINDING_MAP_FORMAT,
		generatedAt: project.updatedAt,
		graphPath: 'routes/graph.json',
		mapPath: 'map.json',
		projectId: project.projectId,
		projectName: project.name,
		sourceContractVersion: project.contractVersion
	};
	const map: WayfindingMapDocument = {
		assets: publishedAssets.map(({ bytes, ...asset }): WayfindingPublishedAsset => {
			void bytes;

			return asset;
		}),
		categories: structuredClone(project.categories ?? []),
		defaultLanguage,
		defaults: structuredClone(wayfindingStudioProjectDefaults(project)),
		floors: floors.map(({ elements, svg, ...floor }): WayfindingPublishedFloor => {
			void elements;
			void svg;

			return floor;
		}),
		languages: structuredClone(project.languages ?? [{ code: 'en', label: 'English' }]),
		projectId: project.projectId,
		projectName: project.name
	};

	return {
		assets: publishedAssets,
		destinations: publishedDestinations(project),
		floors,
		graph: runtimeGraph(project),
		manifest,
		map
	};
};

export const createWayfindingMapPackage = (project: WayfindingStudioProject): Uint8Array => {
	const compiled: WayfindingMapPackage = compileWayfindingMapPackage(project);
	const entries: Record<string, Uint8Array> = {
		'manifest.json': jsonBytes(compiled.manifest),
		'map.json': jsonBytes(compiled.map),
		'data/destinations.json': jsonBytes({ Destinations: { rows: compiled.destinations } }),
		'routes/graph.json': jsonBytes(compiled.graph)
	};

	for (const floor of compiled.floors) {
		entries[floor.scenePath] = jsonBytes({
			backgroundAssetId: floor.backgroundAssetId,
			camera3d: floor.camera3d,
			elements: floor.elements,
			height: floor.height,
			id: floor.id,
			name: floor.name,
			order: floor.order,
			unitsPerMeter: floor.unitsPerMeter,
			width: floor.width
		});
		entries[floor.svgPath] = strToU8(floor.svg);
	}

	for (const asset of compiled.assets) entries[asset.path] = asset.bytes;

	return zipSync(entries, { level: 6 });
};

const requiredEntry = (entries: Record<string, Uint8Array>, path: string): Uint8Array => {
	const entry: Uint8Array | undefined = entries[path];

	if (!entry) throw new Error(`Published map is missing '${path}'.`);

	return entry;
};

const parseJson = <Value, >(entries: Record<string, Uint8Array>, path: string): Value =>
	JSON.parse(strFromU8(requiredEntry(entries, path))) as Value;

export const parseWayfindingMapPackage = (archive: Uint8Array): WayfindingMapPackage => {
	const entries: Record<string, Uint8Array> = unzipSync(archive);
	const manifest = parseJson<WayfindingMapManifest>(entries, 'manifest.json');

	if (manifest.format !== WAYFINDING_MAP_FORMAT || manifest.contractVersion !== 1) throw new Error('Unsupported published wayfinding map format.');
	const map = parseJson<WayfindingMapDocument>(entries, manifest.mapPath);
	const destinationDocument = parseJson<{ Destinations?: { rows?: WayfindingPublishedDestination[] } }>(entries, manifest.destinationsPath);
	const destinations: WayfindingPublishedDestination[] = destinationDocument.Destinations?.rows ?? [];
	const graph = parseJson<WayfindingGraphDocument>(entries, manifest.graphPath);
	const floors = map.floors.map((floor) => {
		const scene = parseJson<{
			camera3d?: WayfindingStudioCamera3d;
			elements: WayfindingStudioElement[];
		}>(entries, floor.scenePath);

		return {
			...floor,
			camera3d: scene.camera3d ?? floor.camera3d,
			elements: scene.elements,
			svg: strFromU8(requiredEntry(entries, floor.svgPath))
		};
	});
	const assets = map.assets.map((asset) => ({
		...asset,
		bytes: requiredEntry(entries, asset.path)
	}));

	return { assets, destinations, floors, graph, manifest, map };
};

const inlinePackageSvgAssets = (
	svg: string,
	assets: Array<WayfindingPublishedAsset & { bytes: Uint8Array }>
): string => {
	let result: string = svg;

	for (const asset of assets) {
		const relativePath = `../${asset.path}`;
		result = result.replaceAll(relativePath, bytesDataUrl(asset.mimeType, asset.bytes));
	}

	return result;
};

export const wayfindingMapPackageToRuntimeBundle = (archive: Uint8Array): WayfindingRuntimeBundle => {
	const published: WayfindingMapPackage = parseWayfindingMapPackage(archive);
	const assets: WayfindingStudioAsset[] = published.assets.map((asset) => ({
		dataUrl: bytesDataUrl(asset.mimeType, asset.bytes),
		id: asset.id,
		kind: asset.kind === 'symbol' ? 'icon' : asset.kind === 'brand' ? 'logo' : asset.kind,
		mimeType: asset.mimeType,
		name: asset.name,
		naturalHeight: asset.naturalHeight,
		naturalWidth: asset.naturalWidth
	}));

	return {
		assets,
		categories: structuredClone(published.map.categories),
		contractVersion: 1,
		defaultLanguage: published.map.defaultLanguage,
		defaults: structuredClone(published.map.defaults),
		destinations: { Destinations: { rows: structuredClone(published.destinations) } },
		floors: published.floors.map((floor) => ({
			backgroundAssetId: floor.backgroundAssetId,
			camera3d: floor.camera3d ? structuredClone(floor.camera3d) : undefined,
			elements: structuredClone(floor.elements),
			height: floor.height,
			id: floor.id,
			name: floor.name,
			order: floor.order,
			svg: inlinePackageSvgAssets(floor.svg, published.assets),
			unitsPerMeter: floor.unitsPerMeter,
			width: floor.width
		})),
		graph: structuredClone(published.graph),
		languages: structuredClone(published.map.languages),
		manifest: {
			deliveryMode: published.manifest.deliveryMode,
			generatedAt: published.manifest.generatedAt,
			projectId: published.manifest.projectId,
			sourceContractVersion: published.manifest.sourceContractVersion,
			targetMode: published.manifest.deliveryMode
		}
	};
};
