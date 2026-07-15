import fs from 'node:fs';
import path from 'node:path';

import {
	createVisualCoverageReport,
	type VisualCoverageMeasurement,
	type VisualCoverageReport
} from './report.mts';

const outputDirectory: string = path.resolve(process.cwd(), 'preview', 'output');
const measurementDirectory: string = path.join(outputDirectory, 'coverage-measurements');

if (!fs.existsSync(measurementDirectory)) {
	throw new Error('Visual coverage measurements were not generated.');
}

const measurements: VisualCoverageMeasurement[] = fs.readdirSync(measurementDirectory)
	.filter((fileName: string): boolean => fileName.endsWith('.json'))
	.map((fileName: string): VisualCoverageMeasurement => {
		const filePath: string = path.join(measurementDirectory, fileName);

		return JSON.parse(fs.readFileSync(filePath, 'utf8')) as VisualCoverageMeasurement;
	});

if (measurements.length === 0) {
	throw new Error('Visual coverage measurement mode did not produce any surface results.');
}

const report: VisualCoverageReport = createVisualCoverageReport(measurements);
const reportPath: string = path.join(outputDirectory, 'coverage-report.json');

fs.writeFileSync(reportPath, `${JSON.stringify(report, null, '\t')}\n`, 'utf8');

for (const entry of report.entries) {
	process.stdout.write(
		`${entry.kind} ${entry.id} ${entry.width}x${entry.height}: measured ${entry.measured.width}% x ${entry.measured.height}%; suggested minimum ${entry.suggestedMinimum.width}% x ${entry.suggestedMinimum.height}%\n`
	);
}

process.stdout.write(`Coverage report: ${reportPath}\n`);
process.stdout.write(
	'Review the screenshots before copying suggested thresholds into generation-brief.json or preview scenarios.\n'
);
