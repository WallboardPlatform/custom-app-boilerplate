import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import {
	createPendingVisualReview,
	createVisualReviewSourceHash,
	VISUAL_REVIEW_CRITERIA,
	type VisualReview
} from './model.mts';

const createProject = (): string => {
	const projectDirectory: string = fs.mkdtempSync(path.join(os.tmpdir(), 'wallboard-review-'));

	fs.mkdirSync(path.join(projectDirectory, 'src'), { recursive: true });
	fs.mkdirSync(path.join(projectDirectory, 'src', 'editor-assets'), { recursive: true });
	fs.mkdirSync(path.join(projectDirectory, 'preview', 'output'), { recursive: true });
	fs.writeFileSync(path.join(projectDirectory, 'src', 'index.tsx'), 'import { value } from \'./app\';\nexport { value };\n');
	fs.writeFileSync(path.join(projectDirectory, 'src', 'app.tsx'), 'export const value = 1;');
	fs.writeFileSync(path.join(projectDirectory, 'src', 'editor-assets', 'properties.json'), '{}');
	fs.writeFileSync(path.join(projectDirectory, 'generation-brief.json'), '{}');
	fs.writeFileSync(path.join(projectDirectory, 'preview', 'fixture.ts'), 'export default {};');
	fs.writeFileSync(path.join(projectDirectory, 'preview', 'output', 'app-default-1x1.png'), 'png');

	return projectDirectory;
};

