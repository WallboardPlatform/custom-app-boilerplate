import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { validatePackageAssets } from './validation.mjs';

const VALID_PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
	'base64'
);

const createPackageProject = () => {
	const rootDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'wallboard-package-assets-'));
	const sourceEditorAssets = path.join(rootDirectory, 'src', 'editor-assets');
	const sourceComponents = path.join(rootDirectory, 'src', 'components');
	const distAssets = path.join(rootDirectory, 'dist', 'assets');
	const distEditorAssets = path.join(rootDirectory, 'dist', 'editor-assets');

	for (const directory of [sourceEditorAssets, sourceComponents, distAssets, distEditorAssets]) {
		fs.mkdirSync(directory, { recursive: true });
	}

	fs.writeFileSync(
		path.join(sourceEditorAssets, 'properties.json'),
		JSON.stringify({
			resourceList: ['assets/app.js', 'assets/app-chrome-49.js']
		})
	);
	fs.writeFileSync(path.join(sourceComponents, 'app.tsx'), "export const value = 'safe';\n");
	fs.writeFileSync(path.join(distAssets, 'app.js'), 'app');
	fs.writeFileSync(path.join(distAssets, 'app-chrome-49.js'), 'legacy');
	fs.writeFileSync(path.join(distEditorAssets, 'config.json'), '{}');
	fs.writeFileSync(path.join(distEditorAssets, 'icon.png'), VALID_PNG);
	fs.writeFileSync(path.join(distEditorAssets, 'placeholder.png'), VALID_PNG);

	return rootDirectory;
};

