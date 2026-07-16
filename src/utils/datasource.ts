export type DatasourcePath = readonly string[];

export const isRecord = (value: unknown): value is Record<string, unknown> => {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

export const parseSerializedValue = (value: unknown): unknown => {
	if (typeof value !== 'string' || value.trim() === '') {
		return value;
	}

	try {
		return JSON.parse(value) as unknown;
	} catch {
		return value;
	}
};

const valueAtPath = (value: unknown, candidatePath: DatasourcePath): unknown => {
	let current: unknown = parseSerializedValue(value);

	for (const segment of candidatePath) {
		current = parseSerializedValue(current);

		if (!isRecord(current)) {
			return undefined;
		}

		current = current[segment];
	}

	return parseSerializedValue(current);
};

export const extractArrayAtPaths = (
	value: unknown,
	candidatePaths: readonly DatasourcePath[]
): unknown[] | undefined => {
	const directValue: unknown = parseSerializedValue(value);

	if (Array.isArray(directValue)) {
		return directValue as unknown[];
	}

	for (const candidatePath of candidatePaths) {
		const candidate: unknown = valueAtPath(directValue, candidatePath);

		if (Array.isArray(candidate)) {
			return candidate as unknown[];
		}
	}

	return undefined;
};
