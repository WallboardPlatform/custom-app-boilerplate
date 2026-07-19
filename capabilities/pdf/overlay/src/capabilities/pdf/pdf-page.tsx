import { createEffect, onCleanup, onMount } from 'solid-js';
import type { JSX } from 'solid-js';

import { createPdfDownloadManager, createPdfLinkService } from './link-service';
import { getPdfJs } from './pdfjs';
import annotationCheckUrl from './images/annotation-check.svg?url';
import annotationCommentUrl from './images/annotation-comment.svg?url';
import annotationHelpUrl from './images/annotation-help.svg?url';
import annotationInsertUrl from './images/annotation-insert.svg?url';
import annotationKeyUrl from './images/annotation-key.svg?url';
import annotationNewParagraphUrl from './images/annotation-newparagraph.svg?url';
import annotationNoIconUrl from './images/annotation-noicon.svg?url';
import annotationNoteUrl from './images/annotation-note.svg?url';
import annotationParagraphUrl from './images/annotation-paragraph.svg?url';
import type {
	PdfInteractionEvent,
	PdfJsLibrary,
	PdfPageDescriptor,
	PdfPageLayout,
	PdfPageProxy,
	PdfRenderTask,
	PdfTextContent,
	PdfViewerOptions,
	PdfViewport
} from './types';

import style from './pdf-viewer.module.scss';

export interface PdfPageProps {
	active: boolean;
	descriptor: PdfPageDescriptor;
	formValues: Map<string, string | string[]>;
	layout: PdfPageLayout;
	navigateTo(destination: unknown): void;
	onInteraction?(event: PdfInteractionEvent): void;
	options: PdfViewerOptions;
	searchQuery: string;
}

const highlightTextLayer = (container: HTMLElement, query: string): void => {
	const normalizedQuery: string = query.trim().toLocaleLowerCase();

	for (const span of Array.from(container.querySelectorAll('span'))) {
		span.classList.toggle(
			'pdf-search-highlight',
			Boolean(normalizedQuery) && (span.textContent ?? '').toLocaleLowerCase().includes(normalizedQuery)
		);
	}
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const readFormControlValue = (
	control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
): string | string[] => {
	if (control instanceof HTMLInputElement && (control.type === 'checkbox' || control.type === 'radio')) {
		return control.checked ? control.value || 'true' : '';
	}

	if (control instanceof HTMLSelectElement && control.multiple) {
		return Array.from(control.selectedOptions).map((option: HTMLOptionElement): string => option.value);
	}

	return control.value;
};

const restoreFormControlValue = (
	control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
	value: string | string[]
): void => {
	if (control instanceof HTMLInputElement && (control.type === 'checkbox' || control.type === 'radio')) {
		control.checked = Array.isArray(value) ? value.includes(control.value) : value === (control.value || 'true');

		return;
	}

	if (control instanceof HTMLSelectElement && control.multiple) {
		const selectedValues: string[] = Array.isArray(value) ? value : [value];

		for (const option of Array.from(control.options)) {
			option.selected = selectedValues.includes(option.value);
		}

		return;
	}

	control.value = Array.isArray(value) ? value[0] ?? '' : value;
};

const identifyFormControls = (
	container: HTMLElement,
	annotations: unknown[],
	formValues: Map<string, string | string[]>
): void => {
	const controls = Array.from(
		container.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea')
	);
	const fields = annotations.filter((annotation: unknown): annotation is Record<string, unknown> => {
		return isRecord(annotation) && typeof annotation.fieldName === 'string' && annotation.fieldName.trim().length > 0;
	});

	for (const [index, field] of fields.entries()) {
		const fieldName: string = String(field.fieldName).trim();
		const annotationId: string = typeof field.id === 'string' ? field.id : '';
		const section: HTMLElement | undefined = annotationId
			? Array.from(container.querySelectorAll<HTMLElement>('[data-annotation-id]')).find(
					(element: HTMLElement): boolean => element.dataset.annotationId === annotationId
				)
			: undefined;
		const control = section?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
			'input, select, textarea'
		) ?? controls[index];

		if (!control) {
			continue;
		}

		control.name = fieldName;
		control.dataset.elementId = fieldName;

		if (!control.id) {
			control.id = `pdf-field-${fieldName.replace(/[^a-z0-9_-]+/gi, '-')}`;
		}

		const storedValue: string | string[] | undefined = formValues.get(fieldName);

		if (storedValue !== undefined) {
			restoreFormControlValue(control, storedValue);
		}
	}
};

