import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { applyCapability } from '../capability-materialization.mjs';
import { materializeExample } from '../example-materialization.mjs';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const hasPdfCapabilityCatalog = fs.existsSync(
	path.join(rootDirectory, 'capabilities', 'pdf', 'capability.json')
);
const require = createRequire(import.meta.url);
const temporaryDirectories: string[] = [];

const temporaryDirectory = (prefix: string): string => {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
	temporaryDirectories.push(directory);

	return directory;
};

const writeJson = (filePath: string, value: unknown): void => {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, `${JSON.stringify(value, null, '\t')}\n`);
};

afterEach((): void => {
	for (const directory of temporaryDirectories.splice(0)) {
		fs.rmSync(directory, { force: true, recursive: true });
	}
});

void describe('PDF capability materialization', (): void => {
	void it('expands the pinned PDF.js runtime only into an opted-in project', {
		skip: !hasPdfCapabilityCatalog
	}, (): void => {
		const targetDirectory = temporaryDirectory('wallboard-pdf-capability-');
		writeJson(path.join(targetDirectory, 'package.json'), { name: 'pdf-target' });

		applyCapability({ capabilityId: 'pdf', rootDirectory, targetDirectory });

		const packageJson = JSON.parse(fs.readFileSync(path.join(targetDirectory, 'package.json'), 'utf8'));
		const runtimePath = path.join(targetDirectory, 'src', 'capabilities', 'pdf', 'vendor', 'pdf.min.js');
		const workerPath = path.join(targetDirectory, 'src', 'capabilities', 'pdf', 'vendor', 'pdf.worker.min.js');

		assert.deepEqual(packageJson.wallboardCapabilities, ['pdf']);
		assert.ok(fs.statSync(runtimePath).size > 300_000);
		assert.ok(fs.statSync(workerPath).size > 700_000);
		assert.match(fs.readFileSync(runtimePath, 'utf8').slice(0, 240), /module = \{ exports: \{\} \}/);
		assert.match(
			fs.readFileSync(path.join(targetDirectory, 'src', 'capabilities', 'pdf', 'pdfjs.ts'), 'utf8'),
			/document\.currentScript[\s\S]*pdf\.worker\.js/
		);

		assert.doesNotThrow((): void => {
			applyCapability({ capabilityId: 'pdf', rootDirectory, targetDirectory });
		});
	});

	void it('keeps ordinary materialized apps free of PDF code and assets', (): void => {
		const fixtureRoot = temporaryDirectory('wallboard-no-pdf-source-');
		const targetDirectory = temporaryDirectory('wallboard-no-pdf-target-');
		writeJson(path.join(fixtureRoot, 'package.json'), { name: 'plain-boilerplate' });
		fs.mkdirSync(path.join(fixtureRoot, 'src'), { recursive: true });
		fs.writeFileSync(path.join(fixtureRoot, 'src', 'index.ts'), 'export const base = true;\n');
		writeJson(path.join(fixtureRoot, 'examples', 'plain', 'example.json'), {
			id: 'plain',
			title: 'Plain app'
		});
		fs.mkdirSync(path.join(fixtureRoot, 'examples', 'plain', 'overlay', 'src'), { recursive: true });
		fs.writeFileSync(path.join(fixtureRoot, 'examples', 'plain', 'overlay', 'src', 'app.ts'), 'export const app = true;\n');
		fs.mkdirSync(path.join(fixtureRoot, 'capabilities', 'pdf'), { recursive: true });
		fs.writeFileSync(path.join(fixtureRoot, 'capabilities', 'pdf', 'sentinel.js'), 'PDF_SENTINEL\n');

		materializeExample({ exampleId: 'plain', rootDirectory: fixtureRoot, targetDirectory });

		const packageJson = JSON.parse(fs.readFileSync(path.join(targetDirectory, 'package.json'), 'utf8'));
		assert.equal(packageJson.wallboardCapabilities, undefined);
		assert.equal(fs.existsSync(path.join(targetDirectory, 'capabilities')), false);
		assert.equal(fs.existsSync(path.join(targetDirectory, 'src', 'capabilities', 'pdf')), false);
		assert.equal(fs.readFileSync(path.join(targetDirectory, 'src', 'index.ts'), 'utf8').includes('PDF_SENTINEL'), false);
	});

	void it('refuses to overwrite project code with different capability content', {
		skip: !hasPdfCapabilityCatalog
	}, (): void => {
		const targetDirectory = temporaryDirectory('wallboard-pdf-collision-');
		writeJson(path.join(targetDirectory, 'package.json'), { name: 'collision-target' });
		const collisionPath = path.join(targetDirectory, 'src', 'capabilities', 'pdf', 'index.ts');
		fs.mkdirSync(path.dirname(collisionPath), { recursive: true });
		fs.writeFileSync(collisionPath, 'export const custom = true;\n');

		assert.throws(
			(): void => { applyCapability({ capabilityId: 'pdf', rootDirectory, targetDirectory }); },
			/overwrite different content/
		);
	});

	void it('keeps the emitted worker external to the Chrome 49 transpilation pass', (): void => {
		const createChrome49Config = require('../../package-tools/chrome-49-webpack.config.cjs') as () => {
			externals: Record<string, string>;
			module: { parser: { javascript: { url: boolean } } };
			resolve: { fallback: Record<string, boolean> };
		};
		const config = createChrome49Config();

		assert.equal(config.externals['./pdf.worker.js'], 'commonjs ./pdf.worker.js');
		assert.equal(config.module.parser.javascript.url, false);
		assert.deepEqual(config.resolve.fallback, {
			fs: false,
			http: false,
			https: false,
			url: false,
			zlib: false
		});
	});
});
