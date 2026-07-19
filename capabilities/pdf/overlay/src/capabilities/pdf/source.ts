import { CONTENT_TYPES } from 'wallboard-app-sdk';
import type { ApiService, WBFileData } from 'wallboard-app-sdk';

import type { PdfSource } from './types';

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

const fileNameFromUrl = (url: string): string => {
	const path: string = url.split(/[?#]/)[0];
	const fileName: string = path.split('/').pop() ?? '';

	try {
		return decodeURIComponent(fileName) || 'PDF document';
	} catch {
		return fileName || 'PDF document';
	}
};

export const normalizePdfSelection = (value: unknown, fallbackId = 'pdf-file'): PdfSource | undefined => {
	if (typeof value === 'string') {
		const url: string = value.trim();

		return url ? { id: fallbackId, name: fileNameFromUrl(url), url } : undefined;
	}

	if (!isRecord(value)) return undefined;

	const url: string = firstText(value, ['cacheCheckedSource', 'location', 'url', 'src', 'filePath', 'path']);

	if (!url) return undefined;

	return {
		id: firstText(value, ['id', 'fileId', 'uuid']) || fallbackId,
		name: firstText(value, ['name', 'fileName', 'title']) || fileNameFromUrl(url),
		password: firstText(value, ['password']) || undefined,
		url
	};
};

export const normalizeFolderId = (value: unknown): string => {
	if (typeof value === 'string' || typeof value === 'number') return text(value);

	if (!isRecord(value)) return '';

	return firstText(value, ['id', 'folderId', 'uuid', 'value']);
};

const fromFolderFile = (file: WBFileData, index: number): PdfSource | undefined => {
	return normalizePdfSelection(file, `pdf-folder-file-${index + 1}`);
};

const cacheSource = async (api: ApiService, source: PdfSource): Promise<PdfSource> => {
	try {
		return { ...source, url: (await api.cacheFile(source.url)) || source.url };
	} catch {
		return source;
	}
};

export interface ResolvePdfSourcesOptions {
	api: ApiService;
	directFile?: unknown;
	fallbackSources?: PdfSource[];
	folder?: unknown;
	password?: string;
	recursive?: boolean;
	sourceMode: 'file' | 'folder';
}

export const resolvePdfSources = async (options: ResolvePdfSourcesOptions): Promise<PdfSource[]> => {
	let sources: PdfSource[] = [];

	if (options.sourceMode === 'folder') {
		const folderId: string = normalizeFolderId(options.folder);

		if (folderId) {
			const files: WBFileData[] = await options.api.getFilesFromFolder(
				folderId,
				CONTENT_TYPES.PDF,
				options.recursive ?? true
			);
			sources = files
				.map(fromFolderFile)
				.filter((source: PdfSource | undefined): source is PdfSource => Boolean(source))
				.sort((left: PdfSource, right: PdfSource): number => left.name.localeCompare(right.name));
		}
	} else {
		const source: PdfSource | undefined = normalizePdfSelection(options.directFile);

		if (source) sources = [source];
	}

	if (sources.length === 0) sources = options.fallbackSources ?? [];

	const password: string = options.password?.trim() ?? '';

	return Promise.all(
		sources.map(async (source: PdfSource): Promise<PdfSource> => {
			return cacheSource(options.api, { ...source, password: source.password || password || undefined });
		})
	);
};
