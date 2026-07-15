import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { normalizeDatasourceBindings } from '../datasource-provisioning.mjs';
import { readPngDimensions } from '../png-validation.mjs';
import type { GenerationBrief } from './validation.mts';

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
}

interface PreviewScenarioValue {
	id?: unknown;
	minimumContentCoverage?: unknown;
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
	output: PropertySummary = { dataPickers: new Set(), settings: new Set() }
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
		const target = property.type === 'dataPicker' ? output.dataPickers : output.settings;

		if (target.has(propertyName)) {
			if (property.propertyContainer === propertyName) {
				continue;
			}

			fail(context, `properties.json contains duplicate property '${propertyName}'.`);
		}

		target.add(propertyName);
	}

	return output;
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
	const propertySummary = collectProperties(context, properties.properties);

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

	if (!fs.existsSync(context.fixturePath)) {
		fail(context, `preview fixture '${path.relative(context.applicationDirectory, context.fixturePath)}' was not found.`);
	}

	const fixtureUrl = `${pathToFileURL(context.fixturePath).href}?brief-validation=${Date.now()}-${Math.random()}`;
	const fixtureModule = await import(fixtureUrl) as { previewScenarios?: PreviewScenarioValue[] };
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
