import fs from 'node:fs';
import path from 'node:path';

import { materializeExample } from './example-materialization.mjs';
import { createVisualReviewSourceHash, type VisualReview } from './visual-review/model.mts';

const rootDirectory: string = process.cwd();
const examplesDirectory: string = path.join(rootDirectory, 'examples');
const validationDirectory: string = path.join(rootDirectory, '.tmp', 'example-review-validation');

let validatedReviews = 0;

fs.rmSync(validationDirectory, { recursive: true, force: true });

try {
	for (const entry of fs.readdirSync(examplesDirectory, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;

		const projectDirectory: string = path.join(validationDirectory, entry.name);

		materializeExample({ rootDirectory, exampleId: entry.name, targetDirectory: projectDirectory });
		const reviewPath: string = path.join(projectDirectory, 'preview', 'visual-review.json');

		if (!fs.existsSync(reviewPath)) {
			throw new Error(`${entry.name}: preview/visual-review.json is missing.`);
		}

		const review: VisualReview = JSON.parse(fs.readFileSync(reviewPath, 'utf8')) as VisualReview;
		const currentHash: string = createVisualReviewSourceHash(projectDirectory);

		if (review.sourceHash !== currentHash) {
			throw new Error(`${entry.name}: visual review is stale for the materialized example.`);
		}

		validatedReviews += 1;
	}
} finally {
	fs.rmSync(validationDirectory, { recursive: true, force: true });
}

process.stdout.write(`Validated ${validatedReviews} materialized visual review hash(es).\n`);
