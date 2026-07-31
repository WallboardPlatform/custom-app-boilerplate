import type { WayfindingStudioProject } from '../../../../studio-project.mts';
import {
	createWayfindingMapPackage,
	WAYFINDING_MAP_PACKAGE_EXTENSION,
	WAYFINDING_MAP_PACKAGE_MIME_TYPE
} from '../../../../runtime-package.mts';

const safeFileStem = (value: string): string =>
	value.trim().replaceAll(/[^a-zA-Z0-9._-]+/g, '-').replaceAll(/^-+|-+$/g, '')
	|| 'wayfinding-project';

export interface PublishedRuntime {
	bytes: Uint8Array;
	fileName: string;
	mimeType: string;
}

export const preparePublishedRuntime = (
	project: WayfindingStudioProject
): PublishedRuntime => ({
	bytes: createWayfindingMapPackage(project),
	fileName: `${safeFileStem(project.name)}${WAYFINDING_MAP_PACKAGE_EXTENSION}`,
	mimeType: WAYFINDING_MAP_PACKAGE_MIME_TYPE
});

export const downloadPublishedRuntime = (
	project: WayfindingStudioProject
): PublishedRuntime => {
	const published = preparePublishedRuntime(project);
	const buffer = new ArrayBuffer(published.bytes.byteLength);
	new Uint8Array(buffer).set(published.bytes);
	const url = URL.createObjectURL(new Blob([buffer], { type: published.mimeType }));
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = published.fileName;
	anchor.click();
	URL.revokeObjectURL(url);

	return published;
};
