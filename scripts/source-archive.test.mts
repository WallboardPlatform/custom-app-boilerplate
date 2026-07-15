import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { collectSourceFiles, readGitProvenance, shouldExcludeSourcePath } from './source-archive.mts';

void describe('source archive filtering', (): void => {
	void it('excludes credentials, generated output, caches, and archives', (): void => {
		for (const relativePath of [
			'.npmrc',
			'packages/widget/.npmrc',
			'.netrc',
			'.pypirc',
			'.env',
			'.env.production',
			'config.json',
			'credentials.json',
			'config/service-account.json',
			'keys/id_rsa',
			'keys/signing.keystore',
			'dist/assets/app.js',
			'node_modules/package/index.js',
			'preview/output/default.png',
			'preview/.playwright/state.json',
			'certificate.pem',
			'legacy-delivery.rar',
			'delivery.zip'
		]) {
			assert.equal(shouldExcludeSourcePath(relativePath), true, relativePath);
		}
	});

	void it('keeps source, documentation, samples, and public configuration', (): void => {
		for (const relativePath of [
			'package.json',
			'config.json.sample',
			'credentials.example.json',
			'service-account.example.json',
			'src/components/wb-app/wb-app.tsx',
			'preview/fixture.ts',
			'sample-datasource.json',
			'docs/system/configuration.md'
		]) {
			assert.equal(shouldExcludeSourcePath(relativePath), false, relativePath);
		}
	});

	void it('collects an agent-ready project without an in-project delivery directory', (testContext): void => {
		const projectDirectory: string = fs.mkdtempSync(path.join(os.tmpdir(), 'wallboard-source-'));
		const deliveryDirectory: string = path.join(projectDirectory, 'delivery');
		testContext.after((): void => fs.rmSync(projectDirectory, { recursive: true, force: true }));

		fs.mkdirSync(path.join(projectDirectory, 'src'), { recursive: true });
		fs.mkdirSync(path.join(projectDirectory, 'node_modules', 'dependency'), { recursive: true });
		fs.mkdirSync(deliveryDirectory, { recursive: true });
		fs.writeFileSync(path.join(projectDirectory, 'package.json'), '{}');
		fs.writeFileSync(path.join(projectDirectory, 'src', 'app.ts'), 'export {};');
		fs.writeFileSync(path.join(projectDirectory, '.npmrc'), 'secret-token');
		fs.writeFileSync(path.join(projectDirectory, 'node_modules', 'dependency', 'index.js'), 'ignored');
		fs.writeFileSync(path.join(deliveryDirectory, 'old.zip'), 'ignored');

		assert.deepEqual(
			collectSourceFiles(projectDirectory, deliveryDirectory).map((filePath: string): string => {
				return filePath.split(path.sep).join('/');
			}),
			['package.json', 'src/app.ts']
		);
	});

	void it('does not inherit provenance from a parent repository', (testContext): void => {
		const nestedProject: string = path.join(process.cwd(), '.tmp', 'source-provenance-test');
		testContext.after((): void => fs.rmSync(nestedProject, { recursive: true, force: true }));
		fs.mkdirSync(nestedProject, { recursive: true });

		assert.deepEqual(readGitProvenance(nestedProject), {
			commit: null,
			workingTreeClean: null
		});
	});
});
