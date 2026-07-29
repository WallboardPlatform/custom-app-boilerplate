import fs from 'node:fs';
import path from 'node:path';

/**
 * Enforces the portfolio rule the repository has always stated and never checked: promote an
 * example only when it teaches a distinct reusable mechanism.
 *
 * The rule has only ever been applied when adding an example, never when keeping one, so
 * duplication accumulates silently until a budget forces the question. Both budgets are now
 * close to their ceilings, and many more use cases are coming.
 *
 * The vocabulary in `examples/mechanisms.json` is deliberately closed. If it were free text,
 * every example could mint a unique mechanism and the rule would enforce nothing.
 */

export interface MechanismRegistry {
	vocabulary: Set<string>;
	claims: Map<string, string[]>;
}

export interface OverlapFinding {
	exampleId: string;
	/** Examples that already declare everything this one declares. */
	coveredBy: string[];
}

const VOCABULARY_KEYS_TO_SKIP = new Set(['note', 'referenceExample']);

export const readVocabulary = (registryPath: string): Set<string> => {
	const raw = JSON.parse(fs.readFileSync(registryPath, 'utf8')) as Record<string, unknown>;
	const ids = new Set<string>();

	for (const [group, entries] of Object.entries(raw)) {
		if (VOCABULARY_KEYS_TO_SKIP.has(group) || typeof entries !== 'object' || entries === null) continue;

		for (const id of Object.keys(entries)) ids.add(id);
	}

	return ids;
};

export const readClaims = (examplesDirectory: string): Map<string, string[]> => {
	const claims = new Map<string, string[]>();

	for (const entry of fs.readdirSync(examplesDirectory, { withFileTypes: true })) {
		const manifestPath: string = path.join(examplesDirectory, entry.name, 'example.json');

		if (!entry.isDirectory() || !fs.existsSync(manifestPath)) continue;

		const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { mechanisms?: string[] };

		claims.set(entry.name, manifest.mechanisms ?? []);
	}

	return claims;
};

/**
 * An example is redundant when every mechanism it claims is already claimed elsewhere — not when
 * it merely shares some. Sharing is expected; teaching nothing new is the problem.
 */
export const findOverlaps = (claims: Map<string, string[]>): OverlapFinding[] => {
	const findings: OverlapFinding[] = [];

	for (const [exampleId, mechanisms] of claims) {
		if (mechanisms.length === 0) continue;

		const coveredBy: string[] = [];

		for (const [otherId, otherMechanisms] of claims) {
			if (otherId === exampleId) continue;

			if (mechanisms.every((mechanism: string): boolean => otherMechanisms.includes(mechanism))) {
				coveredBy.push(otherId);
			}
		}

		if (coveredBy.length > 0) findings.push({ exampleId, coveredBy });
	}

	return findings;
};

/**
 * The registry answers "is this mechanism covered?". It does not answer "which example teaches
 * it best", and those are different questions: an app can teach an already-covered mechanism
 * better than the incumbent. Recording a reference teacher makes that a decision the repository
 * holds, so a better example can take over without either one being deleted.
 */
export const validateReferenceTeachers = (
	referenceExample: Record<string, string>,
	claims: Map<string, string[]>,
	vocabulary: Set<string>
): string[] => {
	const problems: string[] = [];

	for (const [mechanism, exampleId] of Object.entries(referenceExample)) {
		if (mechanism === 'note') continue;

		if (!vocabulary.has(mechanism)) {
			problems.push(`referenceExample names '${mechanism}', which is not a mechanism.`);

			continue;
		}

		const claimed: string[] | undefined = claims.get(exampleId);

		if (!claimed) {
			problems.push(`referenceExample for '${mechanism}' names '${exampleId}', which is not an example.`);
		} else if (!claimed.includes(mechanism)) {
			problems.push(`referenceExample for '${mechanism}' names '${exampleId}', which does not claim it.`);
		}
	}

	return problems;
};

export const validateClaims = (
	claims: Map<string, string[]>,
	vocabulary: Set<string>
): string[] => {
	const problems: string[] = [];

	for (const [exampleId, mechanisms] of claims) {
		if (mechanisms.length === 0) {
			problems.push(`${exampleId}: declares no mechanisms. State what an agent would come here to learn.`);

			continue;
		}

		for (const mechanism of mechanisms) {
			if (!vocabulary.has(mechanism)) {
				problems.push(`${exampleId}: '${mechanism}' is not in examples/mechanisms.json. Add it there deliberately, or reuse an existing entry.`);
			}
		}

		if (new Set(mechanisms).size !== mechanisms.length) {
			problems.push(`${exampleId}: repeats a mechanism.`);
		}
	}

	return problems;
};
