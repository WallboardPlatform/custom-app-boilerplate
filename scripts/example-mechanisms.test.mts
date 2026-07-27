import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { findOverlaps, readClaims, readVocabulary, validateClaims } from './example-mechanisms.mts';

const claimsOf = (entries: Record<string, string[]>): Map<string, string[]> => new Map(Object.entries(entries));

void describe('example mechanism registry', (): void => {
	void it('reads the vocabulary the repository actually declares', (): void => {
		const vocabulary: Set<string> = readVocabulary(path.join(process.cwd(), 'examples', 'mechanisms.json'));

		assert.ok(vocabulary.has('auto-fit-text'));
		assert.ok(vocabulary.has('map-orientation'));
		assert.ok(!vocabulary.has('note'), 'the prose note must not be read as a mechanism');
	});

	void it('every shipped example declares a mechanism from the vocabulary', (): void => {
		const examplesDirectory: string = path.join(process.cwd(), 'examples');
		const problems: string[] = validateClaims(
			readClaims(examplesDirectory),
			readVocabulary(path.join(examplesDirectory, 'mechanisms.json'))
		);

		assert.deepEqual(problems, []);
	});

	void it('rejects a mechanism outside the vocabulary', (): void => {
		// Free text would let every example mint a unique mechanism, and the rule would enforce
		// nothing at all.
		const problems: string[] = validateClaims(claimsOf({ demo: ['invented'] }), new Set(['auto-fit-text']));

		assert.equal(problems.length, 1);
		assert.match(problems[0] ?? '', /not in examples\/mechanisms\.json/);
	});

	void it('rejects an example that declares nothing', (): void => {
		const problems: string[] = validateClaims(claimsOf({ demo: [] }), new Set(['auto-fit-text']));

		assert.match(problems[0] ?? '', /declares no mechanisms/);
	});

	void it('flags an example whose every mechanism is taught elsewhere', (): void => {
		const overlaps = findOverlaps(claimsOf({
			broad: ['a', 'b', 'c'],
			subset: ['a', 'b']
		}));

		assert.deepEqual(overlaps, [{ exampleId: 'subset', coveredBy: ['broad'] }]);
	});

	void it('accepts partial sharing, which is normal', (): void => {
		// Sharing a mechanism is expected. Teaching nothing new is the problem.
		assert.deepEqual(findOverlaps(claimsOf({ left: ['a', 'b'], right: ['b', 'c'] })), []);
	});

	void it('reports a mutual pair from both sides', (): void => {
		const overlaps = findOverlaps(claimsOf({ one: ['a'], two: ['a'] }));

		assert.equal(overlaps.length, 2);
	});

	void it('ignores directories without a manifest', (context): void => {
		const directory: string = fs.mkdtempSync(path.join(os.tmpdir(), 'mechanisms-'));
		context.after((): void => fs.rmSync(directory, { recursive: true, force: true }));
		fs.mkdirSync(path.join(directory, 'not-an-example'));

		assert.equal(readClaims(directory).size, 0);
	});
});
