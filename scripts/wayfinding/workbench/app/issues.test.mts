import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { friendlyIssue } from './issues.ts';

void test('replaces internal route edge ids with actionable publish guidance', () => {
	const message = friendlyIssue({
		code: 'route-leaves-walkable-space',
		elementIds: ['generated:level-0:connector:semantic:location-private-id', 'level-0'],
		message: 'Route edge generated:level-0:connector:semantic:location-private-id leaves the authored pedestrian area.',
		severity: 'error'
	});

	assert.equal(
		message,
		'A route segment leaves walkable space. Rebuild the network or move the segment fully inside the pedestrian area.'
	);
	assert.doesNotMatch(message, /generated:|private-id/u);
});

void test('gives every project validator issue human copy instead of exposing internal ids', async () => {
	const validatorSource = await readFile(
		new URL('../../studio-project.mts', import.meta.url),
		'utf8'
	);
	const codes = [...validatorSource.matchAll(/issues\.push\(\{ code: '([^']+)'/gu)]
		.map((match) => match[1]);
	assert.ok(codes.length > 30);

	for (const code of new Set(codes)) {
		const fallback = `Internal item 'private-${code}-id' failed validation.`;
		const message = friendlyIssue({
			code,
			elementIds: [`private-${code}-id`],
			message: fallback,
			severity: 'error'
		});

		assert.notEqual(message, fallback, `Missing friendly copy for ${code}`);
		assert.doesNotMatch(message, /private-|generated:|semantic:/u);
	}
});
