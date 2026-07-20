import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';

import { materializeExample } from '../example-materialization.mjs';

const temporaryDirectories: string[] = [];

const temporaryDirectory = (prefix: string): string => {
	const directory: string = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
	temporaryDirectories.push(directory);

	return directory;
};

const writeFile = (rootDirectory: string, relativePath: string, content: string): void => {
	const filePath: string = path.join(rootDirectory, relativePath);
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, content);
};

const writeJson = (rootDirectory: string, relativePath: string, value: unknown): void => {
	writeFile(rootDirectory, relativePath, `${JSON.stringify(value, null, '\t')}\n`);
};

afterEach((): void => {
	for (const directory of temporaryDirectories.splice(0)) {
		fs.rmSync(directory, { force: true, recursive: true });
	}
});

void describe('example materialization isolation', (): void => {
	void it('does not inherit generated root app contracts or datasource artifacts', (): void => {
		const rootDirectory: string = temporaryDirectory('wallboard-materialization-source-');
		const targetDirectory: string = temporaryDirectory('wallboard-materialization-target-');

		writeJson(rootDirectory, 'package.json', { name: 'generated-root-app' });
		writeFile(rootDirectory, 'src/index.ts', 'export const root = true;\n');
		writeFile(rootDirectory, 'root-shared.txt', 'shared scaffold\n');
		writeJson(rootDirectory, 'generation-brief.json', { request: { summary: 'Root app' } });
		writeJson(rootDirectory, 'datasource-contract.json', {
			bindings: [{ source: { sampleData: 'samples/lane-schedule.json' } }]
		});
		writeJson(rootDirectory, 'sample-datasource-laneSchedule.json', { root: true });
		writeJson(rootDirectory, 'sample-aquatics-datasource.json', { root: true });
		writeJson(rootDirectory, 'samples/lane-schedule.json', { root: true });
		writeJson(rootDirectory, 'preview/visual-review.json', { reviewer: 'root app' });
		writeJson(rootDirectory, 'src/editor-assets/datasource-contract.json', { root: true });
		writeJson(rootDirectory, 'src/editor-assets/datasource-template.json', { root: true });
		writeJson(rootDirectory, 'src/editor-assets/datasource-template-laneSchedule.json', { root: true });
		writeJson(rootDirectory, 'examples/plain/example.json', { id: 'plain', title: 'Plain example' });
		writeFile(rootDirectory, 'examples/plain/overlay/src/app.ts', 'export const example = true;\n');

		materializeExample({ exampleId: 'plain', rootDirectory, targetDirectory });

		assert.equal(fs.readFileSync(path.join(targetDirectory, 'root-shared.txt'), 'utf8'), 'shared scaffold\n');
		assert.equal(fs.readFileSync(path.join(targetDirectory, 'src', 'app.ts'), 'utf8'), 'export const example = true;\n');
		assert.equal(fs.existsSync(path.join(targetDirectory, 'generation-brief.json')), false);
		assert.equal(fs.existsSync(path.join(targetDirectory, 'datasource-contract.json')), false);
		assert.equal(fs.existsSync(path.join(targetDirectory, 'sample-datasource-laneSchedule.json')), false);
		assert.equal(fs.existsSync(path.join(targetDirectory, 'sample-aquatics-datasource.json')), false);
		assert.equal(fs.existsSync(path.join(targetDirectory, 'samples', 'lane-schedule.json')), false);
		assert.equal(fs.existsSync(path.join(targetDirectory, 'preview', 'visual-review.json')), false);
		assert.equal(fs.existsSync(path.join(targetDirectory, 'src', 'editor-assets', 'datasource-contract.json')), false);
		assert.equal(fs.existsSync(path.join(targetDirectory, 'src', 'editor-assets', 'datasource-template.json')), false);
		assert.equal(fs.existsSync(path.join(targetDirectory, 'src', 'editor-assets', 'datasource-template-laneSchedule.json')), false);
	});
});
