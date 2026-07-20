import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

export type WayfindingSourceIssueSeverity = 'error' | 'warning' | 'info';

export interface WayfindingSourceIssue {
	code: string;
	elementIds?: string[];
	message: string;
	severity: WayfindingSourceIssueSeverity;
}

export interface WayfindingAnchorProposal {
	id: string;
	kind: 'location';
	levelId: string;
	locationId: string;
	reviewStatus: 'proposed';
	sourceElementId: string;
	x: number;
	y: number;
}

export interface WayfindingSourceAudit {
	anchors: WayfindingAnchorProposal[];
	issues: WayfindingSourceIssue[];
	summary: {
		duplicateIdCount: number;
		legacyLocationPointCount: number;
		legacyRoutePointCount: number;
		locationGeometryCount: number;
		modernLocationAnnotationCount: number;
		unsafeElementCount: number;
	};
}

export interface WayfindingSourceMigration {
	annotatedSvg: string;
	audit: WayfindingSourceAudit;
}

const SVG_SHAPES = new Set(['circle', 'ellipse', 'g', 'path', 'polygon', 'rect']);
const UNSAFE_ELEMENTS = new Set(['foreignobject', 'iframe', 'object', 'script']);

const allElements = (document: Document): Element[] => Array.from(document.getElementsByTagName('*'));

const groupLevelId = (groupId: string): string => {
	const prefix: string = groupId.replace(/-(?:Locations|LocationPoints|RoutePoints)$/i, '');
	const levelMatch: RegExpMatchArray | null = prefix.match(/^level[-_ ]?(\d+)$/i);

	return levelMatch ? `level-${levelMatch[1]}` : prefix.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'level-0';
};

const numericAttribute = (element: Element, name: string): number | undefined => {
	const rawValue: string | null = element.getAttribute(name);
	const value: number = Number(rawValue);

	return rawValue !== null && Number.isFinite(value) ? value : undefined;
};

const descendants = (element: Element): Element[] => Array.from(element.getElementsByTagName('*'));

const legacyGroups = (document: Document, suffix: string): Element[] => allElements(document)
	.filter((element: Element): boolean => element.tagName.toLowerCase() === 'g' && new RegExp(`-${suffix}$`, 'i').test(element.getAttribute('id') ?? ''));

const locationGeometryForGroup = (group: Element): Element[] => descendants(group).filter((element: Element): boolean => {
	if (!SVG_SHAPES.has(element.tagName.toLowerCase()) || !element.getAttribute('id')) return false;

	let parent: Node | null = element.parentNode;

	while (parent && parent !== group) {
		if (parent.nodeType === 1) {
			const parentElement: Element = parent as Element;

			if (SVG_SHAPES.has(parentElement.tagName.toLowerCase()) && parentElement.getAttribute('id')) return false;
		}

		parent = parent.parentNode;
	}

	return true;
});

const locationGeometry = (document: Document): Element[] => legacyGroups(document, 'Locations')
	.flatMap((group: Element): Element[] => locationGeometryForGroup(group));

const createAnchorProposals = (document: Document): WayfindingAnchorProposal[] => legacyGroups(document, 'LocationPoints')
	.flatMap((group: Element): WayfindingAnchorProposal[] => descendants(group).flatMap((element: Element): WayfindingAnchorProposal[] => {
		if (element.tagName.toLowerCase() !== 'circle') return [];

		const sourceElementId: string = element.getAttribute('id') ?? '';
		const x: number | undefined = numericAttribute(element, 'cx');
		const y: number | undefined = numericAttribute(element, 'cy');

		if (!sourceElementId || x === undefined || y === undefined) return [];

		const locationId: string = sourceElementId.replace(/-lp$/i, '');

		return [{
			id: `location-${locationId}`,
			kind: 'location',
			levelId: groupLevelId(group.getAttribute('id') ?? ''),
			locationId,
			reviewStatus: 'proposed',
			sourceElementId,
			x,
			y
		}];
	}));

const unsafeElements = (document: Document): Element[] => allElements(document).filter((element: Element): boolean => {
	if (UNSAFE_ELEMENTS.has(element.tagName.toLowerCase())) return true;

	return Array.from(element.attributes).some((attribute: Attr): boolean => attribute.name.toLowerCase().startsWith('on'));
});

