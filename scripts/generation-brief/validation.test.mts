import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import {
	type ProjectValidationContext,
	validateBriefAgainstProject
} from './project-validation.mts';
import {
	type GenerationBrief,
	validateStandaloneBrief
} from './validation.mts';

const VALID_PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
	'base64'
);

const createValidBrief = (): GenerationBrief => ({
	briefVersion: 1,
	request: {
		summary: 'Create an operational signage widget.',
		audience: 'Visitors reading a shared display.',
		primaryGoal: 'Present current information clearly.'
	},
	assumptions: [],
	app: { mode: 'new', name: 'Validation Test', version: '1' },
	surfaces: [
		{ id: 'app-default', width: 1920, height: 1080, role: 'primary', purpose: 'Primary display.', minimumContentCoverage: { width: 80, height: 80 } },
		{ id: 'wide-low', width: 1536, height: 432, role: 'required', purpose: 'Wide display zone.', minimumContentCoverage: { width: 80, height: 70 } },
		{ id: 'portrait', width: 1080, height: 1920, role: 'fallback', purpose: 'Portrait fallback.', minimumContentCoverage: { width: 70, height: 80 } },
		{ id: 'square', width: 600, height: 600, role: 'fallback', purpose: 'Square fallback.', minimumContentCoverage: { width: 70, height: 70 } }
	],
	data: { mode: 'static', bindings: [] },
	settings: [],
	states: [],
	behaviors: [],
	assets: [
		{
			id: 'app-icon',
			source: 'packaged',
			path: 'src/editor-assets/icon.png',
			required: true
		},
		{
			id: 'app-placeholder',
			source: 'packaged',
			path: 'src/editor-assets/placeholder.png',
			required: true
		}
	],
	visualReview: {
		intent: 'A readable production signage composition.',
		focus: ['Check containment.', 'Check hierarchy.']
	}
});

const cloneBrief = (brief: GenerationBrief): GenerationBrief => {
	return JSON.parse(JSON.stringify(brief)) as GenerationBrief;
};

const createProject = (brief: GenerationBrief): ProjectValidationContext => {
	const applicationDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'wallboard-brief-'));
	const editorAssetsDirectory = path.join(applicationDirectory, 'src', 'editor-assets');
	const previewDirectory = path.join(applicationDirectory, 'preview');

	fs.mkdirSync(editorAssetsDirectory, { recursive: true });
	fs.mkdirSync(previewDirectory, { recursive: true });
	fs.writeFileSync(path.join(editorAssetsDirectory, 'icon.png'), VALID_PNG);
	fs.writeFileSync(path.join(editorAssetsDirectory, 'placeholder.png'), VALID_PNG);
	fs.writeFileSync(
		path.join(editorAssetsDirectory, 'properties.json'),
		JSON.stringify({
			name: brief.app.name,
			version: brief.app.version,
			size: { width: '1920px', height: '1080px' },
			properties: []
		})
	);
	fs.writeFileSync(path.join(previewDirectory, 'fixture.ts'), 'export const previewScenarios = [];\n');

	return {
		id: 'test-project',
		applicationDirectory,
		briefPath: path.join(applicationDirectory, 'generation-brief.json'),
		contractPath: path.join(applicationDirectory, 'datasource-contract.json'),
		fixturePath: path.join(previewDirectory, 'fixture.ts'),
		propertiesPath: path.join(editorAssetsDirectory, 'properties.json')
	};
};

void describe('standalone generation brief validation', () => {
	void it('accepts a complete plan without project artifacts', () => {
		assert.deepEqual(validateStandaloneBrief(createValidBrief()), createValidBrief());
	});

	void it('rejects unknown fields through the JSON schema', () => {
		const brief = createValidBrief() as GenerationBrief & { unexpected?: boolean };
		brief.unexpected = true;

		assert.throws(() => validateStandaloneBrief(brief), /additional properties/);
	});

	void it('rejects incompatible datasource source and contract pairs', () => {
		const brief = createValidBrief();
		brief.data = {
			mode: 'bound',
			bindings: [{ property: 'items', source: 'existing', contract: 'TABLE' }]
		};

		assert.throws(() => validateStandaloneBrief(brief), /source and contract are inconsistent/);
	});

	void it('requires the canonical editor icon and placeholder assets', () => {
		const brief = createValidBrief();
		brief.assets[0] = {
			id: 'brand-mark',
			source: 'packaged',
			path: 'src/editor-assets/icon.png',
			required: true
		};

		assert.throws(() => validateStandaloneBrief(brief), /app-icon/);
	});

	void it('requires measurable content coverage for every planned surface', () => {
		const brief = createValidBrief() as unknown as { surfaces: Array<Record<string, unknown>> };
		delete brief.surfaces[0].minimumContentCoverage;

		assert.throws(() => validateStandaloneBrief(brief), /minimumContentCoverage/);
	});

	void it('requires filename-safe surface and scenario identifiers', () => {
		const brief = createValidBrief();
		brief.surfaces[0].id = 'primary/surface';

		assert.throws(() => validateStandaloneBrief(brief), /pattern/);
	});
});

