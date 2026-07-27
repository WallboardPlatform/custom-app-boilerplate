import fs from 'node:fs';
import path from 'node:path';

import { findOverlaps, readClaims, readVocabulary, validateClaims } from './example-mechanisms.mts';
import type { OverlapFinding } from './example-mechanisms.mts';

const rootDirectory: string = process.cwd();
const examplesDirectory: string = path.join(rootDirectory, 'examples');
const policyPath: string = path.join(rootDirectory, 'example-mechanisms-policy.json');

interface MechanismPolicy {
	acknowledgedOverlaps: Record<string, string>;
}

const vocabulary = readVocabulary(path.join(examplesDirectory, 'mechanisms.json'));
const claims = readClaims(examplesDirectory);
const problems: string[] = validateClaims(claims, vocabulary);

if (problems.length > 0) {
	throw new Error(`Example mechanisms are not declared correctly:\n${problems.join('\n')}`);
}

const policy: MechanismPolicy = fs.existsSync(policyPath)
	? JSON.parse(fs.readFileSync(policyPath, 'utf8')) as MechanismPolicy
	: { acknowledgedOverlaps: {} };
const overlaps: OverlapFinding[] = findOverlaps(claims);
const unacknowledged: OverlapFinding[] = overlaps.filter((finding: OverlapFinding): boolean => {
	return !(finding.exampleId in policy.acknowledgedOverlaps);
});

if (unacknowledged.length > 0) {
	const lines: string[] = unacknowledged.map((finding: OverlapFinding): string => {
		return `  ${finding.exampleId}: everything it teaches is already taught by ${finding.coveredBy.join(', ')}`;
	});

	throw new Error(
		`These examples teach nothing another example does not:\n${lines.join('\n')}\n`
		+ 'Give each one a mechanism that is genuinely its own, retire it, or record it in '
		+ 'example-mechanisms-policy.json with the reason it stays.'
	);
}

const stale: string[] = Object.keys(policy.acknowledgedOverlaps).filter((exampleId: string): boolean => {
	return !overlaps.some((finding: OverlapFinding): boolean => finding.exampleId === exampleId);
});

if (stale.length > 0) {
	throw new Error(
		`example-mechanisms-policy.json acknowledges overlaps that no longer exist: ${stale.join(', ')}. `
		+ 'Remove them so the file stays an accurate worklist.'
	);
}

const distinct = new Set([...claims.values()].flat());

process.stdout.write(
	`Example mechanisms: ${claims.size} examples, ${distinct.size} of ${vocabulary.size} vocabulary entries claimed, `
	+ `${overlaps.length} acknowledged overlap(s).\n`
);
