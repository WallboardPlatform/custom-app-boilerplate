import { strFromU8, unzipSync } from 'fflate';

import type {
	RuntimeAsset,
	RuntimeDestination,
	RuntimeFloor,
	RuntimeProjectDefaults,
	WayfindingRuntimeBundle
} from '@interfaces/spatial-wayfinding.interface';
import type { WayfindingGraphDocument } from '@utils/wayfinding';

const FORMAT = 'wallboard-wayfinding-map';

type PublishedAssetDescriptor = Omit<RuntimeAsset, 'bytes' | 'dataUrl'>;

interface PublishedFloorDescriptor extends Omit<RuntimeFloor, 'elements' | 'svg'> {
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
	formatVersion: 1;
	generatedAt: string;
	graphPath: string;
	mapPath: string;
	projectId: string;
	projectName: string;
}

interface PublishedMap {
	assets: PublishedAssetDescriptor[];
	categories: string[];
	defaultLanguage: string;
	defaults: RuntimeProjectDefaults;
	floors: PublishedFloorDescriptor[];
	languages: Array<{ code: string; label: string }>;
	projectId: string;
	projectName: string;
}

interface PublishedScene {
	backgroundAssetId?: string;
	camera3d?: RuntimeFloor['camera3d'];
	elements: RuntimeFloor['elements'];
	height: number;
	id: string;
	name: string;
	order: number;
	unitsPerMeter?: number;
	width: number;
}

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

export const loadWayfindingMapPackage = (archive: Uint8Array): WayfindingRuntimeBundle => {
	const entries: Record<string, Uint8Array> = unzipSync(archive);
	const manifest = parseJson<PublishedManifest>(entries, 'manifest.json');

	if (manifest.format !== FORMAT || manifest.formatVersion !== 1) {
		throw new Error('This app does not support the selected published map version.');
	}

	const map = parseJson<PublishedMap>(entries, manifest.mapPath);
	const destinationDocument = parseJson<{ Destinations?: { rows?: RuntimeDestination[] } }>(
		entries,
		manifest.destinationsPath
	);
	const assets: RuntimeAsset[] = map.assets.map((asset): RuntimeAsset => ({
		...asset,
		bytes: requiredEntry(entries, asset.path),
		dataUrl: bytesToDataUrl(asset.mimeType, requiredEntry(entries, asset.path))
	}));
	const floors: RuntimeFloor[] = map.floors.map((descriptor): RuntimeFloor => {
		const scene = parseJson<PublishedScene>(entries, descriptor.scenePath);

		return {
			backgroundAssetId: scene.backgroundAssetId ?? descriptor.backgroundAssetId,
			camera3d: scene.camera3d ?? descriptor.camera3d,
			elements: scene.elements,
			height: scene.height,
			id: scene.id,
			name: scene.name,
			order: scene.order,
			svg: inlineAssets(strFromU8(requiredEntry(entries, descriptor.svgPath)), assets),
			unitsPerMeter: scene.unitsPerMeter ?? descriptor.unitsPerMeter,
			width: scene.width
		};
	});

	return {
		assets,
		categories: map.categories,
		defaultLanguage: map.defaultLanguage,
		defaults: map.defaults,
		destinations: { Destinations: { rows: destinationDocument.Destinations?.rows ?? [] } },
		format: 'wallboard-wayfinding-runtime',
		formatVersion: 1,
		floors,
		graph: parseJson<WayfindingGraphDocument>(entries, manifest.graphPath),
		languages: map.languages,
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
