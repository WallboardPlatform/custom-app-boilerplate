import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Ajv2020 } from 'ajv/dist/2020.js';

interface BenchmarkTask {
	id: string;
	title: string;
	coverageTags: string[];
	inputs: string[];
	prompt: string;
	hiddenAcceptance: string[];
}

interface BenchmarkSet {
	benchmarkVersion: number;
	agentIsolation: {
		forbiddenContext: string[];
	};
	scoreDefinition: {
		binaryGates: string[];
		ratedDimensions: Array<{ id: string; max: number }>;
	};
	tasks: BenchmarkTask[];
}

const benchmarkDirectory: string = path.dirname(fileURLToPath(import.meta.url));
const repositoryDirectory: string = path.dirname(benchmarkDirectory);

const fail = (message: string): never => {
	throw new Error(`benchmark: ${message}`);
};

function readJson<T>(relativePath: string): T {
	return JSON.parse(fs.readFileSync(path.join(benchmarkDirectory, relativePath), 'utf8')) as T;
}

const sha256 = (filePath: string): string => {
	return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
};

const validateChecksums = (): void => {
	const lines: string[] = fs.readFileSync(path.join(benchmarkDirectory, 'frozen-v1.sha256'), 'utf8')
		.split(/\r?\n/u)
		.filter(Boolean);

	for (const line of lines) {
		const match: RegExpMatchArray = line.match(/^([a-f0-9]{64})\s{2}(.+)$/u)
			?? fail(`invalid checksum line '${line}'.`);

		const filePath: string = path.resolve(repositoryDirectory, match[2]);

		if (!filePath.startsWith(`${benchmarkDirectory}${path.sep}`) || !fs.existsSync(filePath)) {
			fail(`checksum target '${match[2]}' is missing or outside benchmarks.`);
		}

		if (sha256(filePath) !== match[1]) {
			fail(`checksum mismatch for '${match[2]}'. Benchmark v1 is frozen; create a new version.`);
		}
	}
};

const validateSet = (set: BenchmarkSet): void => {
	if (set.benchmarkVersion !== 1 || set.tasks.length < 10) {
		fail('version 1 must contain at least 10 tasks.');
	}

	const ids: Set<string> = new Set<string>();
	const tags: Set<string> = new Set<string>();

	for (const task of set.tasks) {
		if (!/^b\d{2}-[a-z0-9-]+$/u.test(task.id) || ids.has(task.id)) {
			fail(`task id '${task.id}' is invalid or duplicated.`);
		}

		ids.add(task.id);
		task.coverageTags.forEach((tag: string): Set<string> => tags.add(tag));

		if (task.title.trim() === '' || task.prompt.length < 240 || task.hiddenAcceptance.length < 3) {
			fail(`task '${task.id}' lacks a substantial prompt or hidden acceptance criteria.`);
		}

		for (const relativeInput of task.inputs) {
			const inputPath: string = path.resolve(benchmarkDirectory, relativeInput);

			if (!inputPath.startsWith(`${benchmarkDirectory}${path.sep}`) || !fs.existsSync(inputPath)) {
				fail(`task '${task.id}' input '${relativeInput}' is missing or unsafe.`);
			}
		}
	}

	for (const requiredTag of [
		'fixed',
		'bounded',
		'adaptive',
		'static',
		'bound',
		'reference-image',
		'table',
		'charts',
		'ticker',
		'menu',
		'feed',
		'calendar',
		'compact',
		'portrait',
		'single-hero'
	]) {
		if (!tags.has(requiredTag)) {
			fail(`required coverage tag '${requiredTag}' is missing.`);
		}
	}

	if (set.scoreDefinition.binaryGates.length !== 8 || set.scoreDefinition.ratedDimensions.length !== 10) {
		fail('score definition must retain 8 gates and 10 rated dimensions.');
	}

	if (set.agentIsolation.forbiddenContext.length < 4) {
		fail('agent isolation does not enumerate forbidden evaluator context.');
	}
};

const validateScorecardSchema = (): void => {
	const schema: object = readJson<object>('scorecard.schema.json');
	const ajv = new Ajv2020({ allErrors: true, strict: true });

	ajv.compile(schema);
};

validateChecksums();
validateSet(readJson<BenchmarkSet>('benchmark-set.v1.json'));
validateScorecardSchema();

console.log('Frozen benchmark v1 valid: 12 isolated tasks, checksums and scorecard schema verified.');
