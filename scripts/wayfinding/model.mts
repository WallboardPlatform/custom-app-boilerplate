import { XMLParser, XMLValidator } from 'fast-xml-parser';

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

export interface ParsedWayfindingLocation extends ParsedSvgElement {
	levelId?: string;
	locationId: string;
}

export interface ParsedWayfindingSvg {
	elements: ParsedSvgElement[];
	height: number;
	ids: string[];
	locations: ParsedWayfindingLocation[];
	viewBox: [number, number, number, number];
	width: number;
}

export interface DestinationMetadata {
	accessible: boolean | null;
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
	const width: number = finiteNumber(rootAttributes.width) ?? viewBoxValues[2];
	const height: number = finiteNumber(rootAttributes.height) ?? viewBoxValues[3];
	const locations: ParsedWayfindingLocation[] = elements.flatMap((element: ParsedSvgElement): ParsedWayfindingLocation[] => {
		const locationId: string | undefined = element.attributes['data-wayfinding-location-id'];

		return locationId ? [{
			...element,
			levelId: element.attributes['data-wayfinding-level'],
			locationId
		}] : [];
	});

	return {
		elements,
		height,
		ids: elements.map((element: ParsedSvgElement): string => element.attributes.id).filter(Boolean),
		locations,
		viewBox: viewBoxValues as [number, number, number, number],
		width
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
			accessible: item.accessible === true ? true : item.accessible === false ? false : null,
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
