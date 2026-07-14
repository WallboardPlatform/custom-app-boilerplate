import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

interface ValidationContext {
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

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argumentsSet = new Set(process.argv.slice(2));
const validateProject = argumentsSet.has('--project');
const validateExamples = argumentsSet.has('--examples');

if (validateProject === validateExamples) {
	throw new Error('Use exactly one mode: --project or --examples.');
}

const fail = (context: ValidationContext, message: string): never => {
	throw new Error(`${context.id}: ${message}`);
};

const readJson = (context: ValidationContext, filePath: string, label: string): Record<string, any> => {
	if (!fs.existsSync(filePath)) {
		fail(context, `${label} '${path.relative(context.applicationDirectory, filePath)}' was not found.`);
	}

	try {
		return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, any>;
	} catch (error) {
		fail(context, `${label} is not valid JSON: ${(error as Error).message}`);
	}
};

const requireObject = (
	context: ValidationContext,
	value: unknown,
	field: string
): Record<string, any> => {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		fail(context, `${field} must be an object.`);
	}

	return value as Record<string, any>;
};

const requireString = (context: ValidationContext, value: unknown, field: string): string => {
	if (typeof value !== 'string' || value.trim() === '') {
		fail(context, `${field} must be a non-empty string.`);
	}

	return value as string;
};

const requireStringArray = (context: ValidationContext, value: unknown, field: string): string[] => {
	if (!Array.isArray(value)) {
		fail(context, `${field} must be an array.`);
	}

	return (value as unknown[]).map((entry, index) => requireString(context, entry, `${field}[${index}]`));
};

const requireUnique = (context: ValidationContext, values: string[], field: string): Set<string> => {
	const uniqueValues = new Set(values);

	if (uniqueValues.size !== values.length) {
		fail(context, `${field} must not contain duplicates.`);
	}

	return uniqueValues;
};

const setsMatch = (left: Set<string>, right: Set<string>): boolean => {
	return left.size === right.size && [...left].every((value) => right.has(value));
};

const formatSet = (values: Set<string>): string => [...values].sort().join(', ') || '(none)';

