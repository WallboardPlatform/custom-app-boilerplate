const PROVISIONING_BY_CONTRACT = Object.freeze({
	TABLE: Object.freeze({
		source: 'generated',
		quickEdit: 'required',
		current: 'create-or-import-then-bind',
		future: 'create-from-packaged-template'
	}),
	CUSTOM: Object.freeze({
		source: 'generated',
		quickEdit: 'optional',
		current: 'create-or-import-then-bind',
		future: 'create-from-packaged-template'
	}),
	EXISTING: Object.freeze({
		source: 'existing',
		quickEdit: 'forbidden',
		current: 'select-existing-then-bind',
		future: 'bind-existing-source'
	}),
	FEED: Object.freeze({
		source: 'built-in',
		quickEdit: 'forbidden',
		current: 'select-integrated-then-bind',
		future: 'bind-integrated-source'
	}),
	CALENDAR: Object.freeze({
		source: 'built-in',
		quickEdit: 'forbidden',
		current: 'select-integrated-then-bind',
		future: 'bind-integrated-source'
	})
});

export const getDatasourceDefinition = (sourceContract) => {
	const definition = PROVISIONING_BY_CONTRACT[sourceContract];

	if (!definition) {
		throw new Error(`Unsupported datasource contract '${sourceContract}'.`);
	}

	return definition;
};

export const getDatasourceProvisioning = (sourceContract) => {
	const { current, future } = getDatasourceDefinition(sourceContract);

	return { current, future };
};

export const isDatasourceSourceCompatible = (source, sourceContract) => {
	return getDatasourceDefinition(sourceContract).source === source;
};

export const normalizeDatasourceBindings = (contract) => {
	if (Array.isArray(contract.bindings)) {
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
