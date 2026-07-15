import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
	createVisualCoverageReport,
	type VisualCoverageMeasurement,
	type VisualCoverageReport
} from './report.mts';

void describe('visual coverage report', (): void => {
	void it('subtracts a regression margin without dropping below one percent', (): void => {
		const measurements: VisualCoverageMeasurement[] = [
			{
				id: 'portrait',
				kind: 'surface',
				width: 1080,
				height: 1920,
				measured: { width: 4, height: 88 }
			}
		];
		const report: VisualCoverageReport = createVisualCoverageReport(measurements, 5);

		assert.deepEqual(report.entries[0]?.suggestedMinimum, { width: 1, height: 83 });
	});

	void it('sorts entries for stable output', (): void => {
		const measurements: VisualCoverageMeasurement[] = [
			{ id: 'square', kind: 'surface', width: 600, height: 600, measured: { width: 90, height: 90 } },
			{ id: 'portrait', kind: 'surface', width: 1080, height: 1920, measured: { width: 80, height: 85 } }
		];
		const report: VisualCoverageReport = createVisualCoverageReport(measurements);

		assert.deepEqual(report.entries.map((entry): string => entry.id), ['portrait', 'square']);
	});
});
