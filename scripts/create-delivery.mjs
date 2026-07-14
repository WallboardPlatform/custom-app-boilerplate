import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import archiver from 'archiver';

import { readAppMetadata, readJson } from './app-metadata.mjs';

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const metadata = readAppMetadata(projectDirectory);
const requestedOutput = process.argv[2];
const outputDirectory = path.resolve(
	projectDirectory,
	requestedOutput ?? path.join('.tmp', 'deliveries', `${metadata.name.replace(/[^\w.-]/g, '_')}-${metadata.version}`)
);
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const projectPathHash = [...projectDirectory.toLowerCase()].reduce(
	(hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0,
	0
);
const commandEnvironment = {
	...process.env,
	DISABLE_MINIO_UPLOAD: 'true',
	DO_APPLICATION_ZIP: 'false',
	WALLBOARD_PREVIEW_TEST_PORT: process.env.WALLBOARD_PREVIEW_TEST_PORT ?? String(40000 + (projectPathHash % 20000)),
	SIMPLE_OUTPUT: 'true'
};

const runNpmScript = (script) => {
	const result = spawnSync(npmCommand, ['run', script], {
		cwd: projectDirectory,
		env: commandEnvironment,
		shell: process.platform === 'win32',
		stdio: 'inherit'
	});

	if (result.status !== 0) {
		throw new Error(
			`npm run ${script} failed with exit code ${result.status ?? 'unknown'}${result.error ? `: ${result.error.message}` : '.'}`
		);
	}
};

const createZip = (sourceDirectory, outputPath) => new Promise((resolve, reject) => {
	const output = fs.createWriteStream(outputPath);
	const archive = archiver('zip', { zlib: { level: 9 } });

	output.on('close', resolve);
	output.on('error', reject);
	archive.on('warning', (error) => {
		if (error.code !== 'ENOENT') {
			reject(error);
		}
	});
	archive.on('error', reject);
	archive.pipe(output);
	archive.directory(sourceDirectory, false);
	void archive.finalize();
});

const prepareOutputDirectory = () => {
	if (!fs.existsSync(outputDirectory)) {
		fs.mkdirSync(outputDirectory, { recursive: true });
		return;
	}

	const allowedFiles = new Set([
		metadata.zipFileName,
		'delivery-manifest.json',
		'datasource-contract.json',
		'sample-datasource.json'
	]);
	const manifestPath = path.join(outputDirectory, 'delivery-manifest.json');

	if (fs.existsSync(manifestPath)) {
		let previousManifest;

		try {
			previousManifest = readJson(manifestPath);
		} catch (error) {
			throw new Error(`Existing delivery manifest is invalid: ${error.message}`, { cause: error });
		}

		const previousZipFile = previousManifest?.app?.zipFile;

		if (
			typeof previousZipFile === 'string'
			&& path.basename(previousZipFile) === previousZipFile
			&& previousZipFile.toLowerCase().endsWith('.zip')
		) {
			allowedFiles.add(previousZipFile);
		}
	}

	const entries = fs.readdirSync(outputDirectory, { withFileTypes: true });
	const unexpectedEntries = entries.filter((entry) => !entry.isFile() || !allowedFiles.has(entry.name));

	if (unexpectedEntries.length > 0) {
		throw new Error(
			`Delivery output must be a new directory or a previous delivery directory. Unexpected entries: ${unexpectedEntries.map((entry) => entry.name).join(', ')}`
		);
	}

	for (const entry of entries) {
		fs.rmSync(path.join(outputDirectory, entry.name), { force: true });
	}
};

runNpmScript('validate:identity');
runNpmScript('validate:examples');
runNpmScript('lint');
runNpmScript('validate:visual');
runNpmScript('prepare:datasource-package');
runNpmScript('build:production');
runNpmScript('validate:package-assets');

const distDirectory = path.join(projectDirectory, 'dist');
const requiredFiles = [
	'assets/app.js',
	'assets/app-chrome-49.js',
	'editor-assets/config.json'
];

for (const relativePath of requiredFiles) {
	if (!fs.existsSync(path.join(distDirectory, relativePath))) {
		throw new Error(`Validated build is missing '${relativePath}'.`);
	}
}

prepareOutputDirectory();
const zipPath = path.join(outputDirectory, metadata.zipFileName);
await createZip(distDirectory, zipPath);

const contractPath = path.join(projectDirectory, 'datasource-contract.json');
let datasource = null;

if (fs.existsSync(contractPath)) {
	const contract = readJson(contractPath);
	const samplePath = path.resolve(projectDirectory, contract.source.sampleData);
	const contractOutputPath = path.join(outputDirectory, 'datasource-contract.json');
	const sampleOutputPath = path.join(outputDirectory, 'sample-datasource.json');

	fs.copyFileSync(contractPath, contractOutputPath);
	fs.copyFileSync(samplePath, sampleOutputPath);
	datasource = {
		contract: contract.source.contract,
		bindingProperty: contract.binding.property,
		dataPickerType: contract.binding.dataPickerType,
		suggestedName: contract.delivery.suggestedDatasourceName,
		quickEditEligible: contract.delivery.quickEditEligible,
		contractFile: 'datasource-contract.json',
		sampleFile: 'sample-datasource.json',
		packagedContractFile: 'editor-assets/datasource-contract.json',
		packagedTemplateFile: 'editor-assets/datasource-template.json',
		currentProvisioning: 'create-or-import-then-bind',
		futureProvisioning: 'create-from-packaged-template'
	};
}

const manifest = {
	deliveryVersion: 1,
	app: {
		name: metadata.name,
		version: metadata.version,
		identity: metadata.identity,
		zipFile: metadata.zipFileName,
		uploadRule: 'Create this identity once; replacement builds must be uploaded to the same Wallboard app record.'
	},
	datasource,
	validation: {
		identity: true,
		contract: true,
		lint: true,
		visual: true,
		legacyBundle: true,
		packageAssets: true
	}
};

fs.writeFileSync(
	path.join(outputDirectory, 'delivery-manifest.json'),
	`${JSON.stringify(manifest, null, '\t')}\n`,
	'utf8'
);

console.log(`Delivery created at ${outputDirectory}`);
console.log(`Uploadable package: ${zipPath}`);
