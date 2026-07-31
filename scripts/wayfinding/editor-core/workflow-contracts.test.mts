import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { STUDIO_WORKFLOW_CONTRACTS } from './workflow-contracts.ts';

const BROWSER_SPEC = readFileSync('scripts/wayfinding/workbench/studio.spec.ts', 'utf8');

void test('workflow contracts have stable unique identifiers and concrete outcomes', (): void => {
	assert.equal(
		new Set(STUDIO_WORKFLOW_CONTRACTS.map(({ id }) => id)).size,
		STUDIO_WORKFLOW_CONTRACTS.length
	);

	for (const workflow of STUDIO_WORKFLOW_CONTRACTS) {
		assert.ok(workflow.outcome.trim().length >= 48, `${workflow.id} has no concrete user outcome`);
		assert.ok(workflow.capabilityIds.length >= 2, `${workflow.id} is not a composed workflow`);
		assert.ok(workflow.browserContracts.length >= 1, `${workflow.id} has no browser acceptance contract`);
	}
});

void test('workflow contracts reference executable browser journeys', (): void => {
	for (const workflow of STUDIO_WORKFLOW_CONTRACTS) {
		for (const contract of workflow.browserContracts) {
			assert.ok(
				BROWSER_SPEC.includes(`test('${contract}'`),
				`${workflow.id} references missing browser contract: ${contract}`
			);
		}
	}
});

void test('every supported product capability participates in a complete workflow', (): void => {
	const covered = new Set(STUDIO_WORKFLOW_CONTRACTS.flatMap(({ capabilityIds }) => capabilityIds));
	const missing = [
		'project-file-lifecycle',
		'multi-floor-authoring',
		'project-directory-registries',
		'asset-library',
		'project-presentation-defaults',
		'camera-pan-zoom-fit',
		'polygon-authoring',
		'freehand-polygon-authoring',
		'image-assisted-polygon-detection',
		'semantic-point-authoring',
		'selection-layer-inspector-sync',
		'three-dimensional-review',
		'walkable-and-blocked-space',
		'route-network-generation',
		'route-network-direct-editing',
		'route-node-direct-editing',
		'route-simulation',
		'route-profiles',
		'multi-floor-transitions',
		'destination-localized-details',
		'destination-media',
		'destination-entrance-linking',
		'visitor-directory-and-details',
		'visitor-language-floor-category-controls',
		'visitor-map-presentation',
		'runtime-bundle-export',
		'runtime-readiness-diagnostics'
	].filter((capabilityId) => !covered.has(capabilityId));

	assert.deepEqual(missing, [], `Product capabilities missing end-to-end coverage: ${missing.join(', ')}`);
});