const annotationImages = new Map<string, string>([
	['annotation-check.svg', annotationCheckUrl],
	['annotation-comment.svg', annotationCommentUrl],
	['annotation-help.svg', annotationHelpUrl],
	['annotation-insert.svg', annotationInsertUrl],
	['annotation-key.svg', annotationKeyUrl],
	['annotation-newparagraph.svg', annotationNewParagraphUrl],
	['annotation-noicon.svg', annotationNoIconUrl],
	['annotation-note.svg', annotationNoteUrl],
	['annotation-paragraph.svg', annotationParagraphUrl]
]);

const hydrateAnnotationImages = (container: HTMLElement): void => {
	for (const image of Array.from(container.querySelectorAll<HTMLImageElement>('img'))) {
		const source: string = image.getAttribute('src') ?? '';
		const fileName: string = source.slice(source.lastIndexOf('/') + 1);
		const bundledUrl: string | undefined = annotationImages.get(fileName);

		if (bundledUrl) image.src = bundledUrl;
	}
};

export default (props: PdfPageProps): JSX.Element => {
	const pdfjs: PdfJsLibrary = getPdfJs();
	let container!: HTMLDivElement;
	let renderTask: PdfRenderTask | undefined;
	let textRenderTask: { cancel?(): void } | undefined;
	let renderedPage: PdfPageProxy | undefined;
	let generation = 0;

	const clear = (): void => {
		generation += 1;
		renderTask?.cancel();
		textRenderTask?.cancel?.();
		renderTask = undefined;
		textRenderTask = undefined;
		renderedPage?.cleanup();
		renderedPage = undefined;

		if (container) container.replaceChildren();
	};

	const renderActivePage = async (currentGeneration: number): Promise<void> => {
		const page: PdfPageProxy = await props.descriptor.pdfDocument.getPage(props.descriptor.pageNumber);

		if (currentGeneration !== generation) {
			page.cleanup();

			return;
		}

		renderedPage = page;
		const viewport: PdfViewport = page.getViewport({ scale: props.layout.renderScale });
		const deviceScale: number = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
		const canvas: HTMLCanvasElement = document.createElement('canvas');
		canvas.className = 'pdf-canvas';
		canvas.width = Math.max(1, Math.round(props.layout.width * deviceScale));
		canvas.height = Math.max(1, Math.round(props.layout.height * deviceScale));
		canvas.style.width = `${props.layout.width}px`;
		canvas.style.height = `${props.layout.height}px`;
		const context: CanvasRenderingContext2D | null = canvas.getContext('2d', { alpha: false });

		if (!context) throw new Error('The browser could not create a PDF canvas context.');
		context.fillStyle = '#ffffff';
		context.fillRect(0, 0, canvas.width, canvas.height);
		container.appendChild(canvas);

		renderTask = page.render({
			canvasContext: context,
			transform: [deviceScale * props.layout.transformWidth, 0, 0, deviceScale * props.layout.transformHeight, 0, 0],
			viewport
		});

		try {
			await renderTask.promise;
		} catch (error) {
			if ((error as { name?: string }).name !== 'RenderingCancelledException') throw error;

			return;
		}

		if (currentGeneration !== generation) return;

		if (props.options.renderTextLayer) {
			const textLayer: HTMLDivElement = document.createElement('div');
			textLayer.className = 'textLayer';
			textLayer.style.width = `${props.layout.renderedWidth}px`;
			textLayer.style.height = `${props.layout.renderedHeight}px`;
			textLayer.style.transform = `scale(${props.layout.transformWidth}, ${props.layout.transformHeight})`;
			container.appendChild(textLayer);
			const textContent: PdfTextContent = await page.getTextContent();
			const task = pdfjs.renderTextLayer({
				container: textLayer,
				enhanceTextSelection: true,
				textContent,
				textDivs: [],
				viewport
			});
			textRenderTask = task;
			await task.promise?.catch((): void => undefined);
			highlightTextLayer(textLayer, props.searchQuery);
		}

		if (props.options.interactiveAnnotations || props.options.renderForms) {
			const annotations: unknown[] = await page.getAnnotations({ intent: 'display' });

			if (annotations.length > 0 && currentGeneration === generation) {
				const annotationLayer: HTMLDivElement = document.createElement('div');
				annotationLayer.className = 'annotationLayer';
				annotationLayer.style.width = `${props.layout.renderedWidth}px`;
				annotationLayer.style.height = `${props.layout.renderedHeight}px`;
				annotationLayer.style.transform = `scale(${props.layout.transformWidth}, ${props.layout.transformHeight})`;
				annotationLayer.addEventListener('click', (event: MouseEvent): void => {
					const anchor: HTMLAnchorElement | null = (event.target as HTMLElement).closest('a');

					if (anchor?.href) {
						props.onInteraction?.({
							documentIndex: props.descriptor.documentIndex,
							documentName: props.descriptor.documentName,
							pageNumber: props.descriptor.pageNumber,
							type: 'link',
							value: anchor.href
						});
					}
				});
				const preserveFormValue = (event: Event): void => {
					const control = event.target;

					if (
						!(control instanceof HTMLInputElement) &&
						!(control instanceof HTMLSelectElement) &&
						!(control instanceof HTMLTextAreaElement)
					) {
						return;
					}

					const fieldName: string = control.name || control.dataset.elementId || control.id;

					if (fieldName) {
						props.formValues.set(fieldName, readFormControlValue(control));
					}
				};
				annotationLayer.addEventListener('change', preserveFormValue);
				annotationLayer.addEventListener('input', preserveFormValue);
				container.appendChild(annotationLayer);
				pdfjs.AnnotationLayer.render({
					annotations,
					div: annotationLayer,
					downloadManager: createPdfDownloadManager(),
					imageResourcesPath: '',
					linkService: createPdfLinkService({
						executeNamedAction: (action: string): void => {
							props.onInteraction?.({
								documentIndex: props.descriptor.documentIndex,
								documentName: props.descriptor.documentName,
								pageNumber: props.descriptor.pageNumber,
								type: 'annotation',
								value: action
							});
						},
						navigateTo: (destination: unknown): void => props.navigateTo(destination),
						onExternalLink: (url: string): void => {
							window.open(url, '_blank', 'noopener,noreferrer');
						}
					}),
					page,
					renderInteractiveForms: props.options.renderForms,
					viewport: viewport.clone({ dontFlip: true })
				});
				hydrateAnnotationImages(annotationLayer);
				identifyFormControls(annotationLayer, annotations, props.formValues);
			}
		}
	};

	const render = async (): Promise<void> => {
		clear();

		if (!props.active) return;
		const currentGeneration: number = generation;

		try {
			await renderActivePage(currentGeneration);
		} catch (error) {
			if (currentGeneration !== generation || (error as { name?: string }).name === 'RenderingCancelledException') return;

			throw error;
		}
	};

	onMount((): void => {
		createEffect((): void => {
			void props.active;
			void props.layout.height;
			void props.layout.width;
			void props.options.interactiveAnnotations;
			void props.options.renderForms;
			void props.options.renderTextLayer;
			void props.searchQuery;
			void render().catch((error: unknown): void => {
				// eslint-disable-next-line no-console
				console.error(error);
			});
		});
	});

	onCleanup(clear);

	return (
		<div
			ref={container}
			class={style['pdf-page-content']}
			data-document-index={props.descriptor.documentIndex}
			data-page-number={props.descriptor.pageNumber}
			onClick={(): void => {
				props.onInteraction?.({
					documentIndex: props.descriptor.documentIndex,
					documentName: props.descriptor.documentName,
					pageNumber: props.descriptor.pageNumber,
					type: 'click'
				});
			}}
			style={{ height: `${props.layout.height}px`, width: `${props.layout.width}px` }}
		/>
	);
};
