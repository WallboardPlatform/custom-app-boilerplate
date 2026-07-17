import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface ContextBudgetReport {
	files: number;
	characters: number;
	estimatedTokens: number;
	targetTokens: number;
}
const EXCLUDED_DIRECTORIES = new Set(['.git', '.tmp', 'dist', 'node_modules']);
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

const scriptPath: string | undefined = process.argv[1];

if (scriptPath && import.meta.url === new URL(`file:///${path.resolve(scriptPath).replace(/\\/g, '/')}`).href) {
	const repositoryDirectory: string = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
	const report: ContextBudgetReport = measureMarkdownContext(repositoryDirectory);

	const summary: string = `Markdown context: ${report.estimatedTokens}/${report.targetTokens} advisory target across ${report.files} files.`;

	if (report.estimatedTokens > report.targetTokens) {
		process.stderr.write(`Warning: ${summary}\n`);
	} else {
		process.stdout.write(`${summary}\n`);
	}
}
