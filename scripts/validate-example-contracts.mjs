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

const readSample = (exampleId, exampleDirectory, contract) => {
	const samplePath = requireString(exampleId, contract.source?.sampleData, 'source.sampleData');
	const absoluteSamplePath = path.resolve(exampleDirectory, samplePath);

	if (!absoluteSamplePath.startsWith(`${exampleDirectory}${path.sep}`) || !fs.existsSync(absoluteSamplePath)) {
		fail(exampleId, `sample datasource '${samplePath}' was not found inside the example.`);
	}

	return JSON.parse(fs.readFileSync(absoluteSamplePath, 'utf8'));
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

const validateTableContract = (exampleId, exampleDirectory, contract) => {
	const tableName = requireString(exampleId, contract.source?.table, 'source.table');
	const columns = contract.columns;

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

	const sample = readSample(exampleId, exampleDirectory, contract);
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

let validatedContracts = 0;

const validateContract = (exampleId, exampleDirectory, contractPath, propertiesPath) => {
	const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));

	if (contract.contractVersion !== 1) {
		fail(exampleId, 'contractVersion must be 1.');
	}

	const bindingProperty = requireString(exampleId, contract.binding?.property, 'binding.property');
	const dataPickerType = requireString(exampleId, contract.binding?.dataPickerType, 'binding.dataPickerType');
	const sourceContract = requireString(exampleId, contract.source?.contract, 'source.contract');
	const suggestedDatasourceName = requireString(
		exampleId,
		contract.delivery?.suggestedDatasourceName,
		'delivery.suggestedDatasourceName'
	);

	if (typeof contract.delivery?.quickEditEligible !== 'boolean') {
		fail(exampleId, 'delivery.quickEditEligible must be boolean.');
	}

	if (sourceContract === 'TABLE' && contract.delivery.quickEditEligible !== true) {
		fail(exampleId, `TABLE datasource '${suggestedDatasourceName}' must be quick-edit eligible.`);
	}

	if (!fs.existsSync(propertiesPath)) {
		fail(exampleId, `properties file '${path.relative(exampleDirectory, propertiesPath)}' was not found.`);
	}

	const properties = JSON.parse(fs.readFileSync(propertiesPath, 'utf8'));
	const dataPicker = findDataPicker(properties.properties, bindingProperty);

	if (!dataPicker) {
		fail(exampleId, `properties.json has no dataPicker for '${bindingProperty}'.`);
	}

	if ((dataPicker.dataPickerType ?? 'any') !== dataPickerType) {
		fail(exampleId, `dataPickerType for '${bindingProperty}' does not match the contract.`);
	}

	if (sourceContract === 'TABLE') {
		validateTableContract(exampleId, exampleDirectory, contract);
	} else if (sourceContract === 'CUSTOM') {
		readSample(exampleId, exampleDirectory, contract);
	}

	validatedContracts += 1;
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

console.log(`Validated ${validatedContracts} datasource contract(s).`);
