import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { summarizeImages } from './image-budget.mts';

void describe('tracked image budget', () => {
	void it('counts supported image files and ignores other assets', () => {
		const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wallboard-image-budget-'));

		try {
			fs.writeFileSync(path.join(directory, 'one.png'), Buffer.alloc(12));
			fs.writeFileSync(path.join(directory, 'two.JPG'), Buffer.alloc(8));
			fs.writeFileSync(path.join(directory, 'notes.md'), Buffer.alloc(100));

			assert.deepEqual(
				summarizeImages(directory, ['one.png', 'two.JPG', 'notes.md']),
				{ bytes: 20, count: 2 }
			);
		} finally {
			fs.rmSync(directory, { recursive: true, force: true });
		}
	});
});
