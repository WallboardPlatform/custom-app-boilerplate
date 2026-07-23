import type {
	ConfigValues,
	MotionPreset,
	Settings,
	StoryCollection,
	StoryItem,
	StoryLayout,
	StoryTone
} from '@interfaces/application.interface';
import { resolveTheme, themePresetSetting } from '@utils/theme';
import type { ThemePalettes, ThemePreset } from '@utils/theme';

interface StoryPalette extends Record<string, string> {
	backgroundColor: string;
	surfaceColor: string;
	textColor: string;
	mutedTextColor: string;
	coralColor: string;
	cobaltColor: string;
	sunColor: string;
	mintColor: string;
}

const DEFAULT_CONTENT: StoryCollection = {
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

const lightPalette: StoryPalette = {
	backgroundColor: '#f2efe7',
	surfaceColor: '#172220',
	textColor: '#f6f2e8',
	mutedTextColor: '#abb7b2',
	coralColor: '#ed5a47',
	cobaltColor: '#4779dc',
	sunColor: '#f4be3e',
	mintColor: '#62d6b5'
};

const darkPalette: StoryPalette = {
	backgroundColor: '#090d0c',
	surfaceColor: '#151c1a',
	textColor: '#f4f1e8',
	mutedTextColor: '#9eaaa6',
	coralColor: '#ff6551',
	cobaltColor: '#6f97ef',
	sunColor: '#f5c44f',
	mintColor: '#64d8b8'
};

const textSetting = (value: unknown, fallback: string): string => {
	return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback;
};

const booleanSetting = (value: unknown, fallback: boolean): boolean => {
	return typeof value === 'boolean' ? value : fallback;
};

const numberSetting = (value: unknown, fallback: number, minimum: number, maximum: number): number => {
	const numericValue: number = typeof value === 'number' ? value : Number(value);

	return Number.isFinite(numericValue)
		? Math.min(maximum, Math.max(minimum, numericValue))
		: fallback;
};

const toneSetting = (value: unknown): StoryTone => {
	return value === 'cobalt' || value === 'sun' || value === 'mint' ? value : 'coral';
};

const layoutSetting = (value: unknown): StoryLayout => {
	return value === 'quote' || value === 'schedule' ? value : 'statement';
};

const motionSetting = (value: unknown): MotionPreset => {
	return value === 'off' ? 'off' : 'subtle';
};

const normalizeStory = (value: unknown, index: number): StoryItem | null => {
	if (!value || typeof value !== 'object') {
		return null;
	}

	const candidate: Record<string, unknown> = value as Record<string, unknown>;
	const title: string = textSetting(candidate.title, '');

	if (title === '') {
		return null;
	}

	return {
		id: textSetting(candidate.id, `story-${index + 1}`),
		label: textSetting(candidate.label, `STORY ${String(index + 1).padStart(2, '0')}`),
		title,
		body: textSetting(candidate.body, 'Add supporting context in the storyline editor.'),
		detail: textSetting(candidate.detail, ''),
		tone: toneSetting(candidate.tone),
		layout: layoutSetting(candidate.layout),
		enabled: candidate.enabled !== false
	};
};

const normalizeContent = (value: unknown): StoryCollection => {
	if (!value || typeof value !== 'object') {
		return DEFAULT_CONTENT;
	}

	const candidate: Record<string, unknown> = value as Record<string, unknown>;
	const stories: StoryItem[] = Array.isArray(candidate.stories)
		? candidate.stories
			.map((story: unknown, index: number): StoryItem | null => normalizeStory(story, index))
			.filter((story: StoryItem | null): story is StoryItem => story !== null)
		: DEFAULT_CONTENT.stories;

	return {
		venue: textSetting(candidate.venue, DEFAULT_CONTENT.venue),
		title: textSetting(candidate.title, DEFAULT_CONTENT.title),
		deck: textSetting(candidate.deck, DEFAULT_CONTENT.deck),
		stories
	};
};

export default (config: ConfigValues): Settings => {
	const themePreset: ThemePreset = themePresetSetting(config.themePreset);
	const customPalette: StoryPalette = {
		backgroundColor: textSetting(config.backgroundColor, lightPalette.backgroundColor),
		surfaceColor: textSetting(config.surfaceColor, lightPalette.surfaceColor),
		textColor: textSetting(config.textColor, lightPalette.textColor),
		mutedTextColor: textSetting(config.mutedTextColor, lightPalette.mutedTextColor),
		coralColor: textSetting(config.coralColor, lightPalette.coralColor),
		cobaltColor: textSetting(config.cobaltColor, lightPalette.cobaltColor),
		sunColor: textSetting(config.sunColor, lightPalette.sunColor),
		mintColor: textSetting(config.mintColor, lightPalette.mintColor)
	};
	const palettes: ThemePalettes<StoryPalette> = {
		light: lightPalette,
		dark: darkPalette,
		custom: customPalette
	};

	return {
		customContent: normalizeContent(config.customContent),
		rotationSeconds: numberSetting(config.rotationSeconds, 9, 3, 120),
		showProgress: booleanSetting(config.showProgress, true),
		motionPreset: motionSetting(config.motionPreset),
		themePreset,
		...resolveTheme(themePreset, palettes)
	};
};
