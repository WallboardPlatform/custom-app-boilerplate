import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import archiver from 'archiver';

import { readAppMetadata, readJson } from './app-metadata.mjs';
import {
	getDatasourceProvisioning,
	normalizeDatasourceBindings
} from './datasource-provisioning.mjs';

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
		'generation-brief.json',
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
runNpmScript('validate:project');
runNpmScript('validate:examples');
runNpmScript('typecheck:scripts');
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
const briefPath = path.join(projectDirectory, 'generation-brief.json');
const brief = readJson(briefPath);
let datasource = null;

fs.copyFileSync(briefPath, path.join(outputDirectory, 'generation-brief.json'));

if (fs.existsSync(contractPath)) {
	const contract = readJson(contractPath);
	const bindings = normalizeDatasourceBindings(contract);
	const sampleDataPaths = new Set(bindings.map((binding) => binding.source.sampleData));

	if (sampleDataPaths.size !== 1) {
		throw new Error('All datasource bindings must use one shared sampleData bundle.');
	}

	const [sampleDataPath] = sampleDataPaths;

	if (typeof sampleDataPath !== 'string' || sampleDataPath.trim() === '') {
		throw new Error('datasource-contract.json source.sampleData must identify the shared template data file.');
	}

	const samplePath = path.resolve(projectDirectory, sampleDataPath);
	const contractOutputPath = path.join(outputDirectory, 'datasource-contract.json');
	const sampleOutputPath = path.join(outputDirectory, 'sample-datasource.json');
	const manifestBindings = bindings.map((binding) => {
		const provisioning = getDatasourceProvisioning(binding.source.contract);

		return {
			contract: binding.source.contract,
			bindingProperty: binding.property,
			dataPickerType: binding.dataPickerType,
			suggestedName: binding.delivery.suggestedDatasourceName,
			quickEditEligible: binding.delivery.quickEditEligible,
			samplePath: binding.source.samplePath ?? null,
			currentProvisioning: provisioning.current,
			futureProvisioning: provisioning.future
		};
	});
	const singleBinding = manifestBindings.length === 1 ? manifestBindings[0] : null;

	fs.copyFileSync(contractPath, contractOutputPath);
	fs.copyFileSync(samplePath, sampleOutputPath);
	datasource = {
		mode: singleBinding ? 'single' : 'multiple',
		...(singleBinding ?? {}),
		bindings: manifestBindings,
		contractFile: 'datasource-contract.json',
		sampleFile: 'sample-datasource.json',
		packagedContractFile: 'editor-assets/datasource-contract.json',
		packagedTemplateFile: 'editor-assets/datasource-template.json',
		currentProvisioning: singleBinding?.currentProvisioning ?? 'resolve-each-binding',
		futureProvisioning: singleBinding?.futureProvisioning ?? 'resolve-each-binding'
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
	generationBrief: {
		briefVersion: brief.briefVersion,
		file: 'generation-brief.json'
	},
	datasource,
	validation: {
		identity: true,
		generationBrief: true,
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