const collectProperties = (
	context: ValidationContext,
	properties: unknown,
	output: PropertySummary = { dataPickers: new Set(), settings: new Set() }
): PropertySummary => {
	if (!Array.isArray(properties)) {
		fail(context, 'properties.json properties must be an array.');
	}

	for (const propertyValue of properties as unknown[]) {
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

const normalizeContractBindings = (context: ValidationContext, contract: Record<string, any>): Array<Record<string, any>> => {
	if (Array.isArray(contract.bindings)) {
		return contract.bindings;
	}

	const binding = requireObject(context, contract.binding, 'datasource-contract.binding');

	return [{
		property: binding.property,
		source: contract.source
	}];
};

const parsePixelSize = (context: ValidationContext, value: unknown, field: string): number => {
	const size = requireString(context, value, field);
	const match = /^(\d+)px$/.exec(size);

	if (!match || Number(match[1]) <= 0) {
		fail(context, `${field} must be a positive integer pixel value.`);
	}

	return Number(match[1]);
};

const resolveInsideApplication = (
	context: ValidationContext,
	relativePath: string,
	field: string
): string => {
	const resolvedPath = path.resolve(context.applicationDirectory, relativePath);

	if (!resolvedPath.startsWith(`${context.applicationDirectory}${path.sep}`)) {
		fail(context, `${field} must stay inside the application directory.`);
	}

	return resolvedPath;
};

const validateBrief = async (context: ValidationContext): Promise<void> => {
	const brief = readJson(context, context.briefPath, 'generation brief');
	const properties = readJson(context, context.propertiesPath, 'properties.json');
	const propertySummary = collectProperties(context, properties.properties);

	if (brief.briefVersion !== 1) {
		fail(context, 'briefVersion must be 1.');
	}

	const request = requireObject(context, brief.request, 'request');
	requireString(context, request.summary, 'request.summary');
	requireString(context, request.audience, 'request.audience');
	requireString(context, request.primaryGoal, 'request.primaryGoal');
	requireStringArray(context, brief.assumptions, 'assumptions');

	const app = requireObject(context, brief.app, 'app');
	const appMode = requireString(context, app.mode, 'app.mode');

	if (!['new', 'replacement'].includes(appMode)) {
		fail(context, 'app.mode must be new or replacement.');
	}

	if (requireString(context, app.name, 'app.name') !== properties.name) {
		fail(context, 'app.name must match properties.json name.');
	}

	if (String(app.version) !== String(properties.version)) {
		fail(context, 'app.version must match properties.json version.');
	}

	if (!Array.isArray(brief.surfaces) || brief.surfaces.length < 4) {
		fail(context, 'surfaces must contain at least four realistic signage surfaces.');
	}

	const surfaceIds: string[] = [];
	let primarySurface: Record<string, any> | undefined;
	let hasPortrait = false;
	let hasSquare = false;

	for (const [index, surfaceValue] of brief.surfaces.entries()) {
		const surface = requireObject(context, surfaceValue, `surfaces[${index}]`);
		const id = requireString(context, surface.id, `surfaces[${index}].id`);
		const role = requireString(context, surface.role, `surfaces[${index}].role`);
		const width = Number(surface.width);
		const height = Number(surface.height);

		if (!['primary', 'required', 'fallback'].includes(role)) {
			fail(context, `surfaces[${index}].role must be primary, required, or fallback.`);
		}

		if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
			fail(context, `surfaces[${index}] width and height must be positive integers.`);
		}

		requireString(context, surface.purpose, `surfaces[${index}].purpose`);
		surfaceIds.push(id);
		hasPortrait ||= height > width;
		hasSquare ||= height === width;

		if (role === 'primary') {
			if (primarySurface) {
				fail(context, 'surfaces must contain exactly one primary surface.');
			}

			primarySurface = surface;
		}
	}

	requireUnique(context, surfaceIds, 'surfaces[].id');

	if (!primarySurface) {
		fail(context, 'surfaces must contain exactly one primary surface.');
	}

	const configuredWidth = parsePixelSize(context, properties.size?.width, 'properties.json size.width');
	const configuredHeight = parsePixelSize(context, properties.size?.height, 'properties.json size.height');

	if (primarySurface.width !== configuredWidth || primarySurface.height !== configuredHeight) {
		fail(context, 'the primary surface must match properties.json size.');
	}

	if (!hasPortrait || !hasSquare) {
		fail(context, 'surfaces must include portrait and square fallback validation.');
	}

	const data = requireObject(context, brief.data, 'data');
	const dataMode = requireString(context, data.mode, 'data.mode');

	if (!['static', 'bound'].includes(dataMode)) {
		fail(context, 'data.mode must be static or bound.');
	}

	if (!Array.isArray(data.bindings)) {
		fail(context, 'data.bindings must be an array.');
	}

	const briefBindings = new Map<string, Record<string, any>>();

	for (const [index, bindingValue] of data.bindings.entries()) {
		const binding = requireObject(context, bindingValue, `data.bindings[${index}]`);
		const property = requireString(context, binding.property, `data.bindings[${index}].property`);
		const source = requireString(context, binding.source, `data.bindings[${index}].source`);
		const contract = requireString(context, binding.contract, `data.bindings[${index}].contract`);

		if (!['generated', 'existing', 'built-in'].includes(source)) {
			fail(context, `data binding '${property}' source must be generated, existing, or built-in.`);
		}

		if (
			(source === 'generated' && !['TABLE', 'CUSTOM'].includes(contract))
			|| (source === 'existing' && contract !== 'EXISTING')
			|| (source === 'built-in' && !['FEED', 'CALENDAR'].includes(contract))
		) {
			fail(context, `data binding '${property}' source and contract are inconsistent.`);
		}

		if (briefBindings.has(property)) {
			fail(context, `data.bindings contains duplicate property '${property}'.`);
		}

		briefBindings.set(property, binding);
	}

	if (dataMode === 'static') {
		if (briefBindings.size > 0 || propertySummary.dataPickers.size > 0 || fs.existsSync(context.contractPath)) {
			fail(context, 'static apps must not declare datasource bindings, data pickers, or a datasource contract.');
		}
	} else {
		if (!fs.existsSync(context.contractPath)) {
			fail(context, 'bound apps must include datasource-contract.json.');
		}

		const contract = readJson(context, context.contractPath, 'datasource contract');
		const contractBindings = normalizeContractBindings(context, contract);
		const contractProperties = new Set<string>();

		for (const binding of contractBindings) {
			const property = requireString(context, binding.property, 'datasource contract binding property');
			const sourceContract = requireString(context, binding.source?.contract, `${property}.source.contract`);
			const briefBinding = briefBindings.get(property);

			if (!briefBinding || briefBinding.contract !== sourceContract) {
				fail(context, `data binding '${property}' must match datasource-contract.json contract '${sourceContract}'.`);
			}

			contractProperties.add(property);
		}

		if (!setsMatch(contractProperties, propertySummary.dataPickers) || !setsMatch(contractProperties, new Set(briefBindings.keys()))) {
			fail(
				context,
				`datasource properties must match across brief, contract, and properties.json. Brief: ${formatSet(new Set(briefBindings.keys()))}; contract: ${formatSet(contractProperties)}; properties: ${formatSet(propertySummary.dataPickers)}.`
			);
		}
	}

	if (!Array.isArray(brief.settings)) {
		fail(context, 'settings must be an array.');
	}

	const plannedSettings: string[] = [];

	for (const [index, settingValue] of brief.settings.entries()) {
		const setting = requireObject(context, settingValue, `settings[${index}]`);
		plannedSettings.push(requireString(context, setting.property, `settings[${index}].property`));
		requireString(context, setting.purpose, `settings[${index}].purpose`);
	}

	const plannedSettingSet = requireUnique(context, plannedSettings, 'settings[].property');

	if (!setsMatch(plannedSettingSet, propertySummary.settings)) {
		fail(context, `settings must exactly match editor properties. Brief: ${formatSet(plannedSettingSet)}; properties: ${formatSet(propertySummary.settings)}.`);
	}

	const fixtureUrl = `${pathToFileURL(context.fixturePath).href}?brief-validation=${Date.now()}-${Math.random()}`;
	const fixtureModule = await import(fixtureUrl) as { previewScenarios?: Array<{ id?: unknown }> };
	const previewScenarioIds = new Set<string>();

	for (const [index, scenario] of (fixtureModule.previewScenarios ?? []).entries()) {
		const id = requireString(context, scenario?.id, `previewScenarios[${index}].id`);

		if (previewScenarioIds.has(id)) {
			fail(context, `preview fixture contains duplicate scenario '${id}'.`);
		}

		previewScenarioIds.add(id);
	}

	if (!Array.isArray(brief.states)) {
		fail(context, 'states must be an array.');
	}

	const stateScenarioIds: string[] = [];

	for (const [index, stateValue] of brief.states.entries()) {
		const state = requireObject(context, stateValue, `states[${index}]`);
		stateScenarioIds.push(requireString(context, state.scenario, `states[${index}].scenario`));
		requireString(context, state.expectation, `states[${index}].expectation`);
	}

	const stateScenarioSet = requireUnique(context, stateScenarioIds, 'states[].scenario');

	if (!setsMatch(stateScenarioSet, previewScenarioIds)) {
		fail(context, `states must document every named preview scenario. Brief: ${formatSet(stateScenarioSet)}; fixture: ${formatSet(previewScenarioIds)}.`);
	}

	if (!Array.isArray(brief.behaviors)) {
		fail(context, 'behaviors must be an array.');
	}

	const behaviorIds: string[] = [];
	const referencedTestFiles = new Set<string>();

	for (const [index, behaviorValue] of brief.behaviors.entries()) {
		const behavior = requireObject(context, behaviorValue, `behaviors[${index}]`);
		behaviorIds.push(requireString(context, behavior.id, `behaviors[${index}].id`));
		requireString(context, behavior.expectation, `behaviors[${index}].expectation`);
		const evidence = requireObject(context, behavior.evidence, `behaviors[${index}].evidence`);
		const scenario = typeof evidence.scenario === 'string' ? evidence.scenario : undefined;
		const testFile = typeof evidence.testFile === 'string' ? evidence.testFile : undefined;

		if ((scenario ? 1 : 0) + (testFile ? 1 : 0) !== 1) {
			fail(context, `behaviors[${index}].evidence must contain exactly one of scenario or testFile.`);
		}

		if (scenario && !previewScenarioIds.has(scenario)) {
			fail(context, `behavior '${behavior.id}' references unknown scenario '${scenario}'.`);
		}

		if (testFile) {
			if (!testFile.endsWith('.spec.ts')) {
				fail(context, `behavior '${behavior.id}' testFile must end with .spec.ts.`);
			}

			const testPath = resolveInsideApplication(context, testFile, `behavior '${behavior.id}' testFile`);

			if (!fs.existsSync(testPath)) {
				fail(context, `behavior '${behavior.id}' testFile '${testFile}' was not found.`);
			}

			referencedTestFiles.add(path.normalize(testFile));
		}
	}

	requireUnique(context, behaviorIds, 'behaviors[].id');

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

	if (!Array.isArray(brief.assets) || brief.assets.length < 2) {
		fail(context, 'assets must include at least the app icon and placeholder.');
	}

	const assetIds: string[] = [];

	for (const [index, assetValue] of brief.assets.entries()) {
		const asset = requireObject(context, assetValue, `assets[${index}]`);
		const id = requireString(context, asset.id, `assets[${index}].id`);
		const source = requireString(context, asset.source, `assets[${index}].source`);

		if (typeof asset.required !== 'boolean') {
			fail(context, `assets[${index}].required must be boolean.`);
		}

		assetIds.push(id);

		if (source === 'packaged') {
			const assetPath = requireString(context, asset.path, `assets[${index}].path`);

			if (!fs.existsSync(resolveInsideApplication(context, assetPath, `assets[${index}].path`))) {
				fail(context, `packaged asset '${assetPath}' was not found.`);
			}
		} else if (source === 'datasource') {
			const binding = requireString(context, asset.binding, `assets[${index}].binding`);

			if (!briefBindings.has(binding)) {
				fail(context, `datasource asset '${id}' references unknown binding '${binding}'.`);
			}
		} else if (source === 'setting') {
			const properties = requireStringArray(context, asset.properties, `assets[${index}].properties`);

			for (const property of properties) {
				if (!propertySummary.settings.has(property)) {
					fail(context, `setting asset '${id}' references unknown setting '${property}'.`);
				}
			}
		} else {
			fail(context, `assets[${index}].source must be packaged, datasource, or setting.`);
		}
	}

	requireUnique(context, assetIds, 'assets[].id');

	const visualReview = requireObject(context, brief.visualReview, 'visualReview');
	requireString(context, visualReview.intent, 'visualReview.intent');

	if (requireStringArray(context, visualReview.focus, 'visualReview.focus').length < 2) {
		fail(context, 'visualReview.focus must contain at least two concrete review concerns.');
	}
};

const contexts: ValidationContext[] = [];

if (validateProject) {
	contexts.push({
		id: 'materialized-project',
		applicationDirectory: rootDirectory,
		briefPath: path.join(rootDirectory, 'generation-brief.json'),
		contractPath: path.join(rootDirectory, 'datasource-contract.json'),
		fixturePath: path.join(rootDirectory, 'preview', 'fixture.ts'),
		propertiesPath: path.join(rootDirectory, 'src', 'editor-assets', 'properties.json')
	});
} else {
	const examplesDirectory = path.join(rootDirectory, 'examples');
	const validationDirectory = path.join(rootDirectory, '.tmp', 'brief-validation');

	if (!fs.existsSync(examplesDirectory)) {
		console.log('Validated 0 generation briefs (no example catalog in this project).');
		process.exit(0);
	}

	fs.rmSync(validationDirectory, { recursive: true, force: true });
	fs.mkdirSync(validationDirectory, { recursive: true });

	for (const entry of fs.readdirSync(examplesDirectory, { withFileTypes: true })) {
		if (!entry.isDirectory()) {
			continue;
		}

		const exampleDirectory = path.join(examplesDirectory, entry.name);
		const overlayDirectory = path.join(exampleDirectory, 'overlay');
		const applicationDirectory = path.join(validationDirectory, entry.name);
		const manifest = JSON.parse(fs.readFileSync(path.join(exampleDirectory, 'example.json'), 'utf8')) as Record<string, any>;

		fs.cpSync(overlayDirectory, applicationDirectory, { recursive: true });

		for (const artifact of manifest.artifacts ?? []) {
			const relativePath = requireString({
				id: entry.name,
				applicationDirectory,
				briefPath: '',
				contractPath: '',
				fixturePath: '',
				propertiesPath: ''
			}, artifact, 'example.json artifacts[]');
			const sourcePath = path.resolve(exampleDirectory, relativePath);
			const destinationPath = path.resolve(applicationDirectory, relativePath);

			if (!sourcePath.startsWith(`${exampleDirectory}${path.sep}`) || !destinationPath.startsWith(`${applicationDirectory}${path.sep}`)) {
				throw new Error(`${entry.name}: artifact '${relativePath}' must stay inside its source and materialized directories.`);
			}

			fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
			fs.cpSync(sourcePath, destinationPath, { recursive: true });
		}

		contexts.push({
			id: entry.name,
			applicationDirectory,
			briefPath: path.join(applicationDirectory, 'generation-brief.json'),
			contractPath: path.join(applicationDirectory, 'datasource-contract.json'),
			fixturePath: path.join(applicationDirectory, 'preview', 'fixture.ts'),
			propertiesPath: path.join(applicationDirectory, 'src', 'editor-assets', 'properties.json')
		});
	}
}

for (const context of contexts) {
	await validateBrief(context);
}

console.log(`Validated ${contexts.length} generation brief(s).`);
