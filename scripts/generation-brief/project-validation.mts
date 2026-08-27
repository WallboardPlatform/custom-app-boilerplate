import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { normalizeDatasourceBindings } from '../datasource-provisioning.mjs';
import { readPngDimensions } from '../png-validation.mjs';
import type { GenerationBrief } from './validation.mts';
import { validateStyleIsolation } from './style-isolation.mts';

export interface ProjectValidationContext {
	id: string;
	applicationDirectory: string;
	briefPath: string;
	contractPath: string;
	fixturePath: string;
	propertiesPath: string;
}

interface PropertySummary {
	dataPickers: Set<string>;
	settings: Set<string>;
	sliders: Set<string>;
}

interface PreviewScenarioValue {
	id?: unknown;
	minimumContentCoverage?: unknown;
}

interface PreviewSettingEffectValue {
	changedValue?: unknown;
	expectation?: unknown;
	id?: unknown;
	measurement?: unknown;
	property?: unknown;
	selector?: unknown;
	scenario?: unknown;
}

type JsonObject = Record<string, unknown>;

const fail = (context: ProjectValidationContext, message: string): never => {
	throw new Error(`${context.id}: ${message}`);
};

const isObject = (value: unknown): value is JsonObject => {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const requireObject = (context: ProjectValidationContext, value: unknown, field: string): JsonObject => {
	if (isObject(value)) {
		return value;
	}

	return fail(context, `${field} must be an object.`);
};

const requireString = (context: ProjectValidationContext, value: unknown, field: string): string => {
	if (typeof value === 'string' && value.trim() !== '') {
		return value;
	}

	return fail(context, `${field} must be a non-empty string.`);
};

const requireSettingEffectMeasurement = (
	context: ProjectValidationContext,
	value: unknown,
	field: string
): void => {
	const measurement = requireObject(context, value, field);
	const type = requireString(context, measurement.type, `${field}.type`);

	if (type === 'bounding-box') {
		if (measurement.dimension !== 'width' && measurement.dimension !== 'height') {
			fail(context, `${field}.dimension must be 'width' or 'height'.`);
		}

		return;
	}

	if (type === 'computed-style') {
		requireString(context, measurement.property, `${field}.property`);

		return;
	}

	if (type === 'attribute') {
		requireString(context, measurement.name, `${field}.name`);

		return;
	}

	if (type !== 'text-content') {
		fail(context, `${field}.type must be 'bounding-box', 'computed-style', 'text-content', or 'attribute'.`);
	}
};

const requireSettingEffectExpectation = (
	context: ProjectValidationContext,
	value: unknown,
	field: string
): void => {
	const expectation = requireObject(context, value, field);
	const type = requireString(context, expectation.type, `${field}.type`);

	if (type !== 'change' && type !== 'increase' && type !== 'decrease') {
		fail(context, `${field}.type must be 'change', 'increase', or 'decrease'.`);
	}

	if (expectation.minimumDelta !== undefined) {
		if (
			type === 'change'
			|| typeof expectation.minimumDelta !== 'number'
			|| !Number.isFinite(expectation.minimumDelta)
			|| expectation.minimumDelta <= 0
		) {
			fail(context, `${field}.minimumDelta must be a positive number for increase or decrease expectations.`);
		}
	}
};

export const readJsonFile = (
	context: ProjectValidationContext,
	filePath: string,
	label: string
): JsonObject => {
	if (!fs.existsSync(filePath)) {
		fail(context, `${label} '${path.relative(context.applicationDirectory, filePath)}' was not found.`);
	}

	let value: unknown;

	try {
		value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
	} catch (error) {
		return fail(context, `${label} is not valid JSON: ${(error as Error).message}`);
	}

	return requireObject(context, value, label);
};

const collectProperties = (
	context: ProjectValidationContext,
	properties: unknown,
	output: PropertySummary = { dataPickers: new Set(), settings: new Set(), sliders: new Set() }
): PropertySummary => {
	if (!Array.isArray(properties)) {
		return fail(context, 'properties.json properties must be an array.');
	}

	for (const propertyValue of properties) {
		const property = requireObject(context, propertyValue, 'properties[]');

		if (Array.isArray(property.properties)) {
			collectProperties(context, property.properties, output);

			continue;
		}

		const propertyName = requireString(
			context,
			property.property ?? property.propertyContainer,
			'properties[].property or properties[].propertyContainer'
		);
		const propertyType = typeof property.type === 'string' ? property.type : '';
		const fileType = typeof property.fileType === 'string' ? property.fileType.trim() : '';

		if (propertyType === 'folder' && !fileType.endsWith('_folder')) {
			fail(
				context,
				`folder property '${propertyName}' requires a fileType ending in '_folder' (for example 'video_folder' or 'pdf_folder') so the legacy editor renders its picker.`
			);
		}

		if (propertyType === 'file' && fileType.endsWith('_folder')) {
			fail(
				context,
				`file property '${propertyName}' must use the base fileType without the '_folder' suffix.`
			);
		}
		const target = property.type === 'dataPicker' ? output.dataPickers : output.settings;

		if (target.has(propertyName)) {
			if (property.propertyContainer === propertyName) {
				continue;
			}

			fail(context, `properties.json contains duplicate property '${propertyName}'.`);
		}

		target.add(propertyName);

		if (property.type === 'slider') {
			output.sliders.add(propertyName);
		}
	}

	return output;
};

const validatePropertyNesting = (
	context: ProjectValidationContext,
	properties: unknown,
	depth = 0
): void => {
	if (!Array.isArray(properties)) {
		return fail(context, 'properties.json properties must be an array.');
	}

	for (const propertyValue of properties) {
		const property = requireObject(context, propertyValue, 'properties[]');

		if (!Array.isArray(property.properties)) {
			continue;
		}

		if (depth > 0) {
			const label: string = typeof property.label === 'string' ? property.label : '(unlabelled)';

			fail(
				context,
				`nested property group '${label}' is not supported by the legacy editor; keep its controls in the parent group and apply visibilityConditions to each control.`
			);
		}

		validatePropertyNesting(context, property.properties, depth + 1);
	}
};

// Property types the quick editor can render today. Everything else is either valueless (button, dividers, group),
// resolved by another mechanism (dataPicker goes through the content-wide datasource override), or still pending
// (select, file, iconSelect, folder and the propertyContainer-based font controls).
const QUICK_EDIT_SUPPORTED_TYPES = new Set(['text', 'textArea', 'number', 'slider', 'checkbox', 'color']);

const QUICK_EDIT_DECLARATION_KEYS = new Set(['label', 'order', 'defaultEnabled']);

// Baking a long option list into every content that places the app is wasteful; warn well before it hurts
const QUICK_EDIT_LABEL_MAX_LENGTH = 60;

/**
 * Validates the optional `quickEdit` opt-in on property blocks.
 * The declaration only says what MAY be quick-edited; whether it actually is stays a per-tag designer decision.
 */
const validateQuickEditDeclarations = (
	context: ProjectValidationContext,
	properties: unknown
): void => {
	if (!Array.isArray(properties)) {
		return fail(context, 'properties.json properties must be an array.');
	}

	for (const propertyValue of properties) {
		const property = requireObject(context, propertyValue, 'properties[]');
		const isGroup = Array.isArray(property.properties);

		if (isGroup) {
			if (property.quickEdit !== undefined) {
				const label: string = typeof property.label === 'string' ? property.label : '(unlabelled)';

				fail(context, `property group '${label}' must not declare quickEdit; declare it on the individual controls instead.`);
			}

			validateQuickEditDeclarations(context, property.properties);

			continue;
		}

		if (property.quickEdit === undefined) {
			continue;
		}

		const propertyType = typeof property.type === 'string' ? property.type : '';
		const propertyName = typeof property.property === 'string' ? property.property : '';

		if (typeof property.quickEdit !== 'boolean' && !isObject(property.quickEdit)) {
			fail(context, `quickEdit on '${propertyName || propertyType}' must be a boolean or an object.`);
		}

		if (property.quickEdit === false) {
			continue;
		}

		if (!propertyName) {
			fail(
				context,
				`quickEdit requires a 'property' name; '${propertyType}' controls addressed by propertyContainer are not quick-editable yet.`
			);
		}

		if (!QUICK_EDIT_SUPPORTED_TYPES.has(propertyType)) {
			fail(
				context,
				`quickEdit is not supported on '${propertyType}' property '${propertyName}'. Supported types: ${[...QUICK_EDIT_SUPPORTED_TYPES].sort().join(', ')}.`
			);
		}

		if (!isObject(property.quickEdit)) {
			continue;
		}

		for (const key of Object.keys(property.quickEdit)) {
			if (!QUICK_EDIT_DECLARATION_KEYS.has(key)) {
				fail(
					context,
					`quickEdit on '${propertyName}' has an unknown key '${key}'. Allowed keys: ${[...QUICK_EDIT_DECLARATION_KEYS].sort().join(', ')}.`
				);
			}
		}

		const {label, order, defaultEnabled} = property.quickEdit;

		if (label !== undefined && (typeof label !== 'string' || label.trim().length === 0)) {
			fail(context, `quickEdit.label on '${propertyName}' must be a non-empty string.`);
		}

		if (typeof label === 'string' && label.length > QUICK_EDIT_LABEL_MAX_LENGTH) {
			fail(context, `quickEdit.label on '${propertyName}' must be at most ${QUICK_EDIT_LABEL_MAX_LENGTH} characters.`);
		}

		if (order !== undefined && (typeof order !== 'number' || !Number.isFinite(order))) {
			fail(context, `quickEdit.order on '${propertyName}' must be a number.`);
		}

		if (defaultEnabled !== undefined && typeof defaultEnabled !== 'boolean') {
			fail(context, `quickEdit.defaultEnabled on '${propertyName}' must be a boolean.`);
		}
	}
};

const setsMatch = (left: Set<string>, right: Set<string>): boolean => {
	return left.size === right.size && [...left].every((value) => right.has(value));
};

const formatSet = (values: Set<string>): string => [...values].sort().join(', ') || '(none)';

const parsePixelSize = (context: ProjectValidationContext, value: unknown, field: string): number => {
	const size = requireString(context, value, field);
	const match = /^(\d+)px$/.exec(size);

	if (!match || Number(match[1]) <= 0) {
		return fail(context, `${field} must be a positive integer pixel value.`);
	}

	return Number(match[1]);
};

const requireMinimumContentCoverage = (
	context: ProjectValidationContext,
	value: unknown,
	field: string
): void => {
	const coverage = requireObject(context, value, field);

	for (const dimension of ['width', 'height']) {
		const percentage = coverage[dimension];

		if (typeof percentage !== 'number' || !Number.isInteger(percentage) || percentage < 1 || percentage > 100) {
			fail(context, `${field}.${dimension} must be an integer percentage from 1 to 100.`);
		}
	}
};

const resolveInsideApplication = (
	context: ProjectValidationContext,
	relativePath: string,
	field: string
): string => {
	const resolvedPath = path.resolve(context.applicationDirectory, relativePath);

	if (!resolvedPath.startsWith(`${context.applicationDirectory}${path.sep}`)) {
		fail(context, `${field} must stay inside the application directory.`);
	}

	return resolvedPath;
};

export const validateBriefAgainstProject = async (
	context: ProjectValidationContext,
	brief: GenerationBrief
): Promise<void> => {
	const properties = readJsonFile(context, context.propertiesPath, 'properties.json');
	validatePropertyNesting(context, properties.properties);
	validateQuickEditDeclarations(context, properties.properties);
	const propertySummary = collectProperties(context, properties.properties);

	if (brief.briefVersion >= 4) {
		validateStyleIsolation(context.applicationDirectory);
	}

	if (brief.app.name !== properties.name) {
		fail(context, 'app.name must match properties.json name.');
	}

	if (String(brief.app.version) !== String(properties.version)) {
		fail(context, 'app.version must match properties.json version.');
	}

	const primarySurface = brief.surfaces.find((surface) => surface.role === 'primary');
	const size = requireObject(context, properties.size, 'properties.json size');
	const configuredWidth = parsePixelSize(context, size.width, 'properties.json size.width');
	const configuredHeight = parsePixelSize(context, size.height, 'properties.json size.height');

	if (!primarySurface || primarySurface.width !== configuredWidth || primarySurface.height !== configuredHeight) {
		fail(context, 'the primary surface must match properties.json size.');
	}

	const briefBindings = new Map(brief.data.bindings.map((binding) => [binding.property, binding]));

	if (brief.data.mode === 'static') {
		if (propertySummary.dataPickers.size > 0 || fs.existsSync(context.contractPath)) {
			fail(context, 'static apps must not declare data pickers or a datasource contract.');
		}
	} else {
		const contract = readJsonFile(context, context.contractPath, 'datasource contract');
		const contractBindings = normalizeDatasourceBindings(contract) as unknown[];
		const contractProperties = new Set<string>();

		for (const bindingValue of contractBindings) {
			const binding = requireObject(context, bindingValue, 'datasource contract binding');
			const property = requireString(context, binding.property, 'datasource contract binding property');
			const source = requireObject(context, binding.source, `${property}.source`);
			const sourceContract = requireString(context, source.contract, `${property}.source.contract`);
			const briefBinding = briefBindings.get(property);

			if (!briefBinding || briefBinding.contract !== sourceContract) {
				fail(context, `data binding '${property}' must match datasource-contract.json contract '${sourceContract}'.`);
			}

			if (contractProperties.has(property)) {
				fail(context, `datasource-contract.json contains duplicate binding '${property}'.`);
			}

			contractProperties.add(property);
		}

		if (
			!setsMatch(contractProperties, propertySummary.dataPickers)
			|| !setsMatch(contractProperties, new Set(briefBindings.keys()))
		) {
			fail(
				context,
				`datasource properties must match across brief, contract, and properties.json. Brief: ${formatSet(new Set(briefBindings.keys()))}; contract: ${formatSet(contractProperties)}; properties: ${formatSet(propertySummary.dataPickers)}.`
			);
		}
	}

	const plannedSettings = new Set(brief.settings.map((setting) => setting.property));

	if (!setsMatch(plannedSettings, propertySummary.settings)) {
		fail(context, `settings must exactly match editor properties. Brief: ${formatSet(plannedSettings)}; properties: ${formatSet(propertySummary.settings)}.`);
	}

	if (brief.briefVersion >= 4 && (brief.presentation?.themes.length ?? 0) > 1 && !plannedSettings.has('themePreset')) {
		fail(context, 'multiple presentation themes require a \'themePreset\' editor property.');
	}

	if (!fs.existsSync(context.fixturePath)) {
		fail(context, `preview fixture '${path.relative(context.applicationDirectory, context.fixturePath)}' was not found.`);
	}

	const fixtureUrl = `${pathToFileURL(context.fixturePath).href}?brief-validation=${Date.now()}-${Math.random()}`;
	const fixtureModule = await import(fixtureUrl) as {
		previewScenarios?: PreviewScenarioValue[];
		previewSettingEffects?: PreviewSettingEffectValue[];
	};
	const previewScenarioIds = new Set<string>();

	for (const [index, scenario] of (fixtureModule.previewScenarios ?? []).entries()) {
		const scenarioId = requireString(context, scenario.id, `previewScenarios[${index}].id`);

		if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(scenarioId)) {
			fail(context, `previewScenarios[${index}].id must be a lowercase kebab-case identifier.`);
		}

		requireMinimumContentCoverage(
			context,
			scenario.minimumContentCoverage,
			`previewScenarios[${index}].minimumContentCoverage`
		);

		if (previewScenarioIds.has(scenarioId)) {
			fail(context, `preview fixture contains duplicate scenario '${scenarioId}'.`);
		}

		previewScenarioIds.add(scenarioId);
	}

	const stateScenarioIds = new Set(brief.states.map((state) => state.scenario));

	if (!setsMatch(stateScenarioIds, previewScenarioIds)) {
		fail(context, `states must document every named preview scenario. Brief: ${formatSet(stateScenarioIds)}; fixture: ${formatSet(previewScenarioIds)}.`);
	}

	for (const policy of brief.dynamicText) {
		if (!previewScenarioIds.has(policy.evidenceScenario)) {
			fail(context, `dynamicText '${policy.id}' references unknown evidence scenario '${policy.evidenceScenario}'.`);
		}

		if (policy.source.type === 'setting') {
			for (const property of policy.source.properties) {
				if (!propertySummary.settings.has(property)) {
					fail(context, `dynamicText '${policy.id}' references unknown setting '${property}'.`);
				}
			}
		}

		if (policy.source.type === 'datasource') {
			for (const property of policy.source.properties) {
				if (!briefBindings.has(property)) {
					fail(context, `dynamicText '${policy.id}' references unknown datasource binding '${property}'.`);
				}
			}
		}
	}

	const effectIds = new Set<string>();
	const effectProperties = new Map<string, string>();

	for (const [index, effect] of (fixtureModule.previewSettingEffects ?? []).entries()) {
		const effectId = requireString(context, effect.id, `previewSettingEffects[${index}].id`);
		const property = requireString(context, effect.property, `previewSettingEffects[${index}].property`);

		requireString(context, effect.selector, `previewSettingEffects[${index}].selector`);

		if (!Object.prototype.hasOwnProperty.call(effect, 'changedValue') || effect.changedValue === undefined) {
			fail(context, `previewSettingEffects[${index}].changedValue must be defined.`);
		}

		requireSettingEffectMeasurement(
			context,
			effect.measurement,
			`previewSettingEffects[${index}].measurement`
		);
		requireSettingEffectExpectation(
			context,
			effect.expectation,
			`previewSettingEffects[${index}].expectation`
		);

		if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(effectId)) {
			fail(context, `previewSettingEffects[${index}].id must be a lowercase kebab-case identifier.`);
		}

		if (!propertySummary.settings.has(property)) {
			fail(context, `setting effect '${effectId}' references unknown editor property '${property}'.`);
		}

		if (effectIds.has(effectId)) {
			fail(context, `preview fixture contains duplicate setting effect '${effectId}'.`);
		}

		if (effect.scenario !== undefined) {
			const scenario = requireString(context, effect.scenario, `previewSettingEffects[${index}].scenario`);

			if (!previewScenarioIds.has(scenario)) {
				fail(context, `setting effect '${effectId}' references unknown scenario '${scenario}'.`);
			}
		}

		effectIds.add(effectId);
		effectProperties.set(effectId, property);
	}

	const referencedEffectIds = new Set<string>();

	for (const setting of brief.settings) {
		if (!setting.effect) {
			continue;
		}

		if (!effectIds.has(setting.effect)) {
			fail(context, `setting '${setting.property}' references unknown effect '${setting.effect}'.`);
		}

		if (effectProperties.get(setting.effect) !== setting.property) {
			fail(context, `setting effect '${setting.effect}' must verify property '${setting.property}'.`);
		}

		referencedEffectIds.add(setting.effect);
	}

	for (const effectId of effectIds) {
		if (!referencedEffectIds.has(effectId)) {
			fail(context, `setting effect '${effectId}' must be referenced by settings[].effect.`);
		}
	}

	for (const slider of propertySummary.sliders) {
		const plannedSetting = brief.settings.find((setting) => setting.property === slider);

		if (!plannedSetting?.effect) {
			fail(context, `slider setting '${slider}' must declare executable settings[].effect evidence.`);
		}
	}

	const referencedTestFiles = new Set<string>();

	for (const behavior of brief.behaviors) {
		if ('scenario' in behavior.evidence && !previewScenarioIds.has(behavior.evidence.scenario)) {
			fail(context, `behavior '${behavior.id}' references unknown scenario '${behavior.evidence.scenario}'.`);
		}

		if ('testFile' in behavior.evidence) {
			const testPath = resolveInsideApplication(
				context,
				behavior.evidence.testFile,
				`behavior '${behavior.id}' testFile`
			);

			if (!fs.existsSync(testPath)) {
				fail(context, `behavior '${behavior.id}' testFile '${behavior.evidence.testFile}' was not found.`);
			}

			referencedTestFiles.add(path.normalize(behavior.evidence.testFile));
		}
	}

	const previewDirectory = path.join(context.applicationDirectory, 'preview');
	const appSpecificTests = fs.existsSync(previewDirectory)
		? fs.readdirSync(previewDirectory)
			.filter((entry) => entry.endsWith('.spec.ts') && entry !== 'visual.spec.ts')
			.map((entry) => path.normalize(path.join('preview', entry)))
		: [];

	for (const testFile of appSpecificTests) {
		if (!referencedTestFiles.has(testFile)) {
			fail(context, `app-specific test '${testFile}' must be referenced by behaviors[].evidence.testFile.`);
		}
	}

	for (const asset of brief.assets) {
		if (asset.source === 'packaged') {
			const assetPath = resolveInsideApplication(context, asset.path, `asset '${asset.id}' path`);

			if (!fs.existsSync(assetPath)) {
				fail(context, `packaged asset '${asset.path}' was not found.`);
			}

			if (asset.id === 'app-icon' || asset.id === 'app-placeholder') {
				try {
					readPngDimensions(assetPath);
				} catch (error) {
					fail(context, `packaged asset '${asset.path}' is invalid: ${(error as Error).message}.`);
				}
			}
		} else if (asset.source === 'datasource') {
			if (!briefBindings.has(asset.binding)) {
				fail(context, `datasource asset '${asset.id}' references unknown binding '${asset.binding}'.`);
			}
		} else {
			for (const property of asset.properties) {
				if (!propertySummary.settings.has(property)) {
					fail(context, `setting asset '${asset.id}' references unknown setting '${property}'.`);
				}
			}
		}
	}
};
