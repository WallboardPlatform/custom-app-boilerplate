import type { Recognition } from '@interfaces/recognition.interface';

import { extractArrayAtPaths, isRecord } from '@utils/datasource';

import portraitA from '../assets/portraits/portrait-a.jpg';
import portraitB from '../assets/portraits/portrait-b.jpg';
import portraitC from '../assets/portraits/portrait-c.jpg';
import portraitD from '../assets/portraits/portrait-d.jpg';
import portraitE from '../assets/portraits/portrait-e.jpg';

const RECOGNITION_PATHS = [
	['rows'],
	['Recognitions'],
	['Recognitions', 'rows']
] as const;

const textValue = (value: unknown): string => {
	return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
};

export const extractRecognitionRows = (value: unknown): unknown[] | undefined => {
	return extractArrayAtPaths(value, RECOGNITION_PATHS);
};

export const normalizeRecognitionRows = (rows: readonly unknown[]): Recognition[] => {
	return rows
		.map((value: unknown, index: number): Recognition | undefined => {
			if (!isRecord(value)) {
				return undefined;
			}

			const name: string = textValue(value.name);
			const achievement: string = textValue(value.achievement);

			if (!name || !achievement) {
				return undefined;
			}

			return {
				id: `${index}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
				name,
				role: textValue(value.role) || 'Studio contributor',
				achievement,
				team: textValue(value.team) || 'Paper Kite Studio',
				imageUrl: textValue(value.imageUrl),
				quote: textValue(value.quote)
			};
		})
		.filter((recognition: Recognition | undefined): recognition is Recognition => Boolean(recognition));
};

export const recognitionInitials = (name: string): string => {
	const parts: string[] = name.split(/\s+/).filter(Boolean);
	const first: string = parts[0]?.charAt(0) ?? 'P';
	const last: string = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';

	return `${first}${last}`.toUpperCase();
};

export const SAMPLE_RECOGNITIONS: Recognition[] = [
	{
		id: 'maya-rowan',
		name: 'Maya Rowan',
		role: 'Creative Producer',
		achievement: 'Turned the Horizon launch into a calm, clear two-week studio sprint.',
		team: 'Studio Operations',
		imageUrl: portraitA,
		quote: 'Make the brave idea feel possible.'
	},
	{
		id: 'theo-brooks',
		name: 'Theo Brooks',
		role: 'Motion Designer',
		achievement: 'Built a reusable motion toolkit that gave every campaign a sharper rhythm.',
		team: 'Motion Lab',
		imageUrl: portraitB,
		quote: 'Good movement should feel inevitable.'
	},
	{
		id: 'ren-sato',
		name: 'Ren Sato',
		role: 'Senior Strategist',
		achievement: 'Connected six weeks of research into one idea the whole client team could use.',
		team: 'Strategy',
		imageUrl: portraitC,
		quote: 'Clarity is a generous creative act.'
	},
	{
		id: 'elena-vale',
		name: 'Elena Vale',
		role: 'Craft Director',
		achievement: 'Led the print workshop that transformed rough sketches into a tactile launch system.',
		team: 'Design Craft',
		imageUrl: portraitD,
		quote: 'The detail is where an idea earns trust.'
	},
	{
		id: 'arun-mehta',
		name: 'Arun Mehta',
		role: 'Design Technologist',
		achievement: 'Prototyped an accessible installation in three days and shared the tools with everyone.',
		team: 'Prototype Room',
		imageUrl: portraitE,
		quote: 'Build the question, then test it.'
	}
];
