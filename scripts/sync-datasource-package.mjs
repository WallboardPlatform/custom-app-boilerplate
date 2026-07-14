import fs from 'node:fs';
import path from 'node:path';

import { readJson } from './app-metadata.mjs';

const projectDirectory = path.resolve(process.argv[2] ?? process.cwd());
const contractPath = path.join(projectDirectory, 'datasource-contract.json');
const editorAssetsDirectory = path.join(projectDirectory, 'src', 'editor-assets');
const packagedContractPath = path.join(editorAssetsDirectory, 'datasource-contract.json');
const packagedTemplatePath = path.join(editorAssetsDirectory, 'datasource-template.json');

if (!fs.existsSync(contractPath)) {
	fs.rmSync(packagedContractPath, { force: true });
	fs.rmSync(packagedTemplatePath, { force: true });
	console.log('No datasource contract found; no datasource template will be packaged.');
	process.exit(0);
}

const contract = readJson(contractPath);
const sampleDataPath = contract.source?.sampleData;

if (typeof sampleDataPath !== 'string' || sampleDataPath.trim() === '') {
	throw new Error('datasource-contract.json source.sampleData must identify the template data file.');
}

const absoluteSamplePath = path.resolve(projectDirectory, sampleDataPath);

if (!absoluteSamplePath.startsWith(`${projectDirectory}${path.sep}`) || !fs.existsSync(absoluteSamplePath)) {
	throw new Error(`Datasource template '${sampleDataPath}' must exist inside the project.`);
}

fs.mkdirSync(editorAssetsDirectory, { recursive: true });
fs.copyFileSync(contractPath, packagedContractPath);
fs.copyFileSync(absoluteSamplePath, packagedTemplatePath);

console.log('Packaged datasource contract and template under src/editor-assets/.');
