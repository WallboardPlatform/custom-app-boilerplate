import type { PreviewPlatformFixture } from './fixture.types';

type JsonObject = Record<string, unknown>;

export interface PlatformMockAction {
	action: string;
	payload: JsonObject;
}

export interface PlatformMockController {
	datasourceActions: PlatformMockAction[];
	sensorEvents: unknown[];
	getDatasource: (id: string) => unknown;
	getOwnValue: (id: string) => unknown;
	setDatasource: (id: string, value: unknown) => void;
}

const isObject = (value: unknown): value is JsonObject => {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const clone = <T>(value: T): T => {
	return value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;
};

const pathSegments = (selector: unknown): string[] => {
	return typeof selector === 'string' && selector.trim() !== ''
		? selector.split('.').filter(Boolean)
		: [];
};

const getNested = (root: unknown, selector: unknown): unknown => {
	return pathSegments(selector).reduce<unknown>((value: unknown, segment: string): unknown => {
		return isObject(value) || Array.isArray(value)
			? (value as Record<string, unknown>)[segment]
			: undefined;
	}, root);
};

const setNested = (root: unknown, selector: unknown, value: unknown): unknown => {
	const segments = pathSegments(selector);

	if (segments.length === 0) {
		return clone(value);
	}

	const nextRoot: JsonObject = isObject(root) ? clone(root) : {};
	let current: JsonObject = nextRoot;

	for (const segment of segments.slice(0, -1)) {
		const child = current[segment];
		current[segment] = isObject(child) ? clone(child) : {};
		current = current[segment] as JsonObject;
	}

	current[segments[segments.length - 1]] = clone(value);

	return nextRoot;
};

const deleteNested = (root: unknown, selector: unknown): unknown => {
	const segments = pathSegments(selector);

	if (segments.length === 0 || !isObject(root)) {
		return {};
	}

	const nextRoot: JsonObject = clone(root);
	let current: JsonObject | undefined = nextRoot;

	for (const segment of segments.slice(0, -1)) {
		const child: unknown = current[segment];
		current = isObject(child) ? child : undefined;

		if (!current) {
			return nextRoot;
		}
	}

	delete current[segments[segments.length - 1]];

	return nextRoot;
};

const mergeRoot = (current: unknown, value: unknown): unknown => {
	return isObject(current) && isObject(value)
		? { ...clone(current), ...clone(value) }
		: clone(value);
};

export const installPlatformMock = (fixture: PreviewPlatformFixture = {}): PlatformMockController => {
	const datasources: Record<string, unknown> = clone(fixture.internalDatasources ?? {});
	const filesByFolder: Record<string, unknown[]> = clone(fixture.filesByFolder ?? {});
	const weatherByLocation: Record<string, unknown> = clone(fixture.weatherByLocation ?? {});
	const ownValues: Record<string, unknown> = {};
	const datasourceActions: PlatformMockAction[] = [];
	const sensorEvents: unknown[] = [];
	const noOperation = (): undefined => undefined;

	const setDatasource = (id: string, value: unknown): void => {
		datasources[id] = clone(value);
	};

	const internalDatasourceActions = (action: string, payloadValue: unknown): void => {
		const payload: JsonObject = isObject(payloadValue) ? clone(payloadValue) : {};
		const datasourceId: string = String(payload.datasourceId ?? '');
		const selector: unknown = payload.selector ?? payload.arraySelector;
		let current: unknown = clone(datasources[datasourceId] ?? {});

		datasourceActions.push({ action, payload });

		switch (action) {
			case 'setInternalDatasource':
				current = clone(payload.data);
				break;
			case 'mergeInternalDatasource':
				current = mergeRoot(current, payload.data);
				break;
			case 'insertToInternalDatasourceArray': {
				const existing: unknown = getNested(current, selector);
				const items: unknown[] = Array.isArray(existing) ? clone(existing) : [];
				const index: number = Number.isInteger(payload.index)
					? Math.max(0, Math.min(items.length, Number(payload.index)))
					: items.length;

				items.splice(index, 0, clone(payload.data));
				const maximum: number | undefined = Number.isInteger(payload.maxElementCount)
					? Math.max(0, Number(payload.maxElementCount))
					: undefined;

				if (maximum !== undefined && items.length > maximum) {
					payload.rotateEnabled === true
						? items.splice(0, items.length - maximum)
						: items.splice(maximum);
				}

				current = setNested(current, selector, items);
				break;
			}
			case 'increaseInternalDatasourceValue': {
				const currentValue: number = Number(getNested(current, selector)) || 0;
				const maximum: number = Number(payload.maximumValue);
				current = setNested(current, selector, Number.isFinite(maximum) ? Math.min(maximum, currentValue + 1) : currentValue + 1);
				break;
			}
			case 'decreaseInternalDatasourceValue': {
				const currentValue: number = Number(getNested(current, selector)) || 0;
				const minimum: number = Number(payload.maximumValue);
				current = setNested(current, selector, Number.isFinite(minimum) ? Math.max(minimum, currentValue - 1) : currentValue - 1);
				break;
			}
			case 'emptyInternalDatasourceArray':
				current = setNested(current, selector, []);
				break;
			case 'deleteInternalDatasourceValue':
				current = deleteNested(current, selector);
				break;
			case 'removeFromInternalDatasourceArray': {
				const existing: unknown = getNested(current, selector);
				const items: unknown[] = Array.isArray(existing) ? clone(existing) : [];
				const index: number = Number.isInteger(payload.index) ? Number(payload.index) : items.length - 1;
				if (index >= 0 && index < items.length) items.splice(index, 1);
				current = setNested(current, selector, items);
				break;
			}
			case 'rotateInternalDatasourceArray': {
				const existing: unknown = getNested(current, selector);
				const items: unknown[] = Array.isArray(existing) ? clone(existing) : [];
				if (items.length > 1) items.push(items.shift());
				current = setNested(current, selector, items);
				break;
			}
			case 'getDatasource':
				return;
			default:
				throw new Error(`Unsupported preview internal datasource action '${action}'.`);
		}

		setDatasource(datasourceId, current);
	};

	const methods: Record<string, unknown> = {
		isDisplayer: fixture.isDisplayer ?? false,
		triggerSensorEvent: (event: unknown): void => {
			sensorEvents.push(clone(event));
		},
		setInteractionEventValue: (id: string, value: unknown): void => {
			ownValues[id] = clone(value);
		},
		getInteractionEventValue: (id: string): unknown => clone(ownValues[id]),
		getClickReactionState: (): boolean => false,
		setClickReactionState: noOperation,
		setWidgetSize: noOperation,
		cacheFile: async (url: string): Promise<string> => url,
		getWeatherData: async (locations: Array<{ cityCode: string; countryCode: string }>): Promise<Record<string, unknown>[]> => {
			return locations.map((location): Record<string, unknown> => {
				const searchKey = `${location.cityCode},${location.countryCode}`;
				const fixtureValue = weatherByLocation[searchKey];

				return isObject(fixtureValue)
					? clone(fixtureValue)
					: {
						searchKey,
						location: { city: 'Preview City', country: location.countryCode },
						item: { forecast: [] }
					};
			});
		},
		getMockDatasourceByIdSync: (id: string): unknown => clone(datasources[id] ?? {}),
		getDatasourceBindingPaths: (): { basePath: unknown[]; path: unknown[] } => ({ basePath: [], path: [] }),
		getDatasourceById: async (id: string): Promise<{ data: string }> => ({
			data: JSON.stringify(datasources[id] ?? {})
		}),
		getBoundDatasourceType: (_appId: string, id: string): string => {
			return Object.prototype.hasOwnProperty.call(datasources, id) ? 'INTERNAL' : 'MOCK';
		},
		internalDatasourceActions,
		getFilesFromFolderByFolderId: async (folderId: string): Promise<unknown[]> => clone(filesByFolder[folderId] ?? []),
		authenticateUserAction: async (_pin: unknown, action: unknown): Promise<{ userEmail: string; action: unknown }> => ({
			userEmail: 'preview.user@example.invalid',
			action
		})
	};

	const controller: PlatformMockController = {
		datasourceActions,
		sensorEvents,
		getDatasource: (id: string): unknown => clone(datasources[id]),
		getOwnValue: (id: string): unknown => clone(ownValues[id]),
		setDatasource
	};

	Object.defineProperty(window, 'CustomWidgetAPI', {
		configurable: true,
		value: methods,
		writable: true
	});

	return controller;
};
