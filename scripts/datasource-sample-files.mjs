import fs from 'node:fs';
import path from 'node:path';

const safeBindingPropertyPattern = /^[A-Za-z0-9_-]+$/u;

export const getBindingSampleFileName = (bindingProperty, prefix) => {
	if (typeof bindingProperty !== 'string' || !safeBindingPropertyPattern.test(bindingProperty)) {
		throw new Error(`Datasource binding property '${bindingProperty}' cannot be used in a sample filename.`);
	}

	return `${prefix}-${bindingProperty}.json`;
};

export const readBindingSample = (projectDirectory, binding) => {
	const sampleDataPath = binding.source?.sampleData;

	if (typeof sampleDataPath !== 'string' || sampleDataPath.trim() === '') {
		throw new Error(`Datasource binding '${binding.property}' must identify source.sampleData.`);
	}

	const absoluteSamplePath = path.resolve(projectDirectory, sampleDataPath);

	if (!absoluteSamplePath.startsWith(`${projectDirectory}${path.sep}`) || !fs.existsSync(absoluteSamplePath)) {
		throw new Error(`Datasource template '${sampleDataPath}' must exist inside the project.`);
	}

	let sample = JSON.parse(fs.readFileSync(absoluteSamplePath, 'utf8'));
	const samplePath = binding.source?.samplePath;

	if (samplePath !== undefined) {
		if (typeof samplePath !== 'string' || samplePath.trim() === '') {
			throw new Error(`Datasource binding '${binding.property}' source.samplePath must be a non-empty string.`);
		}

		for (const segment of samplePath.split('.')) {
			if (!sample || typeof sample !== 'object' || Array.isArray(sample) || !(segment in sample)) {
				throw new Error(`Datasource template does not contain path '${samplePath}' for '${binding.property}'.`);
			}

			sample = sample[segment];
		}
	}

	return sample;
};

export const writeBindingSampleFiles = ({ bindings, projectDirectory, outputDirectory, prefix }) => {
	if (bindings.length < 2) {
		return [];
	}

	const files = bindings.map((binding) => {
		const fileName = getBindingSampleFileName(binding.property, prefix);
		const sample = readBindingSample(projectDirectory, binding);

		fs.writeFileSync(path.join(outputDirectory, fileName), `${JSON.stringify(sample, null, '\t')}\n`, 'utf8');
		return {
			bindingProperty: binding.property,
			fileName
		};
	});

	if (new Set(files.map(({ fileName }) => fileName)).size !== files.length) {
		throw new Error('Datasource binding properties must produce unique sample filenames.');
	}

	return files;
};
