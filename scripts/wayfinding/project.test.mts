import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import {
	assessWayfindingProject,
	type WayfindingEvidenceItem,
	type WayfindingProjectDocument
} from './project.mjs';
import { parseWayfindingProject } from './schema.mjs';

const confirmed = (
	provenance: WayfindingEvidenceItem['provenance'] = 'reviewer-authored',
	independentFrom?: WayfindingEvidenceItem['independentFrom']
): WayfindingEvidenceItem => ({
	independentFrom,
	provenance,
	review: { method: 'overlay-review', reviewedBy: 'wayfinding-reviewer', reviewerType: 'qualified-reviewer' },
	status: 'confirmed'
});

const proposed = (provenance: WayfindingEvidenceItem['provenance'] = 'ai-inferred'): WayfindingEvidenceItem => ({
	provenance,
	status: 'proposed'
});

const project = (overrides: Partial<WayfindingProjectDocument> = {}): WayfindingProjectDocument => ({
	contractVersion: 1,
	evidence: {
		accessibility: proposed(),
		currentLocationAnchors: confirmed('customer-provided'),
		destinationAnchors: confirmed('image-analysis'),
		destinationMetadata: confirmed('customer-provided'),
		entranceApproaches: proposed('image-analysis'),
		levelTransitions: proposed('image-analysis'),
		orientation: confirmed('customer-provided'),
		routeTopology: proposed(),
		walkableSpace: proposed('image-analysis')
	},
	guidance: { allowFallback: true, stepFreeRequired: false, targetMode: 'route' },
	projectId: 'fixture-wayfinding',
	source: {
		equivalentRedrawAllowed: true,
		kind: 'illustrated-map',
		levels: 1,
		presentation: 'source-overlay'
	},
	...overrides
});

void describe('adaptive wayfinding project assessment', (): void => {
	void it('ships a schema-valid template that fails closed until evidence is confirmed', (): void => {
		const template = parseWayfindingProject(fs.readFileSync(path.resolve('templates', 'wayfinding-project.json'), 'utf8'));
		const assessment = assessWayfindingProject(template);

		assert.equal(assessment.deliveryAllowed, false);
		assert.equal(assessment.deliveryMode, 'blocked');
	});

	void it('downgrades an illustrated raster map to directional guidance instead of inventing a route', (): void => {
		const assessment = assessWayfindingProject(project());

		assert.equal(assessment.targetSatisfied, false);
		assert.equal(assessment.deliveryAllowed, true);
		assert.equal(assessment.deliveryMode, 'directional');
		assert.equal(assessment.capabilities.destinationHighlight, true);
		assert.equal(assessment.capabilities.standardRouting, false);
		assert.ok(assessment.issues.some((issue): boolean => issue.code === 'guidance-mode-downgraded'));
	});

	void it('permits routing on a reviewed directory map with an independent walkable-space artifact', (): void => {
		const evidence: WayfindingProjectDocument['evidence'] = {
			accessibility: proposed(),
			currentLocationAnchors: confirmed('customer-provided'),
			destinationAnchors: confirmed('vector-extraction'),
			destinationMetadata: confirmed('customer-provided'),
			entranceApproaches: confirmed('reviewer-authored'),
			levelTransitions: proposed(),
			orientation: confirmed('customer-provided'),
			routeTopology: confirmed('reviewer-authored'),
			walkableSpace: confirmed('image-analysis', ['routeTopology'])
		};
		const assessment = assessWayfindingProject(project({
			evidence,
			source: { equivalentRedrawAllowed: true, kind: 'directory-map', levels: 1, presentation: 'redrawn-equivalent' }
		}));

		assert.equal(assessment.targetSatisfied, true);
		assert.equal(assessment.deliveryMode, 'route');
		assert.equal(assessment.capabilities.standardRouting, true);
	});

	void it('rejects a graph-derived mask as route certification evidence', (): void => {
		const base = project();
		const assessment = assessWayfindingProject(project({
			evidence: {
				...base.evidence,
				entranceApproaches: confirmed(),
				routeTopology: confirmed(),
				walkableSpace: confirmed('image-analysis')
			}
		}));

		assert.equal(assessment.capabilities.standardRouting, false);
		assert.equal(assessment.deliveryMode, 'directional');
		assert.ok(assessment.issues.some((issue): boolean => issue.code === 'walkable-space-not-independent'));
	});

	void it('requires reviewed transitions before routing across multiple levels', (): void => {
		const base = project();
		const assessment = assessWayfindingProject(project({
			evidence: {
				...base.evidence,
				entranceApproaches: confirmed(),
				routeTopology: confirmed(),
				walkableSpace: confirmed('image-analysis', ['routeTopology'])
			},
			source: { equivalentRedrawAllowed: true, kind: 'floor-plan', levels: 2, presentation: 'schematic' }
		}));

		assert.equal(assessment.capabilities.standardRouting, false);
		assert.ok(assessment.issues.some((issue): boolean => issue.code === 'route-evidence-incomplete' && issue.evidence.includes('levelTransitions')));
	});

	void it('requires calibrated projection before drawing routes over isometric artwork', (): void => {
		const allConfirmed: WayfindingProjectDocument['evidence'] = {
			accessibility: confirmed(),
			currentLocationAnchors: confirmed(),
			destinationAnchors: confirmed(),
			destinationMetadata: confirmed(),
			entranceApproaches: confirmed(),
			levelTransitions: confirmed(),
			orientation: confirmed(),
			routeTopology: confirmed(),
			walkableSpace: confirmed('image-analysis', ['routeTopology'])
		};
		const assessment = assessWayfindingProject(project({
			evidence: allConfirmed,
			source: { equivalentRedrawAllowed: true, kind: 'isometric-map', levels: 1, presentation: 'source-overlay' }
		}));

		assert.equal(assessment.capabilities.standardRouting, false);
		assert.equal(assessment.deliveryMode, 'directional');
		assert.ok(assessment.issues.some((issue): boolean => issue.code === 'isometric-projection-uncalibrated'));
	});

	void it('blocks delivery when the target is not certified and fallback is disabled', (): void => {
		const assessment = assessWayfindingProject(project({
			guidance: { allowFallback: false, stepFreeRequired: false, targetMode: 'route' }
		}));

		assert.equal(assessment.deliveryAllowed, false);
		assert.equal(assessment.deliveryMode, 'blocked');
	});

	void it('does not accept self-declared confirmed evidence without review provenance', (): void => {
		const invalid = project();
		invalid.evidence.destinationMetadata = { provenance: 'ai-inferred', status: 'confirmed' };

		assert.throws(
			(): void => { parseWayfindingProject(JSON.stringify(invalid)); },
			/Wayfinding project schema validation failed/
		);
	});
});
