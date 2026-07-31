import { strFromU8, unzipSync } from 'fflate';

import type {
	RuntimeAsset,
	RuntimeDestination,
	RuntimeLevel,
	RuntimeProjectDefaults,
	WayfindingRuntimeBundle
} from '@interfaces/spatial-wayfinding.interface';
import type { WayfindingGraphDocument } from '@utils/wayfinding';

const FORMAT = 'wallboard-wayfinding-map';
const DEFAULT_ORIGIN_MARKER_SIZE_2D = 28;
const DEFAULT_ORIGIN_MARKER_SIZE_3D = 46;

type PublishedAssetDescriptor = Omit<RuntimeAsset, 'bytes' | 'dataUrl'>;

interface PublishedLevelDescriptor extends Omit<RuntimeLevel, 'elements' | 'svg' | 'role'> {
	role?: RuntimeLevel['role'];
	scenePath: string;
	svgPath: string;
}

interface PublishedManifest {
	capabilities: {
		routing: boolean;
		stepFreeRouting: boolean;
	};
	defaultLanguage: string;
	destinationsPath: string;
	format: typeof FORMAT;
	formatVersion: 1 | 2;
	generatedAt: string;
	graphPath: string;
	mapPath: string;
	projectId: string;
	projectName: string;
}

interface PublishedMapBase {
	assets: PublishedAssetDescriptor[];
	categories: string[];
	defaultLanguage: string;
	defaults: RuntimeProjectDefaults;
	languages: Array<{ code: string; label: string }>;
	projectId: string;
	projectName: string;
}

interface PublishedMapV1 extends PublishedMapBase {
	floors: PublishedLevelDescriptor[];
}

interface PublishedMapV2 extends PublishedMapBase {
	buildings: WayfindingRuntimeBundle['buildings'];
	connectors: WayfindingRuntimeBundle['connectors'];
	levels: PublishedLevelDescriptor[];
	presentation: WayfindingRuntimeBundle['presentation'];
	siteLevelId?: string;
}

interface PublishedScene {
	alignment?: RuntimeLevel['alignment'];
	backgroundAssetId?: string;
	buildingId?: string;
	camera3d?: RuntimeLevel['camera3d'];
	elements: RuntimeLevel['elements'];
	elevationMeters?: number;
	height: number;
	id: string;
	levelNumber?: number;
	name: string;
	order: number;
	role?: RuntimeLevel['role'];
	unitsPerMeter?: number;
	width: number;
}

type PublishedDestination = Omit<RuntimeDestination, 'entranceRefs' | 'geometryRefs' | 'levelId'> & {
	entranceRefs?: Array<{ elementId: string; floorId?: string; levelId?: string }>;
	floor?: string;
	geometryRefs?: Array<{
		elementId: string;
		floorId?: string;
		levelId?: string;
		representation: 'area' | 'point';
	}>;
	levelId?: string;
};

const requiredEntry = (entries: Record<string, Uint8Array>, path: string): Uint8Array => {
	const entry: Uint8Array | undefined = entries[path];

	if (!entry) throw new Error(`The published map is missing ${path}.`);

	return entry;
};

const parseJson = <Value, >(entries: Record<string, Uint8Array>, path: string): Value =>
	JSON.parse(strFromU8(requiredEntry(entries, path))) as Value;

const bytesToDataUrl = (mimeType: string, bytes: Uint8Array): string => {
	let binary = '';
	const chunkSize = 0x8000;

	for (let offset = 0; offset < bytes.length; offset += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
	}

	return `data:${mimeType};base64,${btoa(binary)}`;
};

const inlineAssets = (svg: string, assets: RuntimeAsset[]): string => {
	let result: string = svg;

	for (const asset of assets) {
		result = result.replaceAll(`../${asset.path}`, bytesToDataUrl(asset.mimeType, asset.bytes));
	}

	return result;
};

const normalizeProjectDefaults = (
	defaults: RuntimeProjectDefaults,
	assets: RuntimeAsset[]
): RuntimeProjectDefaults => {
	const markerAssetId: string | undefined = defaults.origin.markerAssetId;

	if (
		markerAssetId
		&& !assets.some((asset): boolean => asset.id === markerAssetId && asset.kind === 'symbol')
	) {
		throw new Error(`The published You are here marker '${markerAssetId}' is missing or is not a symbol asset.`);
	}

	return {
		...defaults,
		origin: {
			...defaults.origin,
			markerSize2d: Math.max(20, Math.min(96, defaults.origin.markerSize2d ?? DEFAULT_ORIGIN_MARKER_SIZE_2D)),
			markerSize3d: Math.max(28, Math.min(120, defaults.origin.markerSize3d ?? DEFAULT_ORIGIN_MARKER_SIZE_3D))
		}
	};
};

