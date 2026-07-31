import fs from 'node:fs';
import path from 'node:path';

/**
 * An example that builds a thing with a conformance suite must run that suite.
 *
 * The suites constrain behaviour every app of a kind has to get right, and each one is now proven
 * able to fail. None of that helps where a suite is never registered: of the three keyboards in
 * this portfolio, only one was conformance-checked, and the two that were not went unnoticed
 * because nothing connected "this example has a keyboard" to "this example runs the keyboard
 * suite". The registry tracks what an example teaches; this tracks what it must therefore prove.
 */

interface SuiteRequirement {
	/** Conformance suite module under preview/conformance. */
	suite: string;
	/** Registration function the example's spec must call. */
	register: string;
	/** Declaring any of these mechanisms requires the suite. */
	mechanisms: string[];
	/** Declaring any of these capabilities requires the suite. */
	capabilities: string[];
	/** Why the suite is mandatory for this kind of app. */
	because: string;
}

const REQUIREMENTS: SuiteRequirement[] = [
	{
		suite: 'keyboard',
		register: 'registerKeyboardConformance',
		mechanisms: ['on-screen-keyboard'],
		capabilities: ['keyboard'],
		because: 'a touch keyboard that steals focus or doubles a space produces a query that looks right and matches nothing'
	},
	{
		suite: 'pagination',
		register: 'registerPaginationConformance',
		mechanisms: ['content-paging', 'manual-paging'],
		capabilities: [],
		because: 'a pager that drops a record shows a board that looks entirely correct and is wrong'
	},
	{
		suite: 'status-indicator',
		register: 'registerStatusIndicatorConformance',
		mechanisms: ['status-wall'],
		capabilities: [],
		because: 'state carried by colour alone excludes roughly one viewer in twelve and survives no real signage condition'
	}
];

interface ExampleManifest {
	capabilities?: string[];
	mechanisms?: string[];
}

interface CoveragePolicy {
	/** "<example>:<suite>" to the reason the suite does not apply. */
	excluded: Record<string, string>;
}

const rootDirectory: string = process.cwd();
const examplesDirectory: string = path.join(rootDirectory, 'examples');
const policyPath: string = path.join(rootDirectory, 'conformance-coverage-policy.json');

const policy: CoveragePolicy = fs.existsSync(policyPath)
	? JSON.parse(fs.readFileSync(policyPath, 'utf8')) as CoveragePolicy
	: { excluded: {} };

const readSpecs = (exampleDirectory: string): string => {
	const previewDirectory: string = path.join(exampleDirectory, 'overlay', 'preview');

	if (!fs.existsSync(previewDirectory)) {
		return '';
	}

	return fs.readdirSync(previewDirectory)
		.filter((name: string): boolean => name.endsWith('.spec.ts'))
		.map((name: string): string => fs.readFileSync(path.join(previewDirectory, name), 'utf8'))
		.join('\n');
};

const problems: string[] = [];
const satisfied: string[] = [];
const used = new Set<string>();

for (const entry of fs.readdirSync(examplesDirectory, { withFileTypes: true })) {
	const manifestPath: string = path.join(examplesDirectory, entry.name, 'example.json');

	if (!entry.isDirectory() || !fs.existsSync(manifestPath)) {
		continue;
	}

	const manifest: ExampleManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as ExampleManifest;
	const mechanisms: string[] = manifest.mechanisms ?? [];
	const capabilities: string[] = manifest.capabilities ?? [];
	const specs: string = readSpecs(path.join(examplesDirectory, entry.name));

	for (const requirement of REQUIREMENTS) {
		const triggeredBy: string[] = [
			...requirement.mechanisms.filter((id: string): boolean => mechanisms.includes(id)),
			...requirement.capabilities.filter((id: string): boolean => capabilities.includes(id))
		];

		if (triggeredBy.length === 0) {
			continue;
		}

		const key = `${entry.name}:${requirement.suite}`;

		if (key in policy.excluded) {
			used.add(key);
			continue;
		}

		if (specs.includes(requirement.register)) {
			satisfied.push(key);
			continue;
		}

		problems.push(
			`${entry.name} declares ${triggeredBy.join(', ')} but never calls ${requirement.register}. `
			+ `Register the ${requirement.suite} suite in its preview spec, because ${requirement.because}. `
			+ `If the suite genuinely does not apply, record why in conformance-coverage-policy.json under "${key}".`
		);
	}
}

const staleExclusions: string[] = Object.keys(policy.excluded).filter((key: string): boolean => !used.has(key));

if (staleExclusions.length > 0) {
	problems.push(`conformance-coverage-policy.json excludes entries that no longer apply: ${staleExclusions.join(', ')}.`);
}

if (problems.length > 0) {
	throw new Error(problems.join('\n\n'));
}

process.stdout.write(
	`Conformance coverage: ${satisfied.length} required suite registration(s) present, `
	+ `${Object.keys(policy.excluded).length} recorded exclusion(s).\n`
);
