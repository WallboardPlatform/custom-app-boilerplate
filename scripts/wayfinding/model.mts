import { XMLParser, XMLValidator } from 'fast-xml-parser';

import type { WayfindingNode, WayfindingNodeKind } from '../../src/utils/wayfinding.js';

export const WAYFINDING_LAYER_SUFFIXES = [
	'TransitionPoints',
	'LocationPoints',
	'RoutePoints',
	'Icons',
	'Legends',
	'Locations',
	'Walls'
] as const;

type XmlAttributes = Record<string, string>;

interface XmlNode {
	':@'?: XmlAttributes;
	[key: string]: unknown;
}

export interface ParsedSvgElement {
	attributes: XmlAttributes;
	groupIds: string[];
	tag: string;
}

export interface ParsedWayfindingLevel {
	id: string;
	locations: ParsedSvgElement[];
	pointNodes: WayfindingNode[];
	subgroupIds: string[];
}

export interface ParsedWayfindingSvg {
	elements: ParsedSvgElement[];
	height: number;
	ids: string[];
	levels: ParsedWayfindingLevel[];
	rootGroupIds: string[];
	viewBox: [number, number, number, number];
	width: number;
}

export interface DestinationMetadata {
	accessible: boolean;
	category?: string;
	description?: string;
	floor?: string;
	hours?: string;
	id: string;
	image?: string;
	keywords?: string;
	name: string;
	routeable: boolean;
	status?: string;
}

const tagOf = (node: XmlNode): string | undefined => Object.keys(node).find((key: string): boolean => key !== ':@');

const childrenOf = (node: XmlNode): XmlNode[] => {
	const tag: string | undefined = tagOf(node);
	const children: unknown = tag ? node[tag] : undefined;

	return Array.isArray(children) ? children as XmlNode[] : [];
};

const attributesOf = (node: XmlNode): XmlAttributes => node[':@'] ?? {};

const finiteNumber = (value: string | undefined): number | undefined => {
	if (value === undefined) return undefined;

	const number: number = Number(value.replace(/px$/i, ''));

	return Number.isFinite(number) ? number : undefined;
};

const collectElements = (nodes: XmlNode[], groupIds: string[], output: ParsedSvgElement[]): void => {
	for (const node of nodes) {
		const tag: string | undefined = tagOf(node);

		if (!tag || tag.startsWith('?')) continue;

		const attributes: XmlAttributes = attributesOf(node);
		const nextGroupIds: string[] = tag === 'g' && attributes.id ? [...groupIds, attributes.id] : groupIds;
		output.push({ attributes, groupIds, tag });
		collectElements(childrenOf(node), nextGroupIds, output);
	}
};

const directGroups = (node: XmlNode): XmlNode[] => childrenOf(node).filter((child: XmlNode): boolean => tagOf(child) === 'g');

const pointKind = (suffix: typeof WAYFINDING_LAYER_SUFFIXES[number]): WayfindingNodeKind | undefined => {
	if (suffix === 'RoutePoints') return 'route';

	if (suffix === 'LocationPoints') return 'location';

	if (suffix === 'TransitionPoints') return 'transition';

	return undefined;
};

const locationIdForPoint = (attributes: XmlAttributes): string | undefined => {
	if (attributes['data-location-id']) return attributes['data-location-id'];

	if (attributes.id.startsWith('lp-')) return attributes.id.slice(3);

	if (attributes.id.endsWith('-lp')) return attributes.id.slice(0, -3);

	return undefined;
};

const parsePointNodes = (levelId: string, suffix: typeof WAYFINDING_LAYER_SUFFIXES[number], group: XmlNode): WayfindingNode[] => {
	const kind: WayfindingNodeKind | undefined = pointKind(suffix);

	if (!kind) return [];

	return childrenOf(group).flatMap((child: XmlNode): WayfindingNode[] => {
		if (tagOf(child) !== 'circle') return [];

		const attributes: XmlAttributes = attributesOf(child);
		const x: number | undefined = finiteNumber(attributes.cx);
		const y: number | undefined = finiteNumber(attributes.cy);

		if (!attributes.id || x === undefined || y === undefined) return [];

		return [{
			id: attributes.id,
			kind,
			levelId,
			locationId: kind === 'location' ? locationIdForPoint(attributes) : undefined,
			x,
			y
		}];
	});
};

