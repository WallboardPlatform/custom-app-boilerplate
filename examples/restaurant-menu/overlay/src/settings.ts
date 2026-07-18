import type { ConfigValues, Settings } from '@interfaces/application.interface';

import { resolveTheme, themePresetSetting } from '@utils/theme';

const textSetting = (value: string | undefined, fallback: string): string => {
	return typeof value === 'string' && value.trim() !== '' ? value : fallback;
};

export default function mapSettings(config: ConfigValues): Settings {
	const palette = resolveTheme(themePresetSetting(config.themePreset), {
		dark: {
			backgroundColor: '#121815',
			headerBackgroundColor: '#f0ebdf',
			headerTextColor: '#151a17',
			storyBackgroundColor: '#dce5db',
			storyTextColor: '#172019',
			primaryTextColor: '#f2eee4',
			secondaryTextColor: '#aeb9b2',
			accentColor: '#e66c47',
			accentTextColor: '#a3472f',
			lineColor: '#5d6a63',
			featuredColor: '#f3b29e'
		},
		light: {
			backgroundColor: '#f6f1e7',
			headerBackgroundColor: '#172019',
			headerTextColor: '#f3eee4',
			storyBackgroundColor: '#e0e8dd',
			storyTextColor: '#172019',
			primaryTextColor: '#172019',
			secondaryTextColor: '#56645c',
			accentColor: '#c24e35',
			accentTextColor: '#9d3e2b',
			lineColor: '#aeb9b2',
			featuredColor: '#a3472f'
		},
		custom: {
			backgroundColor: textSetting(config.backgroundColor, '#121815'),
			headerBackgroundColor: textSetting(config.headerBackgroundColor, '#f0ebdf'),
			headerTextColor: textSetting(config.headerTextColor, '#151a17'),
			storyBackgroundColor: textSetting(config.storyBackgroundColor, '#dce5db'),
			storyTextColor: textSetting(config.storyTextColor, '#172019'),
			primaryTextColor: textSetting(config.primaryTextColor, '#f2eee4'),
			secondaryTextColor: textSetting(config.secondaryTextColor, '#aeb9b2'),
			accentColor: textSetting(config.accentColor, '#e66c47'),
			accentTextColor: textSetting(config.accentTextColor, '#a3472f'),
			lineColor: textSetting(config.lineColor, '#5d6a63'),
			featuredColor: textSetting(config.featuredColor, '#f3b29e')
		}
	});

	return {
		restaurantLabel: textSetting(config.restaurantLabel, 'Restaurant'),
		restaurantName: textSetting(config.restaurantName, 'Cordo'),
		editionTitle: textSetting(config.editionTitle, 'Dinner menu'),
		editionSubtitle: textSetting(config.editionSubtitle, 'Seasonal kitchen - thoughtfully sourced'),
		storyEyebrow: textSetting(config.storyEyebrow, 'Chef\'s selection'),
		storyTitle: textSetting(config.storyTitle, 'Simple ingredients.\nConsidered plates.'),
		storyDescription: textSetting(
			config.storyDescription,
			'Our evening menu follows the market, the season, and the growers we trust.'
		),
		courseLabel: textSetting(config.courseLabel, 'Tonight\'s table'),
		courseName: textSetting(config.courseName, 'Four courses'),
		coursePrice: textSetting(config.coursePrice, '$68'),
		closingText: textSetting(config.closingText, 'Kitchen closes 22:30'),
		allergenText: textSetting(config.allergenText, 'Ask us about allergens'),
		emptyStateText: textSetting(config.emptyStateText, 'No menu items are available.'),
		pageDurationSeconds: Math.max(3, Number(config.pageDurationSeconds) || 12),
		motionPreset: config.motionPreset === 'off' || config.motionPreset === 'expressive' ? config.motionPreset : 'subtle',
		...palette
	};
}
