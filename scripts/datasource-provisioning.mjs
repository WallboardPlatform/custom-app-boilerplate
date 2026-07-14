const PROVISIONING_BY_CONTRACT = Object.freeze({
	TABLE: Object.freeze({
		current: 'create-or-import-then-bind',
		future: 'create-from-packaged-template'
	}),
	CUSTOM: Object.freeze({
		current: 'create-or-import-then-bind',
		future: 'create-from-packaged-template'
	}),
	EXISTING: Object.freeze({
		current: 'select-existing-then-bind',
		future: 'bind-existing-source'
	}),
	FEED: Object.freeze({
		current: 'select-integrated-then-bind',
		future: 'bind-integrated-source'
	}),
	CALENDAR: Object.freeze({
		current: 'select-integrated-then-bind',
		future: 'bind-integrated-source'
	})
});

export const getDatasourceProvisioning = (sourceContract) => {
	const provisioning = PROVISIONING_BY_CONTRACT[sourceContract];

	if (!provisioning) {
		throw new Error(`Unsupported datasource contract '${sourceContract}'.`);
	}

	return provisioning;
};
