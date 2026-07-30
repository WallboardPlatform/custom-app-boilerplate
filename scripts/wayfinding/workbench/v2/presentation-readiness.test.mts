import assert from 'node:assert/strict';
import test from 'node:test';

import { createWayfindingStudioProject } from '../../studio-project.mts';
import { getThreeDimensionalReadiness } from './features/preview/presentation-readiness.js';

void test('keeps 3D unavailable for empty or unlabeled floor geometry', () => {
	const project = createWayfindingStudioProject('3D readiness');
	const floor = project.floors[0];

	assert.deepEqual(getThreeDimensionalReadiness(project, floor.id), {
		ready: false,
		reasons: [
			'Add at least one room or destination area.',
			'Name every visible destination before presenting it in 3D.'
		]
	});
});

void test('enables 3D only after geometry, labeling, camera, contrast, and complexity pass', () => {
	const project = createWayfindingStudioProject('3D readiness');
	const floor = project.floors[0];
	project.destinations.push({
		floor: floor.id,
		id: 'destination-a',
		name: 'Information',
		routeable: true
	});
	floor.elements.push({
		destinationId: 'destination-a',
		floorId: floor.id,
		geometry: [
			{ x: 100, y: 100 },
			{ x: 400, y: 100 },
			{ x: 400, y: 300 },
			{ x: 100, y: 300 }
		],
		id: 'location-a',
		provenance: 'reviewer-authored',
		status: 'confirmed',
		type: 'location'
	});

	assert.deepEqual(getThreeDimensionalReadiness(project, floor.id), {
		ready: true,
		reasons: []
	});

	floor.camera3d = {
		azimuthDegrees: 20,
		distance: 0,
		pitchDegrees: 90,
		targetX: -10,
		targetY: 120
	};
	assert.deepEqual(getThreeDimensionalReadiness(project, floor.id), {
		ready: false,
		reasons: ['Reset or correct the saved 3D camera.']
	});
});
