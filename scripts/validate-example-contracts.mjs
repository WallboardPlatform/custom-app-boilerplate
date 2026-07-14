import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const examplesDirectory = path.join(rootDirectory, 'examples');

const fail = (exampleId, message) => {
	throw new Error(`${exampleId}: ${message}`);
};

const requireString = (exampleId, value, field) => {
	if (typeof value !== 'string' || value.trim() === '') {
		fail(exampleId, `${field} must be a non-empty string.`);
	}

	return value;
};

const findDataPicker = (properties, propertyName) => {
	for (const property of properties ?? []) {
		if (property?.type === 'dataPicker' && property.property === propertyName) {
			return property;
		}

		const nested = findDataPicker(property?.properties, propertyName);

		if (nested) {
			return nested;
		}
	}

	return undefined;
};

const hasDataPicker = (properties) => {
	return (properties ?? []).some((property) => {
		return property?.type === 'dataPicker' || hasDataPicker(property?.properties);
	});
};

const readSample = (exampleId, exampleDirectory, source) => {
	const samplePath = requireString(exampleId, source?.sampleData, 'source.sampleData');
	const absoluteSamplePath = path.resolve(exampleDirectory, samplePath);

	if (!absoluteSamplePath.startsWith(`${exampleDirectory}${path.sep}`) || !fs.existsSync(absoluteSamplePath)) {
		fail(exampleId, `sample datasource '${samplePath}' was not found inside the example.`);
	}

	let sample = JSON.parse(fs.readFileSync(absoluteSamplePath, 'utf8'));

	if (source?.samplePath !== undefined) {
		const valuePath = requireString(exampleId, source.samplePath, 'source.samplePath').split('.');

		for (const segment of valuePath) {
			if (!sample || typeof sample !== 'object' || Array.isArray(sample) || !(segment in sample)) {
				fail(exampleId, `sample datasource does not contain path '${source.samplePath}'.`);
			}

			sample = sample[segment];
		}
	}

	return sample;
};

const matchesPrimitiveType = (value, type) => {
	if (value === undefined || value === null || value === '') {
		return true;
	}

	if (type === 'number') {
		return typeof value === 'number' && Number.isFinite(value);
	}

	if (type === 'boolean') {
		return typeof value === 'boolean';
	}

	if (['string', 'text', 'color', 'url', 'date', 'time'].includes(type)) {
		return typeof value === 'string';
	}

	return true;
};

const validateTableContract = (exampleId, exampleDirectory, binding) => {
	const tableName = requireString(exampleId, binding.source?.table, 'source.table');
	const columns = binding.columns;

	if (!Array.isArray(columns) || columns.length === 0) {
		fail(exampleId, 'columns must contain at least one column.');
	}

	const columnTypes = new Map();

	for (const column of columns) {
		const name = requireString(exampleId, column?.name, 'columns[].name');
		const type = requireString(exampleId, column?.type, `columns.${name}.type`);

		if (columnTypes.has(name)) {
			fail(exampleId, `duplicate column '${name}'.`);
		}

		columnTypes.set(name, { type, required: column.required === true });
	}

	const sample = readSample(exampleId, exampleDirectory, binding.source);
	const table = sample?.[tableName];

	if (!table || typeof table !== 'object' || Array.isArray(table)) {
		fail(exampleId, `sample datasource must contain table '${tableName}'.`);
	}

	if (!table.header || typeof table.header !== 'object' || Array.isArray(table.header)) {
		fail(exampleId, `table '${tableName}' must contain a header object.`);
	}

	if (!Array.isArray(table.rows)) {
		fail(exampleId, `table '${tableName}' must contain a rows array.`);
	}

	if (!table.connectors || typeof table.connectors !== 'object' || Array.isArray(table.connectors)) {
		fail(exampleId, `table '${tableName}' must contain a connectors object.`);
	}

	for (const [name, definition] of columnTypes) {
		if (table.header[name] !== definition.type) {
			fail(exampleId, `sample header '${name}' must use type '${definition.type}'.`);
		}
	}

	for (const name of Object.keys(table.header)) {
		if (!columnTypes.has(name)) {
			fail(exampleId, `sample header contains undocumented column '${name}'.`);
		}
	}

	for (const [rowIndex, row] of table.rows.entries()) {
		if (!row || typeof row !== 'object' || Array.isArray(row)) {
			fail(exampleId, `row ${rowIndex} must be an object.`);
		}

		for (const [name, definition] of columnTypes) {
			if (definition.required && (row[name] === undefined || row[name] === null || row[name] === '')) {
				fail(exampleId, `row ${rowIndex} is missing required column '${name}'.`);
			}

			if (!matchesPrimitiveType(row[name], definition.type)) {
				fail(exampleId, `row ${rowIndex} column '${name}' must use type '${definition.type}'.`);
			}
		}

		for (const name of Object.keys(row)) {
			if (!columnTypes.has(name)) {
				fail(exampleId, `row ${rowIndex} contains undocumented column '${name}'.`);
			}
		}
	}
};

let validatedBindings = 0;

