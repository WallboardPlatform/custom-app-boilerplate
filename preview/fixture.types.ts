export interface MinimumContentCoverage {
	width: number;
	height: number;
}

export interface PreviewFixture {
	id: string;
	readySelector?: string;
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
	minimumContentCoverage: MinimumContentCoverage;
	liveDatasourceUpdate?: {
		property: string;
		value: unknown;
		expectedText: string;
	};
}

export type PreviewSettingEffectMeasurement =
	| { type: 'bounding-box'; dimension: 'width' | 'height' }
	| { type: 'computed-style'; property: string }
	| { type: 'text-content' }
	| { type: 'attribute'; name: string };

export type PreviewSettingEffectExpectation =
	| { type: 'increase'; minimumDelta?: number }
	| { type: 'decrease'; minimumDelta?: number }
	| { type: 'change' };

export interface PreviewSettingEffect {
	id: string;
	property: string;
	changedValue: unknown;
	selector: string;
	scenario?: string;
	measurement: PreviewSettingEffectMeasurement;
	expectation: PreviewSettingEffectExpectation;
}
