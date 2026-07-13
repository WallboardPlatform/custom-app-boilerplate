export interface PreviewFixture {
	id: string;
	configValues: Record<string, unknown>;
	dataPickerValues: Record<string, unknown>;
	datasourceIds: Record<string, string | number | undefined>;
	additionalConfig?: Record<string, unknown>;
}

export interface PreviewScenario {
	id: string;
	fixture: PreviewFixture;
	viewport: {
		width: number;
		height: number;
		background?: 'checker' | 'light' | 'dark';
	};
	advanceTimeMs?: number;
}

const baseConfig: Record<string, unknown> = {
	titleText: 'Operations pulse',
	subtitleText: 'Live fulfillment performance',
	emptyStateText: 'No operational data is available.',
	targetLabel: 'Daily target',
	targetValue: 2400,
	fontFamily: "'Segoe UI', Arial, sans-serif",
	backgroundColor: '#101416',
	surfaceColor: '#1b2226',
	primaryTextColor: '#f4f1e8',
	secondaryTextColor: '#aab5ba',
	accentColor: '#63d7ff',
	positiveColor: '#63e6bd',
	warningColor: '#ffbf69'
};

const operationsData = {
	metrics: [
		{ label: 'Orders completed', value: 1842, unit: 'orders', delta: '+8.4% vs yesterday', tone: 'positive' },
		{ label: 'On-time dispatch', value: 96.8, unit: '%', delta: '1.2 pts above target', tone: 'positive' },
		{ label: 'Open exceptions', value: 17, unit: 'cases', delta: '5 need attention', tone: 'warning' }
	],
	history: [
		{ label: '06:00', value: 120 },
		{ label: '08:00', value: 310 },
		{ label: '10:00', value: 570 },
		{ label: '12:00', value: 910 },
		{ label: '14:00', value: 1280 },
		{ label: '16:00', value: 1575 },
		{ label: '18:00', value: 1842 }
	],
	updatedAt: 'Updated 18:05'
};

const createFixture = (
	id: string,
	data: unknown,
	configValues: Record<string, unknown> = baseConfig
): PreviewFixture => ({
	id,
	configValues,
	dataPickerValues: { operationsData: data },
	datasourceIds: { operationsData: 'preview-operations-data' },
	additionalConfig: { licenseType: null, mockDatasource: {}, style: {} }
});

const previewFixture: PreviewFixture = createFixture('kpi-operations-preview', operationsData);

export const previewScenarios: PreviewScenario[] = [
	{
		id: 'empty',
		fixture: createFixture('kpi-operations-empty', null),
		viewport: { width: 960, height: 540, background: 'light' }
	},
	{
		id: 'long-labels',
		fixture: createFixture(
			'kpi-operations-long-labels',
			{
				...operationsData,
				metrics: [
					{ label: 'Orders completed across all fulfillment locations', value: 1842, unit: 'orders', delta: '+8.4% vs previous operating day', tone: 'positive' },
					{ label: 'Shipments dispatched within the committed service window', value: 96.8, unit: '%', delta: '1.2 pts above target', tone: 'positive' },
					{ label: 'Open exceptions requiring supervisor attention', value: 17, unit: 'cases', delta: '5 need attention', tone: 'warning' }
				]
			},
			{ ...baseConfig, titleText: 'European distribution operations performance' }
		),
		viewport: { width: 1536, height: 432, background: 'dark' }
	}
];

export default previewFixture;
