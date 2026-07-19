import { getPdfJs } from './pdfjs';
import type {
	LoadedPdfCollection,
	PdfDocumentProxy,
	PdfJsLibrary,
	PdfLoadingTask,
	PdfOutlineItem,
	PdfPageDescriptor,
	PdfSearchMatch,
	PdfSource,
	PdfTextContent
} from './types';

const isRecord = (value: unknown): value is Record<string, unknown> => {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const flattenOutline = (
	items: unknown[] | null,
	documentIndex: number,
	level = 0,
	prefix = 'outline'
): PdfOutlineItem[] => {
	if (!items) return [];

	return items.flatMap((value: unknown, index: number): PdfOutlineItem[] => {
		if (!isRecord(value)) return [];

		const title: string = typeof value.title === 'string' ? value.title.trim() : '';
		const id: string = `${prefix}-${documentIndex}-${index}`;
		const current: PdfOutlineItem[] =
			title && value.dest ? [{ destination: value.dest, documentIndex, id, level, title }] : [];
		const children: unknown[] | null = Array.isArray(value.items) ? value.items : null;

		return [...current, ...flattenOutline(children, documentIndex, level + 1, id)];
	});
};

const normalizeSearchText = (value: string): string => value.replace(/\s+/g, ' ').trim();

const countMatches = (value: string, query: string): number => {
	let count = 0;
	let index = 0;

	while ((index = value.indexOf(query, index)) !== -1) {
		count += 1;
		index += Math.max(1, query.length);
	}

	return count;
};

export class PdfDocumentStore {
	private collection: LoadedPdfCollection | undefined;
	private readonly pdfjs: PdfJsLibrary = getPdfJs();
	private readonly textCache = new Map<string, string>();

	public async load(sources: PdfSource[]): Promise<LoadedPdfCollection> {
		await this.destroy();

		const loadingTasks: PdfLoadingTask[] = [];
		const documents: PdfDocumentProxy[] = [];
		const pages: PdfPageDescriptor[] = [];
		const outlines: PdfOutlineItem[] = [];

		try {
			for (const [documentIndex, source] of sources.entries()) {
				const loadingTask: PdfLoadingTask = this.pdfjs.getDocument({
					password: source.password,
					url: source.url,
					withCredentials: false
				});
				loadingTasks.push(loadingTask);
				const document: PdfDocumentProxy = await loadingTask.promise;
				documents.push(document);
				outlines.push(...flattenOutline(await document.getOutline(), documentIndex));

				for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
					const page = await document.getPage(pageNumber);
					const viewport = page.getViewport({ scale: 1 });
					pages.push({
						documentIndex,
						documentName: source.name,
						globalIndex: pages.length,
						height: viewport.height,
						id: `${source.id}-${pageNumber}`,
						pageNumber,
						pdfDocument: document,
						source,
						width: viewport.width
					});
					page.cleanup();
				}
			}
		} catch (error) {
			for (const task of loadingTasks) task.destroy();

			for (const document of documents) await document.destroy().catch((): void => undefined);

			throw error;
		}

		this.collection = { documents, loadingTasks, outlines, pages, sources };

		return this.collection;
	}

	public getCollection(): LoadedPdfCollection | undefined {
		return this.collection;
	}

	public async resolveOutline(item: PdfOutlineItem): Promise<number | undefined> {
		const collection: LoadedPdfCollection | undefined = this.collection;
		const document: PdfDocumentProxy | undefined = collection?.documents[item.documentIndex];

		if (!collection || !document) return undefined;

		const destination: unknown[] | null =
			typeof item.destination === 'string'
				? await document.getDestination(item.destination)
				: Array.isArray(item.destination)
					? item.destination
					: null;

		if (!destination || destination.length === 0) return undefined;

		const pageIndex: number =
			typeof destination[0] === 'number' ? destination[0] : await document.getPageIndex(destination[0]);
		const page: PdfPageDescriptor | undefined = collection.pages.find((candidate: PdfPageDescriptor): boolean => {
			return candidate.documentIndex === item.documentIndex && candidate.pageNumber === pageIndex + 1;
		});

		return page?.globalIndex;
	}

	public async search(queryValue: string): Promise<PdfSearchMatch[]> {
		const collection: LoadedPdfCollection | undefined = this.collection;
		const query: string = normalizeSearchText(queryValue).toLocaleLowerCase();

		if (!collection || !query) return [];

		const matches: PdfSearchMatch[] = [];

		for (const descriptor of collection.pages) {
			let pageText: string | undefined = this.textCache.get(descriptor.id);

			if (pageText === undefined) {
				const page = await descriptor.pdfDocument.getPage(descriptor.pageNumber);
				const content: PdfTextContent = await page.getTextContent();
				pageText = normalizeSearchText(content.items.map((item) => item.str ?? '').join(' '));
				this.textCache.set(descriptor.id, pageText);
				page.cleanup();
			}

			const normalizedPageText: string = pageText.toLocaleLowerCase();
			const occurrenceCount: number = countMatches(normalizedPageText, query);

			if (occurrenceCount === 0) continue;

			const firstIndex: number = normalizedPageText.indexOf(query);
			const previewStart: number = Math.max(0, firstIndex - 48);
			const previewEnd: number = Math.min(pageText.length, firstIndex + query.length + 72);
			const preview: string = pageText.slice(previewStart, previewEnd);

			for (let occurrence = 1; occurrence <= occurrenceCount; occurrence += 1) {
				matches.push({
					documentIndex: descriptor.documentIndex,
					globalPageIndex: descriptor.globalIndex,
					occurrence,
					pageNumber: descriptor.pageNumber,
					preview,
					query: queryValue
				});
			}
		}

		return matches;
	}

	public async destroy(): Promise<void> {
		const collection: LoadedPdfCollection | undefined = this.collection;
		this.collection = undefined;
		this.textCache.clear();

		if (!collection) return;

		for (const task of collection.loadingTasks) task.destroy();

		for (const document of collection.documents) await document.destroy().catch((): void => undefined);
	}
}
