import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const DEFAULT_IMAGE_BUDGET_BYTES = 10 * 1024 * 1024;
const imageExtension = /\.(?:gif|jpe?g|png|webp)$/i;

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
	const summary = validateImageBudget(rootDirectory);

	process.stdout.write(
		`Tracked image budget: ${summary.count} files, ${(summary.bytes / 1024 / 1024).toFixed(2)} / ${(DEFAULT_IMAGE_BUDGET_BYTES / 1024 / 1024).toFixed(2)} MiB.\n`
	);
}
