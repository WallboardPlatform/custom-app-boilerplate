import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
	directionBetweenPoints,
	nearestWayfindingPoint,
	resolveWayfindingGuidanceMode
} from '../../src/utils/wayfinding-guidance.ts';

void describe('runtime wayfinding guidance', (): void => {
	void it('fails route requests down to the strongest evidenced non-route mode', (): void => {
		assert.equal(resolveWayfindingGuidanceMode('route', {
			directory: true,
			highlight: true,
			directional: true,
			route: false
		}), 'directional');
	});

	void it('blocks unsupported guidance when fallback is disabled', (): void => {
		assert.equal(resolveWayfindingGuidanceMode('route', {
			directory: true,
			highlight: true,
			directional: false,
			route: false
		}, false), undefined);
	});

	void it('computes screen-aware cardinal cues without drawing a path', (): void => {
		assert.deepEqual(directionBetweenPoints({ x: 10, y: 10 }, { x: 20, y: 0 }), {
			bearingDegrees: 45,
			cardinal: 'NE',
			distance: Math.sqrt(200)
		});
		assert.equal(directionBetweenPoints({ x: 10, y: 10 }, { x: 20, y: 0 }, 90).cardinal, 'NW');
	});

	void it('finds the nearest reviewed facility anchor', (): void => {
		const nearest = nearestWayfindingPoint({ x: 0, y: 0 }, [
			{ id: 'far', point: { x: 10, y: 10 } },
			{ id: 'near', point: { x: 2, y: 1 } }
		]);

		assert.equal(nearest?.id, 'near');
	});
});
