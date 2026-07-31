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

	it('names the building entrance and authored vertical connector', (): void => {
		const legs = buildRouteGuidance(
			{
				edgeIds: ['campus-path', 'semantic-connector:library-main:1', 'lobby-path', 'semantic-connector:library-lift:1', 'archive-path'],
				nodeIds: ['start', 'entrance-site', 'entrance-inside', 'lift-ground', 'lift-first', 'archive'],
				path: [
					{ levelId: 'site', x: 0, y: 0 },
					{ levelId: 'site', x: 20, y: 0 },
					{ levelId: 'ground', x: 20, y: 0 },
					{ levelId: 'ground', x: 40, y: 0 },
					{ levelId: 'first', x: 40, y: 0 },
					{ levelId: 'first', x: 60, y: 0 }
				]
			},
			[
				{ id: 'site', name: 'Northline Campus', role: 'site' },
				{ buildingId: 'library', id: 'ground', name: 'Ground floor', role: 'building-floor' },
				{ buildingId: 'library', id: 'first', name: 'Level 1', role: 'building-floor' }
			],
			[
				{ from: 'start', id: 'campus-path', kind: 'walk', to: 'entrance-site' },
				{ from: 'entrance-site', id: 'semantic-connector:library-main:1', kind: 'walk', to: 'entrance-inside' },
				{ from: 'entrance-inside', id: 'lobby-path', kind: 'walk', to: 'lift-ground' },
				{ from: 'lift-ground', id: 'semantic-connector:library-lift:1', kind: 'elevator', to: 'lift-first' },
				{ from: 'lift-first', id: 'archive-path', kind: 'walk', to: 'archive' }
			],
			[
				{ id: 'start', levelId: 'site' },
				{ id: 'entrance-site', levelId: 'site', semanticElementId: 'library-main:site' },
				{ id: 'entrance-inside', levelId: 'ground', semanticElementId: 'library-main:inside' },
				{ id: 'lift-ground', levelId: 'ground', semanticElementId: 'library-lift:g' },
				{ id: 'lift-first', levelId: 'first', semanticElementId: 'library-lift:1' },
				{ id: 'archive', levelId: 'first' }
			],
			{
				buildings: [{ id: 'library', name: 'Library' }],
				connectors: [
					{ endpoints: [{ id: 'library-main:site', levelId: 'site', role: 'site' }, { id: 'library-main:inside', levelId: 'ground', role: 'interior' }], id: 'library-main', kind: 'entrance', label: 'Main entrance' },
					{ endpoints: [{ id: 'library-lift:g', levelId: 'ground' }, { id: 'library-lift:1', levelId: 'first' }], id: 'library-lift', kind: 'elevator', label: 'Library elevator' }
				]
			}
		);

		assert.equal(legs[0].instructions.at(-1)?.text, 'Enter Library through Main entrance and continue on Ground floor');
		assert.equal(legs[1].instructions.at(-1)?.text, 'Take Library elevator to Level 1');
	});
});
