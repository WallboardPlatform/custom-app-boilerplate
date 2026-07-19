const downloadBlob = (blob: Blob, fileName: string): void => {
	const url: string = URL.createObjectURL(blob);
	const anchor: HTMLAnchorElement = document.createElement('a');
	anchor.href = url;
	anchor.download = fileName;
	anchor.style.display = 'none';
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	setTimeout((): void => URL.revokeObjectURL(url), 1000);
};

const bytesToBlob = (data: Uint8Array, contentType: string): Blob => {
	const copy = new Uint8Array(data.byteLength);
	copy.set(data);

	return new Blob([copy.buffer], { type: contentType });
};

export interface PdfLinkServiceOptions {
	executeNamedAction(action: string): void;
	navigateTo(destination: unknown): void;
	onExternalLink(url: string): void;
}

export const createPdfLinkService = (options: PdfLinkServiceOptions): Record<string, unknown> => ({
	externalLinkEnabled: true,
	externalLinkRel: 'noopener noreferrer nofollow',
	externalLinkTarget: 2,
	executeNamedAction: (action: string): void => options.executeNamedAction(action),
	getAnchorUrl: (anchor: string): string => anchor || '#',
	getDestinationHash: (): string => '#',
	navigateTo: (destination: unknown): void => options.navigateTo(destination),
	onFileAttachmentAnnotation: (): void => undefined,
	setHash: (hash: string): void => options.onExternalLink(hash)
});

export const createPdfDownloadManager = (): Record<string, unknown> => ({
	downloadData: (data: Uint8Array, fileName: string, contentType = 'application/octet-stream'): void => {
		downloadBlob(bytesToBlob(data, contentType), fileName);
	},
	downloadUrl: (url: string, fileName: string): void => {
		const anchor: HTMLAnchorElement = document.createElement('a');
		anchor.href = url;
		anchor.download = fileName;
		anchor.rel = 'noopener noreferrer';
		anchor.click();
	},
	openOrDownloadData: (data: Uint8Array, fileName: string, contentType = 'application/octet-stream'): boolean => {
		downloadBlob(bytesToBlob(data, contentType), fileName);

		return true;
	}
});

export const downloadPdfBytes = (data: Uint8Array, fileName: string): void => {
	downloadBlob(bytesToBlob(data, 'application/pdf'), fileName);
};
