interface WeatherLocation {
	cityCode: string;
	countryCode: string;
}

const createWeatherData = (location: WeatherLocation): Record<string, unknown> => {
	return {
		searchKey: `${location.cityCode},${location.countryCode}`,
		location: {
			city: 'Preview City',
			country: location.countryCode
		},
		item: {
			forecast: []
		}
	};
};

export const installPlatformMock = (): void => {
	const noOperation = (): undefined => undefined;
	const methods: Record<string, unknown> = {
		isDisplayer: false,
		triggerSensorEvent: noOperation,
		setInteractionEventValue: noOperation,
		getInteractionEventValue: noOperation,
		getClickReactionState: (): boolean => false,
		setClickReactionState: noOperation,
		setWidgetSize: noOperation,
		cacheFile: async (url: string): Promise<string> => url,
		getWeatherData: async (locations: WeatherLocation[]): Promise<Record<string, unknown>[]> => {
			return locations.map(createWeatherData);
		},
		getMockDatasourceByIdSync: (): Record<string, never> => ({}),
		getDatasourceById: async (): Promise<{ data: string }> => ({ data: '{}' }),
		getFilesFromFolderByFolderId: async (): Promise<string[]> => []
	};

	Object.defineProperty(window, 'CustomWidgetAPI', {
		configurable: true,
		value: methods,
		writable: true
	});
};
