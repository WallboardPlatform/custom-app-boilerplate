import type {
	WayfindingStudioDestination,
	WayfindingStudioPolygonElement,
	WayfindingStudioProject
} from '../../studio-project.mts';
import type { WayfindingPoint } from '../../../../src/utils/wayfinding.js';
import {
	translatedDestinationDescription,
	translatedDestinationName
} from './visitor';

export type VisitorMapDetail = 'compact' | 'standard' | 'detailed';

export interface VisitorMapItem {
	anchor: WayfindingPoint;
	category?: string;
	description: string;
	destinationId: string;
	geometry?: WayfindingPoint[];
	logoDataUrl?: string;
	mapNumber?: string;
	name: string;
	presentation: 'draft' | 'ready';
}

export interface VisitorMapLabelPlacement {
	height: number;
	item: VisitorMapItem;
	width: number;
	x: number;
	y: number;
}

interface Bounds {
	bottom: number;
	left: number;
	right: number;
	top: number;
}

export interface VisitorMapViewport {
	height: number;
	width: number;
}

export const visitorMarkerIds = (
	items: VisitorMapItem[],
	scale: number,
	selectedDestinationId?: string
): Set<string> => {
	const detail = visitorMapDetail(scale);
	const ready = items.filter((item) => item.presentation === 'ready');
	const prioritized = [
		...ready.filter((item) => Boolean(item.logoDataUrl)),
		...ready.filter((item) => !item.logoDataUrl)
	];
	const limit = detail === 'compact' ? 0 : detail === 'standard' ? 10 : 24;
	const ids = new Set(prioritized.slice(0, limit).map((item) => item.destinationId));

	if (selectedDestinationId) ids.add(selectedDestinationId);

	return ids;
};

const polygonCentroid = (geometry: WayfindingPoint[]): WayfindingPoint => {
	if (geometry.length === 0) return { x: 0, y: 0 };
	let area = 0;
	let x = 0;
	let y = 0;

	for (let index = 0; index < geometry.length; index += 1) {
		const current = geometry[index];
		const next = geometry[(index + 1) % geometry.length];
		const cross = current.x * next.y - next.x * current.y;

		area += cross;
		x += (current.x + next.x) * cross;
		y += (current.y + next.y) * cross;
	}

	if (Math.abs(area) < 0.001) {
		return {
			x: geometry.reduce((sum, point) => sum + point.x, 0) / geometry.length,
			y: geometry.reduce((sum, point) => sum + point.y, 0) / geometry.length
		};
	}

	return {
		x: x / (3 * area),
		y: y / (3 * area)
	};
};

const destinationGeometry = (
	project: WayfindingStudioProject,
	floorId: string,
	destinationId: string
): WayfindingStudioPolygonElement | undefined =>
	project.floors
		.find((floor) => floor.id === floorId)
		?.elements
		.find((element): element is WayfindingStudioPolygonElement =>
			element.type === 'location' && element.destinationId === destinationId
		);

const destinationAnchor = (
	project: WayfindingStudioProject,
	floorId: string,
	destination: WayfindingStudioDestination
): { anchor: WayfindingPoint; geometry?: WayfindingPoint[] } | undefined => {
	const polygon = destinationGeometry(project, floorId, destination.id);

	if (polygon) return { anchor: polygonCentroid(polygon.geometry), geometry: polygon.geometry };
	const floor = project.floors.find((candidate) => candidate.id === floorId);
	const pointElement = floor?.elements.find((element) =>
		'destinationId' in element && element.destinationId === destination.id && 'point' in element
	);

	return pointElement && 'point' in pointElement
		? { anchor: pointElement.point }
		: undefined;
};

export const visitorMapDetail = (scale: number): VisitorMapDetail => {
	if (scale < 0.72) return 'compact';

	if (scale < 1.35) return 'standard';

	return 'detailed';
};

const placeholderNamePattern = /^(location|destination|room|area)\s+\d+$/i;

