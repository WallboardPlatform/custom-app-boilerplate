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
import { createSourceArchive, readGitProvenance } from './source-archive.mts';

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const metadata = readAppMetadata(projectDirectory);
const argumentsList = process.argv.slice(2);
const unverified = argumentsList.includes('--unverified');
const unsupportedOptions = argumentsList.filter((argument) => argument.startsWith('--') && argument !== '--unverified');
const positionalArguments = argumentsList.filter((argument) => !argument.startsWith('--'));

if (unsupportedOptions.length > 0 || positionalArguments.length > 1) {
	throw new Error('Usage: npm run deliver -- <output-directory> or npm run deliver:unverified -- <output-directory>.');
}

const requestedOutput = positionalArguments[0];
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
	WALLBOARD_PREVIEW_TEST_PORT: process.env.WALLBOARD_PREVIEW_TEST_PORT ?? String(42000 + (projectPathHash % 6000)),
	SIMPLE_OUTPUT: 'true'
};
const packageBaseName = path.basename(metadata.zipFileName, '.zip');
const appZipFileName = unverified ? `${packageBaseName}_UNVERIFIED.zip` : metadata.zipFileName;
const sourceArchiveFileName = unverified
	? `${packageBaseName}_UNVERIFIED_source.zip`
	: `${packageBaseName}_source.zip`;
const unverifiedReason = process.env.WALLBOARD_UNVERIFIED_REASON?.trim()
	|| 'Browser visual validation was not run in this environment.';

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
		appZipFileName,
		sourceArchiveFileName,
		'delivery-manifest.json',
		'generation-brief.json',
		'visual-review.json',
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
		const previousSourceArchiveFile = previousManifest?.source?.archiveFile;

		if (
			typeof previousZipFile === 'string'
			&& path.basename(previousZipFile) === previousZipFile
			&& previousZipFile.toLowerCase().endsWith('.zip')
		) {
			allowedFiles.add(previousZipFile);
		}

		if (
			typeof previousSourceArchiveFile === 'string'
			&& path.basename(previousSourceArchiveFile) === previousSourceArchiveFile
			&& previousSourceArchiveFile.toLowerCase().endsWith('.zip')
		) {
			allowedFiles.add(previousSourceArchiveFile);
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
runNpmScript('validate:legacy');

if (!unverified) {
	runNpmScript('validate:visual');
	runNpmScript('validate:visual-review');
}

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
const zipPath = path.join(outputDirectory, appZipFileName);
await createZip(distDirectory, zipPath);
const sourceArchivePath = path.join(outputDirectory, sourceArchiveFileName);
const sourceArchive = await createSourceArchive(projectDirectory, sourceArchivePath, outputDirectory);
const gitProvenance = readGitProvenance(projectDirectory);

const contractPath = path.join(projectDirectory, 'datasource-contract.json');
const briefPath = path.join(projectDirectory, 'generation-brief.json');
const brief = readJson(briefPath);
const visualReviewPath = path.join(projectDirectory, 'preview', 'visual-review.json');
const visualReview = unverified ? null : readJson(visualReviewPath);
let datasource = null;

fs.copyFileSync(briefPath, path.join(outputDirectory, 'generation-brief.json'));

if (visualReview) {
	fs.copyFileSync(visualReviewPath, path.join(outputDirectory, 'visual-review.json'));
}

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
	deliveryVersion: 3,
	app: {
		name: metadata.name,
		version: metadata.version,
		identity: metadata.identity,
		zipFile: appZipFileName,
		uploadRule: 'Create this identity once; replacement builds must be uploaded to the same Wallboard app record.'
	},
	source: {
		archiveFile: sourceArchiveFileName,
		fileCount: sourceArchive.fileCount,
		sha256: sourceArchive.sha256,
		git: gitProvenance
	},
	generationBrief: {
		briefVersion: brief.briefVersion,
		file: 'generation-brief.json'
	},
	visualReview: visualReview ? {
		file: 'visual-review.json',
		reviewVersion: visualReview.reviewVersion,
		sourceHash: visualReview.sourceHash,
		reviewedAt: visualReview.reviewedAt,
		reviewer: visualReview.reviewer
	} : null,
	datasource,
	acceptance: {
		status: unverified ? 'unverified' : 'accepted',
		uploadReady: !unverified,
		missingEvidence: unverified ? ['browser visual validation'] : [],
		reason: unverified ? unverifiedReason : null
	},
	validation: {
		identity: true,
		generationBrief: true,
		contract: true,
		lint: true,
		visual: !unverified,
		visualReview: !unverified,
		legacyBundle: true,
		packageAssets: true,
		sourceArchive: true
	}
};

fs.writeFileSync(
	path.join(outputDirectory, 'delivery-manifest.json'),
	`${JSON.stringify(manifest, null, '\t')}\n`,
	'utf8'
);

console.log(`Delivery created at ${outputDirectory}`);

if (unverified) {
	console.warn(`UNVERIFIED PACKAGE: ${zipPath}`);
	console.warn('Do not upload this package until npm run deliver passes in a browser-capable environment.');
} else {
	console.log(`Uploadable package: ${zipPath}`);
}

console.log(`Agent-ready source: ${sourceArchivePath}`);