export const parseWayfindingSvg = (xml: string): ParsedWayfindingSvg => {
	const xmlValidation = XMLValidator.validate(xml);

	if (xmlValidation !== true) {
		throw new Error(`Invalid SVG XML: ${xmlValidation.err.msg} at line ${xmlValidation.err.line}.`);
	}

	const parser = new XMLParser({
		attributeNamePrefix: '',
		ignoreAttributes: false,
		parseAttributeValue: false,
		preserveOrder: true,
		processEntities: false
	});
	const document: XmlNode[] = parser.parse(xml) as XmlNode[];
	const root: XmlNode | undefined = document.find((node: XmlNode): boolean => tagOf(node) === 'svg');

	if (!root) throw new Error('SVG root element is missing.');

	const rootAttributes: XmlAttributes = attributesOf(root);
	const viewBoxValues: number[] = (rootAttributes.viewBox ?? '').trim().split(/[ ,]+/).map(Number);

	if (viewBoxValues.length !== 4 || viewBoxValues.some((value: number): boolean => !Number.isFinite(value))) {
		throw new Error('SVG viewBox must contain four finite numbers.');
	}

	const elements: ParsedSvgElement[] = [];
	collectElements(childrenOf(root), [], elements);
	const rootGroups: XmlNode[] = directGroups(root);
	const rootGroupIds: string[] = rootGroups.map((group: XmlNode): string => attributesOf(group).id ?? '').filter(Boolean);
	const levels: ParsedWayfindingLevel[] = [];

	for (const group of rootGroups) {
		const id: string | undefined = attributesOf(group).id;

		if (!id || id === 'Base') continue;

		const subgroups: XmlNode[] = directGroups(group);
		const subgroupById = new Map(subgroups.map((subgroup: XmlNode): [string, XmlNode] => [attributesOf(subgroup).id ?? '', subgroup]));
		const expectedIds: string[] = WAYFINDING_LAYER_SUFFIXES.map((suffix): string => `${id}-${suffix}`);

		if (!expectedIds.some((expectedId: string): boolean => subgroupById.has(expectedId))) continue;

		const pointNodes: WayfindingNode[] = WAYFINDING_LAYER_SUFFIXES.flatMap((suffix): WayfindingNode[] => {
			const subgroup: XmlNode | undefined = subgroupById.get(`${id}-${suffix}`);

			return subgroup ? parsePointNodes(id, suffix, subgroup) : [];
		});
		const locationGroup: XmlNode | undefined = subgroupById.get(`${id}-Locations`);
		const locations: ParsedSvgElement[] = locationGroup
			? childrenOf(locationGroup).flatMap((child: XmlNode): ParsedSvgElement[] => {
				const tag: string | undefined = tagOf(child);
				const attributes: XmlAttributes = attributesOf(child);

				return tag && attributes.id ? [{ attributes, groupIds: [`${id}-Locations`], tag }] : [];
			})
			: [];

		levels.push({
			id,
			locations,
			pointNodes,
			subgroupIds: subgroups.map((subgroup: XmlNode): string => attributesOf(subgroup).id ?? '').filter(Boolean)
		});
	}

	const width: number = finiteNumber(rootAttributes.width) ?? viewBoxValues[2];
	const height: number = finiteNumber(rootAttributes.height) ?? viewBoxValues[3];

	return {
		elements,
		height,
		ids: elements.map((element: ParsedSvgElement): string => element.attributes.id).filter(Boolean),
		levels,
		rootGroupIds,
		viewBox: viewBoxValues as [number, number, number, number],
		width: width
	};
};

const asRecord = (value: unknown): Record<string, unknown> | undefined => {
	return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
};

export const parseDestinationMetadata = (value: unknown): DestinationMetadata[] => {
	let rows: unknown = value;
	const record: Record<string, unknown> | undefined = asRecord(value);

	if (record) {
		const table: Record<string, unknown> | undefined = asRecord(record.Destinations)
			?? Object.values(record).map(asRecord).find((candidate): candidate is Record<string, unknown> => Array.isArray(candidate?.rows));
		rows = table?.rows ?? record.rows ?? [];
	}

	if (!Array.isArray(rows)) return [];

	return rows.flatMap((row: unknown): DestinationMetadata[] => {
		const item: Record<string, unknown> | undefined = asRecord(row);

		if (!item) return [];

		const id: string = typeof item.id === 'string' ? item.id.trim() : '';
		const name: string = typeof item.name === 'string' ? item.name.trim() : '';

		if (!id || !name) return [];

		const optionalString = (key: string): string | undefined => typeof item[key] === 'string' && item[key].trim() !== ''
			? item[key].trim()
			: undefined;

		return [{
			accessible: item.accessible !== false,
			category: optionalString('category'),
			description: optionalString('description'),
			floor: optionalString('floor'),
			hours: optionalString('hours'),
			id,
			image: optionalString('image'),
			keywords: optionalString('keywords'),
			name,
			routeable: item.routeable !== false,
			status: optionalString('status')
		}];
	});
};
