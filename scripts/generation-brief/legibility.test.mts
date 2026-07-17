import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FONT_FLOORS, fontFloor } from '../../preview/legibility.js';

void describe('signage legibility floors', () => {
	void it('increases every semantic role with viewing distance', () => {
		for (const role of ['primary', 'secondary', 'metadata'] as const) {
			assert.ok(FONT_FLOORS.near[role] < FONT_FLOORS.room[role]);
			assert.ok(FONT_FLOORS.room[role] < FONT_FLOORS.distance[role]);
		}
	});

	void it('keeps role hierarchy within each viewing distance', () => {
		for (const distance of ['near', 'room', 'distance'] as const) {
			assert.ok(fontFloor(distance, 'primary') > fontFloor(distance, 'secondary'));
			assert.ok(fontFloor(distance, 'secondary') > fontFloor(distance, 'metadata'));
		}
	});
});
