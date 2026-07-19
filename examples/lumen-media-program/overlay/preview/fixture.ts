import { previewVideos } from '../src/assets/preview-videos';
import type { PreviewFixture, PreviewScenario, PreviewSettingEffect } from './fixture.types';

const baseConfig: Record<string, unknown> = {
	accentColor: '#ff5a3d',
	advanceOnError: true,
	autoplay: true,
	backgroundColor: '#080b0d',
	fit: 'cover',
	muted: true,
	mutedTextColor: '#b8c0c5',
	playlistJson: '',
	primaryTextColor: '#f5f2e9',
	programName: 'Night signal',
	recursiveFolder: true,
	repeat: 'playlist',
	retryCount: 1,
	showCaptions: true,
	showChrome: true,
	showControls: false,
	sourceMode: 'file',
	startAtSeconds: 0,
	themePreset: 'dark',
	venueName: 'Lumen public media',
	videoFile: null,
	videoFolder: null,
	volume: 0
};

const createFixture = (
	id: string,
	configOverrides: Record<string, unknown> = {},
	platformOverrides: Record<string, unknown> = {}
): PreviewFixture => ({
	id,
	readySelector: '.wb-lumen-media-program-root[data-source-count="2"]',
	settleMs: 800,
	configValues: { ...baseConfig, ...configOverrides },
	dataPickerValues: {},
	datasourceIds: {},
	additionalConfig: { licenseType: null, mockDatasource: {}, style: {} },
	platform: platformOverrides
});

const previewFixture: PreviewFixture = createFixture('lumen-media-program-default');

export const previewScenarios: PreviewScenario[] = [
	{
		id: 'full-hd',
		fixture: createFixture('lumen-media-program-full-hd'),
		viewport: { width: 1920, height: 1080, background: 'dark' },
		minimumContentCoverage: { width: 100, height: 100 }
	},
	{
		id: 'wide-low',
		fixture: createFixture('lumen-media-program-wide-low'),
		viewport: { width: 1536, height: 432, background: 'dark' },
		minimumContentCoverage: { width: 100, height: 100 }
	},
	{
		id: 'portrait',
		fixture: createFixture('lumen-media-program-portrait', { themePreset: 'light' }),
		viewport: { width: 1080, height: 1920, background: 'light' },
		minimumContentCoverage: { width: 100, height: 100 }
	},
	{
		id: 'compact',
		fixture: createFixture('lumen-media-program-compact', { showControls: true }),
		viewport: { width: 640, height: 360, background: 'dark' },
		minimumContentCoverage: { width: 100, height: 100 }
	},
	{
		id: 'square',
		fixture: createFixture('lumen-media-program-square'),
		viewport: { width: 600, height: 600, background: 'dark' },
		minimumContentCoverage: { width: 100, height: 100 }
	},
	{
		id: 'long-title',
		fixture: createFixture('lumen-media-program-long-title', {
			programName: 'International moving-image archive and community field-recording program',
			venueName: 'Lumen Metropolitan Public Media and Contemporary Culture Center'
		}),
		viewport: { width: 960, height: 540, background: 'dark' },
		minimumContentCoverage: { width: 100, height: 100 }
	},
	{
		id: 'custom-theme',
		fixture: createFixture('lumen-media-program-custom-theme', { themePreset: 'custom' }),
		viewport: { width: 1280, height: 720, background: 'dark' },
		minimumContentCoverage: { width: 100, height: 100 }
	},
	{
		id: 'source-error',
		fixture: createFixture('lumen-media-program-source-error', {
			playlistJson: JSON.stringify([
				{ id: 'broken', name: 'Unavailable opening', url: 'data:video/webm;base64,broken' },
				{ id: 'recovery', name: 'Recovery reel', type: 'video/webm', url: previewVideos[1].dataUrl }
			]),
			retryCount: 0,
			sourceMode: 'playlist'
		}),
		viewport: { width: 1920, height: 1080, background: 'dark' },
		minimumContentCoverage: { width: 100, height: 100 }
	}
];

export const previewSettingEffects: PreviewSettingEffect[] = [
	{
		id: 'theme-preset',
		property: 'themePreset',
		changedValue: 'light',
		selector: '.wb-lumen-media-program-root',
		measurement: { type: 'attribute', name: 'data-theme' },
		expectation: { type: 'change' }
	},
	{
		id: 'media-fit',
		property: 'fit',
		changedValue: 'contain',
		selector: '.wb-lumen-media-program-root',
		measurement: { type: 'attribute', name: 'data-fit' },
		expectation: { type: 'change' }
	},
	{
		id: 'player-volume',
		property: 'volume',
		changedValue: 35,
		selector: '.wb-lumen-media-program-root',
		measurement: { type: 'attribute', name: 'data-volume' },
		expectation: { type: 'change' }
	},
	{
		id: 'custom-accent',
		property: 'accentColor',
		scenario: 'custom-theme',
		changedValue: '#33c3ff',
		selector: '.wb-lumen-media-program-root',
		measurement: { type: 'computed-style', property: '--wb-lumen-media-program-accent' },
		expectation: { type: 'change' }
	}
];

export default previewFixture;
