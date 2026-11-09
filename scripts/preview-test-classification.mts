const SHARED_PREVIEW_TEST_FILES = new Set([
	'visual.spec.ts',
	'audio.spec.ts',
	'audio-sdk.spec.ts'
]);

// Shared harness tests still run, but are not app behavior evidence or visual source.
export const isAppSpecificPreviewTest = (fileName: string): boolean => {
	return fileName.endsWith('.spec.ts') && !SHARED_PREVIEW_TEST_FILES.has(fileName);
};
