import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { calculateFixedCanvasFrame, fixedCanvasStyle } from '../../src/utils/fixed-canvas.js';

void describe('fixed-canvas capability', (): void => {
	void it('centers a landscape design with transparent side letterboxing', (): void => {
		const frame = calculateFixedCanvasFrame(1000, 1000, 1920, 1080);

		assert.equal(frame.scale, 1000 / 1920);
		assert.ok(Math.abs(frame.renderedWidth - 1000) < 0.001);
		assert.ok(Math.abs(frame.offsetX) < 0.001);
		assert.ok(frame.offsetY > 200);
		assert.match(fixedCanvasStyle(frame).transform, /scale\(/);
	});

	void it('contains invalid dimensions without producing NaN', (): void => {
		const frame = calculateFixedCanvasFrame(0, Number.NaN, 0, -2);

		assert.equal(frame.scale, 1);
		assert.equal(frame.renderedWidth, 1);
		assert.equal(frame.renderedHeight, 1);
	});
});
