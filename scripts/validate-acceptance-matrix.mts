import fs from 'node:fs';
import path from 'node:path';

/**
 * Every example must appear in the CI acceptance matrix.
 *
 * The matrix is a hand-maintained list, so an example joins the repository and is silently never
 * accepted in CI. That is not hypothetical: five examples were already missing when this was
 * first measured, and the author of that finding then added a sixth without noticing. A
 * hand-maintained list with no check is a list that drifts.
 */

const rootDirectory: string = process.cwd();
const workflowPath: string = path.join(rootDirectory, '.github', 'workflows', 'example-acceptance.yml');
const examplesDirectory: string = path.join(rootDirectory, 'examples');
const policyPath: string = path.join(rootDirectory, 'acceptance-matrix-policy.json');

interface MatrixPolicy {
	/** Example id to the reason CI does not accept it. */
	excluded: Record<string, string>;
}

export const readMatrixEntries = (workflow: string): string[] => {
	const section: string = workflow.split('matrix:')[1] ?? '';
	const stop: number = section.search(/^\s{4}\S/m);

	return [...(stop >= 0 ? section.slice(0, stop) : section).matchAll(/^\s+- ([a-z0-9][a-z0-9-]*)\s*$/gm)]
		.map((match: RegExpMatchArray): string => match[1]);
};

export const readExampleIds = (directory: string): string[] => {
	return fs.readdirSync(directory, { withFileTypes: true })
		.filter((entry: fs.Dirent): boolean => {
			return entry.isDirectory() && fs.existsSync(path.join(directory, entry.name, 'example.json'));
		})
		.map((entry: fs.Dirent): string => entry.name);
};

const matrix: string[] = readMatrixEntries(fs.readFileSync(workflowPath, 'utf8'));
const examples: string[] = readExampleIds(examplesDirectory);
const policy: MatrixPolicy = fs.existsSync(policyPath)
	? JSON.parse(fs.readFileSync(policyPath, 'utf8')) as MatrixPolicy
	: { excluded: {} };

const missing: string[] = examples.filter((id: string): boolean => {
	return !matrix.includes(id) && !(id in policy.excluded);
});
const unknown: string[] = matrix.filter((id: string): boolean => !examples.includes(id));
const staleExclusions: string[] = Object.keys(policy.excluded).filter((id: string): boolean => {
	return !examples.includes(id) || matrix.includes(id);
});

const problems: string[] = [];

if (missing.length > 0) {
	problems.push(
		`These examples are never accepted in CI: ${missing.join(', ')}. `
		+ 'Add them to the matrix in .github/workflows/example-acceptance.yml, or record why not in '
		+ 'acceptance-matrix-policy.json.'
	);
}

if (unknown.length > 0) {
	problems.push(`The matrix names examples that do not exist: ${unknown.join(', ')}.`);
}

if (staleExclusions.length > 0) {
	problems.push(`acceptance-matrix-policy.json excludes entries that are covered or gone: ${staleExclusions.join(', ')}.`);
}

if (problems.length > 0) {
	throw new Error(problems.join('\n'));
}

process.stdout.write(
	`Acceptance matrix: ${matrix.length} of ${examples.length} examples accepted in CI, `
	+ `${Object.keys(policy.excluded).length} recorded exclusion(s).\n`
);
