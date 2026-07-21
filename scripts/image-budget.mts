import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const DEFAULT_IMAGE_BUDGET_BYTES = 10 * 1024 * 1024;
const BYTES_PER_MIB = 1024 * 1024;
const IMAGE_BUDGET_POLICY_FILE = 'image-budget-policy.json';
const imageExtension = /\.(?:gif|jpe?g|png|webp)$/i;

export interface ImageBudgetPolicy {
	approvedBudgetMiB: number;
	justification: string;
	reviewThresholdMiB: number;
}

export const resolveImageBudgetBytes = (policy: ImageBudgetPolicy): number => {
	if (!Number.isFinite(policy.reviewThresholdMiB) || policy.reviewThresholdMiB <= 0) {
		throw new Error('Image budget reviewThresholdMiB must be a positive number.');
	}

	if (!Number.isFinite(policy.approvedBudgetMiB) || policy.approvedBudgetMiB < policy.reviewThresholdMiB) {
		throw new Error('Image budget approvedBudgetMiB must be at least the review threshold.');
	}

	if (policy.approvedBudgetMiB > policy.reviewThresholdMiB && policy.justification.trim().length < 20) {
		throw new Error('An image budget above the review threshold requires a meaningful tracked justification.');
	}

	return policy.approvedBudgetMiB * BYTES_PER_MIB;
};

export const loadImageBudgetPolicy = (rootDirectory: string): ImageBudgetPolicy => {
	const policyPath = path.join(rootDirectory, IMAGE_BUDGET_POLICY_FILE);

	if (!fs.existsSync(policyPath)) {
		return { approvedBudgetMiB: 10, justification: '', reviewThresholdMiB: 10 };
	}

	return JSON.parse(fs.readFileSync(policyPath, 'utf8')) as ImageBudgetPolicy;
};

export const summarizeImages = (
	rootDirectory: string,
	trackedFiles: string[]
): { bytes: number; count: number } => {
	const images = trackedFiles.filter((file) => imageExtension.test(file));

	return {
		bytes: images.reduce((total, file) => total + fs.statSync(path.join(rootDirectory, file)).size, 0),
		count: images.length
	};
};

export const validateImageBudget = (
	rootDirectory: string,
	budgetBytes = DEFAULT_IMAGE_BUDGET_BYTES
): { bytes: number; count: number } => {
	const trackedFiles = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
		cwd: rootDirectory,
		encoding: 'utf8'
	}).split('\0').filter((file) => file !== '' && fs.existsSync(path.join(rootDirectory, file)));
	const summary = summarizeImages(rootDirectory, trackedFiles);

	if (summary.bytes > budgetBytes) {
		throw new Error(
			`Tracked images use ${(summary.bytes / 1024 / 1024).toFixed(2)} MiB; budget is ${(budgetBytes / 1024 / 1024).toFixed(2)} MiB.`
		);
	}

	return summary;
};

const scriptPath = process.argv[1] ? path.resolve(process.argv[1]) : '';

if (scriptPath === fileURLToPath(import.meta.url)) {
	const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
	const budgetBytes = resolveImageBudgetBytes(loadImageBudgetPolicy(rootDirectory));
	const summary = validateImageBudget(rootDirectory, budgetBytes);

	process.stdout.write(
		`Tracked image budget: ${summary.count} files, ${(summary.bytes / BYTES_PER_MIB).toFixed(2)} / ${(budgetBytes / BYTES_PER_MIB).toFixed(2)} MiB.\n`
	);
}
