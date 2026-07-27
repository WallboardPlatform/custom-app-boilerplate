import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { applyCapability } from '../capability-materialization.mjs';

interface KeyboardModule {
	appendKeyboardSpace: (value: string, maximumLength?: number) => string;
	appendKeyboardValue: (value: string, key: string, maximumLength?: number) => string;
	keyboardLayoutsFor: (
		ids: readonly ('en' | 'hu')[]
	) => Array<{ id: string; rows: readonly (readonly string[])[] }>;
	removeLastKeyboardCharacter: (value: string) => string;
}

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const hasKeyboardCapabilityCatalog = fs.existsSync(
	path.join(rootDirectory, 'capabilities', 'keyboard', 'capability.json')
);
const hasMaterializedKeyboardRuntime = fs.existsSync(
	path.join(rootDirectory, 'src', 'capabilities', 'keyboard', 'keyboard.ts')
);
const keyboardImport = hasKeyboardCapabilityCatalog
	? '../../capabilities/keyboard/overlay/src/capabilities/keyboard/keyboard.js'
	: hasMaterializedKeyboardRuntime
		? '../../src/capabilities/keyboard/keyboard.js'
		: undefined;
const keyboardModule = keyboardImport
	? await import(keyboardImport) as unknown as KeyboardModule
	: undefined;
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
	void it('preserves requested built-in language order without duplicates', {
		skip: !keyboardModule
	}, (): void => {
		assert.ok(keyboardModule);
		const { keyboardLayoutsFor } = keyboardModule;

		assert.deepEqual(keyboardLayoutsFor(['hu', 'en', 'hu']).map((layout) => layout.id), ['hu', 'en']);
		assert.ok(keyboardLayoutsFor(['hu'])[0].rows.flat().includes('ő'));
	});

	void it('edits bounded Unicode text without splitting the final character', {
		skip: !keyboardModule
	}, (): void => {
		assert.ok(keyboardModule);
		const { appendKeyboardValue, removeLastKeyboardCharacter } = keyboardModule;

		assert.equal(appendKeyboardValue('Veszpr', 'é', 8), 'Veszpré');
		assert.equal(appendKeyboardValue('1234', '5', 4), '1234');
		assert.equal(removeLastKeyboardCharacter('Veszprém'), 'Veszpré');
	});

	void it('collapses the leading and doubled spaces a tapped space bar produces', {
		skip: !keyboardModule
	}, (): void => {
		assert.ok(keyboardModule);
		const { appendKeyboardSpace } = keyboardModule;

		// A wide space bar under a finger double-taps easily, and the resulting query matches
		// nothing while looking identical on screen.
		assert.equal(appendKeyboardSpace(''), '');
		assert.equal(appendKeyboardSpace('vár '), 'vár ');
		assert.equal(appendKeyboardSpace('vár'), 'vár ');
		assert.equal(appendKeyboardSpace('vár', 4), 'vár ');
		assert.equal(appendKeyboardSpace('vár', 3), 'vár');
	});

	void it('materializes only into an opted-in app', {
		skip: !hasKeyboardCapabilityCatalog
	}, (): void => {
		const targetDirectory = temporaryDirectory();
		fs.writeFileSync(path.join(targetDirectory, 'package.json'), '{}\n');

		applyCapability({ capabilityId: 'keyboard', rootDirectory, targetDirectory });

		assert.ok(fs.existsSync(path.join(targetDirectory, 'src', 'capabilities', 'keyboard', 'on-screen-keyboard.tsx')));
		const packageJson = JSON.parse(fs.readFileSync(path.join(targetDirectory, 'package.json'), 'utf8')) as { wallboardCapabilities: string[] };
		assert.deepEqual(packageJson.wallboardCapabilities, ['keyboard']);
	});
});