void describe('generation brief project synchronization', () => {
	void it('accepts a synchronized project', async (testContext) => {
		const brief = createValidBrief();
		const context = createProject(brief);
		testContext.after(() => fs.rmSync(context.applicationDirectory, { recursive: true, force: true }));

		await assert.doesNotReject(validateBriefAgainstProject(context, brief));
	});

	void it('rejects editor settings that are not implemented', async (testContext) => {
		const brief = createValidBrief();
		brief.settings.push({ property: 'title', purpose: 'Visible heading.' });
		const context = createProject(brief);
		testContext.after(() => fs.rmSync(context.applicationDirectory, { recursive: true, force: true }));

		await assert.rejects(validateBriefAgainstProject(context, brief), /settings must exactly match/);
	});

	void it('requires executable effect evidence for slider settings', async (testContext) => {
		const brief = createValidBrief();
		brief.settings.push({ property: 'logoScale', purpose: 'Visible logo size.' });
		const context = createProject(brief);
		testContext.after(() => fs.rmSync(context.applicationDirectory, { recursive: true, force: true }));
		fs.writeFileSync(
			context.propertiesPath,
			JSON.stringify({
				name: brief.app.name,
				version: brief.app.version,
				size: { width: '1920px', height: '1080px' },
				properties: [{ label: 'Logo size', type: 'slider', property: 'logoScale', default: 50 }]
			})
		);

		await assert.rejects(validateBriefAgainstProject(context, brief), /slider setting 'logoScale'/);
	});

	void it('accepts a slider with linked preview effect evidence', async (testContext) => {
		const brief = createValidBrief();
		brief.settings.push({ property: 'logoScale', purpose: 'Visible logo size.', effect: 'logo-scale' });
		const context = createProject(brief);
		testContext.after(() => fs.rmSync(context.applicationDirectory, { recursive: true, force: true }));
		fs.writeFileSync(
			context.propertiesPath,
			JSON.stringify({
				name: brief.app.name,
				version: brief.app.version,
				size: { width: '1920px', height: '1080px' },
				properties: [{ label: 'Logo size', type: 'slider', property: 'logoScale', default: 50 }]
			})
		);
		fs.writeFileSync(
			context.fixturePath,
			'export const previewScenarios = [];\nexport const previewSettingEffects = [{ id: \'logo-scale\', property: \'logoScale\', changedValue: 80, selector: \'.logo\', measurement: { type: \'bounding-box\', dimension: \'height\' }, expectation: { type: \'increase\', minimumDelta: 5 } }];\n'
		);

		await assert.doesNotReject(validateBriefAgainstProject(context, brief));
	});

	void it('rejects incomplete setting effect evidence', async (testContext) => {
		const brief = createValidBrief();
		brief.settings.push({ property: 'logoScale', purpose: 'Visible logo size.', effect: 'logo-scale' });
		const context = createProject(brief);
		testContext.after(() => fs.rmSync(context.applicationDirectory, { recursive: true, force: true }));
		fs.writeFileSync(
			context.propertiesPath,
			JSON.stringify({
				name: brief.app.name,
				version: brief.app.version,
				size: { width: '1920px', height: '1080px' },
				properties: [{ label: 'Logo size', type: 'slider', property: 'logoScale', default: 50 }]
			})
		);
		fs.writeFileSync(
			context.fixturePath,
			'export const previewScenarios = [];\nexport const previewSettingEffects = [{ id: \'logo-scale\', property: \'logoScale\', selector: \'.logo\' }];\n'
		);

		await assert.rejects(
			validateBriefAgainstProject(context, brief),
			/previewSettingEffects\[0\]\.changedValue must be defined/
		);
	});

	void it('rejects a missing packaged asset', async (testContext) => {
		const brief = createValidBrief();
		const context = createProject(brief);
		testContext.after(() => fs.rmSync(context.applicationDirectory, { recursive: true, force: true }));
		fs.rmSync(path.join(context.applicationDirectory, 'src', 'editor-assets', 'icon.png'));

		await assert.rejects(validateBriefAgainstProject(context, brief), /packaged asset/);
	});

	void it('rejects a corrupt editor image', async (testContext) => {
		const brief = createValidBrief();
		const context = createProject(brief);
		testContext.after(() => fs.rmSync(context.applicationDirectory, { recursive: true, force: true }));
		fs.writeFileSync(path.join(context.applicationDirectory, 'src', 'editor-assets', 'icon.png'), 'not-an-image');

		await assert.rejects(validateBriefAgainstProject(context, brief), /structurally valid PNG/);
	});

	void it('rejects preview states that are not implemented', async (testContext) => {
		const brief = cloneBrief(createValidBrief());
		brief.states.push({ scenario: 'empty', expectation: 'Show a clear empty state.' });
		const context = createProject(brief);
		testContext.after(() => fs.rmSync(context.applicationDirectory, { recursive: true, force: true }));

		await assert.rejects(validateBriefAgainstProject(context, brief), /states must document every named preview scenario/);
	});

	void it('rejects named scenarios without measurable content coverage', async (testContext) => {
		const brief = cloneBrief(createValidBrief());
		brief.states.push({ scenario: 'empty', expectation: 'Show a clear empty state.' });
		const context = createProject(brief);
		testContext.after(() => fs.rmSync(context.applicationDirectory, { recursive: true, force: true }));
		fs.writeFileSync(
			context.fixturePath,
			'export const previewScenarios = [{ id: \'empty\' }];\n'
		);

		await assert.rejects(validateBriefAgainstProject(context, brief), /minimumContentCoverage/);
	});

	void it('rejects preview scenario identifiers that are unsafe as filenames', async (testContext) => {
		const brief = cloneBrief(createValidBrief());
		brief.states.push({ scenario: 'unsafe-scenario', expectation: 'Show the requested state.' });
		const context = createProject(brief);
		testContext.after(() => fs.rmSync(context.applicationDirectory, { recursive: true, force: true }));
		fs.writeFileSync(
			context.fixturePath,
			'export const previewScenarios = [{ id: \'unsafe/scenario\', minimumContentCoverage: { width: 80, height: 80 } }];\n'
		);

		await assert.rejects(validateBriefAgainstProject(context, brief), /lowercase kebab-case identifier/);
	});
});
