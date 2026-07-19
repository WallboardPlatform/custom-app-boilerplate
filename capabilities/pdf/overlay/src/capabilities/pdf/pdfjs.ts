import pdfJsModule from './vendor/pdf.min.js';
import pdfWorkerUrl from './vendor/pdf.worker.min.js?url';

import type { PdfJsLibrary } from './types';

const isPdfJsLibrary = (value: unknown): value is PdfJsLibrary => {
	return value !== null && typeof value === 'object' && 'GlobalWorkerOptions' in value && 'getDocument' in value;
};

const moduleDefault: unknown =
	typeof pdfJsModule === 'object' && pdfJsModule !== null && 'default' in pdfJsModule
		? pdfJsModule.default
		: undefined;
const invalidRuntime = (): never => {
	throw new Error('Invalid PDF.js runtime.');
};
const pdfjs: PdfJsLibrary = isPdfJsLibrary(pdfJsModule)
	? pdfJsModule
	: isPdfJsLibrary(moduleDefault)
		? moduleDefault
		: invalidRuntime();

const resolveWorkerUrl = (): string => {
	const scriptSource: string = (document.currentScript as HTMLScriptElement | null)?.src ?? '';

	if (scriptSource) {
		return `${scriptSource.slice(0, scriptSource.lastIndexOf('/') + 1)}pdf.worker.js`;
	}

	return pdfWorkerUrl;
};

pdfjs.GlobalWorkerOptions.workerSrc = resolveWorkerUrl();

export const getPdfJs = (): PdfJsLibrary => pdfjs;
export const PDF_JS_VERSION: string = pdfjs.version;
