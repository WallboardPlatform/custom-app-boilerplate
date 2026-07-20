import assert from 'node:assert/strict';
import test from 'node:test';

import { auditWayfindingSource, migrateWayfindingSource } from './source-audit.mts';

const LEGACY_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">
	<g id="Level0-LocationPoints"><circle id="lobby-lp" cx="20" cy="30" /></g>
	<g id="Level0-RoutePoints"><circle id="rp-1" cx="30" cy="30" /><circle id="rp-2" cx="40" cy="30" /></g>
	<g id="Level0-Locations"><path id="lobby" d="M 10 10 H 50 V 50 H 10 Z"><title>Lobby</title><desc>Unverified copy</desc></path></g>
</svg>`;

await test('audits legacy point maps without treating route points as graph topology', (): void => {
	const audit = auditWayfindingSource(LEGACY_SVG);

	assert.equal(audit.summary.legacyLocationPointCount, 1);
	assert.equal(audit.summary.legacyRoutePointCount, 2);
	assert.equal(audit.summary.locationGeometryCount, 1);
	assert.deepEqual(audit.anchors[0], {
		id: 'location-lobby',
		kind: 'location',
		levelId: 'level-0',
		locationId: 'lobby',
		reviewStatus: 'proposed',
		sourceElementId: 'lobby-lp',
		x: 20,
		y: 30
	});
	assert.ok(audit.issues.some((issue): boolean => issue.code === 'point-cloud-is-not-topology'));
});

await test('annotates legacy location geometry but does not create route edges', (): void => {
	const migration = migrateWayfindingSource(LEGACY_SVG);

	assert.match(migration.annotatedSvg, /data-wayfinding-location-id="lobby"/);
	assert.match(migration.annotatedSvg, /data-wayfinding-level="level-0"/);
	assert.doesNotMatch(migration.annotatedSvg, /data-wayfinding-edge/);
});

await test('annotates only the outermost named geometry for nested legacy locations', (): void => {
	const migration = migrateWayfindingSource(`
		<svg xmlns="http://www.w3.org/2000/svg">
			<g id="Level0-Locations"><g id="casino"><path id="casino-floor" d="M0 0H10V10H0Z" /></g></g>
		</svg>`);

	assert.match(migration.annotatedSvg, /id="casino" data-wayfinding-location-id="casino"/);
	assert.doesNotMatch(migration.annotatedSvg, /id="casino-floor" data-wayfinding-location-id=/);
	assert.equal(migration.audit.summary.locationGeometryCount, 1);
});

await test('reports unsafe content and duplicate ids as errors', (): void => {
	const audit = auditWayfindingSource('<svg xmlns="http://www.w3.org/2000/svg"><script id="bad"/><path id="same"/><path id="same" onclick="run()"/></svg>');

	assert.equal(audit.summary.duplicateIdCount, 1);
	assert.equal(audit.summary.unsafeElementCount, 2);
	assert.ok(audit.issues.some((issue): boolean => issue.code === 'duplicate-svg-ids' && issue.severity === 'error'));
	assert.ok(audit.issues.some((issue): boolean => issue.code === 'unsafe-svg-content' && issue.severity === 'error'));
});
