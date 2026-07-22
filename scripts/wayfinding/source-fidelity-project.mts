import fs from 'node:fs';
import path from 'node:path';

import type { WayfindingProjectDocument } from './project.mjs';
import { parseWayfindingSourceFidelityReview, parseWayfindingSourceUnderstanding } from './schema.mjs';
import { resolveWayfindingArtifact, validateWayfindingSourceFidelity } from './source-fidelity.mjs';

export const validateConfiguredSourceFidelity = (
	projectDirectory: string,
	project: WayfindingProjectDocument
): void => {
	if (project.source.presentation !== 'redrawn-equivalent') return;

	const contractPath: string = project.source.referenceContract ?? '';
	const reviewPath: string = project.source.fidelityReview ?? '';

	if (!contractPath || !reviewPath) {
		throw new Error('Redrawn-equivalent wayfinding requires source.referenceContract and source.fidelityReview.');
	}

	const absoluteContractPath: string = resolveWayfindingArtifact(projectDirectory, contractPath, 'source reference contract');
	const absoluteReviewPath: string = resolveWayfindingArtifact(projectDirectory, reviewPath, 'source fidelity review');
	const contract = parseWayfindingSourceUnderstanding(fs.readFileSync(absoluteContractPath, 'utf8'));
	const review = parseWayfindingSourceFidelityReview(fs.readFileSync(absoluteReviewPath, 'utf8'));

	if (contract.projectId !== project.projectId) {
		throw new Error('Source-understanding contract projectId must match wayfinding-project.json.');
	}

	validateWayfindingSourceFidelity(projectDirectory, contractPath, reviewPath, contract, review);
};
