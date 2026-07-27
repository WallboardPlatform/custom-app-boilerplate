import fs from 'node:fs';
import path from 'node:path';

import { materializeExample } from '../example-materialization.mjs';
import { createVisualReviewSourceHash } from './model.mts';

/**
 * Refuses to promote a review whose workspace predates the current repository source.
 *
 * `validate:visual-review` compares a workspace against the snapshot inside that same workspace,
 * so a workspace prepared before a later source change is internally consistent and passes. The
 * screenshots and hash it promotes are then evidence for code that no longer exists.
 *
 * This is not hypothetical: it happened twice while building the archetype standards, both times
 * because a control experiment re-prepared an example with a reverted fix in the tree and the
 * next promote picked that workspace up. Both were caught later by
 * `validate-example-reviews`, after the wrong evidence had already been committed.
 */

const [exampleId, reviewDirectory] = process.argv.slice(2);

if (!exampleId || !reviewDirectory) {
	throw new Error('Usage: assert-workspace-current.mts <example-id> <review-directory>');
}

const rootDirectory: string = process.cwd();
const reviewPath: string = path.join(reviewDirectory, 'preview', 'visual-review.json');

if (!fs.existsSync(reviewPath)) {
	throw new Error(`No review at ${reviewPath}. Prepare the workspace first.`);
}

const review = JSON.parse(fs.readFileSync(reviewPath, 'utf8')) as { sourceHash: string };
const probeDirectory: string = path.join(rootDirectory, '.tmp', 'promote-probe', exampleId);

fs.rmSync(probeDirectory, { recursive: true, force: true });

try {
	materializeExample({ rootDirectory, exampleId, targetDirectory: probeDirectory });

	const current: string = createVisualReviewSourceHash(probeDirectory);

	if (current !== review.sourceHash) {
		throw new Error(
			`The '${exampleId}' review workspace was prepared from different source than the repository now holds. `
			+ 'Re-run example:review:prepare and inspect the fresh screenshots before promoting; promoting now '
			+ 'would record evidence for code that is no longer there.'
		);
	}
} finally {
	fs.rmSync(probeDirectory, { recursive: true, force: true });
}

process.stdout.write(`Review workspace for '${exampleId}' matches the current source.\n`);
