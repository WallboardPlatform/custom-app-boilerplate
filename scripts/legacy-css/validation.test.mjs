import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { validateLegacyCss } from './validation.mjs';

const createProject = (source) => {
	const rootDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'wallboard-legacy-css-'));
	const styleDirectory = path.join(rootDirectory, 'src', 'components');

	fs.mkdirSync(styleDirectory, { recursive: true });
	fs.writeFileSync(path.join(styleDirectory, 'app.module.scss'), source);
	fs.writeFileSync(path.join(rootDirectory, 'vite.config.mts'), "export default { build: { cssTarget: 'chrome56' } };\n");

	return rootDirectory;
};

void describe('legacy CSS validation', () => {
	void it('accepts deterministic flexbox and media-query CSS', async (testContext) => {
		const rootDirectory = createProject(`
			.root { display: flex; width: 100%; min-width: 0; }
			.root > * + * { margin-left: 12px; }
			@media (max-width: 700px) { .root { flex-direction: column; } }
		`);
		testContext.after(() => fs.rmSync(rootDirectory, { recursive: true, force: true }));

		assert.deepEqual(await validateLegacyCss(rootDirectory), { checkedFiles: 1 });
	});

	for (const [feature, source] of [
		['CSS grid', '.root { display: grid; }'],
		['flex/grid gap', '.root { gap: 12px; }'],
		['modern sizing function', '.root { font-size: clamp(12px, 2vw, 24px); }'],
		['aspect-ratio', '.root { aspect-ratio: 16 / 9; }'],
		['container query', '@container card (min-width: 300px) { .root { display: flex; } }'],
		['backdrop-filter', '.root { backdrop-filter: blur(8px); }'],
		['color-mix()', '.root { color: color-mix(in srgb, red 50%, blue); }'],
		['modern viewport unit', '.root { height: 100dvh; }']
	]) {
		void it(`rejects ${feature}`, async (testContext) => {
			const rootDirectory = createProject(source);
			testContext.after(() => fs.rmSync(rootDirectory, { recursive: true, force: true }));

			await assert.rejects(validateLegacyCss(rootDirectory), new RegExp(feature.replace(/[()]/g, '\\$&')));
		});
	}

	void it('ignores unsupported feature names inside comments', async (testContext) => {
		const rootDirectory = createProject('/* display: grid; gap: 10px; */\n.root { display: flex; }');
		testContext.after(() => fs.rmSync(rootDirectory, { recursive: true, force: true }));

		await assert.doesNotReject(validateLegacyCss(rootDirectory));
	});

	void it('requires the production build to target Chrome 56 CSS', async (testContext) => {
		const rootDirectory = createProject('.root { display: flex; }');
		testContext.after(() => fs.rmSync(rootDirectory, { recursive: true, force: true }));
		fs.writeFileSync(path.join(rootDirectory, 'vite.config.mts'), "export default { build: { cssTarget: 'es2015' } };\n");

		await assert.rejects(validateLegacyCss(rootDirectory), /build\.cssTarget must be chrome56/);
	});

	void it('checks CSS emitted from Sass variables', async (testContext) => {
		const rootDirectory = createProject('$layout: grid; .root { display: $layout; }');
		testContext.after(() => fs.rmSync(rootDirectory, { recursive: true, force: true }));

		await assert.rejects(validateLegacyCss(rootDirectory), /CSS grid/);
	});

	void it('does not treat custom property names as flex gap declarations', async (testContext) => {
		const rootDirectory = createProject('.root { --component-gap: 12px; display: flex; }');
		testContext.after(() => fs.rmSync(rootDirectory, { recursive: true, force: true }));

		await assert.doesNotReject(validateLegacyCss(rootDirectory));
	});
});