export const isVisitorReadyDestination = (
	destination: WayfindingStudioDestination,
	name = destination.name
): boolean => {
	const normalizedName = name.trim();
	const hasPurposefulName = normalizedName.length > 0
		&& normalizedName !== destination.id
		&& !placeholderNamePattern.test(normalizedName);
	const hasSupportingContent = [
		destination.category,
		destination.description,
		destination.hours,
		destination.mapNumber,
		destination.phone,
		destination.status,
		destination.website
	].some((value) => typeof value === 'string' && value.trim().length > 0)
		|| Boolean(destination.logoAssetId)
		|| Boolean(destination.photoAssetIds?.length)
		|| Object.values(destination.translations ?? {}).some((translation) =>
			Boolean(translation.name?.trim() || translation.description?.trim())
		);

	return hasPurposefulName || hasSupportingContent;
};

export const buildVisitorMapItems = (
	project: WayfindingStudioProject,
	floorId: string,
	language: string,
	destinations: WayfindingStudioDestination[]
): VisitorMapItem[] => destinations.flatMap((destination) => {
	if (destination.floor !== floorId) return [];
	const positioned = destinationAnchor(project, floorId, destination);

	if (!positioned) return [];
	const logo = project.assets.find((asset) =>
		asset.id === destination.logoAssetId && (asset.kind === 'logo' || asset.kind === 'icon')
	);

	const name = translatedDestinationName(destination, language);

	return [{
		...positioned,
		category: destination.category,
		description: translatedDestinationDescription(destination, language),
		destinationId: destination.id,
		logoDataUrl: logo?.dataUrl,
		mapNumber: destination.mapNumber,
		name,
		presentation: isVisitorReadyDestination(destination, name) ? 'ready' : 'draft'
	}];
});

const intersects = (left: Bounds, right: Bounds): boolean =>
	left.left < right.right
	&& left.right > right.left
	&& left.top < right.bottom
	&& left.bottom > right.top;

const placementBounds = (
	x: number,
	y: number,
	width: number,
	height: number
): Bounds => ({
	bottom: y + height,
	left: x,
	right: x + width,
	top: y
});

export const layoutVisitorMapLabels = (
	items: VisitorMapItem[],
	scale: number,
	selectedDestinationId?: string,
	viewport?: VisitorMapViewport
): VisitorMapLabelPlacement[] => {
	const detail = visitorMapDetail(scale);
	const selected = items.find((item) => item.destinationId === selectedDestinationId);
	const candidates = [
		...(selected ? [selected] : []),
		...items.filter((item) =>
			item.destinationId !== selectedDestinationId && item.presentation === 'ready'
		)
	];
	const occupied: Bounds[] = [];
	const placements: VisitorMapLabelPlacement[] = [];
	const inverseScale = 1 / Math.max(0.25, scale);
	const labelHeight = (detail === 'detailed' ? 42 : 32) * inverseScale;
	const markerGap = 16 * inverseScale;
	const limit = detail === 'compact' ? (selected ? 1 : 0) : detail === 'standard' ? 8 : 16;
	const viewportMargin = 12 * inverseScale;

	for (const item of candidates) {
		if (placements.length >= limit && item.destinationId !== selectedDestinationId) continue;
		const width = Math.min(
			240,
			Math.max(88, item.name.length * 7.2 + (item.mapNumber ? 26 : 0))
		) * inverseScale;
		const offsets = [
			{ x: markerGap, y: -labelHeight / 2 },
			{ x: -width - markerGap, y: -labelHeight / 2 },
			{ x: -width / 2, y: -labelHeight - markerGap },
			{ x: -width / 2, y: markerGap }
		];
		const offset = offsets.find((candidate) => {
			const bounds = placementBounds(
				item.anchor.x + candidate.x,
				item.anchor.y + candidate.y,
				width,
				labelHeight
			);
			const insideViewport = !viewport || (
				bounds.left >= viewportMargin
				&& bounds.right <= viewport.width - viewportMargin
				&& bounds.top >= viewportMargin
				&& bounds.bottom <= viewport.height - viewportMargin
			);

			return insideViewport && occupied.every((existing) => !intersects(bounds, existing));
		});

		if (!offset && item.destinationId !== selectedDestinationId) continue;
		const fallback = offset ?? offsets[0];
		const placement = {
			height: labelHeight,
			item,
			width,
			x: item.anchor.x + fallback.x,
			y: item.anchor.y + fallback.y
		};

		occupied.push(placementBounds(placement.x, placement.y, width, labelHeight));
		placements.push(placement);
	}

	return placements;
};
