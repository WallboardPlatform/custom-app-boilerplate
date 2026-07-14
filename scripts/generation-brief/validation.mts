import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { Ajv, type ErrorObject } from 'ajv';

import { isDatasourceSourceCompatible } from '../datasource-provisioning.mjs';

export interface GenerationBriefBinding {
	property: string;
	source: 'generated' | 'existing' | 'built-in';
	contract: 'TABLE' | 'CUSTOM' | 'EXISTING' | 'FEED' | 'CALENDAR';
}

export interface GenerationBriefSetting {
	property: string;
	purpose: string;
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

export type GenerationBriefAsset =
	| { id: string; source: 'packaged'; path: string; required: boolean }
	| { id: string; source: 'datasource'; binding: string; required: boolean }
	| { id: string; source: 'setting'; properties: string[]; required: boolean };

export interface GenerationBrief {
	briefVersion: 1;
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
	surfaces: Array<{
		id: string;
		width: number;
		height: number;
		role: 'primary' | 'required' | 'fallback';
		purpose: string;
	}>;
	data: {
		mode: 'static' | 'bound';
		bindings: GenerationBriefBinding[];
	};
	settings: GenerationBriefSetting[];
	states: GenerationBriefState[];
	behaviors: GenerationBriefBehavior[];
	assets: GenerationBriefAsset[];
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

	if (!brief.surfaces.some((surface) => surface.height > surface.width)) {
		fail(id, 'surfaces must include portrait fallback validation.');
	}

	if (!brief.surfaces.some((surface) => surface.height === surface.width)) {
		fail(id, 'surfaces must include square fallback validation.');
	}

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

	requireUnique(id, brief.settings.map((setting) => setting.property), 'settings[].property');
	requireUnique(id, brief.states.map((state) => state.scenario), 'states[].scenario');
	requireUnique(id, brief.behaviors.map((behavior) => behavior.id), 'behaviors[].id');
	requireUnique(id, brief.assets.map((asset) => asset.id), 'assets[].id');
	validateRequiredEditorAsset(id, brief, 'app-icon', 'src/editor-assets/icon.png');
	validateRequiredEditorAsset(id, brief, 'app-placeholder', 'src/editor-assets/placeholder.png');

	return brief;
};
