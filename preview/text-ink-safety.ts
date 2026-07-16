export interface TextInkMeasurement {
	selector: string;
	text: string;
	overflowY: string;
	fontSize: number;
	lineHeight: number;
	boxHeight: number;
	layoutHeight?: number;
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
	completeLineCount: number;
	partialLinePixels: number;
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

		const layoutHeight: number = measurement.layoutHeight ?? measurement.boxHeight;
		const viewportScale: number = measurement.layoutHeight && measurement.boxHeight > 0
			? measurement.boxHeight / measurement.layoutHeight
			: 1;
		const visibleHeight: number | undefined = measurement.visibleHeight === undefined
			? undefined
			: measurement.visibleHeight / viewportScale;
		const unclippedHeight: number = layoutHeight - measurement.borderTop - measurement.borderBottom;
		const availableHeight: number = Math.min(unclippedHeight, visibleHeight ?? unclippedHeight);
		const availableTextHeight: number = Math.max(0, availableHeight - measurement.paddingBottom);
		const glyphHeight: number = measurement.actualAscent + measurement.actualDescent;
		const inkLead: number = Math.max(0, (measurement.lineHeight - glyphHeight) / 2);
		const completeLineCapacity: number = availableTextHeight >= inkLead + glyphHeight
			? Math.floor((availableTextHeight - inkLead - glyphHeight + 0.5) / measurement.lineHeight) + 1
			: 0;
		const visibleLineCount: number = Math.min(measurement.lineCount, Math.max(1, completeLineCapacity));
		const nextLineInkTop: number = completeLineCapacity * measurement.lineHeight + inkLead;
		const partialLinePixels: number = measurement.lineCount > completeLineCapacity
			? Math.max(0, Math.min(glyphHeight, availableTextHeight - nextLineInkTop))
			: 0;
		const inkHeight: number = completeLineCapacity > 0
			? (visibleLineCount - 1) * measurement.lineHeight + inkLead + glyphHeight
			: glyphHeight;
		const buffer: number = availableHeight - inkHeight;
		const requiredBuffer: number = requiredTextInkBuffer(measurement.fontSize);
		const hasDescender: boolean = /[gjpqy]/.test(measurement.text);
		const descenderClearance: number =
			measurement.paddingBottom + Math.max(0, (measurement.lineHeight - measurement.fontSize) / 2);
		const requiredDescenderClearance: number = hasDescender ? Math.max(0.75, measurement.fontSize * 0.08) : 0;

		if (partialLinePixels <= 1 && buffer >= requiredBuffer && descenderClearance >= requiredDescenderClearance) {
			return [];
		}

		return [
			{
				...measurement,
				availableHeight: round(availableHeight),
				inkHeight: round(inkHeight),
				buffer: round(buffer),
				requiredBuffer: round(requiredBuffer),
				descenderClearance: round(descenderClearance),
				requiredDescenderClearance: round(requiredDescenderClearance),
				completeLineCount: visibleLineCount,
				partialLinePixels: round(partialLinePixels)
			}
		];
	});
};

export const formatTextInkRisks = (risks: TextInkRisk[]): string => {
	return risks
		.map((risk: TextInkRisk): string => {
			const partialLine = risk.partialLinePixels > 1
				? ` It exposes ${risk.partialLinePixels}px of a clipped text line.`
				: '';

			return `${risk.selector} "${risk.text}" has ${risk.buffer}px total text-ink buffer and ${risk.descenderClearance}px descender clearance; at least ${risk.requiredBuffer}px and ${risk.requiredDescenderClearance}px are required.${partialLine}`;
		})
		.join('\n');
};