const duplicateIds = (document: Document): string[] => {
	const counts = new Map<string, number>();

	for (const element of allElements(document)) {
		const id: string = element.getAttribute('id') ?? '';

		if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
	}

	return Array.from(counts.entries()).filter(([, count]: [string, number]): boolean => count > 1).map(([id]: [string, number]): string => id);
};

const parseSvg = (svg: string): Document => {
	const errors: string[] = [];
	const document: Document = new DOMParser({
		errorHandler: {
			error: (message: string): void => { errors.push(message); },
			fatalError: (message: string): void => { errors.push(message); },
			warning: (): void => undefined
		}
	}).parseFromString(svg, 'image/svg+xml');

	if (!document.documentElement || document.documentElement.tagName.toLowerCase() !== 'svg' || errors.length > 0) {
		throw new Error(`Invalid SVG source${errors.length > 0 ? `: ${errors.join('; ')}` : '.'}`);
	}

	return document;
};

export const auditWayfindingSource = (svg: string): WayfindingSourceAudit => {
	const document: Document = parseSvg(svg);
	const geometry: Element[] = locationGeometry(document);
	const anchors: WayfindingAnchorProposal[] = createAnchorProposals(document);
	const routePointCount: number = legacyGroups(document, 'RoutePoints')
		.reduce((total: number, group: Element): number => total + descendants(group).filter((element: Element): boolean => element.tagName.toLowerCase() === 'circle').length, 0);

	const duplicates: string[] = duplicateIds(document);

	const unsafe: Element[] = unsafeElements(document);

	const modernAnnotations: number = allElements(document).filter((element: Element): boolean => element.hasAttribute('data-wayfinding-location-id')).length;

	const issues: WayfindingSourceIssue[] = [];

	if (duplicates.length > 0) issues.push({ code: 'duplicate-svg-ids', elementIds: duplicates, message: 'SVG ids must be unique before migration.', severity: 'error' });
	if (unsafe.length > 0) issues.push({ code: 'unsafe-svg-content', elementIds: unsafe.map((element: Element): string => element.getAttribute('id') ?? '').filter(Boolean), message: 'Executable or embedded document content must be removed before use.', severity: 'error' });
	if (routePointCount > 0) issues.push({ code: 'point-cloud-is-not-topology', message: `${routePointCount} legacy route points were found. They are evidence only; explicit graph edges must be authored and reviewed.`, severity: 'warning' });
	if (anchors.length > 0) issues.push({ code: 'anchors-require-review', message: `${anchors.length} location-point anchors were proposed from legacy circles. Verify each entrance or approach point against the source.`, severity: 'warning' });
	if (document.getElementsByTagName('title').length + document.getElementsByTagName('desc').length > 0) issues.push({ code: 'embedded-copy-unverified', message: 'Embedded title and description copy is not promoted to the destination table automatically.', severity: 'warning' });
	if (modernAnnotations === 0 && geometry.length === 0) issues.push({ code: 'no-location-geometry', message: 'No modern annotations or legacy location geometry were found.', severity: 'warning' });

	return {
		anchors,
		issues,
		summary: {
			duplicateIdCount: duplicates.length,
			legacyLocationPointCount: anchors.length,
			legacyRoutePointCount: routePointCount,
			locationGeometryCount: geometry.length,
			modernLocationAnnotationCount: modernAnnotations,
			unsafeElementCount: unsafe.length
		}
	};
};

export const migrateWayfindingSource = (svg: string): WayfindingSourceMigration => {
	const document: Document = parseSvg(svg);
	const audit: WayfindingSourceAudit = auditWayfindingSource(svg);

	for (const group of legacyGroups(document, 'Locations')) {
		const levelId: string = groupLevelId(group.getAttribute('id') ?? '');

		for (const element of locationGeometryForGroup(group)) {
			const id: string = element.getAttribute('id') ?? '';

			element.setAttribute('data-wayfinding-location-id', id);
			element.setAttribute('data-wayfinding-level', levelId);
		}
	}

	return { annotatedSvg: new XMLSerializer().serializeToString(document), audit };
};
