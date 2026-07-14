import type { ConfigValues, Settings } from '@interfaces/application.interface';

const textSetting = (value: string | undefined, fallback: string): string => {
	return typeof value === 'string' && value.trim() !== '' ? value : fallback;
};

export default function mapSettings(config: ConfigValues): Settings {
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
		pageDurationSeconds: Math.max(3, Number(config.pageDurationSeconds) || 12)
	};
}
