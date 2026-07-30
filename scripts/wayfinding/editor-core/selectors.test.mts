import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
	createWayfindingStudioProject,
	type WayfindingStudioDoorElement,
	type WayfindingStudioPolygonElement
} from '../studio-project.mts';
import { elementDisplayName } from './selectors.ts';

void describe('editor selectors', () => {
	void it('uses destination-aware object names instead of internal identifiers', () => {
		const project = createWayfindingStudioProject('selector-test');
		const floor = project.floors[0];
		const location: WayfindingStudioPolygonElement = {
			destinationId: 'destination-library',
			floorId: floor.id,
			geometry: [
				{ x: 20, y: 20 },
				{ x: 120, y: 20 },
				{ x: 120, y: 100 },
				{ x: 20, y: 100 }
			],
			id: 'location-library-technical-id',
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'location'
		};
		const door: WayfindingStudioDoorElement = {
			angle: 0,
			floorId: floor.id,
			id: 'door-library-technical-id',
			length: 36,
			locationId: location.id,
			point: { x: 70, y: 100 },
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'door'
		};

		project.destinations.push({
			accessible: true,
			category: 'Services',
			floor: floor.id,
			id: 'destination-library',
			name: 'Central Library',
			routeable: true,
			status: 'open'
		});
		floor.elements.push(location, door);

		assert.equal(elementDisplayName(location, project), 'Central Library');
		assert.equal(elementDisplayName(door, project), 'Entrance — Central Library');
		assert.equal(elementDisplayName(door), 'Entrance');
	});
});
