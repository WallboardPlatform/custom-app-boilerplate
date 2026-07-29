import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import {
	capabilityById,
	incompleteLegacyCapabilities,
	LEGACY_CONTROL_DISPOSITIONS,
	STUDIO_CAPABILITIES
} from './capabilities.ts';

const LEGACY_CONTROL_IDS = Array.from(
	readFileSync('scripts/wayfinding/workbench/index.html', 'utf8').matchAll(/id="([^"]+)"/g),
	(match) => match[1]
);

const REQUIRED_CAPABILITY_IDS = [
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
] as const;

void test('the capability catalog has stable unique identifiers', (): void => {
	assert.equal(new Set(STUDIO_CAPABILITIES.map(({ id }) => id)).size, STUDIO_CAPABILITIES.length);
});

void test('every required migration area remains explicitly tracked', (): void => {
	for (const id of REQUIRED_CAPABILITY_IDS) {
		assert.ok(capabilityById(id), `Missing capability contract: ${id}`);
		assert.equal(capabilityById(id)?.legacyRequired, true);
	}
});

void test('legacy control evidence references real v1 controls', (): void => {
	for (const capability of STUDIO_CAPABILITIES) {
		for (const controlId of capability.legacyControlIds) {
			assert.ok(
				LEGACY_CONTROL_IDS.includes(controlId),
				`${capability.id} references unknown v1 control: ${controlId}`
			);
		}
	}
});

void test('every v1 control has exactly one migration or explicit disposition', (): void => {
	const accounted = [
		...STUDIO_CAPABILITIES.flatMap(({ id, legacyControlIds }) =>
			legacyControlIds.map((controlId) => ({ controlId, owner: `capability:${id}` }))
		),
		...LEGACY_CONTROL_DISPOSITIONS.flatMap(({ controlIds, status }) =>
			controlIds.map((controlId) => ({ controlId, owner: `disposition:${status}` }))
		)
	];
	const owners = new Map<string, string[]>();

	for (const { controlId, owner } of accounted) {
		const current = owners.get(controlId) ?? [];
		current.push(owner);
		owners.set(controlId, current);
	}

	const unknown = [...owners.keys()].filter((controlId) => !LEGACY_CONTROL_IDS.includes(controlId));
	const missing = LEGACY_CONTROL_IDS.filter((controlId) => !owners.has(controlId));
	const duplicate = [...owners.entries()].filter(([, controlOwners]) => controlOwners.length !== 1);

	assert.deepEqual(unknown, [], `The audit references unknown v1 controls: ${unknown.join(', ')}`);
	assert.deepEqual(missing, [], `Unaccounted v1 controls: ${missing.join(', ')}`);
	assert.deepEqual(
		duplicate,
		[],
		`V1 controls have ambiguous owners: ${duplicate
			.map(([controlId, controlOwners]) => `${controlId} -> ${controlOwners.join(' + ')}`)
			.join(', ')}`
	);
});

void test('removed and superseded controls explain the replacement decision', (): void => {
	for (const disposition of LEGACY_CONTROL_DISPOSITIONS) {
		assert.ok(disposition.controlIds.length > 0);
		assert.ok(disposition.reason.trim().length >= 24);
		assert.ok(disposition.replacement?.trim(), `${disposition.status} controls have no replacement`);
	}
});

void test('implemented capabilities require browser contracts and existing evidence', (): void => {
	const spec = readFileSync('scripts/wayfinding/workbench/studio-v2.spec.ts', 'utf8');

	for (const capability of STUDIO_CAPABILITIES.filter(({ status }) => status === 'implemented')) {
		assert.ok(capability.evidence.implementation.length > 0, `${capability.id} has no implementation evidence`);
		assert.ok(capability.evidence.tests.length > 0, `${capability.id} has no test evidence`);
		assert.ok(capability.evidence.browserContracts.length > 0, `${capability.id} has no browser contract`);

		for (const path of [...capability.evidence.implementation, ...capability.evidence.tests]) {
			assert.ok(existsSync(path), `${capability.id} references missing evidence: ${path}`);
		}

		for (const contract of capability.evidence.browserContracts) {
			assert.ok(spec.includes(`test('${contract}'`), `${capability.id} references missing browser contract: ${contract}`);
		}
	}
});

void test('every v1-required workflow has implementation and browser evidence', (): void => {
	const incomplete = incompleteLegacyCapabilities().map(({ id }) => id);

	assert.deepEqual(incomplete, [], `Incomplete v1 capability contracts: ${incomplete.join(', ')}`);
});
