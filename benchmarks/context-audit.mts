import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

interface ContextEntry {
	path: string;
	chars: number;
	words: number;
	estimatedTokens: number;
}

interface ContextTotals {
	files: number;
	chars: number;
	words: number;
	estimatedTokens: number;
}

const benchmarkDirectory: string = path.dirname(fileURLToPath(import.meta.url));
const repositoryDirectory: string = path.dirname(benchmarkDirectory);
const excludedDirectories: Set<string> = new Set(['.git', '.tmp', 'benchmarks', 'dist', 'node_modules']);
const entries: ContextEntry[] = [];

const visit = (directory: string): void => {
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		if (entry.isDirectory() && excludedDirectories.has(entry.name)) {
			continue;
		}

		const filePath: string = path.join(directory, entry.name);

		if (entry.isDirectory()) {
			visit(filePath);
		} else if (entry.isFile() && entry.name.endsWith('.md')) {
			const text: string = fs.readFileSync(filePath, 'utf8');
			const words: number = text.match(/[\p{L}\p{N}_'-]+/gu)?.length ?? 0;

			entries.push({
				path: path.relative(repositoryDirectory, filePath).split(path.sep).join('/'),
				chars: text.length,
				words,
				estimatedTokens: Math.ceil(text.length / 4)
			});
		}
	}
};

visit(repositoryDirectory);
entries.sort((left: ContextEntry, right: ContextEntry): number => left.path.localeCompare(right.path));

const totals: ContextTotals = {
	files: entries.length,
	chars: entries.reduce((sum: number, entry: ContextEntry): number => sum + entry.chars, 0),
	words: entries.reduce((sum: number, entry: ContextEntry): number => sum + entry.words, 0),
	estimatedTokens: entries.reduce((sum: number, entry: ContextEntry): number => sum + entry.estimatedTokens, 0)
};
const baseline = JSON.parse(
	fs.readFileSync(path.join(benchmarkDirectory, 'context-baseline.v1.json'), 'utf8')
) as { commit: string; totals: ContextTotals };
const reduction = (before: number, after: number): number => before === 0 ? 0 : (before - after) / before;
const report = {
	method: 'UTF-16 code units; Unicode word tokens; estimatedTokens=ceil(chars/4) per file',
	baseline: {
		commit: baseline.commit,
		totals: baseline.totals
	},
	current: totals,
	delta: {
		files: totals.files - baseline.totals.files,
		chars: totals.chars - baseline.totals.chars,
		words: totals.words - baseline.totals.words,
		estimatedTokens: totals.estimatedTokens - baseline.totals.estimatedTokens
	},
	reduction: {
		chars: reduction(baseline.totals.chars, totals.chars),
		words: reduction(baseline.totals.words, totals.words),
		estimatedTokens: reduction(baseline.totals.estimatedTokens, totals.estimatedTokens)
	},
	entries
};
const argumentsList: string[] = process.argv.slice(2);
const outputIndex: number = argumentsList.indexOf('--output');
const outputPath: string | undefined = outputIndex >= 0 ? argumentsList[outputIndex + 1] : undefined;
const serialized: string = `${JSON.stringify(report, null, 2)}\n`;

if (outputIndex >= 0 && !outputPath) {
	throw new Error('--output requires a file path.');
}

if (outputPath) {
	const resolvedOutput: string = path.resolve(repositoryDirectory, outputPath);
	fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true });
	fs.writeFileSync(resolvedOutput, serialized, 'utf8');
}

console.log(serialized.trimEnd());
