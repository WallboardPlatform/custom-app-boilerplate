import type { PreviewFixture, PreviewScenario, PreviewSettingEffect } from './fixture.types';

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
export const previewSettingEffects: PreviewSettingEffect[] = [];

export default previewFixture;
