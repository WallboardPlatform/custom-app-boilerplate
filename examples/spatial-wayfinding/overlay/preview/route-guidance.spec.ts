import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildRouteGuidance } from '../src/utils/route-guidance.js';

describe('buildRouteGuidance', (): void => {
	it('creates calibrated turns and an arrival step', (): void => {
		const legs = buildRouteGuidance(
			{
				edgeIds: ['edge-a'],
				nodeIds: ['start', 'end'],
				path: [
					{ levelId: 'ground', x: 0, y: 0 },
					{ levelId: 'ground', x: 40, y: 0 },
					{ levelId: 'ground', x: 40, y: -30 }
				]
			},
			[{ id: 'ground', name: 'Ground floor', unitsPerMeter: 4 }],
			[{ from: 'start', id: 'edge-a', kind: 'walk', to: 'end' }],
			[{ id: 'start', levelId: 'ground' }, { id: 'end', levelId: 'ground' }]
		);

		assert.deepEqual(legs[0].instructions.map((instruction) => instruction.kind), ['start', 'turn-left', 'arrive']);
		assert.equal(legs[0].instructions[1].text, 'In 10 m, turn left');
	});

	it('separates floor legs and names the connecting transition', (): void => {
		const legs = buildRouteGuidance(
			{
				edgeIds: ['walk-ground', 'lift', 'walk-first'],
				nodeIds: ['start', 'lift-ground', 'lift-first', 'end'],
				path: [
					{ levelId: 'ground', x: 0, y: 0 },
					{ levelId: 'ground', x: 20, y: 0 },
					{ levelId: 'first', x: 20, y: 0 },
					{ levelId: 'first', x: 50, y: 0 }
				]
			},
			[
				{ id: 'ground', name: 'Ground floor', unitsPerMeter: 2 },
				{ id: 'first', name: 'First floor', unitsPerMeter: 2 }
			],
			[
				{ from: 'start', id: 'walk-ground', kind: 'walk', to: 'lift-ground' },
				{ from: 'lift-ground', id: 'lift', kind: 'elevator', to: 'lift-first' },
				{ from: 'lift-first', id: 'walk-first', kind: 'walk', to: 'end' }
			],
			[
				{ id: 'start', levelId: 'ground' },
				{ id: 'lift-ground', levelId: 'ground' },
				{ id: 'lift-first', levelId: 'first' },
				{ id: 'end', levelId: 'first' }
			]
		);

		assert.equal(legs.length, 2);
		assert.equal(legs[0].instructions.at(-1)?.text, 'Take the elevator to First floor');
		assert.deepEqual(legs[1].instructions.map((instruction) => instruction.kind), ['continue', 'arrive']);
	});
});
