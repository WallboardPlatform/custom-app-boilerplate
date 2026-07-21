import type { WayfindingPoint } from './wayfinding';

export type WayfindingGuidanceMode = 'directory' | 'highlight' | 'directional' | 'route';

export interface WayfindingGuidanceCapabilities {
	directory: boolean;
	highlight: boolean;
	directional: boolean;
	route: boolean;
}

export interface WayfindingDirection {
	bearingDegrees: number;
	cardinal: 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
	distance: number;
}

const MODE_ORDER: WayfindingGuidanceMode[] = ['directory', 'highlight', 'directional', 'route'];
const CARDINALS: WayfindingDirection['cardinal'][] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

const normalizeDegrees = (degrees: number): number => ((degrees % 360) + 360) % 360;

export const resolveWayfindingGuidanceMode = (
	requested: WayfindingGuidanceMode,
	capabilities: WayfindingGuidanceCapabilities,
	allowFallback = true
): WayfindingGuidanceMode | undefined => {
	if (capabilities[requested]) return requested;

	if (!allowFallback) return undefined;

	for (let index = MODE_ORDER.indexOf(requested) - 1; index >= 0; index -= 1) {
		const candidate: WayfindingGuidanceMode = MODE_ORDER[index];

		if (capabilities[candidate]) return candidate;
	}

	return undefined;
};

/**
 * Returns a compass cue without claiming a walkable route. `mapNorthOffsetDegrees`
 * is the clockwise angle between screen-up and north on the supplied artwork.
 */
export const directionBetweenPoints = (
	start: WayfindingPoint,
	destination: WayfindingPoint,
	mapNorthOffsetDegrees = 0
): WayfindingDirection => {
	const deltaX: number = destination.x - start.x;
	const deltaY: number = destination.y - start.y;
	const screenBearing: number = Math.atan2(deltaX, -deltaY) * 180 / Math.PI;
	const bearingDegrees: number = normalizeDegrees(screenBearing - mapNorthOffsetDegrees);
	const cardinalIndex: number = Math.round(bearingDegrees / 45) % CARDINALS.length;

	return {
		bearingDegrees: Math.round(bearingDegrees),
		cardinal: CARDINALS[cardinalIndex],
		distance: Math.hypot(deltaX, deltaY)
	};
};

export const nearestWayfindingPoint = <T extends { point: WayfindingPoint }>(
	origin: WayfindingPoint,
	candidates: readonly T[]
): T | undefined => {
	let nearest: T | undefined;
	let nearestDistance = Number.POSITIVE_INFINITY;

	for (const candidate of candidates) {
		const distance: number = Math.hypot(candidate.point.x - origin.x, candidate.point.y - origin.y);

		if (distance >= nearestDistance) continue;

		nearest = candidate;
		nearestDistance = distance;
	}

	return nearest;
};
