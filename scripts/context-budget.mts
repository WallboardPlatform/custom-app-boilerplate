import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface ContextBudgetReport {
	files: number;
	characters: number;
	estimatedTokens: number;
	targetTokens: number;
}

export interface ContextBudgetPolicy {
	approvedBudgetTokens: number;
	justification: string;
	reviewThresholdTokens: number;
}

const EXCLUDED_DIRECTORIES = new Set(['.git', '.tmp', 'dist', 'node_modules', 'test-results']);
const CONTEXT_BUDGET_POLICY_FILE = 'context-budget-policy.json';
export const DEFAULT_CONTEXT_TARGET = 25_000;

export const measureMarkdownContext = (
	repositoryDirectory: string,
	targetTokens: number = DEFAULT_CONTEXT_TARGET
): ContextBudgetReport => {
	let files: number = 0;
	let characters: number = 0;

	const visit = (directory: string): void => {
		for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
			if (entry.isDirectory() && EXCLUDED_DIRECTORIES.has(entry.name)) {
				continue;
			}

			const filePath: string = path.join(directory, entry.name);

			if (entry.isDirectory()) {
				visit(filePath);
			} else if (entry.isFile() && entry.name.endsWith('.md')) {
				files += 1;
				characters += fs.readFileSync(filePath, 'utf8').length;
			}
		}
	};

	visit(repositoryDirectory);

	return {
		files,
		characters,
		estimatedTokens: Math.ceil(characters / 4),
		targetTokens
	};
};

export const resolveContextBudgetTokens = (policy: ContextBudgetPolicy): number => {
	if (!Number.isFinite(policy.reviewThresholdTokens) || policy.reviewThresholdTokens <= 0) {
		throw new Error('Context budget reviewThresholdTokens must be a positive number.');
	}

	if (!Number.isFinite(policy.approvedBudgetTokens) || policy.approvedBudgetTokens < policy.reviewThresholdTokens) {
		throw new Error('Context budget approvedBudgetTokens must be at least the review threshold.');
	}

	if (policy.approvedBudgetTokens > policy.reviewThresholdTokens && policy.justification.trim().length < 20) {
		throw new Error('A context budget above the review threshold requires a meaningful tracked justification.');
	}

	return policy.approvedBudgetTokens;
};

export const loadContextBudgetPolicy = (rootDirectory: string): ContextBudgetPolicy => {
	const policyPath: string = path.join(rootDirectory, CONTEXT_BUDGET_POLICY_FILE);

	if (!fs.existsSync(policyPath)) {
		return {
			approvedBudgetTokens: DEFAULT_CONTEXT_TARGET,
			justification: '',
			reviewThresholdTokens: DEFAULT_CONTEXT_TARGET
		};
	}

	return JSON.parse(fs.readFileSync(policyPath, 'utf8')) as ContextBudgetPolicy;
};

export const validateContextBudget = (
	repositoryDirectory: string,
	budgetTokens: number = DEFAULT_CONTEXT_TARGET
): ContextBudgetReport => {
	const report: ContextBudgetReport = measureMarkdownContext(repositoryDirectory, budgetTokens);

	if (report.estimatedTokens > budgetTokens) {
		throw new Error(
			`Markdown context uses ${report.estimatedTokens} estimated tokens across ${report.files} files; budget is ${budgetTokens}. Trim or merge a document, or raise the approved budget in ${CONTEXT_BUDGET_POLICY_FILE} with a justification.`
		);
	}

	return report;
};

const scriptPath: string | undefined = process.argv[1];

if (scriptPath && import.meta.url === new URL(`file:///${path.resolve(scriptPath).replace(/\\/g, '/')}`).href) {
	const repositoryDirectory: string = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
	const budgetTokens: number = resolveContextBudgetTokens(loadContextBudgetPolicy(repositoryDirectory));
	const report: ContextBudgetReport = validateContextBudget(repositoryDirectory, budgetTokens);

	process.stdout.write(
		`Markdown context budget: ${report.files} files, ${report.estimatedTokens} / ${budgetTokens} estimated tokens.\n`
	);
}