const normalizeBindings = (exampleId, contract) => {
	if (Array.isArray(contract.bindings)) {
		if (contract.bindings.length === 0) {
			fail(exampleId, 'bindings must contain at least one datasource binding.');
		}

		return contract.bindings;
	}

	return [{
		property: contract.binding?.property,
		dataPickerType: contract.binding?.dataPickerType,
		source: contract.source,
		delivery: contract.delivery,
		columns: contract.columns
	}];
};

const collectDataPickers = (properties, output = []) => {
	for (const property of properties ?? []) {
		if (property?.type === 'dataPicker' && typeof property.property === 'string') {
			output.push(property.property);
		}

		collectDataPickers(property?.properties, output);
	}

	return output;
};

const validateContract = (exampleId, exampleDirectory, contractPath, propertiesPath) => {
	const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));

	if (contract.contractVersion !== 1) {
		fail(exampleId, 'contractVersion must be 1.');
	}

	if (!fs.existsSync(propertiesPath)) {
		fail(exampleId, `properties file '${path.relative(exampleDirectory, propertiesPath)}' was not found.`);
	}

	const properties = JSON.parse(fs.readFileSync(propertiesPath, 'utf8'));
	const bindings = normalizeBindings(exampleId, contract);
	const declaredProperties = new Set();
	const sampleDataPaths = new Set(bindings.map((binding) => {
		return requireString(exampleId, binding.source?.sampleData, `${binding.property ?? 'binding'}.source.sampleData`);
	}));

	if (sampleDataPaths.size !== 1) {
		fail(exampleId, 'all datasource bindings must use one shared sampleData bundle.');
	}

	for (const binding of bindings) {
		const bindingProperty = requireString(exampleId, binding.property, 'binding.property');
		const dataPickerType = requireString(exampleId, binding.dataPickerType, `${bindingProperty}.dataPickerType`);
		const sourceContract = requireString(exampleId, binding.source?.contract, `${bindingProperty}.source.contract`);
		const suggestedDatasourceName = requireString(
			exampleId,
			binding.delivery?.suggestedDatasourceName,
			`${bindingProperty}.delivery.suggestedDatasourceName`
		);

		if (declaredProperties.has(bindingProperty)) {
			fail(exampleId, `duplicate datasource binding '${bindingProperty}'.`);
		}

		declaredProperties.add(bindingProperty);

		if (typeof binding.delivery?.quickEditEligible !== 'boolean') {
			fail(exampleId, `${bindingProperty}.delivery.quickEditEligible must be boolean.`);
		}

		if (sourceContract === 'TABLE' && binding.delivery.quickEditEligible !== true) {
			fail(exampleId, `TABLE datasource '${suggestedDatasourceName}' must be quick-edit eligible.`);
		}

		const dataPicker = findDataPicker(properties.properties, bindingProperty);

		if (!dataPicker) {
			fail(exampleId, `properties.json has no dataPicker for '${bindingProperty}'.`);
		}

		if ((dataPicker.dataPickerType ?? 'any') !== dataPickerType) {
			fail(exampleId, `dataPickerType for '${bindingProperty}' does not match the contract.`);
		}

		if (sourceContract === 'TABLE') {
			validateTableContract(exampleId, exampleDirectory, binding);
		} else if (sourceContract === 'CUSTOM' || sourceContract === 'EXISTING') {
			readSample(exampleId, exampleDirectory, binding.source);
		} else {
			fail(exampleId, `unsupported source contract '${sourceContract}'.`);
		}

		validatedBindings += 1;
	}

	for (const dataPickerProperty of collectDataPickers(properties.properties)) {
		if (!declaredProperties.has(dataPickerProperty)) {
			fail(exampleId, `dataPicker '${dataPickerProperty}' is missing from datasource-contract.json.`);
		}
	}
};

const materializedContractPath = path.join(rootDirectory, 'datasource-contract.json');

if (fs.existsSync(materializedContractPath)) {
	validateContract(
		'materialized-project',
		rootDirectory,
		materializedContractPath,
		path.join(rootDirectory, 'src', 'editor-assets', 'properties.json')
	);
}

if (fs.existsSync(examplesDirectory)) {
	for (const entry of fs.readdirSync(examplesDirectory, { withFileTypes: true })) {
		if (!entry.isDirectory()) {
			continue;
		}

		const exampleId = entry.name;
		const exampleDirectory = path.join(examplesDirectory, exampleId);
		const contractPath = path.join(exampleDirectory, 'datasource-contract.json');
		const propertiesPath = path.join(exampleDirectory, 'overlay', 'src', 'editor-assets', 'properties.json');

		if (!fs.existsSync(contractPath)) {
			if (fs.existsSync(propertiesPath)) {
				const properties = JSON.parse(fs.readFileSync(propertiesPath, 'utf8'));

				if (hasDataPicker(properties.properties)) {
					fail(exampleId, 'data-bound examples must include datasource-contract.json.');
				}
			}

			continue;
		}

		validateContract(
			exampleId,
			exampleDirectory,
			contractPath,
			propertiesPath
		);
	}
}

console.log(`Validated ${validatedBindings} datasource binding(s).`);
