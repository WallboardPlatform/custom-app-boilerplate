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
	minimumContentCoverage?: {
		width: number;
		height: number;
	};
	liveDatasourceUpdate?: {
		property: string;
		value: unknown;
		expectedText: string;
	};
}

const previewFixture: PreviewFixture = {
	id: 'wallboard-local-preview',
	readySelector: '.wb-app',
	configValues: {
		layoutEditor: {
			items: []
		},
		wbKeyboardEnabled: false,
		txtField: 'Local preview',
		sampleSlider: 20,
		sampleFont: {
			'font-family': 'Arial',
			'font-size': 32,
			'font-style': 'normal',
			'font-weight': 700,
			color: '#111827',
			'text-decoration': 'none'
		},
		btnSample: false,
		sampleType: 'none',
		colorPicker: '#e63946',
		sampleNumberInput: 220,
		sampleTextAreaInput: 'Representative preview content'
	},
	dataPickerValues: {
		myDataset: [
			{
				label: 'Preview row',
				value: 42
			}
		]
	},
	datasourceIds: {
		myDataset: 'preview-my-dataset'
	},
	additionalConfig: {
		licenseType: null,
		mockDatasource: {},
		style: {}
	}
};

export const previewScenarios: PreviewScenario[] = [];

export default previewFixture;
