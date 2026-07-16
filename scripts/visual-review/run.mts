/* eslint-disable no-console */
import fs from 'node:fs';
import path from 'node:path';

import {
	collectScreenshotFiles,
	createPendingVisualReview,
	createVisualReviewSourceHash,
	VISUAL_REVIEW_CRITERIA,
	type VisualReview,
	type VisualReviewCriterion,
	type VisualReviewScreenshot
} from './model.mts';

interface GenerationBriefVisualSummary {
	visualDirection?: {
		source?: string;
	};
}

const projectDirectory: string = process.cwd();
const reviewPath: string = path.join(projectDirectory, 'preview', 'visual-review.json');
const briefPath: string = path.join(projectDirectory, 'generation-brief.json');
const mode: string = process.argv[2] ?? '';

const fail = (message: string): never => {
	throw new Error(`visual-review: ${message}`);
};

const readReview = (): VisualReview | undefined => {
	if (!fs.existsSync(reviewPath)) {
		return undefined;
	}

	return JSON.parse(fs.readFileSync(reviewPath, 'utf8')) as VisualReview;
};

if (mode === '--prepare') {
	const review: VisualReview = createPendingVisualReview(projectDirectory, readReview());

	if (review.screenshots.length === 0) {
		fail('no screenshots found; run npm run validate:visual first.');
	}

	fs.writeFileSync(reviewPath, `${JSON.stringify(review, null, '\t')}\n`, 'utf8');
	console.log(`Visual review checklist prepared: ${reviewPath}`);
	console.log('Inspect every screenshot, then set criteria and screenshot statuses before delivery.');
} else if (mode === '--validate') {
	const review: VisualReview = readReview()
		?? fail('preview/visual-review.json is missing; run npm run prepare:visual-review after visual validation.');

	if (review.reviewVersion !== 1 || review.sourceHash !== createVisualReviewSourceHash(projectDirectory)) {
		fail('review is stale for the current app, fixture, brief, or datasource sample. Prepare and inspect it again.');
	}

	if (!review.reviewedAt || Number.isNaN(Date.parse(review.reviewedAt)) || review.reviewer.trim() === '') {
		fail('reviewedAt and reviewer must identify the completed review.');
	}

	const criteria = new Map<string, VisualReviewCriterion>(
		review.criteria.map((criterion: VisualReviewCriterion): [string, VisualReviewCriterion] => [criterion.id, criterion])
	);
	const brief: GenerationBriefVisualSummary = JSON.parse(fs.readFileSync(briefPath, 'utf8')) as GenerationBriefVisualSummary;

	for (const id of VISUAL_REVIEW_CRITERIA) {
		const criterion: VisualReviewCriterion = criteria.get(id)
			?? fail(`criterion '${id}' is missing.`);

		if (criterion.status === 'pending' || criterion.notes.trim().length < 12) {
			fail(`criterion '${id}' needs pass/not-applicable status and a concrete review note.`);
		}

		if (id === 'referenceFidelity' && brief.visualDirection?.source === 'reference-led' && criterion.status !== 'pass') {
			fail('reference-led apps must pass referenceFidelity.');
		}
	}

	const expectedScreenshots: string[] = collectScreenshotFiles(projectDirectory);
	const reviewedScreenshots = new Map<string, VisualReviewScreenshot>(
		review.screenshots.map((screenshot: VisualReviewScreenshot): [string, VisualReviewScreenshot] => [screenshot.file, screenshot])
	);

	if (
		expectedScreenshots.length === 0
		|| expectedScreenshots.length !== reviewedScreenshots.size
		|| expectedScreenshots.some((file: string): boolean => reviewedScreenshots.get(file)?.status !== 'pass')
	) {
		fail('every current preview/output PNG must appear exactly once with pass status.');
	}

	if (review.unresolvedFindings.length > 0) {
		fail(`unresolved findings remain: ${review.unresolvedFindings.join('; ')}`);
	}

	console.log(`Visual review valid: ${expectedScreenshots.length} screenshots inspected against current source.`);
} else {
	fail('use --prepare or --validate.');
}