void describe('visual review model', (): void => {
	void it('ignores shared conformance suites when hashing the reviewed source', (context): void => {
		// The hash answers whether the app, fixture, brief or datasource sample moved since a reviewer
		// looked at the screenshots. A conformance suite is boilerplate harness that renders nothing,
		// so editing one must not invalidate every example's review and demand a re-inspection that
		// cannot reveal anything.
		const projectDirectory: string = createProject();
		context.after((): void => fs.rmSync(projectDirectory, { recursive: true, force: true }));

		fs.mkdirSync(path.join(projectDirectory, 'preview', 'conformance'), { recursive: true });
		fs.writeFileSync(
			path.join(projectDirectory, 'preview', 'conformance', 'pagination.ts'),
			'export const registerPaginationConformance = (): void => undefined;\n'
		);
		fs.writeFileSync(
			path.join(projectDirectory, 'preview', 'conformance.spec.ts'),
			"import { registerPaginationConformance } from './conformance/pagination';\nregisterPaginationConformance();\n"
		);

		const before: string = createVisualReviewSourceHash(projectDirectory);

		fs.writeFileSync(
			path.join(projectDirectory, 'preview', 'conformance', 'pagination.ts'),
			'export const registerPaginationConformance = (): void => { /* stricter now */ };\n'
		);

		assert.equal(createVisualReviewSourceHash(projectDirectory), before);

		fs.writeFileSync(path.join(projectDirectory, 'src', 'app.tsx'), 'export const value = 2;');
		assert.notEqual(
			createVisualReviewSourceHash(projectDirectory),
			before,
			'an app change must still invalidate the review'
		);
	});

	void it('creates one criterion and screenshot entry per current artifact', (context): void => {
		const projectDirectory: string = createProject();
		context.after((): void => fs.rmSync(projectDirectory, { recursive: true, force: true }));

		const review: VisualReview = createPendingVisualReview(projectDirectory);

		assert.deepEqual(review.criteria.map((criterion) => criterion.id), VISUAL_REVIEW_CRITERIA);
		assert.deepEqual(review.screenshots.map((screenshot) => screenshot.file), ['app-default-1x1.png']);
		assert.equal(review.screenshots[0]?.status, 'pending');
	});

	void it('accepts an intent-only seed review without completed evidence arrays', (context): void => {
		const projectDirectory: string = createProject();
		context.after((): void => fs.rmSync(projectDirectory, { recursive: true, force: true }));
		const seedReview = {
			intent: 'Inspect the generated signage composition.',
			focus: ['Legibility', 'Framing']
		} as unknown as VisualReview;

		const review: VisualReview = createPendingVisualReview(projectDirectory, seedReview);

		assert.deepEqual(review.criteria.map((criterion) => criterion.id), VISUAL_REVIEW_CRITERIA);
		assert.deepEqual(review.screenshots.map((screenshot) => screenshot.file), ['app-default-1x1.png']);
		assert.ok(review.criteria.every((criterion) => criterion.status === 'pending'));
	});

	void it('invalidates completed review evidence when visual source changes', (context): void => {
		const projectDirectory: string = createProject();
		context.after((): void => fs.rmSync(projectDirectory, { recursive: true, force: true }));
		const previous: VisualReview = createPendingVisualReview(projectDirectory);

		previous.reviewer = 'Independent reviewer';
		previous.reviewedAt = '2026-07-15T00:00:00.000Z';
		previous.criteria = previous.criteria.map((criterion) => ({ ...criterion, status: 'pass', notes: 'Reviewed.' }));
		previous.screenshots = previous.screenshots.map((screenshot) => ({ ...screenshot, status: 'pass' }));
		fs.writeFileSync(path.join(projectDirectory, 'src', 'app.tsx'), 'export const value = 2;');

		const next: VisualReview = createPendingVisualReview(projectDirectory, previous);

		assert.notEqual(next.sourceHash, previous.sourceHash);
		assert.equal(next.reviewer, '');
		assert.equal(next.reviewedAt, null);
		assert.ok(next.criteria.every((criterion) => criterion.status === 'pending'));
	});

	void it('ignores generated screenshots in the source hash', (context): void => {
		const projectDirectory: string = createProject();
		context.after((): void => fs.rmSync(projectDirectory, { recursive: true, force: true }));
		const before: string = createVisualReviewSourceHash(projectDirectory);

		fs.writeFileSync(path.join(projectDirectory, 'preview', 'output', 'other.png'), 'different');

		assert.equal(createVisualReviewSourceHash(projectDirectory), before);
	});

	void it('normalizes text line endings in the source hash', (context): void => {
		const projectDirectory: string = createProject();
		context.after((): void => fs.rmSync(projectDirectory, { recursive: true, force: true }));
		const sourcePath: string = path.join(projectDirectory, 'src', 'app.tsx');

		fs.writeFileSync(sourcePath, 'export const first = 1;\nexport const second = 2;\n');
		const lfHash: string = createVisualReviewSourceHash(projectDirectory);
		fs.writeFileSync(sourcePath, 'export const first = 1;\r\nexport const second = 2;\r\n');

		assert.equal(createVisualReviewSourceHash(projectDirectory), lfHash);
	});

	void it('normalizes line endings for editor-asset markup, not only script sources', (context): void => {
		// A custom settings editor contributes HTML to the fingerprint. While that extension was
		// unnormalized, the one example that ships one hashed differently on Windows and Linux,
		// so whichever platform promoted its review last made the other platform fail.
		const projectDirectory: string = createProject();
		context.after((): void => fs.rmSync(projectDirectory, { recursive: true, force: true }));
		const editorDirectory: string = path.join(projectDirectory, 'src', 'editor-assets');

		fs.mkdirSync(editorDirectory, { recursive: true });

		const markupPath: string = path.join(editorDirectory, 'index.html');

		fs.writeFileSync(markupPath, '<!doctype html>\n<title>editor</title>\n');
		const lfHash: string = createVisualReviewSourceHash(projectDirectory);
		fs.writeFileSync(markupPath, '<!doctype html>\r\n<title>editor</title>\r\n');

		assert.equal(createVisualReviewSourceHash(projectDirectory), lfHash);
	});

	void it('ignores generated datasource sidecars but tracks every declared root source', (context): void => {
		const projectDirectory: string = createProject();
		context.after((): void => fs.rmSync(projectDirectory, { recursive: true, force: true }));
		fs.writeFileSync(
			path.join(projectDirectory, 'datasource-contract.json'),
			JSON.stringify({
				bindings: [
					{ source: { sampleData: 'sample-questions.json' } },
					{ source: { sampleData: 'sample-results.json' } }
				]
			})
		);
		fs.writeFileSync(path.join(projectDirectory, 'sample-questions.json'), '{"rows":[]}');
		fs.writeFileSync(path.join(projectDirectory, 'sample-results.json'), '{"rows":[]}');
		const before: string = createVisualReviewSourceHash(projectDirectory);

		fs.writeFileSync(
			path.join(projectDirectory, 'src', 'editor-assets', 'datasource-contract.json'),
			'{"version":1}'
		);
		fs.writeFileSync(
			path.join(projectDirectory, 'src', 'editor-assets', 'datasource-template.json'),
			'{"rows":[]}'
		);

		assert.equal(createVisualReviewSourceHash(projectDirectory), before);
		fs.writeFileSync(path.join(projectDirectory, 'sample-results.json'), '{"rows":[{"id":1}]}');
		assert.notEqual(createVisualReviewSourceHash(projectDirectory), before);
	});

	void it('ignores unused boilerplate utilities but tracks reachable dependencies', (context): void => {
		const projectDirectory: string = createProject();
		context.after((): void => fs.rmSync(projectDirectory, { recursive: true, force: true }));
		const before: string = createVisualReviewSourceHash(projectDirectory);

		fs.writeFileSync(path.join(projectDirectory, 'src', 'unused.ts'), 'export const unused = 2;');
		assert.equal(createVisualReviewSourceHash(projectDirectory), before);

		fs.writeFileSync(path.join(projectDirectory, 'src', 'app.tsx'), 'export const value = 3;');
		assert.notEqual(createVisualReviewSourceHash(projectDirectory), before);
	});
});
