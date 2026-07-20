import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { applyCapability } from '../capability-materialization.mjs';
import {
	appendKeyboardValue,
	keyboardLayoutsFor,
	removeLastKeyboardCharacter
} from '../../capabilities/keyboard/overlay/src/capabilities/keyboard/keyboard.js';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const temporaryDirectories: string[] = [];

const temporaryDirectory = (): string => {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wallboard-keyboard-'));
	temporaryDirectories.push(directory);

	return directory;
};

afterEach((): void => {
	for (const directory of temporaryDirectories.splice(0)) {
		fs.rmSync(directory, { recursive: true, force: true });
	}
});

void describe('on-screen keyboard capability', (): void => {
	void it('preserves requested built-in language order without duplicates', (): void => {
		assert.deepEqual(keyboardLayoutsFor(['hu', 'en', 'hu']).map((layout) => layout.id), ['hu', 'en']);
		assert.ok(keyboardLayoutsFor(['hu'])[0].rows.flat().includes('ő'));
	});

	void it('edits bounded Unicode text without splitting the final character', (): void => {
		assert.equal(appendKeyboardValue('Veszpr', 'é', 8), 'Veszpré');
		assert.equal(appendKeyboardValue('1234', '5', 4), '1234');
		assert.equal(removeLastKeyboardCharacter('Veszprém'), 'Veszpré');
	});

	void it('materializes only into an opted-in app', (): void => {
		const targetDirectory = temporaryDirectory();
		fs.writeFileSync(path.join(targetDirectory, 'package.json'), '{}\n');

		applyCapability({ capabilityId: 'keyboard', rootDirectory, targetDirectory });

		assert.ok(fs.existsSync(path.join(targetDirectory, 'src', 'capabilities', 'keyboard', 'on-screen-keyboard.tsx')));
		const packageJson = JSON.parse(fs.readFileSync(path.join(targetDirectory, 'package.json'), 'utf8')) as { wallboardCapabilities: string[] };
		assert.deepEqual(packageJson.wallboardCapabilities, ['keyboard']);
	});
});
