export const selectReferenceScreenshots = (manifest, availableScreenshots) => {
	const selected = manifest?.referenceScreenshots;

	if (!Array.isArray(selected) || selected.length < 1 || selected.length > 2) {
		throw new Error('referenceScreenshots must contain one or two screenshot filenames.');
	}

	if (selected.some((file) => typeof file !== 'string' || !file.endsWith('.png'))) {
		throw new Error('referenceScreenshots entries must be PNG filenames.');
	}

	if (new Set(selected).size !== selected.length) {
		throw new Error('referenceScreenshots entries must be unique.');
	}

	const available = new Set(availableScreenshots);
	const missing = selected.filter((file) => !available.has(file));

	if (missing.length > 0) {
		throw new Error(`referenceScreenshots not found: ${missing.join(', ')}.`);
	}

	return selected;
};
