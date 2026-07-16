const SYNTHETIC_SENTINELS = new Set([
	'', 'example-only', 'not-configured', 'placeholder', 'sample-only', 'synthetic'
]);
const SENSITIVE_KEY = /(?:api[-_]?key|credential|password|secret|token)/i;
const EMAIL = /\b[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})\b/gi;
const WALLBOARD_HOST = /https?:\/\/[^\s/]*(?:wallboard\.info|wallboard\.us)(?=[:/\s]|$)/i;
const PRODUCTION_IDENTIFIER = /\b(?:[0-9a-f]{24,64}|[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\b/i;

const fail = (exampleId, location, message) => {
	throw new Error(`${exampleId}: ${location} ${message}`);
};

const validateString = (exampleId, location, key, value) => {
	if (WALLBOARD_HOST.test(value)) {
		fail(exampleId, location, 'contains a Wallboard environment URL.');
	}

	if (PRODUCTION_IDENTIFIER.test(value)) {
		fail(exampleId, location, 'contains a production-shaped identifier.');
	}

	for (const match of value.matchAll(EMAIL)) {
		if (!match[1]?.toLowerCase().endsWith('.invalid')) {
			fail(exampleId, location, 'contains a non-reserved email address.');
		}
	}

	if (SENSITIVE_KEY.test(key) && !SYNTHETIC_SENTINELS.has(value.trim().toLowerCase())) {
		fail(exampleId, location, `uses a non-sentinel value for sensitive field '${key}'.`);
	}

	if (/^(?:link|url)$/i.test(key) && /^https?:\/\//i.test(value)) {
		const hostname = new URL(value).hostname.toLowerCase();

		if (!hostname.endsWith('.invalid')) {
			fail(exampleId, location, `uses non-reserved URL host '${hostname}'.`);
		}
	}
};

const visit = (exampleId, value, location = '$', key = '') => {
	if (typeof value === 'string') {
		validateString(exampleId, location, key, value);
		return;
	}

	if (Array.isArray(value)) {
		value.forEach((item, index) => visit(exampleId, item, `${location}[${index}]`, key));
		return;
	}

	if (!value || typeof value !== 'object') {
		return;
	}

	for (const [childKey, childValue] of Object.entries(value)) {
		visit(exampleId, childValue, `${location}.${childKey}`, childKey);
	}
};

export const validateSyntheticSample = (exampleId, contract, sample) => {
	if (contract.sampleDataClassification !== 'synthetic') {
		fail(exampleId, 'datasource-contract.json', "must declare sampleDataClassification as 'synthetic'.");
	}

	visit(exampleId, sample);
};

