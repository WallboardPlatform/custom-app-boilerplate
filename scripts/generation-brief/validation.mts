import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { Ajv, type ErrorObject } from 'ajv';

import { isDatasourceSourceCompatible } from '../datasource-provisioning.mjs';

export interface GenerationBriefBinding {
	property: string;
	source: 'generated' | 'existing' | 'built-in';
	contract: 'TABLE' | 'CUSTOM' | 'EXISTING' | 'FEED' | 'CALENDAR';
	access?: 'read' | 'write' | 'read-write';
}

export interface GenerationBriefSetting {
	property: string;
	purpose: string;
	effect?: string;
}

export interface GenerationBriefState {
	scenario: string;
	expectation: string;
}

export interface GenerationBriefBehavior {
	id: string;
	expectation: string;
	evidence: { scenario: string } | { testFile: string };
}

export interface GenerationBriefDynamicTextPolicy {
	id: string;
	role?: 'primary' | 'secondary' | 'metadata';
	source: {
		type: 'setting' | 'datasource' | 'computed';
		properties: string[];
	};
	selectors: string[];
	strategy: 'auto-fit' | 'wrap' | 'ellipsis' | 'marquee';
	limits: {
		minimumFontSize?: number;
		maximumLines?: number;
	};
	fallback: string;
	rationale: string;
	evidenceScenario: string;
}

export type GenerationBriefAsset =
	| { id: string; source: 'packaged'; path: string; required: boolean }
	| { id: string; source: 'datasource'; binding: string; required: boolean }
	| { id: string; source: 'setting'; properties: string[]; required: boolean };

export interface GenerationBriefOwnershipDecision {
	id: string;
	area: 'content' | 'presentation' | 'behavior' | 'state';
	owner: 'locked' | 'setting' | 'datasource' | 'interaction' | 'external-command';
	targets: string[];
	rationale: string;
}

export interface GenerationBriefRuntimeOutput {
	id: string;
	channel: 'internal-datasource' | 'sensor-event' | 'own-state';
	target: string;
	operation: 'insert-to-array' | 'set' | 'merge' | 'increase' | 'decrease' | 'remove' | 'rotate' | 'upsert' | 'emit';
	editorPolicy: 'disabled' | 'preview-mock';
	expectation: string;
	failure: string;
}

export interface GenerationBrief {
	briefVersion: 3 | 4 | 5 | 6 | 7;
	request: {
		summary: string;
		audience: string;
		primaryGoal: string;
	};
	assumptions: string[];
	app: {
		mode: 'new' | 'replacement';
		name: string;
		version: string | number;
	};
	surfaceStrategy: {
		mode: 'fixed' | 'bounded' | 'adaptive';
		rationale: string;
	};
	surfaces: Array<{
		id: string;
		width: number;
		height: number;
		role: 'primary' | 'required' | 'fallback';
		purpose: string;
		minimumContentCoverage: {
			width: number;
			height: number;
		};
	}>;
	data: {
		mode: 'static' | 'bound';
		bindings: GenerationBriefBinding[];
	};
	ownership?: GenerationBriefOwnershipDecision[];
	experience?: {
		mode: 'passive' | 'interactive';
		views: Array<{ id: string; purpose: string }>;
		inputs: Array<{
			id: string;
			type: 'touch' | 'pointer' | 'keyboard' | 'external-command';
			action: string;
		}>;
		session: {
			reset: 'none' | 'timeout' | 'completion' | 'external-command' | 'manual';
			timeoutSeconds?: number;
			expectation: string;
		};
	};
	outputs?: GenerationBriefRuntimeOutput[];
	rendering?: {
		mode: 'reflow' | 'fixed-canvas';
		designWidth?: number;
		designHeight?: number;
		letterbox: 'transparent' | 'background';
		rationale: string;
	};
	motion?: {
		default: 'off' | 'subtle' | 'expressive';
		disableProperty?: string;
		presetProperty?: string;
		transition?: 'none' | 'fade' | 'slide' | 'scale' | 'custom';
		techniques: Array<'fade' | 'slide' | 'scale' | 'progress' | 'chart' | 'custom'>;
		rationale: string;
	};
	media?: Array<{
		id: string;
		type: 'image' | 'video';
		source: 'packaged' | 'datasource' | 'setting' | 'folder' | 'file-system' | 'feed' | 'weather';
		fit: 'cover' | 'contain' | 'blur-fill' | 'fill';
		binding?: string;
		properties?: string[];
		fields?: string[];
		lookup?: {
			recordBinding: string;
			recordField: string;
			assetField: string;
			urlFields: string[];
			match: 'filename' | 'filename-stem';
		};
		cache?: 'bundle' | 'platform' | 'none';
		preview?: 'packaged' | 'data-uri' | 'platform-mock';
		fallback: string;
		rationale: string;
	}>;
	branding?: {
		source: 'none' | 'settings' | 'reference' | 'mcp-branding-kit';
		editable: boolean;
		provenance: string;
		fallback: string;
	};
	presentation?: {
		themes: Array<'dark' | 'light' | 'custom'>;
		density: 'sparse' | 'balanced' | 'dense';
		viewingDistance?: 'near' | 'room' | 'distance';
		textRoles?: Array<{
			role: 'primary' | 'secondary' | 'metadata';
			selectors: string[];
		}>;
	};
	cadence?: {
		mode: 'static' | 'rotation';
		intervalProperty?: string;
	};
	settings: GenerationBriefSetting[];
	dynamicText: GenerationBriefDynamicTextPolicy[];
	states: GenerationBriefState[];
	behaviors: GenerationBriefBehavior[];
	assets: GenerationBriefAsset[];
	visualDirection: {
		source: 'reference-led' | 'instruction-led' | 'creative-led' | 'agent-authored';
		summary: string;
		references: string[];
		signatureChoices: string[];
		avoid: string[];
	};
	visualReview: {
		intent: string;
		focus: string[];
	};
}

