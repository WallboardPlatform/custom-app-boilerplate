import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { parseWayfindingSourceFidelityReview, parseWayfindingSourceUnderstanding } from './schema.mjs';
import {
	hashFile,
	resolveWayfindingArtifact,
	validateWayfindingSourceFidelity,
	type WayfindingSourceFidelityReview,
	type WayfindingSourceUnderstanding
} from './source-fidelity.mjs';

const writeJson = (filePath: string, value: unknown): void => {
	fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
};

const fixture = (): {
	contract: WayfindingSourceUnderstanding;
	directory: string;
	review: WayfindingSourceFidelityReview;
} => {
	const directory: string = fs.mkdtempSync(path.join(os.tmpdir(), 'wayfinding-source-fidelity-'));
	fs.mkdirSync(path.join(directory, 'reference'));
	fs.writeFileSync(path.join(directory, 'reference', 'source.png'), 'source image');
	fs.writeFileSync(path.join(directory, 'reference', 'candidate.png'), 'candidate image');

	const contract: WayfindingSourceUnderstanding = {
		allowedSimplifications: ['Furniture may be omitted.'],
		authoredBy: 'author-agent',
		contractVersion: 1,
		coordinateSystem: {
			height: 100,
			mapping: 'Map coordinates match source pixels.',
			origin: 'top-left',
			tolerancePercent: 2,
			units: 'source-pixels',
			width: 200
		},
		invariants: [{
			category: 'footprint',
			id: 'level-1-footprint',
			levelIds: ['level-1'],
			severity: 'required',
			statement: 'Preserve the asymmetric shell.'
		}],
		levels: [{
			circulation: ['One central public corridor.'],
			description: 'Public ground floor.',
			destinations: ['Service desk east of lobby.'],
			doors: ['Service desk door opens to corridor.'],
			entrances: ['South public entrance.'],
			footprint: 'Asymmetric shell.',
			id: 'level-1',
			sourceFileId: 'source-plan',
			sourcePage: 1,
			transitions: ['Elevator north of lobby.'],
			uncertainties: ['Installed kiosk orientation.']
		}],
		prohibitedChanges: ['Do not move transitions.'],
		projectId: 'test-wayfinding',
		sourceFiles: [{
			id: 'source-plan',
			kind: 'raster',
			path: 'reference/source.png',
			role: 'authoritative',
			sha256: hashFile(path.join(directory, 'reference', 'source.png'))
		}]
	};

	writeJson(path.join(directory, 'source-understanding.json'), contract);

	const review: WayfindingSourceFidelityReview = {
		comparisons: [{
			candidateHash: hashFile(path.join(directory, 'reference', 'candidate.png')),
			candidateImage: 'reference/candidate.png',
			levelId: 'level-1',
			notes: 'Footprint and public circulation match the source image.',
			sourceHash: hashFile(path.join(directory, 'reference', 'source.png')),
			sourceImage: 'reference/source.png',
			status: 'pass'
		}],
		contractHash: hashFile(path.join(directory, 'source-understanding.json')),
		contractPath: 'source-understanding.json',
		invariantResults: [{
			invariantId: 'level-1-footprint',
			notes: 'Overlay review confirms the asymmetric shell.',
			status: 'pass'
		}],
		projectId: 'test-wayfinding',
		reviewer: {
			context: 'independent-ai',
			id: 'review-agent',
			reviewedAt: '2026-07-22T08:00:00.000Z'
		},
		reviewVersion: 1,
		unresolvedFindings: []
	};

	writeJson(path.join(directory, 'source-fidelity-review.json'), review);

	return { contract, directory, review };
};

void describe('wayfinding source fidelity', () => {
	void it('validates immutable source and independently reviewed candidate evidence', () => {
		const { contract, directory, review } = fixture();

		assert.doesNotThrow((): void => validateWayfindingSourceFidelity(
			directory,
			'source-understanding.json',
			'source-fidelity-review.json',
			parseWayfindingSourceUnderstanding(JSON.stringify(contract)),
			parseWayfindingSourceFidelityReview(JSON.stringify(review))
		));
	});

	void it('rejects a stale candidate render', () => {
		const { contract, directory, review } = fixture();
		fs.writeFileSync(path.join(directory, 'reference', 'candidate.png'), 'changed candidate');

		assert.throws(
			(): void => validateWayfindingSourceFidelity(directory, 'source-understanding.json', 'source-fidelity-review.json', contract, review),
			/candidate image hash is stale/
		);
	});

	void it('rejects self-review and unresolved required invariants', () => {
		const { contract, directory, review } = fixture();
		review.reviewer.id = contract.authoredBy;

		assert.throws(
			(): void => validateWayfindingSourceFidelity(directory, 'source-understanding.json', 'source-fidelity-review.json', contract, review),
			/different reviewer or agent context/
		);

		review.reviewer.id = 'review-agent';
		review.invariantResults[0].status = 'fail';

		assert.throws(
			(): void => validateWayfindingSourceFidelity(directory, 'source-understanding.json', 'source-fidelity-review.json', contract, review),
			/did not pass/
		);
	});

	void it('rejects artifacts outside the project before reading them', () => {
		const { directory } = fixture();

		assert.throws(
			(): string => resolveWayfindingArtifact(directory, '../outside.json', 'source reference contract'),
			/must stay inside the project directory/
		);
	});
});
