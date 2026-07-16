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
const VALID_PREVIEW_SCENARIOS = 'export const previewScenarios = [{ id: \'long-labels\', minimumContentCoverage: { width: 80, height: 80 } }];\n';

const createValidBrief = (): GenerationBrief => ({
	briefVersion: 4,
	request: {
		summary: 'Create an operational signage widget.',
		audience: 'Visitors reading a shared display.',
		primaryGoal: 'Present current information clearly.'
	},
	assumptions: [],
	app: { mode: 'new', name: 'Validation Test', version: '1' },
	surfaceStrategy: {
		mode: 'adaptive',
		rationale: 'The request requires use across unknown signage aspect ratios.'
	},
	surfaces: [
		{ id: 'app-default', width: 1920, height: 1080, role: 'primary', purpose: 'Primary display.', minimumContentCoverage: { width: 80, height: 80 } },
		{ id: 'wide-low', width: 1536, height: 432, role: 'required', purpose: 'Wide display zone.', minimumContentCoverage: { width: 80, height: 70 } },
		{ id: 'portrait', width: 1080, height: 1920, role: 'fallback', purpose: 'Portrait fallback.', minimumContentCoverage: { width: 70, height: 80 } },
		{ id: 'square', width: 600, height: 600, role: 'fallback', purpose: 'Square fallback.', minimumContentCoverage: { width: 70, height: 70 } }
	],
	data: { mode: 'static', bindings: [] },
	presentation: { themes: ['dark'], density: 'balanced' },
	settings: [],
	dynamicText: [
		{
			id: 'primary-title',
			source: { type: 'computed', properties: ['primaryTitle'] },
			selectors: ['.dynamic-title'],
			strategy: 'auto-fit',
			limits: { minimumFontSize: 18, maximumLines: 1 },
			fallback: 'Wrap to two lines if the title still cannot fit at the readable minimum.',
			rationale: 'The primary title is variable and must remain readable without silent clipping.',
			evidenceScenario: 'long-labels'
		}
	],
	states: [{ scenario: 'long-labels', expectation: 'Stress text remains readable.' }],
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
	visualDirection: {
		source: 'creative-led',
		summary: 'A clear operational composition authored for the stated audience.',
		references: [],
		signatureChoices: ['One dominant status region.', 'Quiet supporting metadata.'],
		avoid: ['Generic nested dashboard cards.']
	},
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
	fs.writeFileSync(path.join(previewDirectory, 'fixture.ts'), VALID_PREVIEW_SCENARIOS);

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

	void it('keeps legacy v3 briefs compatible without presentation decisions', () => {
		const brief = createValidBrief();
		brief.briefVersion = 3;
		delete brief.presentation;
		brief.visualDirection.source = 'agent-authored';

		assert.doesNotThrow(() => validateStandaloneBrief(brief));
	});

	void it('requires presentation decisions for v4 briefs', () => {
		const brief = createValidBrief();
		delete brief.presentation;

		assert.throws(() => validateStandaloneBrief(brief), /presentation/);
	});

	void it('uses creative-led instead of agent-authored in v4 briefs', () => {
		const brief = createValidBrief();
		brief.visualDirection.source = 'agent-authored';

		assert.throws(() => validateStandaloneBrief(brief), /creative-led/);
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

	void it('requires an explicit dynamic text policy', () => {
		const brief = createValidBrief() as unknown as Record<string, unknown>;
		delete brief.dynamicText;

		assert.throws(() => validateStandaloneBrief(brief), /dynamicText/);
	});

	void it('requires auto-fit policies to declare a readable minimum', () => {
		const brief = createValidBrief();
		brief.dynamicText[0].limits = { maximumLines: 1 };

		assert.throws(() => validateStandaloneBrief(brief), /minimumFontSize/);
	});

	void it('requires bounded wrap policies to declare a maximum line count', () => {
		const brief = createValidBrief();
		brief.dynamicText[0].strategy = 'wrap';
		brief.dynamicText[0].limits = { minimumFontSize: 18 };

		assert.throws(() => validateStandaloneBrief(brief), /maximumLines/);
	});

	void it('rejects duplicate dynamic text policy identifiers', () => {
		const brief = createValidBrief();
		brief.dynamicText.push(cloneBrief(brief).dynamicText[0]);

		assert.throws(() => validateStandaloneBrief(brief), /dynamicText\[\]\.id/);
	});

	void it('requires filename-safe surface and scenario identifiers', () => {
		const brief = createValidBrief();
		brief.surfaces[0].id = 'primary/surface';

		assert.throws(() => validateStandaloneBrief(brief), /pattern/);
	});

	void it('accepts a single explicitly fixed surface', () => {
		const brief = createValidBrief();
		brief.surfaceStrategy = {
			mode: 'fixed',
			rationale: 'The target is one known LED wall canvas.'
		};
		brief.surfaces = [brief.surfaces[0]];

		assert.doesNotThrow(() => validateStandaloneBrief(brief));
	});

	void it('rejects a fallback surface for a fixed strategy', () => {
		const brief = createValidBrief();
		brief.surfaceStrategy = {
			mode: 'fixed',
			rationale: 'The target is one known LED wall canvas.'
		};
		brief.surfaces = [
			brief.surfaces[0],
			brief.surfaces[2]
		];

		assert.throws(() => validateStandaloneBrief(brief), /must not declare fallback/);
	});

	void it('requires two representative surfaces for a bounded strategy', () => {
		const brief = createValidBrief();
		brief.surfaceStrategy = {
			mode: 'bounded',
			rationale: 'The widget is used in a known family of landscape zones.'
		};
		brief.surfaces = [brief.surfaces[0]];

		assert.throws(() => validateStandaloneBrief(brief), /at least two representative surfaces/);
	});

	void it('keeps portrait and square evidence mandatory for adaptive apps', () => {
		const brief = createValidBrief();
		brief.surfaces = brief.surfaces.filter((surface) => surface.id !== 'portrait');
		brief.surfaces.push({
			id: 'landscape-small',
			width: 800,
			height: 450,
			role: 'fallback',
			purpose: 'Additional landscape fallback.',
			minimumContentCoverage: { width: 70, height: 70 }
		});

		assert.throws(() => validateStandaloneBrief(brief), /portrait fallback/);
	});

	void it('requires a named reference for reference-led visual direction', () => {
		const brief = createValidBrief();
		brief.visualDirection.source = 'reference-led';

		assert.throws(() => validateStandaloneBrief(brief), /at least one user reference/);
	});
});

void describe('generation brief project synchronization', () => {
	void it('accepts a synchronized project', async (testContext) => {
		const brief = createValidBrief();
		const context = createProject(brief);
		testContext.after(() => fs.rmSync(context.applicationDirectory, { recursive: true, force: true }));

		await assert.doesNotReject(validateBriefAgainstProject(context, brief));
	});

	void it('requires a theme preset property for multiple v4 themes', async (testContext) => {
		const brief = createValidBrief();
		brief.presentation = { themes: ['dark', 'light', 'custom'], density: 'balanced' };
		const context = createProject(brief);
		testContext.after(() => fs.rmSync(context.applicationDirectory, { recursive: true, force: true }));

		await assert.rejects(validateBriefAgainstProject(context, brief), /themePreset/);
	});

	void it('rejects unscoped global classes in v4 app components', async (testContext) => {
		const brief = createValidBrief();
		const context = createProject(brief);
		testContext.after(() => fs.rmSync(context.applicationDirectory, { recursive: true, force: true }));
		const componentDirectory = path.join(context.applicationDirectory, 'src', 'components', 'wb-app');
		fs.mkdirSync(componentDirectory, { recursive: true });
		fs.writeFileSync(path.join(componentDirectory, 'widget.tsx'), 'export const Widget = () => <div class="card title" />;\n');

		await assert.rejects(validateBriefAgainstProject(context, brief), /unscoped global class 'card'/);
	});

	void it('accepts uniquely namespaced global classes and custom properties', async (testContext) => {
		const brief = createValidBrief();
		const context = createProject(brief);
		testContext.after(() => fs.rmSync(context.applicationDirectory, { recursive: true, force: true }));
		const componentDirectory = path.join(context.applicationDirectory, 'src', 'components', 'wb-app');
		fs.mkdirSync(componentDirectory, { recursive: true });
		fs.writeFileSync(path.join(componentDirectory, 'widget.tsx'), 'export const Widget = () => <div class="wb-validation-widget-card" />;\n');
		fs.writeFileSync(path.join(componentDirectory, 'widget.module.scss'), ':global(.wb-validation-widget-card) { color: var(--wb-validation-widget-text); }\n');

		await assert.doesNotReject(validateBriefAgainstProject(context, brief));
	});

	void it('rejects unscoped global selectors and custom properties in v4 styles', async (testContext) => {
		const brief = createValidBrief();
		const context = createProject(brief);
		testContext.after(() => fs.rmSync(context.applicationDirectory, { recursive: true, force: true }));
		const componentDirectory = path.join(context.applicationDirectory, 'src', 'components', 'wb-app');
		fs.mkdirSync(componentDirectory, { recursive: true });
		fs.writeFileSync(path.join(componentDirectory, 'widget.module.scss'), ':global(.card) { color: var(--accent); }\n');

		await assert.rejects(validateBriefAgainstProject(context, brief), /unscoped :global class 'card'/);
	});

	void it('rejects dynamic text evidence that is not implemented', async (testContext) => {
		const brief = createValidBrief();
		brief.dynamicText[0].evidenceScenario = 'missing-long-labels';
		const context = createProject(brief);
		testContext.after(() => fs.rmSync(context.applicationDirectory, { recursive: true, force: true }));

		await assert.rejects(validateBriefAgainstProject(context, brief), /unknown evidence scenario/);
	});

	void it('rejects dynamic text policies that reference unknown settings', async (testContext) => {
		const brief = createValidBrief();
		brief.dynamicText[0].source = { type: 'setting', properties: ['missingTitle'] };
		const context = createProject(brief);
		testContext.after(() => fs.rmSync(context.applicationDirectory, { recursive: true, force: true }));

		await assert.rejects(validateBriefAgainstProject(context, brief), /unknown setting 'missingTitle'/);
	});

	void it('rejects dynamic text policies that reference unknown datasource bindings', async (testContext) => {
		const brief = createValidBrief();
		brief.dynamicText[0].source = { type: 'datasource', properties: ['missingData'] };
		const context = createProject(brief);
		testContext.after(() => fs.rmSync(context.applicationDirectory, { recursive: true, force: true }));

		await assert.rejects(validateBriefAgainstProject(context, brief), /unknown datasource binding 'missingData'/);
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
			`${VALID_PREVIEW_SCENARIOS}export const previewSettingEffects = [{ id: 'logo-scale', property: 'logoScale', changedValue: 80, selector: '.logo', measurement: { type: 'bounding-box', dimension: 'height' }, expectation: { type: 'increase', minimumDelta: 5 } }];\n`
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
			`${VALID_PREVIEW_SCENARIOS}export const previewSettingEffects = [{ id: 'logo-scale', property: 'logoScale', selector: '.logo' }];\n`
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