export const loadWayfindingMapPackage = (archive: Uint8Array): WayfindingRuntimeBundle => {
	const entries: Record<string, Uint8Array> = unzipSync(archive);
	const manifest = parseJson<PublishedManifest>(entries, 'manifest.json');

	if (manifest.format !== FORMAT || ![1, 2].includes(manifest.formatVersion)) {
		throw new Error('This app does not support the selected published map version.');
	}

	const map = parseJson<PublishedMapV1 | PublishedMapV2>(entries, manifest.mapPath);
	const destinationDocument = parseJson<{ Destinations?: { rows?: PublishedDestination[] } }>(
		entries,
		manifest.destinationsPath
	);
	const assets: RuntimeAsset[] = map.assets.map((asset): RuntimeAsset => ({
		...asset,
		bytes: requiredEntry(entries, asset.path),
		dataUrl: bytesToDataUrl(asset.mimeType, requiredEntry(entries, asset.path))
	}));
	const descriptors = 'levels' in map ? map.levels : map.floors;
	const levels: RuntimeLevel[] = descriptors.map((descriptor): RuntimeLevel => {
		const scene = parseJson<PublishedScene>(entries, descriptor.scenePath);
		const normalizeElement = (element: RuntimeLevel['elements'][number]): RuntimeLevel['elements'][number] => {
			const legacy = element as RuntimeLevel['elements'][number] & { floorId?: string };
			const normalized = { ...legacy, levelId: legacy.levelId ?? legacy.floorId ?? scene.id };
			delete normalized.floorId;

			return normalized;
		};

		return {
			alignment: scene.alignment ?? descriptor.alignment,
			backgroundAssetId: scene.backgroundAssetId ?? descriptor.backgroundAssetId,
			buildingId: scene.buildingId ?? descriptor.buildingId,
			camera3d: scene.camera3d ?? descriptor.camera3d,
			elements: scene.elements.map(normalizeElement),
			elevationMeters: scene.elevationMeters ?? descriptor.elevationMeters,
			height: scene.height,
			id: scene.id,
			levelNumber: scene.levelNumber ?? descriptor.levelNumber,
			name: scene.name,
			order: scene.order,
			role: scene.role ?? descriptor.role ?? 'standalone',
			svg: inlineAssets(strFromU8(requiredEntry(entries, descriptor.svgPath)), assets),
			unitsPerMeter: scene.unitsPerMeter ?? descriptor.unitsPerMeter,
			width: scene.width
		};
	});
	const destinations = (destinationDocument.Destinations?.rows ?? []).map((destination): RuntimeDestination => ({
		...destination,
		entranceRefs: destination.entranceRefs?.map((reference) => ({ elementId: reference.elementId, levelId: reference.levelId ?? reference.floorId ?? '' })),
		geometryRefs: destination.geometryRefs?.map((reference) => ({ elementId: reference.elementId, levelId: reference.levelId ?? reference.floorId ?? '', representation: reference.representation })),
		levelId: destination.levelId ?? destination.floor
	}));
	const v2 = 'levels' in map ? map : undefined;

	return {
		assets,
		buildings: v2?.buildings ?? [],
		categories: map.categories,
		connectors: v2?.connectors ?? [],
		defaultLanguage: map.defaultLanguage,
		defaults: normalizeProjectDefaults(map.defaults, assets),
		destinations: { Destinations: { rows: destinations } },
		format: 'wallboard-wayfinding-runtime',
		formatVersion: 2,
		levels,
		graph: parseJson<WayfindingGraphDocument>(entries, manifest.graphPath),
		languages: map.languages,
		presentation: v2?.presentation ?? {
			buildingTapBehavior: 'focus-actions',
			defaultOverviewMode: 'site',
			enabledOverviewModes: ['site']
		},
		siteLevelId: v2?.siteLevelId,
		manifest: {
			capabilities: manifest.capabilities,
			generatedAt: manifest.generatedAt,
			projectId: manifest.projectId,
			projectName: manifest.projectName
		}
	};
};

export const fetchWayfindingMapPackage = async (url: string): Promise<WayfindingRuntimeBundle> => {
	const response: Response = await fetch(url);

	if (!response.ok) throw new Error(`Published map request failed (${response.status}).`);

	return loadWayfindingMapPackage(new Uint8Array(await response.arrayBuffer()));
};
