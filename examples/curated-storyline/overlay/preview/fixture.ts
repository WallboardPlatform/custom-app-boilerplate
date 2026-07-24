import type { PreviewFixture, PreviewScenario, PreviewSettingEffect } from './fixture.types';

interface StoryFixtureItem {
	id: string;
	label: string;
	title: string;
	body: string;
	detail: string;
	tone: 'coral' | 'cobalt' | 'sun' | 'mint';
	layout: 'statement' | 'quote' | 'schedule';
	enabled: boolean;
}

interface StoryFixtureContent {
	venue: string;
	title: string;
	deck: string;
	stories: StoryFixtureItem[];
}

const defaultContent: StoryFixtureContent = {
	venue: 'NORTHLINE ARTS',
	title: 'MATERIAL MEMORY',
	deck: 'Three encounters with salvage, sound, and light',
	stories: [
		{
			id: 'recovered-light',
			label: 'INSTALLATION 01',
			title: 'Recovered light',
			body: 'Discarded glass becomes a shifting field of color as daylight moves through the gallery.',
			detail: 'ATRIUM / LEVEL 1',
			tone: 'coral',
			layout: 'statement',
			enabled: true
		},
		{
			id: 'listening-bench',
			label: 'ARTIST NOTE',
			title: 'The room remembers every footstep.',
			body: 'Sit for a moment. The bench translates the movement of nearby visitors into a low, evolving score.',
			detail: 'MARA VEGA, 2026',
			tone: 'cobalt',
			layout: 'quote',
			enabled: true
		},
		{
			id: 'material-library',
			label: 'TODAY IN THE STUDIO',
			title: 'Material library',
			body: 'Handle samples from the exhibition and meet the conservation team.',
			detail: '14:00-17:30 / PROJECT ROOM',
			tone: 'sun',
			layout: 'schedule',
			enabled: true
		}
	]
};

const baseConfigValues: Record<string, unknown> = {
	customContent: defaultContent,
	rotationSeconds: 9,
	showProgress: true,
	motionPreset: 'subtle',
	themePreset: 'dark',
	backgroundColor: '#f2efe7',
	surfaceColor: '#172220',
	textColor: '#f6f2e8',
	mutedTextColor: '#abb7b2',
	coralColor: '#ed5a47',
	cobaltColor: '#4779dc',
	sunColor: '#f4be3e',
	mintColor: '#62d6b5'
};

const fixture = (id: string, overrides: Record<string, unknown> = {}): PreviewFixture => ({
	id,
	readySelector: '.wb-curated-storyline-render-ready',
	configValues: {
		...baseConfigValues,
		...overrides
	},
	dataPickerValues: {},
	datasourceIds: {},
	additionalConfig: {
		licenseType: null,
		mockDatasource: {},
		style: {}
	}
});

const previewFixture: PreviewFixture = fixture('curated-storyline-preview');

export const previewScenarios: PreviewScenario[] = [
	{
		id: 'wide-low',
		fixture: fixture('curated-storyline-wide-low'),
		viewport: { width: 1536, height: 432, background: 'checker' },
		minimumContentCoverage: { width: 95, height: 87 }
	},
	{
		id: 'portrait',
		fixture: fixture('curated-storyline-portrait'),
		viewport: { width: 1080, height: 1920, background: 'checker' },
		minimumContentCoverage: { width: 88, height: 85 }
	},
	{
		id: 'square',
		fixture: fixture('curated-storyline-square'),
		viewport: { width: 600, height: 600, background: 'checker' },
		minimumContentCoverage: { width: 92, height: 87 }
	},
	{
		id: 'quote',
		fixture: fixture('curated-storyline-quote', {
			customContent: {
				...defaultContent,
				stories: [defaultContent.stories[1]]
			}
		}),
		viewport: { width: 1920, height: 1080, background: 'checker' },
		minimumContentCoverage: { width: 92, height: 86 }
	},
	{
		id: 'schedule',
		fixture: fixture('curated-storyline-schedule', {
			customContent: {
				...defaultContent,
				stories: [defaultContent.stories[2]]
			}
		}),
		viewport: { width: 1920, height: 1080, background: 'checker' },
		minimumContentCoverage: { width: 92, height: 86 }
	},
	{
		id: 'long-copy',
		fixture: fixture('curated-storyline-long-copy', {
			customContent: {
				venue: 'NORTHLINE CONTEMPORARY ART AND MATERIAL RESEARCH CENTRE',
				title: 'MEMORY, MOVEMENT, AND THE OBJECTS WE DECIDE TO KEEP',
				deck: 'A season of installations, public workshops, conservation demonstrations, and artist-led encounters',
				stories: [
					{
						id: 'long-story',
						label: 'ARCHIVE COMMISSION / INSTALLATION 08',
						title: 'Everything we carry changes the room around us',
						body: 'A suspended field of recovered timber, handwritten inventories, and translucent fabric traces how ordinary objects move between private memory and public record.',
						detail: 'EAST GALLERY / LEVEL 2 / OPEN UNTIL 21:00',
						tone: 'mint',
						layout: 'statement',
						enabled: true
					}
				]
			}
		}),
		viewport: { width: 1536, height: 864, background: 'checker' },
		minimumContentCoverage: { width: 92, height: 86 }
	},
	{
		id: 'empty',
		fixture: fixture('curated-storyline-empty', {
			customContent: {
				...defaultContent,
				stories: defaultContent.stories.map((story: StoryFixtureItem): StoryFixtureItem => ({
					...story,
					enabled: false
				}))
			}
		}),
		viewport: { width: 1366, height: 768, background: 'checker' },
		minimumContentCoverage: { width: 88, height: 62 }
	},
	{
		id: 'custom-theme',
		fixture: fixture('curated-storyline-custom-theme', {
			themePreset: 'custom',
			backgroundColor: '#dce4e1',
			surfaceColor: '#132b32',
			textColor: '#fff8e8',
			mutedTextColor: '#b7c6c8',
			coralColor: '#ff6f4f',
			cobaltColor: '#43a8c5',
			sunColor: '#ffc64b',
			mintColor: '#79d4a9'
		}),
		viewport: { width: 1920, height: 1080, background: 'light' },
		minimumContentCoverage: { width: 92, height: 86 }
	}
];

export const previewSettingEffects: PreviewSettingEffect[] = [
	{
		id: 'story-content',
		property: 'customContent',
		changedValue: {
			...defaultContent,
			stories: [
				{
					id: 'runtime-story',
					label: 'LIVE EDIT',
					title: 'Updated from the custom editor',
					body: 'The mounted app receives the complete structured collection.',
					detail: 'RUNTIME PROOF',
					tone: 'mint',
					layout: 'statement',
					enabled: true
				}
			]
		},
		selector: '.wb-curated-storyline-title',
		measurement: { type: 'text-content' },
		expectation: { type: 'change' }
	},
	{
		id: 'motion-preset',
		property: 'motionPreset',
		changedValue: 'off',
		selector: '[aria-label$="curated storyline"]',
		measurement: { type: 'attribute', name: 'data-motion' },
		expectation: { type: 'change' }
	},
	{
		id: 'theme-preset',
		property: 'themePreset',
		changedValue: 'light',
		selector: '[aria-label$="curated storyline"]',
		measurement: { type: 'computed-style', property: 'background-color' },
		expectation: { type: 'change' }
	}
];

export default previewFixture;
