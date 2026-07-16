import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Ajv2020 } from 'ajv/dist/2020.js';

interface Scorecard {
	taskId: string;
	firstPass: { usable: boolean; ratedTotal: number };
	final: { usable: boolean; ratedTotal: number };
	timing: { firstPassMinutes: number; totalMinutes: number; correctionRounds: number };
}

const benchmarkDirectory: string = path.dirname(fileURLToPath(import.meta.url));
const repositoryDirectory: string = path.dirname(benchmarkDirectory);
const [runId] = process.argv.slice(2);

if (!runId) {
	throw new Error('Usage: npx tsx benchmarks/validate-results.mts <run-id>');
}

const runDirectory: string = path.join(repositoryDirectory, '.tmp', 'benchmark-runs', runId);
const benchmark = JSON.parse(fs.readFileSync(path.join(benchmarkDirectory, 'benchmark-set.v1.json'), 'utf8')) as {
	tasks: Array<{ id: string }>;
};
const schema: object = JSON.parse(fs.readFileSync(path.join(benchmarkDirectory, 'scorecard.schema.json'), 'utf8'));
const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
const scorecardDirectory: string = path.join(runDirectory, 'scorecards');
const scorecards: Scorecard[] = fs.existsSync(scorecardDirectory)
	? fs.readdirSync(scorecardDirectory)
		.filter((file: string): boolean => file.endsWith('.json'))
		.map((file: string): Scorecard => {
			const scorecard = JSON.parse(fs.readFileSync(path.join(scorecardDirectory, file), 'utf8')) as Scorecard;

			if (!validate(scorecard)) {
				throw new Error(`${file}: ${JSON.stringify(validate.errors)}`);
			}

			return scorecard;
		})
	: [];
const expectedIds: string[] = benchmark.tasks.map((task) => task.id).sort();
const actualIds: string[] = scorecards.map((scorecard: Scorecard) => scorecard.taskId).sort();

if (JSON.stringify(expectedIds) !== JSON.stringify(actualIds)) {
	throw new Error(`Scorecards must cover all frozen tasks. Expected ${expectedIds.join(', ')}; got ${actualIds.join(', ')}.`);
}

const sum = (values: number[]): number => values.reduce((total: number, value: number): number => total + value, 0);
const summary = {
	runId,
	benchmarkVersion: 1,
	taskCount: scorecards.length,
	firstPassUsable: scorecards.filter((scorecard: Scorecard): boolean => scorecard.firstPass.usable).length,
	finalUsable: scorecards.filter((scorecard: Scorecard): boolean => scorecard.final.usable).length,
	firstPassUsableRate: scorecards.filter((scorecard: Scorecard): boolean => scorecard.firstPass.usable).length / scorecards.length,
	finalUsableRate: scorecards.filter((scorecard: Scorecard): boolean => scorecard.final.usable).length / scorecards.length,
	averageFirstPassScore: sum(scorecards.map((scorecard: Scorecard): number => scorecard.firstPass.ratedTotal)) / scorecards.length,
	averageFinalScore: sum(scorecards.map((scorecard: Scorecard): number => scorecard.final.ratedTotal)) / scorecards.length,
	totalCorrectionRounds: sum(scorecards.map((scorecard: Scorecard): number => scorecard.timing.correctionRounds)),
	averageFirstPassMinutes: sum(scorecards.map((scorecard: Scorecard): number => scorecard.timing.firstPassMinutes)) / scorecards.length,
	averageTotalMinutes: sum(scorecards.map((scorecard: Scorecard): number => scorecard.timing.totalMinutes)) / scorecards.length,
	validatedAt: new Date().toISOString()
};

fs.writeFileSync(path.join(runDirectory, 'summary.json'), `${JSON.stringify(summary, null, '\t')}\n`, 'utf8');
console.log(JSON.stringify(summary, null, 2));
