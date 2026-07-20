import type {
	WayfindingPoint,
	WayfindingWalkableMaskDocument,
	WayfindingWalkableMaskRun
} from '../../src/utils/wayfinding.js';

export interface WayfindingMaskSample extends WayfindingPoint {
	column: number;
	row: number;
}

const pointAt = (left: WayfindingPoint, right: WayfindingPoint, ratio: number): WayfindingPoint => ({
	x: left.x + (right.x - left.x) * ratio,
	y: left.y + (right.y - left.y) * ratio
});

export class WayfindingWalkableMask {
	private readonly intervalsByRow = new Map<number, Array<[number, number]>>();

	public constructor(public readonly document: WayfindingWalkableMaskDocument) {
		for (const [row, startColumn, endColumn] of document.walkableRuns) {
			const intervals: Array<[number, number]> = this.intervalsByRow.get(row) ?? [];
			intervals.push([startColumn, endColumn]);
			this.intervalsByRow.set(row, intervals);
		}
	}

	public sample(point: WayfindingPoint): WayfindingMaskSample {
		const originX: number = this.document.originX ?? 0;
		const originY: number = this.document.originY ?? 0;

		return {
			...point,
			column: Math.floor((point.x - originX) / this.document.cellSize),
			row: Math.floor((point.y - originY) / this.document.cellSize)
		};
	}

	public contains(point: WayfindingPoint): boolean {
		const sample: WayfindingMaskSample = this.sample(point);

		if (sample.column < 0 || sample.column >= this.document.columns || sample.row < 0 || sample.row >= this.document.rows) return false;

		return (this.intervalsByRow.get(sample.row) ?? []).some(([startColumn, endColumn]: [number, number]): boolean => {
			return sample.column >= startColumn && sample.column <= endColumn;
		});
	}

	public outsideCorridor(points: WayfindingPoint[], corridorWidth: number): WayfindingMaskSample[] {
		const failures: WayfindingMaskSample[] = [];
		const failureKeys = new Set<string>();
		const step: number = Math.max(1, this.document.cellSize / 2);
		const halfWidth: number = Math.max(0, corridorWidth / 2);

		for (let index = 1; index < points.length; index += 1) {
			const left: WayfindingPoint = points[index - 1];
			const right: WayfindingPoint = points[index];
			const dx: number = right.x - left.x;
			const dy: number = right.y - left.y;
			const length: number = Math.hypot(dx, dy);

			if (length === 0) continue;

			const normalX: number = -dy / length;
			const normalY: number = dx / length;
			const sampleCount: number = Math.max(1, Math.ceil(length / step));

			for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
				const center: WayfindingPoint = pointAt(left, right, sampleIndex / sampleCount);

				for (const offset of [0, -halfWidth, halfWidth]) {
					const sample: WayfindingMaskSample = this.sample({
						x: center.x + normalX * offset,
						y: center.y + normalY * offset
					});

					if (this.contains(sample)) continue;

					const key: string = `${sample.column}:${sample.row}`;

					if (!failureKeys.has(key)) {
						failureKeys.add(key);
						failures.push(sample);
					}
				}
			}
		}

		return failures;
	}
}

export const validateWalkableMaskStructure = (document: WayfindingWalkableMaskDocument): string[] => {
	const errors: string[] = [];
	const expectedColumns: number = Math.ceil(document.width / document.cellSize);
	const expectedRows: number = Math.ceil(document.height / document.cellSize);

	if (document.columns !== expectedColumns) errors.push(`columns must be ${expectedColumns} for the configured width and cell size`);
	if (document.rows !== expectedRows) errors.push(`rows must be ${expectedRows} for the configured height and cell size`);

	for (const [index, run] of document.walkableRuns.entries()) {
		const [row, startColumn, endColumn]: WayfindingWalkableMaskRun = run;

		if (row >= document.rows) errors.push(`run ${index} row is outside the mask`);
		if (startColumn > endColumn) errors.push(`run ${index} starts after it ends`);
		if (endColumn >= document.columns) errors.push(`run ${index} ends outside the mask`);
	}

	return errors;
};
