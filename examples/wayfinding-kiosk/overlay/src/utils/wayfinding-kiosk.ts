import type { DestinationLiveStatus, KioskPlace } from '@interfaces/wayfinding-kiosk.interface';
import type {
	WayfindingViewerAsset,
	WayfindingViewerBuilding,
	WayfindingViewerDestination,
	WayfindingViewerLevel
} from '../capabilities/wayfinding';

const record = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const tableRows = (value: unknown): unknown[] => {
	if (Array.isArray(value)) return value;

	if (!record(value)) return [];

	if (Array.isArray(value.rows)) return value.rows;
	const table = value.DestinationStatus;

	return record(table) && Array.isArray(table.rows) ? table.rows : [];
};

const optionalText = (value: unknown): string | undefined =>
	typeof value === 'string' && value.trim() ? value.trim() : undefined;

const available = (value: unknown): boolean => {
	if (typeof value === 'boolean') return value;

	if (typeof value === 'number') return value !== 0;

	if (typeof value === 'string') return !['false', 'no', '0', 'closed', 'unavailable'].includes(value.trim().toLowerCase());

	return true;
};

export const normalizeDestinationStatuses = (value: unknown): Map<string, DestinationLiveStatus> => {
	const statuses = new Map<string, DestinationLiveStatus>();

	for (const candidate of tableRows(value)) {
		if (!record(candidate)) continue;
		const destinationId = optionalText(candidate.destinationId);

		if (!destinationId) continue;
		const wait = Number(candidate.waitMinutes);

		statuses.set(destinationId, {
			available: available(candidate.available),
			destinationId,
			note: optionalText(candidate.note),
			status: optionalText(candidate.status),
			waitMinutes: Number.isFinite(wait) && wait >= 0 ? Math.round(wait) : undefined
		});
	}

	return statuses;
};

export const buildKioskPlaces = (
	buildings: readonly WayfindingViewerBuilding[],
	destinations: readonly WayfindingViewerDestination[]
): KioskPlace[] => [
	...buildings.map((entity): KioskPlace => ({
		entity,
		kind: 'building',
		target: { id: entity.id, kind: 'building' }
	})),
	...destinations.map((entity): KioskPlace => ({
		entity,
		kind: 'destination',
		target: { id: entity.id, kind: 'destination' }
	}))
];

export const localizedPlaceName = (place: KioskPlace, language: string): string =>
	place.entity.translations?.[language]?.name?.trim() || place.entity.name;

export const localizedPlaceDescription = (place: KioskPlace, language: string): string =>
	place.entity.translations?.[language]?.description?.trim()
	|| place.entity.description?.trim()
	|| (place.kind === 'building'
		? 'Explore services, spaces, and destinations in this building.'
		: 'Select route to view the complete journey from this kiosk.');

export const placeFloorLabel = (
	place: KioskPlace,
	levels: readonly WayfindingViewerLevel[]
): string => {
	if (place.kind === 'building') return 'Building';
	const level = levels.find((candidate) => candidate.id === place.entity.levelId);

	return level?.role === 'site' ? 'Campus' : level?.name ?? 'Location';
};

export const placeImage = (
	place: KioskPlace,
	assets: readonly WayfindingViewerAsset[]
): string | undefined => {
	const photoId = place.entity.photoAssetIds?.[0];
	const symbolId = place.entity.symbolAssetId;

	return assets.find((asset) => asset.id === photoId)?.dataUrl
		?? assets.find((asset) => asset.id === symbolId)?.dataUrl;
};

export const filterKioskPlaces = (
	places: readonly KioskPlace[],
	query: string,
	language: string,
	kind: 'all' | 'building' | 'destination'
): KioskPlace[] => {
	const normalized = query.trim().toLocaleLowerCase(language);

	return places.filter((place) => {
		if (kind !== 'all' && place.kind !== kind) return false;

		if (!normalized) return true;
		const haystack = [
			localizedPlaceName(place, language),
			place.entity.description,
			place.entity.category,
			place.kind === 'destination' ? place.entity.mapNumber : undefined
		].filter(Boolean).join(' ').toLocaleLowerCase(language);

		return haystack.includes(normalized);
	});
};
