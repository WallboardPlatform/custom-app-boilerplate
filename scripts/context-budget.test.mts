import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { measureMarkdownContext, resolveContextBudgetTokens, validateContextBudget } from './context-budget.mts';

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

	void it('fails when tracked Markdown exceeds the approved budget', (context): void => {
		const directory: string = fs.mkdtempSync(path.join(os.tmpdir(), 'wallboard-context-budget-'));
		context.after((): void => fs.rmSync(directory, { recursive: true, force: true }));
		fs.writeFileSync(path.join(directory, 'README.md'), 'x'.repeat(400));

		assert.throws((): unknown => validateContextBudget(directory, 50), /Markdown context uses 100 estimated tokens/);
	});

	void it('allows an explicitly justified budget above the review threshold', (): void => {
		assert.equal(resolveContextBudgetTokens({
			approvedBudgetTokens: 36_000,
			justification: 'Agent-facing contract documents grew with the v7 brief and the Wayfinding Studio surface.',
			reviewThresholdTokens: 30_000
		}), 36_000);
	});

	void it('rejects an unexplained budget increase', (): void => {
		assert.throws((): unknown => resolveContextBudgetTokens({
			approvedBudgetTokens: 36_000,
			justification: 'Needed.',
			reviewThresholdTokens: 30_000
		}), /meaningful tracked justification/);
	});
});
