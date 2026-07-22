import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface WayfindingSourceFile {
	id: string;
	kind: 'pdf' | 'raster' | 'svg' | 'cad-bim' | 'gis' | 'other';
	note?: string;
	pages?: number[];
	path: string;
	role: 'authoritative' | 'reference' | 'supplemental';
	sha256: string;
}

export interface WayfindingSourceLevel {
	circulation: string[];
	description: string;
	destinations: string[];
	doors: string[];
	entrances: string[];
	footprint: string;
	id: string;
	sourceFileId: string;
	sourcePage: number;
	transitions: string[];
	uncertainties: string[];
}

export interface WayfindingSourceInvariant {
	category: 'footprint' | 'proportion' | 'adjacency' | 'circulation' | 'entrance' | 'door' | 'transition' | 'destination' | 'orientation' | 'other';
	id: string;
	levelIds: string[];
	severity: 'required' | 'advisory';
	statement: string;
}

export interface WayfindingSourceUnderstanding {
	allowedSimplifications: string[];
	authoredBy: string;
	contractVersion: 1;
	coordinateSystem: {
		height: number;
		mapping: string;
		origin: 'top-left' | 'bottom-left';
		tolerancePercent?: number;
		units: 'source-pixels' | 'source-points' | 'meters' | 'millimeters' | 'custom';
		width: number;
	};
	invariants: WayfindingSourceInvariant[];
	levels: WayfindingSourceLevel[];
	prohibitedChanges: string[];
	projectId: string;
	sourceFiles: WayfindingSourceFile[];
}

export interface WayfindingSourceFidelityReview {
	comparisons: Array<{
		candidateHash: string;
		candidateImage: string;
		levelId: string;
		notes: string;
		sourceHash: string;
		sourceImage: string;
		status: 'pass' | 'fail';
	}>;
	contractHash: string;
	contractPath: string;
	invariantResults: Array<{
		invariantId: string;
		notes: string;
		status: 'pass' | 'fail' | 'not-applicable';
	}>;
	projectId: string;
	reviewer: {
		context: 'independent-ai' | 'human' | 'customer';
		id: string;
		reviewedAt: string;
	};
	reviewVersion: 1;
	unresolvedFindings: string[];
}

export const hashFile = (filePath: string): string => crypto
	.createHash('sha256')
	.update(fs.readFileSync(filePath))
	.digest('hex');

export const resolveWayfindingArtifact = (baseDirectory: string, relativePath: string, field: string): string => {
	const resolvedPath: string = path.resolve(baseDirectory, relativePath);

	if (!resolvedPath.startsWith(`${baseDirectory}${path.sep}`)) {
		throw new Error(`${field} must stay inside the project directory.`);
	}

	if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
		throw new Error(`${field} '${relativePath}' was not found.`);
	}

	return resolvedPath;
};

const uniqueIds = (values: string[], field: string): void => {
	if (new Set(values).size !== values.length) throw new Error(`${field} contains duplicate ids.`);
};

export const validateWayfindingSourceFidelity = (
	projectDirectory: string,
	contractPath: string,
	reviewPath: string,
	contract: WayfindingSourceUnderstanding,
	review: WayfindingSourceFidelityReview
): void => {
	const resolvedProjectDirectory: string = path.resolve(projectDirectory);
	const resolvedContractPath: string = resolveWayfindingArtifact(resolvedProjectDirectory, contractPath, 'source reference contract');
	resolveWayfindingArtifact(resolvedProjectDirectory, reviewPath, 'source fidelity review');

	if (contract.projectId !== review.projectId) throw new Error('Source contract and fidelity review projectId values must match.');

	if (contract.authoredBy.trim() === review.reviewer.id.trim()) throw new Error('Source fidelity review must be completed by a different reviewer or agent context than the source contract author.');

	if (review.contractPath !== contractPath) throw new Error('Source fidelity review contractPath must match wayfinding-project.json.');

	if (review.contractHash !== hashFile(resolvedContractPath)) throw new Error('Source fidelity review is stale for the current source-understanding contract.');

	if (Number.isNaN(Date.parse(review.reviewer.reviewedAt))) throw new Error('Source fidelity review reviewedAt must be a valid date-time.');

	uniqueIds(contract.sourceFiles.map((file: WayfindingSourceFile): string => file.id), 'sourceFiles');
	uniqueIds(contract.levels.map((level: WayfindingSourceLevel): string => level.id), 'levels');
	uniqueIds(contract.invariants.map((invariant: WayfindingSourceInvariant): string => invariant.id), 'invariants');

	const sourceFileIds = new Set(contract.sourceFiles.map((file: WayfindingSourceFile): string => file.id));
	const levelIds = new Set(contract.levels.map((level: WayfindingSourceLevel): string => level.id));

	for (const sourceFile of contract.sourceFiles) {
		const sourcePath: string = resolveWayfindingArtifact(resolvedProjectDirectory, sourceFile.path, `source file '${sourceFile.id}'`);

		if (hashFile(sourcePath) !== sourceFile.sha256) throw new Error(`Source file '${sourceFile.id}' hash is stale.`);
	}

	for (const level of contract.levels) {
		if (!sourceFileIds.has(level.sourceFileId)) throw new Error(`Level '${level.id}' references unknown sourceFileId '${level.sourceFileId}'.`);
	}

	for (const invariant of contract.invariants) {
		for (const levelId of invariant.levelIds) {
			if (!levelIds.has(levelId)) throw new Error(`Invariant '${invariant.id}' references unknown level '${levelId}'.`);
		}
	}

	uniqueIds(review.comparisons.map((comparison): string => comparison.levelId), 'comparisons');
	uniqueIds(review.invariantResults.map((result): string => result.invariantId), 'invariantResults');

	const comparisonByLevel = new Map(review.comparisons.map((comparison) => [comparison.levelId, comparison]));

	for (const level of contract.levels) {
		const comparison = comparisonByLevel.get(level.id);

		if (!comparison) throw new Error(`Source fidelity review is missing level comparison '${level.id}'.`);

		if (comparison.status !== 'pass') throw new Error(`Source fidelity comparison '${level.id}' did not pass.`);

		const sourceImage: string = resolveWayfindingArtifact(resolvedProjectDirectory, comparison.sourceImage, `comparison '${level.id}' sourceImage`);
		const candidateImage: string = resolveWayfindingArtifact(resolvedProjectDirectory, comparison.candidateImage, `comparison '${level.id}' candidateImage`);

		if (hashFile(sourceImage) !== comparison.sourceHash) throw new Error(`Comparison '${level.id}' source image hash is stale.`);

		if (hashFile(candidateImage) !== comparison.candidateHash) throw new Error(`Comparison '${level.id}' candidate image hash is stale.`);
	}

	const invariantResults = new Map(review.invariantResults.map((result) => [result.invariantId, result]));

	for (const invariant of contract.invariants) {
		const result = invariantResults.get(invariant.id);

		if (!result) throw new Error(`Source fidelity review is missing invariant '${invariant.id}'.`);

		if (result.status === 'fail' || (invariant.severity === 'required' && result.status !== 'pass')) {
			throw new Error(`Source fidelity invariant '${invariant.id}' did not pass.`);
		}
	}

	if (review.unresolvedFindings.length > 0) throw new Error(`Source fidelity review has unresolved findings: ${review.unresolvedFindings.join('; ')}`);
};
