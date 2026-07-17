export type MediaFit = 'cover' | 'contain' | 'blur-fill' | 'fill';

export interface MediaFitPolicy {
	foregroundFit: 'cover' | 'contain' | 'fill';
	showBlurBackground: boolean;
}

export type FileSystemMatch = 'filename' | 'filename-stem';

export interface FileSystemMediaRecord {
	name: string;
	url: string;
}

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const parseValue = (value: unknown): unknown => {
	if (typeof value !== 'string') {
		return value;
	}

	try {
		return JSON.parse(value) as unknown;
	} catch {
		return value;
	}
};

const safeMediaUrl = (value: unknown): string => {
	if (typeof value !== 'string') {
		return '';
	}

	const url = value.trim();

	return /^(?:https?:\/\/|data:image\/|blob:|\/)/i.test(url) ? url : '';
};

const fileSystemRows = (value: unknown): unknown[] => {
	const parsed = parseValue(value);

	if (Array.isArray(parsed)) {
		return parsed;
	}

	if (!isRecord(parsed)) {
		return [];
	}

	const content = parseValue(parsed.content);

	return Array.isArray(content) ? content : [];
};

const mediaKey = (value: unknown, match: FileSystemMatch): string => {
	if (typeof value !== 'string') {
		return '';
	}

	const normalized = value.trim().toLowerCase().replace(/\\/g, '/').split('/').pop() ?? '';

	return match === 'filename-stem' ? normalized.replace(/\.[^.]+$/, '') : normalized;
};

export const normalizeFileSystemMedia = (value: unknown): FileSystemMediaRecord[] => {
	return fileSystemRows(value).flatMap((item): FileSystemMediaRecord[] => {
		if (!isRecord(item) || typeof item.name !== 'string') {
			return [];
		}

		const url = safeMediaUrl(item.url) || safeMediaUrl(item.thumbnailUrl) || safeMediaUrl(item.location);

		return url ? [{ name: item.name.trim(), url }] : [];
	});
};

export const buildFileSystemMediaIndex = (
	value: unknown,
	match: FileSystemMatch = 'filename-stem'
): ReadonlyMap<string, FileSystemMediaRecord> => {
	const index = new Map<string, FileSystemMediaRecord>();

	for (const item of normalizeFileSystemMedia(value)) {
		const key = mediaKey(item.name, match);

		if (key && !index.has(key)) {
			index.set(key, item);
		}
	}

	return index;
};

export const findFileSystemMedia = (
	index: ReadonlyMap<string, FileSystemMediaRecord>,
	key: unknown,
	match: FileSystemMatch = 'filename-stem'
): FileSystemMediaRecord | undefined => {
	return index.get(mediaKey(key, match));
};

export const resolveCachedMediaUrl = async (
	value: unknown,
	cacheFile: (url: string) => Promise<string> | string
): Promise<string> => {
	const url = safeMediaUrl(value);

	if (!url || url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('/')) {
		return url;
	}

	try {
		return safeMediaUrl(await cacheFile(url)) || url;
	} catch {
		return url;
	}
};

export const mediaFit = (value: unknown): MediaFit => {
	return value === 'contain' || value === 'blur-fill' || value === 'fill' ? value : 'cover';
};

export const resolveMediaFit = (value: unknown): MediaFitPolicy => {
	const fit: MediaFit = mediaFit(value);

	return {
		foregroundFit: fit === 'blur-fill' ? 'contain' : fit,
		showBlurBackground: fit === 'blur-fill'
	};
};
