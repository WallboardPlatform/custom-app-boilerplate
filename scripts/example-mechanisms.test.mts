import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import {
	findOverlaps,
	readClaims,
	readVocabulary,
	validateClaims,
	validateReferenceTeachers
} from './example-mechanisms.mts';

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

	void it('accepts a reference teacher that claims the mechanism', (): void => {
		const problems: string[] = validateReferenceTeachers(
			{ note: 'prose', 'dense-table-board': 'airport' },
			claimsOf({ airport: ['dense-table-board'] }),
			new Set(['dense-table-board'])
		);

		assert.deepEqual(problems, []);
	});

	void it('rejects a reference teacher that does not claim the mechanism', (): void => {
		// Caught two of my own assignments the first time it ran.
		const problems: string[] = validateReferenceTeachers(
			{ 'dense-table-board': 'museum' },
			claimsOf({ museum: ['editorial-poster'] }),
			new Set(['dense-table-board', 'editorial-poster'])
		);

		assert.match(problems[0] ?? '', /does not claim it/);
	});

	void it('rejects a reference teacher naming an example that does not exist', (): void => {
		const problems: string[] = validateReferenceTeachers(
			{ 'dense-table-board': 'ghost' },
			claimsOf({ airport: ['dense-table-board'] }),
			new Set(['dense-table-board'])
		);

		assert.match(problems[0] ?? '', /is not an example/);
	});

	void it('rejects a reference for something that is not a mechanism', (): void => {
		const problems: string[] = validateReferenceTeachers(
			{ invented: 'airport' },
			claimsOf({ airport: ['dense-table-board'] }),
			new Set(['dense-table-board'])
		);

		assert.match(problems[0] ?? '', /is not a mechanism/);
	});

	void it('the shipped reference teachers are all consistent', (): void => {
		const examplesDirectory: string = path.join(process.cwd(), 'examples');
		const registryPath: string = path.join(examplesDirectory, 'mechanisms.json');
		const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8')) as { referenceExample?: Record<string, string> };
		const problems: string[] = validateReferenceTeachers(
			registry.referenceExample ?? {},
			readClaims(examplesDirectory),
			readVocabulary(registryPath)
		);

		assert.deepEqual(problems, []);
	});

	void it('ignores directories without a manifest', (context): void => {
		const directory: string = fs.mkdtempSync(path.join(os.tmpdir(), 'mechanisms-'));
		context.after((): void => fs.rmSync(directory, { recursive: true, force: true }));
		fs.mkdirSync(path.join(directory, 'not-an-example'));

		assert.equal(readClaims(directory).size, 0);
	});
});