void describe('package asset validation', () => {
	void it('accepts a complete package with cache-listed runtime assets', (testContext) => {
		const rootDirectory = createPackageProject();
		testContext.after(() => fs.rmSync(rootDirectory, { recursive: true, force: true }));

		assert.deepEqual(validatePackageAssets(rootDirectory), { runtimeAssetCount: 2 });
	});

	void it('rejects corrupt editor PNG files', (testContext) => {
		const rootDirectory = createPackageProject();
		testContext.after(() => fs.rmSync(rootDirectory, { recursive: true, force: true }));
		fs.writeFileSync(path.join(rootDirectory, 'dist', 'editor-assets', 'icon.png'), 'not-an-image');

		assert.throws(() => validatePackageAssets(rootDirectory), /Editor images are invalid/);
	});

	void it('rejects PNG headers without image data', (testContext) => {
		const rootDirectory = createPackageProject();
		testContext.after(() => fs.rmSync(rootDirectory, { recursive: true, force: true }));
		fs.writeFileSync(
			path.join(rootDirectory, 'dist', 'editor-assets', 'icon.png'),
			VALID_PNG.subarray(0, 33)
		);

		assert.throws(() => validatePackageAssets(rootDirectory), /image data and an end chunk/);
	});

	void it('rejects PNG payload corruption', (testContext) => {
		const rootDirectory = createPackageProject();
		testContext.after(() => fs.rmSync(rootDirectory, { recursive: true, force: true }));
		const corruptPng = Buffer.from(VALID_PNG);
		const imageDataOffset = corruptPng.indexOf(Buffer.from('IDAT')) + 4;
		corruptPng[imageDataOffset] ^= 0xff;
		fs.writeFileSync(path.join(rootDirectory, 'dist', 'editor-assets', 'icon.png'), corruptPng);

		assert.throws(() => validatePackageAssets(rootDirectory), /CRC check/);
	});

	void it('rejects emitted runtime assets missing from resourceList', (testContext) => {
		const rootDirectory = createPackageProject();
		testContext.after(() => fs.rmSync(rootDirectory, { recursive: true, force: true }));
		fs.writeFileSync(path.join(rootDirectory, 'dist', 'assets', 'brand.png'), VALID_PNG);

		assert.throws(() => validatePackageAssets(rootDirectory), /brand\.png/);
	});

	void it('rejects runtime-relative JSX media URLs', (testContext) => {
		const rootDirectory = createPackageProject();
		testContext.after(() => fs.rmSync(rootDirectory, { recursive: true, force: true }));
		fs.writeFileSync(
			path.join(rootDirectory, 'src', 'components', 'app.tsx'),
			'export const App = () => <img src="index.png" />;\n'
		);

		assert.throws(() => validatePackageAssets(rootDirectory), /runtime-relative JSX media URL/);
	});

	void it('rejects expression and variable-based runtime-relative JSX media URLs', (testContext) => {
		const rootDirectory = createPackageProject();
		testContext.after(() => fs.rmSync(rootDirectory, { recursive: true, force: true }));
		fs.writeFileSync(
			path.join(rootDirectory, 'src', 'components', 'app.tsx'),
			"const icon = 'icon.png'; export const App = () => <><img src={'cover.webp'} /><img src={icon} /></>;\n"
		);

		assert.throws(() => validatePackageAssets(rootDirectory), /runtime-relative JSX media URL/);
	});

	void it('ignores media URL examples in comments and ordinary strings', (testContext) => {
		const rootDirectory = createPackageProject();
		testContext.after(() => fs.rmSync(rootDirectory, { recursive: true, force: true }));
		fs.writeFileSync(
			path.join(rootDirectory, 'src', 'components', 'app.tsx'),
			"// <img src=\"example.png\" />\nexport const note = 'src=\"example.png\"';\n"
		);

		assert.doesNotThrow(() => validatePackageAssets(rootDirectory));
	});

	void it('rejects import-meta media URLs that resolve incorrectly in the displayer', (testContext) => {
		const rootDirectory = createPackageProject();
		testContext.after(() => fs.rmSync(rootDirectory, { recursive: true, force: true }));
		fs.writeFileSync(
			path.join(rootDirectory, 'src', 'components', 'app.tsx'),
			"export const icon = new URL('./icon.png', import.meta.url).href;\n"
		);

		assert.throws(() => validatePackageAssets(rootDirectory), /new URL/);
	});

	void it('rejects duplicate and traversal resource entries', (testContext) => {
		const rootDirectory = createPackageProject();
		testContext.after(() => fs.rmSync(rootDirectory, { recursive: true, force: true }));
		fs.writeFileSync(
			path.join(rootDirectory, 'src', 'editor-assets', 'properties.json'),
			JSON.stringify({
				resourceList: [
					'assets/app.js',
					'assets/app.js',
					'assets/app-chrome-49.js',
					'../outside.png'
				]
			})
		);

		assert.throws(() => validatePackageAssets(rootDirectory), /resourceList contains duplicates/);
		assert.throws(() => validatePackageAssets(rootDirectory), /unsafe local paths/);
	});

	void it('rejects unreferenced editor-asset directories', (testContext) => {
		const rootDirectory = createPackageProject();
		testContext.after(() => fs.rmSync(rootDirectory, { recursive: true, force: true }));
		fs.mkdirSync(path.join(rootDirectory, 'src', 'editor-assets', 'layout-editor'));

		assert.throws(() => validatePackageAssets(rootDirectory), /must be referenced by properties.json or removed/);
	});

	void it('accepts an editor-asset directory referenced by properties.json', (testContext) => {
		const rootDirectory = createPackageProject();
		testContext.after(() => fs.rmSync(rootDirectory, { recursive: true, force: true }));
		fs.mkdirSync(path.join(rootDirectory, 'src', 'editor-assets', 'layout-editor'));
		fs.writeFileSync(
			path.join(rootDirectory, 'src', 'editor-assets', 'properties.json'),
			JSON.stringify({
				properties: [{ customSettingsUrl: '/editor-assets/layout-editor/index.html' }],
				resourceList: ['assets/app.js', 'assets/app-chrome-49.js']
			})
		);

		assert.doesNotThrow(() => validatePackageAssets(rootDirectory));
	});
});