const schemaPath = fileURLToPath(new URL('../../schemas/generation-brief.schema.json', import.meta.url));
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as object;
const ajv = new Ajv({ allErrors: true, strict: true });
const validateSchema = ajv.compile<GenerationBrief>(schema);

const fail = (id: string, message: string): never => {
	throw new Error(`${id}: ${message}`);
};

const formatSchemaError = (error: ErrorObject): string => {
	const field = error.instancePath || '/';

	return `${field} ${error.message ?? 'is invalid'}`;
};

const requireUnique = (id: string, values: string[], field: string): Set<string> => {
	const uniqueValues = new Set(values);

	if (uniqueValues.size !== values.length) {
		fail(id, `${field} must not contain duplicates.`);
	}

	return uniqueValues;
};

const validateRequiredEditorAsset = (
	id: string,
	brief: GenerationBrief,
	assetId: string,
	expectedPath: string
): void => {
	const asset = brief.assets.find((candidate) => candidate.id === assetId);

	if (
		!asset
		|| asset.source !== 'packaged'
		|| asset.path !== expectedPath
		|| asset.required !== true
	) {
		fail(id, `assets must include required packaged '${assetId}' at '${expectedPath}'.`);
	}
};

export const validateStandaloneBrief = (value: unknown, id = 'generation-brief'): GenerationBrief => {
	if (!validateSchema(value)) {
		const errors = (validateSchema.errors ?? []).map(formatSchemaError).join('; ');

		fail(id, `schema validation failed: ${errors}`);
	}

	const brief = value as GenerationBrief;
	const surfaceIds = brief.surfaces.map((surface) => surface.id);
	const primarySurfaces = brief.surfaces.filter((surface) => surface.role === 'primary');

	requireUnique(id, surfaceIds, 'surfaces[].id');

	if (primarySurfaces.length !== 1) {
		fail(id, 'surfaces must contain exactly one primary surface.');
	}

	if (brief.surfaceStrategy.mode === 'fixed') {
		if (brief.surfaces.some((surface) => surface.role === 'fallback')) {
			fail(id, 'fixed surface strategies must not declare fallback surfaces.');
		}
	} else if (brief.surfaceStrategy.mode === 'bounded') {
		if (brief.surfaces.length < 2) {
			fail(id, 'bounded surface strategies must declare at least two representative surfaces.');
		}
	} else {
		if (brief.surfaces.length < 4) {
			fail(id, 'adaptive surface strategies must declare at least four representative surfaces.');
		}

		if (!brief.surfaces.some((surface) => surface.height > surface.width)) {
			fail(id, 'adaptive surface strategies must include portrait fallback validation.');
		}

		if (!brief.surfaces.some((surface) => surface.height === surface.width)) {
			fail(id, 'adaptive surface strategies must include square fallback validation.');
		}
	}

	if (brief.visualDirection.source === 'reference-led' && brief.visualDirection.references.length === 0) {
		fail(id, 'reference-led visual direction must identify at least one user reference.');
	}

	if (brief.briefVersion === 4 && brief.visualDirection.source === 'agent-authored') {
		fail(id, 'v4 visual direction uses \'creative-led\' instead of legacy \'agent-authored\'.');
	}

	if (brief.briefVersion >= 5 && brief.visualDirection.source === 'agent-authored') {
		fail(id, `v${brief.briefVersion} visual direction uses 'creative-led' instead of legacy 'agent-authored'.`);
	}

	if (brief.presentation) {
		requireUnique(id, brief.presentation.themes, 'presentation.themes');
	}

	requireUnique(id, brief.visualDirection.references, 'visualDirection.references');
	requireUnique(id, brief.visualDirection.signatureChoices, 'visualDirection.signatureChoices');
	requireUnique(id, brief.visualDirection.avoid, 'visualDirection.avoid');

	const bindingProperties = requireUnique(
		id,
		brief.data.bindings.map((binding) => binding.property),
		'data.bindings[].property'
	);

	if (brief.data.mode === 'static' && bindingProperties.size > 0) {
		fail(id, 'static briefs must not declare datasource bindings.');
	}

	if (brief.data.mode === 'bound' && bindingProperties.size === 0) {
		fail(id, 'bound briefs must declare at least one datasource binding.');
	}

	for (const binding of brief.data.bindings) {
		if (!isDatasourceSourceCompatible(binding.source, binding.contract)) {
			fail(id, `data binding '${binding.property}' source and contract are inconsistent.`);
		}
	}

	if (brief.briefVersion >= 5) {
		const ownership = brief.ownership ?? [];
		const experience = brief.experience!;
		const outputs = brief.outputs ?? [];
		const rendering = brief.rendering!;
		const motion = brief.motion!;
		const ownershipTargets = new Set<string>();

		requireUnique(id, ownership.map((decision) => decision.id), 'ownership[].id');
		requireUnique(id, experience.views.map((view) => view.id), 'experience.views[].id');
		requireUnique(id, experience.inputs.map((input) => input.id), 'experience.inputs[].id');
		requireUnique(id, outputs.map((output) => output.id), 'outputs[].id');
		requireUnique(id, (brief.media ?? []).map((policy) => policy.id), 'media[].id');

		for (const binding of brief.data.bindings) {
			if (!binding.access) {
				fail(id, `v5 data binding '${binding.property}' must declare read, write, or read-write access.`);
			}
		}

		for (const decision of ownership) {
			for (const target of decision.targets) {
				if (ownershipTargets.has(target)) {
					fail(id, `ownership target '${target}' must have exactly one owner.`);
				}

				ownershipTargets.add(target);
			}
		}

		for (const setting of brief.settings) {
			const decision = ownership.find((candidate) => candidate.targets.includes(setting.property));

			if (decision?.owner !== 'setting') {
				fail(id, `setting '${setting.property}' must have setting ownership.`);
			}
		}

		for (const binding of brief.data.bindings) {
			const decision = ownership.find((candidate) => candidate.targets.includes(binding.property));

			if (decision?.owner !== 'datasource') {
				fail(id, `data binding '${binding.property}' must have datasource ownership.`);
			}
		}

		if (experience.mode === 'passive' && experience.inputs.length > 0) {
			fail(id, 'passive experiences must not declare interactive inputs.');
		}

		if (experience.mode === 'interactive' && experience.inputs.length === 0) {
			fail(id, 'interactive experiences must declare at least one input.');
		}

		if (experience.session.reset === 'timeout' && experience.session.timeoutSeconds === undefined) {
			fail(id, 'timeout session reset must declare timeoutSeconds.');
		}

		if (rendering.mode === 'fixed-canvas' && (!rendering.designWidth || !rendering.designHeight)) {
			fail(id, 'fixed-canvas rendering must declare designWidth and designHeight.');
		}

		if (rendering.mode === 'reflow' && (rendering.designWidth || rendering.designHeight)) {
			fail(id, 'reflow rendering must not declare a fixed design size.');
		}

		if (motion.default === 'off' && motion.techniques.length > 0) {
			fail(id, 'motion default off must not declare active techniques.');
		}

		if (motion.default !== 'off' && motion.techniques.length === 0) {
			fail(id, 'enabled motion must declare at least one technique.');
		}

		if (motion.disableProperty && !brief.settings.some((setting) => setting.property === motion.disableProperty)) {
			fail(id, `motion disableProperty '${motion.disableProperty}' must reference an editor setting.`);
		}

		for (const output of outputs) {
			if (output.channel === 'internal-datasource') {
				const binding = brief.data.bindings.find((candidate) => candidate.property === output.target);

				if (!binding || binding.access === 'read') {
					fail(id, `internal datasource output '${output.id}' must target a write-enabled binding.`);
				}

				if (output.editorPolicy !== 'disabled') {
					fail(id, `internal datasource output '${output.id}' must be disabled in the Wallboard editor.`);
				}
			} else if (output.channel === 'sensor-event' && output.operation !== 'emit') {
				fail(id, `sensor event output '${output.id}' must use the emit operation.`);
			} else if (output.channel === 'own-state' && output.operation !== 'set') {
				fail(id, `own-state output '${output.id}' must use the set operation.`);
			}
		}

		for (const binding of brief.data.bindings) {
			if (
				(binding.access === 'write' || binding.access === 'read-write')
				&& !outputs.some((output) => output.channel === 'internal-datasource' && output.target === binding.property)
			) {
				fail(id, `write-enabled binding '${binding.property}' must have an internal datasource output contract.`);
			}
		}
	}

	if (brief.briefVersion >= 6) {
		const textRoles = brief.presentation?.textRoles ?? [];
		const roleNames = requireUnique(id, textRoles.map((policy) => policy.role), 'presentation.textRoles[].role');
		const selectorsByRole = new Map(textRoles.map((policy) => [policy.role, requireUnique(
			id,
			policy.selectors,
			`presentation.textRoles '${policy.role}' selectors`
		)]));
		const allSelectors = textRoles.flatMap((policy) => policy.selectors);

		requireUnique(id, allSelectors, 'presentation.textRoles[].selectors');

		if (!roleNames.has('primary') || !roleNames.has('secondary')) {
			fail(id, 'v6 presentation.textRoles must declare primary and secondary text.');
		}

		for (const policy of brief.dynamicText) {
			if (!policy.role) {
				fail(id, `v6 dynamicText '${policy.id}' must declare a semantic role.`);
			}

			const roleSelectors = selectorsByRole.get(policy.role!);

			for (const selector of policy.selectors) {
				if (!roleSelectors?.has(selector)) {
					fail(id, `v6 dynamicText '${policy.id}' selector '${selector}' must be declared under presentation.textRoles '${policy.role}'.`);
				}
			}
		}

		const cadence = brief.cadence!;

		if (cadence.mode === 'rotation') {
			if (!cadence.intervalProperty) {
				fail(id, 'v6 rotation cadence must declare intervalProperty.');
			}

			if (!brief.settings.some((setting) => setting.property === cadence.intervalProperty)) {
				fail(id, `cadence intervalProperty '${cadence.intervalProperty}' must reference an editor setting.`);
			}

			if (!brief.behaviors.some((behavior) => 'testFile' in behavior.evidence)) {
				fail(id, 'v6 rotation cadence must have behavior-test evidence.');
			}
		} else if (cadence.intervalProperty) {
			fail(id, 'v6 static cadence must not declare intervalProperty.');
		}
	}

	if (brief.briefVersion === 7) {
		const motion = brief.motion!;
		const media = brief.media ?? [];

		if (motion.disableProperty) {
			fail(id, 'v7 motion uses presetProperty instead of legacy disableProperty.');
		}

		if (motion.default === 'off') {
			if (motion.transition !== 'none') {
				fail(id, 'v7 motion default off must declare transition none.');
			}
		} else {
			if (!motion.presetProperty) {
				fail(id, 'v7 enabled motion must declare presetProperty.');
			}

			if (!brief.settings.some((setting) => setting.property === motion.presetProperty)) {
				fail(id, `motion presetProperty '${motion.presetProperty}' must reference an editor setting.`);
			}

			if (!motion.transition || motion.transition === 'none') {
				fail(id, 'v7 enabled motion must declare an active transition.');
			}

			if (!brief.behaviors.some((behavior) => 'testFile' in behavior.evidence)) {
				fail(id, 'v7 enabled motion must have behavior-test evidence.');
			}
		}

		for (const policy of media) {
			if (!policy.cache || !policy.preview) {
				fail(id, `v7 media '${policy.id}' must declare cache and preview policies.`);
			}

			if (policy.source === 'folder') {
				fail(id, `v7 media '${policy.id}' uses file-system instead of legacy folder.`);
			}

			if (policy.source === 'packaged') {
				if (policy.cache !== 'bundle' || policy.preview !== 'packaged') {
					fail(id, `packaged media '${policy.id}' must use bundle cache and packaged preview.`);
				}
			} else if (policy.source === 'setting') {
				if (!(policy.properties?.length) || policy.properties.some((property) => !brief.settings.some((setting) => setting.property === property))) {
					fail(id, `setting media '${policy.id}' must reference editor properties.`);
				}

				if (policy.cache !== 'platform' || (policy.preview !== 'data-uri' && policy.preview !== 'platform-mock')) {
					fail(id, `setting media '${policy.id}' must use platform cache and an offline preview.`);
				}
			} else if (policy.source === 'weather') {
				if (policy.binding) {
					fail(id, `weather media '${policy.id}' must use the platform weather service, not a datasource binding.`);
				}

				if (policy.cache !== 'platform' || policy.preview !== 'platform-mock') {
					fail(id, `weather media '${policy.id}' must use platform cache and platform-mock preview.`);
				}
			} else {
				const binding = brief.data.bindings.find((candidate) => candidate.property === policy.binding);

				if (!binding) {
					fail(id, `media '${policy.id}' binding '${policy.binding ?? ''}' must reference a datasource.`);
				}

				if (policy.cache !== 'platform' || (policy.preview !== 'data-uri' && policy.preview !== 'platform-mock')) {
					fail(id, `bound media '${policy.id}' must use platform cache and an offline preview.`);
				}

				if (policy.source === 'feed' && binding?.contract !== 'FEED') {
					fail(id, `feed media '${policy.id}' must reference a FEED binding.`);
				}

				if ((policy.source === 'datasource' || policy.source === 'feed') && !(policy.fields?.length)) {
					fail(id, `${policy.source} media '${policy.id}' must declare candidate fields.`);
				}

				if (policy.source === 'file-system') {
					const lookup = policy.lookup;

					if (!lookup) {
						fail(id, `file-system media '${policy.id}' must declare lookup between record and asset bindings.`);
					}


					if (binding?.contract !== 'EXISTING'
						|| !brief.data.bindings.some((candidate) => candidate.property === lookup?.recordBinding)) {
						fail(id, `file-system media '${policy.id}' lookup bindings must exist.`);
					}
				}
			}
		}
	}

	requireUnique(id, brief.settings.map((setting) => setting.property), 'settings[].property');
	requireUnique(id, brief.dynamicText.map((policy) => policy.id), 'dynamicText[].id');

	for (const policy of brief.dynamicText) {
		requireUnique(id, policy.source.properties, `dynamicText '${policy.id}' source.properties`);
		requireUnique(id, policy.selectors, `dynamicText '${policy.id}' selectors`);

		if (policy.strategy === 'auto-fit' && policy.limits.minimumFontSize === undefined) {
			fail(id, `dynamicText '${policy.id}' auto-fit strategy must declare limits.minimumFontSize.`);
		}

		if (
			(policy.strategy === 'wrap' || policy.strategy === 'ellipsis')
			&& policy.limits.maximumLines === undefined
		) {
			fail(id, `dynamicText '${policy.id}' ${policy.strategy} strategy must declare limits.maximumLines.`);
		}
	}

	requireUnique(id, brief.states.map((state) => state.scenario), 'states[].scenario');
	requireUnique(id, brief.behaviors.map((behavior) => behavior.id), 'behaviors[].id');
	requireUnique(id, brief.assets.map((asset) => asset.id), 'assets[].id');
	validateRequiredEditorAsset(id, brief, 'app-icon', 'src/editor-assets/icon.png');
	validateRequiredEditorAsset(id, brief, 'app-placeholder', 'src/editor-assets/placeholder.png');

	return brief;
};
