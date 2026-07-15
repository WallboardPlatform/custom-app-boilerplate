export interface TextInkMeasurement {
	selector: string;
	text: string;
	overflowY: string;
	fontSize: number;
	lineHeight: number;
	boxHeight: number;
	visibleHeight?: number;
	borderTop: number;
	borderBottom: number;
	paddingBottom: number;
	lineCount: number;
	actualAscent: number;
	actualDescent: number;
}

export interface TextInkRisk extends TextInkMeasurement {
	availableHeight: number;
	inkHeight: number;
	buffer: number;
	requiredBuffer: number;
	descenderClearance: number;
	requiredDescenderClearance: number;
}

const round = (value: number): number => Math.round(value * 100) / 100;

export const requiredTextInkBuffer = (fontSize: number): number => {
	return Math.max(0.75, fontSize * 0.035);
};

export const findTextInkRisks = (measurements: TextInkMeasurement[]): TextInkRisk[] => {
	return measurements.flatMap((measurement: TextInkMeasurement): TextInkRisk[] => {
		if (
			!['clip', 'hidden'].includes(measurement.overflowY) ||
			measurement.lineCount < 1 ||
			measurement.lineHeight <= 0 ||
			measurement.actualAscent + measurement.actualDescent <= 0
		) {
			return [];
		}

		const unclippedHeight: number = measurement.boxHeight - measurement.borderTop - measurement.borderBottom;
		const availableHeight: number = Math.min(unclippedHeight, measurement.visibleHeight ?? unclippedHeight);
		const visibleLineCapacity: number = Math.max(1, Math.floor((availableHeight + 0.5) / measurement.lineHeight));
		const visibleLineCount: number = Math.min(measurement.lineCount, visibleLineCapacity);
		const inkHeight: number =
			(visibleLineCount - 1) * measurement.lineHeight + measurement.actualAscent + measurement.actualDescent;
		const buffer: number = availableHeight - inkHeight;
		const requiredBuffer: number = requiredTextInkBuffer(measurement.fontSize);
		const hasDescender: boolean = /[gjpqy]/.test(measurement.text);
		const descenderClearance: number =
			measurement.paddingBottom + Math.max(0, (measurement.lineHeight - measurement.fontSize) / 2);
		const requiredDescenderClearance: number = hasDescender ? Math.max(0.75, measurement.fontSize * 0.08) : 0;

		if (buffer >= requiredBuffer && descenderClearance >= requiredDescenderClearance) {
			return [];
		}

		return [
			{
				...measurement,
				lineCount: visibleLineCount,
				availableHeight: round(availableHeight),
				inkHeight: round(inkHeight),
				buffer: round(buffer),
				requiredBuffer: round(requiredBuffer),
				descenderClearance: round(descenderClearance),
				requiredDescenderClearance: round(requiredDescenderClearance)
			}
		];
	});
};

export const formatTextInkRisks = (risks: TextInkRisk[]): string => {
	return risks
		.map((risk: TextInkRisk): string => {
			return `${risk.selector} "${risk.text}" has ${risk.buffer}px total text-ink buffer and ${risk.descenderClearance}px descender clearance; at least ${risk.requiredBuffer}px and ${risk.requiredDescenderClearance}px are required.`;
		})
		.join('\n');
};
