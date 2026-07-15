import type { PreviewFixture, PreviewScenario, PreviewSettingEffect } from './fixture.types';

const previewFixture: PreviewFixture = {
	id: 'wallboard-local-preview',
	readySelector: '.wb-app',
	configValues: {
		title: 'Local preview',
		accentColor: '#15c39a',
		textColor: '#f4f7f6',
		backgroundColor: '#111516'
	},
	dataPickerValues: {},
	datasourceIds: {},
	additionalConfig: {
		licenseType: null,
		mockDatasource: {},
		style: {}
	}
};

export const previewScenarios: PreviewScenario[] = [];
export const previewSettingEffects: PreviewSettingEffect[] = [];

export default previewFixture;
