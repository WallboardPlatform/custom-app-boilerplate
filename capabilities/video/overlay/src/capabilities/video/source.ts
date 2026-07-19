import type { ApiService, CONTENT_TYPES, WBFileData } from 'wallboard-app-sdk';

import type { VideoCaptionTrack, VideoSource } from './types';

const isRecord = (value: unknown): value is Record<string, unknown> => {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const text = (value: unknown): string => {
	return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
};

const firstText = (record: Record<string, unknown>, keys: string[]): string => {
	for (const key of keys) {
		const value: string = text(record[key]);

		if (value) return value;
	}

	return '';
};

const safeUrl = (value: unknown): string => {
	const url: string = text(value);

	if (!url || /^javascript:/i.test(url)) return '';

	return url;
};

const fileNameFromUrl = (url: string): string => {
	const path: string = url.split(/[?#]/)[0];
	const fileName: string = path.split('/').pop() ?? '';

	try {
		return decodeURIComponent(fileName) || 'Video';
	} catch {
		return fileName || 'Video';
	}
};

const normalizeCaptions = (value: unknown): VideoCaptionTrack[] => {
	if (!Array.isArray(value)) return [];

	return value.flatMap((item: unknown, index: number): VideoCaptionTrack[] => {
		if (!isRecord(item)) return [];

		const src: string = safeUrl(firstText(item, ['src', 'url', 'location', 'cacheCheckedSource']));

		if (!src) return [];

		return [{
			default: item.default === true,
			label: firstText(item, ['label', 'name', 'title']) || `Captions ${index + 1}`,
			language: firstText(item, ['language', 'lang', 'srclang']) || 'en',
			src
		}];
	});
};

export const normalizeVideoSelection = (value: unknown, fallbackId = 'video'): VideoSource | undefined => {
	if (typeof value === 'string') {
		const url: string = safeUrl(value);

		return url ? { id: fallbackId, name: fileNameFromUrl(url), url } : undefined;
	}

	if (!isRecord(value)) return undefined;

	const url: string = safeUrl(firstText(value, ['cacheCheckedSource', 'location', 'url', 'src', 'filePath', 'path']));

	if (!url) return undefined;

	return {
		captions: normalizeCaptions(value.captions ?? value.tracks),
		id: firstText(value, ['id', 'fileId', 'uuid', 'key']) || fallbackId,
		name: firstText(value, ['name', 'fileName', 'title', 'label']) || fileNameFromUrl(url),
		poster: safeUrl(firstText(value, ['poster', 'posterUrl', 'thumbnail', 'image'])),
		type: firstText(value, ['type', 'mimeType', 'contentType']) || undefined,
		url
	};
};

const parseSerialized = (value: unknown): unknown => {
	if (typeof value !== 'string') return value;

	try {
		return JSON.parse(value) as unknown;
	} catch {
		return value;
	}
};

export const normalizeVideoPlaylist = (value: unknown): VideoSource[] => {
	const parsed: unknown = parseSerialized(value);
	let items: unknown[] = [];

	if (Array.isArray(parsed)) items = parsed;
	else if (isRecord(parsed)) {
		for (const key of ['videos', 'items', 'rows', 'data', 'content']) {
			const candidate: unknown = parseSerialized(parsed[key]);

			if (Array.isArray(candidate)) {
				items = candidate;
				break;
			}
		}

		if (items.length === 0) items = [parsed];
	} else if (typeof parsed === 'string') items = [parsed];

	const seen = new Set<string>();

	return items.flatMap((item: unknown, index: number): VideoSource[] => {
		const source: VideoSource | undefined = normalizeVideoSelection(item, `video-${index + 1}`);

		if (!source || seen.has(source.url)) return [];
		seen.add(source.url);

		return [source];
	});
};

export const normalizeFolderId = (value: unknown): string => {
	if (typeof value === 'string' || typeof value === 'number') return text(value);
	if (!isRecord(value)) return '';

	return firstText(value, ['id', 'folderId', 'uuid', 'value']);
};

const cacheSource = async (api: ApiService, source: VideoSource): Promise<VideoSource> => {
	const cache = async (url: string): Promise<string> => {
		if (!url || url.startsWith('data:') || url.startsWith('blob:')) return url;

		try {
			return (await api.cacheFile(url)) || url;
		} catch {
			return url;
		}
	};

	return {
		...source,
		captions: await Promise.all((source.captions ?? []).map(async (track): Promise<VideoCaptionTrack> => ({
			...track,
			src: await cache(track.src)
		}))),
		poster: source.poster ? await cache(source.poster) : undefined,
		url: await cache(source.url)
	};
};

export interface ResolveVideoSourcesOptions {
	api: ApiService;
	directSource?: unknown;
	fallbackSources?: VideoSource[];
	folder?: unknown;
	playlist?: unknown;
	recursive?: boolean;
	sourceMode: 'file' | 'folder' | 'playlist';
}

export const resolveVideoSources = async (options: ResolveVideoSourcesOptions): Promise<VideoSource[]> => {
	let sources: VideoSource[] = [];

	if (options.sourceMode === 'folder') {
		const folderId: string = normalizeFolderId(options.folder);

		if (folderId) {
			const files: WBFileData[] = await options.api.getFilesFromFolder(
				folderId,
				'VIDEO' as CONTENT_TYPES,
				options.recursive ?? true
			);
			sources = files
				.map((file: WBFileData, index: number): VideoSource | undefined => normalizeVideoSelection(file, `folder-video-${index + 1}`))
				.filter((source: VideoSource | undefined): source is VideoSource => Boolean(source))
				.sort((left: VideoSource, right: VideoSource): number => left.name.localeCompare(right.name));
		}
	} else if (options.sourceMode === 'playlist') {
		sources = normalizeVideoPlaylist(options.playlist);
	} else {
		const source: VideoSource | undefined = normalizeVideoSelection(options.directSource);
		if (source) sources = [source];
	}

	if (sources.length === 0) sources = options.fallbackSources ?? [];

	return Promise.all(sources.map((source: VideoSource): Promise<VideoSource> => cacheSource(options.api, source)));
};

export const isHlsSource = (source: VideoSource | undefined): boolean => {
	return Boolean(source && (/\.m3u8(?:$|[?#])/i.test(source.url) || /mpegurl/i.test(source.type ?? '')));
};
