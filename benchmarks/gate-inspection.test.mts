import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { validateDatasourceGate, validateVersionOnePolicy } from './gate-inspection.mts';

void describe('benchmark gate inspection', (): void => {
	void it('reports missing standard metadata as failed gates instead of throwing', (context): void => {
		const workspace: string = fs.mkdtempSync(path.join(os.tmpdir(), 'wallboard-gates-'));
		context.after((): void => fs.rmSync(workspace, { recursive: true, force: true }));

		assert.deepEqual(validateDatasourceGate(workspace, false), {
			contractValid: false,
			fictionalOnly: false
		});
		assert.equal(validateVersionOnePolicy(workspace), false);
	});

	void it('reports malformed metadata as failed gates instead of throwing', (context): void => {
		const workspace: string = fs.mkdtempSync(path.join(os.tmpdir(), 'wallboard-gates-'));
		context.after((): void => fs.rmSync(workspace, { recursive: true, force: true }));
		fs.mkdirSync(path.join(workspace, 'src', 'editor-assets'), { recursive: true });
		fs.writeFileSync(path.join(workspace, 'generation-brief.json'), '{broken');
		fs.writeFileSync(path.join(workspace, 'src', 'editor-assets', 'properties.json'), '{broken');

		assert.deepEqual(validateDatasourceGate(workspace, false), {
			contractValid: false,
			fictionalOnly: false
		});
		assert.equal(validateVersionOnePolicy(workspace), false);
	});

	void it('accepts a static version-one project without a datasource contract', (context): void => {
		const workspace: string = fs.mkdtempSync(path.join(os.tmpdir(), 'wallboard-gates-'));
		context.after((): void => fs.rmSync(workspace, { recursive: true, force: true }));
		fs.mkdirSync(path.join(workspace, 'src', 'editor-assets'), { recursive: true });
		fs.writeFileSync(path.join(workspace, 'generation-brief.json'), '{"data":{"mode":"static"}}');
		fs.writeFileSync(path.join(workspace, 'src', 'editor-assets', 'properties.json'), '{"version":"1"}');

		assert.deepEqual(validateDatasourceGate(workspace, true), {
			contractValid: true,
			fictionalOnly: true
		});
		assert.equal(validateVersionOnePolicy(workspace), true);
	});
});
