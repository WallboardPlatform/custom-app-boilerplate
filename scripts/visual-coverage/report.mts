export interface VisualCoverageMeasurement {
	id: string;
	kind: 'surface' | 'scenario';
	width: number;
	height: number;
	measured: {
		width: number;
		height: number;
	};
}

export interface VisualCoverageReportEntry extends VisualCoverageMeasurement {
	suggestedMinimum: {
		width: number;
		height: number;
	};
}

export interface VisualCoverageReport {
	generatedAt: string;
	regressionMargin: number;
	entries: VisualCoverageReportEntry[];
}

const suggestedMinimum = (measured: number, regressionMargin: number): number => {
	return Math.max(1, measured - regressionMargin);
};

export const createVisualCoverageReport = (
	measurements: VisualCoverageMeasurement[],
	regressionMargin = 5
): VisualCoverageReport => {
	return {
		generatedAt: new Date().toISOString(),
		regressionMargin,
		entries: [...measurements]
			.sort((left: VisualCoverageMeasurement, right: VisualCoverageMeasurement): number => {
				return left.id.localeCompare(right.id) || left.width - right.width || left.height - right.height;
			})
			.map((measurement: VisualCoverageMeasurement): VisualCoverageReportEntry => ({
				...measurement,
				suggestedMinimum: {
					width: suggestedMinimum(measurement.measured.width, regressionMargin),
					height: suggestedMinimum(measurement.measured.height, regressionMargin)
				}
			}))
	};
};
