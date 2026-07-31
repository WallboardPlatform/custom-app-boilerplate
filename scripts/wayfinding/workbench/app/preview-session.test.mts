import assert from 'node:assert/strict';
import test from 'node:test';

import { createRoot } from 'solid-js';

import { createPreviewSession } from './features/preview/preview-session.js';

void test('preview session stays ephemeral and resets all simulation state', (): void => {
	createRoot((dispose): void => {
		const session = createPreviewSession('en');
		session.setCategory('Dining');
		session.setDestinationId('destination-cafe');
		session.setDiagnosticLayer('routeNetwork', true);
		session.setFloorId('level-1');
		session.setLanguage('hu');
		session.setOriginId('origin-lobby');
		session.setProfile('step-free');
		session.setQuery('cafe');
		session.setSimulationOpen(true);

		assert.deepEqual(session.state(), {
			category: 'Dining',
			destinationId: 'destination-cafe',
			diagnosticLayers: { routeNetwork: true },
			floorId: 'level-1',
			language: 'hu',
			originId: 'origin-lobby',
			profile: 'step-free',
			query: 'cafe',
			simulationOpen: true
		});

		session.reset('de');
		assert.deepEqual(session.state(), {
			category: '',
			diagnosticLayers: { routeNetwork: false },
			floorId: '',
			language: 'de',
			profile: 'standard',
			query: '',
			simulationOpen: false
		});
		dispose();
	});
});

void test('preview session ignores no-op writes instead of retriggering reactive consumers', (): void => {
	createRoot((dispose): void => {
		const session = createPreviewSession('en');
		const initial = session.state();

		session.setOriginId(undefined);
		session.setDestinationId(undefined);
		session.setLanguage('en');
		session.setDiagnosticLayer('routeNetwork', false);

		assert.equal(session.state(), initial);
		dispose();
	});
});
