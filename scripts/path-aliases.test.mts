import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { readPathAliases, resolvedPathAliases } from './path-aliases.mts';

const projectWith = (tsconfig: string): string => {
	const directory: string = fs.mkdtempSync(path.join(os.tmpdir(), 'aliases-'));

	fs.writeFileSync(path.join(directory, 'tsconfig.json'), tsconfig, 'utf8');

	return directory;
};

void describe('path aliases', (): void => {
	void it('reads the aliases the repository actually declares', (): void => {
		const aliases: Record<string, string> = readPathAliases(process.cwd());

		assert.equal(aliases['@utils'], 'src/utils');
		assert.equal(aliases['@components'], 'src/components');
	});

	void it('keeps alias patterns intact when tsconfig carries comments', (context): void => {
		// The alias patterns contain the same slash-star sequence that opens a block comment, so
		// a regex-based comment stripper eats from inside one string to the next terminator.
		const directory: string = projectWith(`{
			// leading line comment
			"compilerOptions": {
				/* block comment */
				"paths": {
					"@contexts/*": ["src/contexts/*"],
					"@utils/*": ["src/utils/*"]
				}
			}
		}`);
		context.after((): void => fs.rmSync(directory, { recursive: true, force: true }));

		assert.deepEqual(readPathAliases(directory), { '@contexts': 'src/contexts', '@utils': 'src/utils' });
	});

	void it('tolerates trailing commas', (context): void => {
		const directory: string = projectWith('{"compilerOptions":{"paths":{"@utils/*":["src/utils/*"],},},}');
		context.after((): void => fs.rmSync(directory, { recursive: true, force: true }));

		assert.deepEqual(readPathAliases(directory), { '@utils': 'src/utils' });
	});

	void it('resolves targets against the project root', (context): void => {
		const directory: string = projectWith('{"compilerOptions":{"paths":{"@utils/*":["src/utils/*"]}}}');
		context.after((): void => fs.rmSync(directory, { recursive: true, force: true }));

		assert.equal(resolvedPathAliases(directory)['@utils'], path.resolve(directory, 'src/utils'));
	});

	void it('refuses to report an empty alias map', (context): void => {
		// Silently returning nothing would let the review fingerprint stop tracking aliased
		// imports without anything failing.
		const directory: string = projectWith('{"compilerOptions":{}}');
		context.after((): void => fs.rmSync(directory, { recursive: true, force: true }));

		assert.throws((): unknown => readPathAliases(directory), /declares no compilerOptions.paths/);
	});

	void it('refuses to guess when tsconfig is absent', (context): void => {
		const directory: string = fs.mkdtempSync(path.join(os.tmpdir(), 'aliases-'));
		context.after((): void => fs.rmSync(directory, { recursive: true, force: true }));

		assert.throws((): unknown => readPathAliases(directory), /none found/);
	});
});
