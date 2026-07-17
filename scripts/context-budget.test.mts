import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { measureMarkdownContext } from './context-budget.mts';

void describe('Markdown context budget', (): void => {
	void it('counts Markdown and ignores generated dependency directories', (context): void => {
		const directory: string = fs.mkdtempSync(path.join(os.tmpdir(), 'wallboard-context-budget-'));
		context.after((): void => fs.rmSync(directory, { recursive: true, force: true }));
		fs.mkdirSync(path.join(directory, 'docs'), { recursive: true });
		fs.mkdirSync(path.join(directory, 'node_modules', 'package'), { recursive: true });
		fs.writeFileSync(path.join(directory, 'README.md'), '1234');
		fs.writeFileSync(path.join(directory, 'docs', 'guide.md'), '12345');
		fs.writeFileSync(path.join(directory, 'node_modules', 'package', 'README.md'), 'ignored');

		assert.deepEqual(measureMarkdownContext(directory, 10), {
			files: 2,
			characters: 9,
			estimatedTokens: 3,
			targetTokens: 10
		});
	});
});
