import fs from 'node:fs';
import path from 'node:path';

export const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

export const readAppMetadata = (projectDirectory) => {
	const propertiesPath = path.join(projectDirectory, 'src', 'editor-assets', 'properties.json');

	if (!fs.existsSync(propertiesPath)) {
		throw new Error(`App metadata was not found: ${propertiesPath}`);
	}

	const properties = readJson(propertiesPath);
	const name = typeof properties.name === 'string' ? properties.name : '';
	const version = typeof properties.version === 'string' ? properties.version : '';

	if (!name || name.trim() !== name) {
		throw new Error('properties.json name must be a non-empty string without leading or trailing whitespace.');
	}

	if (!/^[1-9][0-9]*$/.test(version)) {
		throw new Error('properties.json version must be a positive integer string, for example "1".');
	}

	return {
		name,
		version,
		identity: `customApp_${name}_${version}`,
		zipFileName: `${name.replace(/[^\w.-]/g, '_')}_${version}.zip`
	};
};
