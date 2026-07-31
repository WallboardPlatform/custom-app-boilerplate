import type { WayfindingPoint } from './wayfinding';

export interface PresentationTranslation {
	description?: string;
	name?: string;
}

export interface PresentationDestinationSource {
	category?: string;
	description?: string;
	/** v1 runtime compatibility. */
	floor?: string;
	geometryRefs?: Array<{ levelId: string }>;
	hours?: string;
	id: string;
	levelId?: string;
	mapNumber?: string;
	name: string;
	phone?: string;
	status?: string;
	translations?: Record<string, PresentationTranslation>;
	website?: string;
}

export interface PresentationElementSource {
	destinationId?: string;
	geometry?: WayfindingPoint[];
	id: string;
	point?: WayfindingPoint;
	text?: string;
	type: string;
}

export interface PresentationLevelSource<
	TElement extends PresentationElementSource = PresentationElementSource
> {
	camera3d?: {
		azimuthDegrees: number;
		distance: number;
		pitchDegrees: number;
		targetX: number;
		targetY: number;
	};
	elements: TElement[];
	height: number;
	id: string;
	name: string;
	role?: 'building-floor' | 'site' | 'standalone';
	width: number;
}

export interface PresentationReadiness {
	ready: boolean;
	reasons: string[];
}

export interface PresentationMapItem {
	anchor: WayfindingPoint;
	category?: string;
	description: string;
	destinationId: string;
	levelId?: string;
	geometry?: WayfindingPoint[];
	mapNumber?: string;
	name: string;
	presentation: 'draft' | 'ready';
}

export interface PresentationLabelPlacement {
	displayText: string;
	fontSize: number;
	height: number;
	item: PresentationMapItem;
	width: number;
	x: number;
	y: number;
}

export interface PresentationViewport {
	height: number;
	width: number;
}

export interface PresentationScene<
	TLevel extends PresentationLevelSource,
	TDestination extends PresentationDestinationSource
> {
	activeLevel?: TLevel;
	destinations: TDestination[];
	levels: TLevel[];
	language: string;
	mapItems: PresentationMapItem[];
	projectId: string;
	supersededLabelIds: string[];
	version: 2;
}

export interface PresentationSceneSource<
	TLevel extends PresentationLevelSource,
	TDestination extends PresentationDestinationSource
> {
	defaultLanguage?: string;
	destinations: TDestination[];
	levels: TLevel[];
	projectId: string;
}

const placeholderNamePattern = /^(location|destination|room|area)\s+\d+$/i;

export const isPresentationReadyDestination = (
	destination: PresentationDestinationSource,
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
		|| Object.values(destination.translations ?? {}).some((translation) =>
			Boolean(translation.name?.trim() || translation.description?.trim())
		);

	return hasPurposefulName || hasSupportingContent;
};

export const presentationDestinationLevelIds = (
	destination: PresentationDestinationSource
): string[] => Array.from(new Set([
	...(destination.geometryRefs?.map((reference) => reference.levelId) ?? []),
	...(destination.levelId ? [destination.levelId] : []),
	...(destination.floor ? [destination.floor] : [])
]));

export const translatedPresentationDestination = <
	TDestination extends PresentationDestinationSource
>(
	destination: TDestination,
	language: string
): TDestination => {
	const translation = destination.translations?.[language];

	return {
		...destination,
		description: translation?.description ?? destination.description,
		name: translation?.name ?? destination.name
	};
};

const polygonCentroid = (geometry: readonly WayfindingPoint[]): WayfindingPoint => {
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

const destinationPosition = (
	floor: PresentationLevelSource,
	destinationId: string
): Pick<PresentationMapItem, 'anchor' | 'geometry'> | undefined => {
	const polygon = floor.elements.find((element) =>
		element.type === 'location'
		&& element.destinationId === destinationId
		&& element.geometry
	);

	if (polygon?.geometry) {
		return {
			anchor: polygonCentroid(polygon.geometry),
			geometry: polygon.geometry
		};
	}
	const pointElement = floor.elements.find((element) =>
		element.destinationId === destinationId && element.point
	);

	return pointElement?.point ? { anchor: pointElement.point } : undefined;
};

const normalizedLabelText = (value: string): string => value
	.normalize('NFKD')
	.replace(/\p{M}/gu, '')
	.toLocaleLowerCase()
	.replace(/[^\p{L}\p{N}]+/gu, '');

const pointInPolygon = (point: WayfindingPoint, polygon: WayfindingPoint[]): boolean => {
	let inside = false;

	for (let left = 0, right = polygon.length - 1; left < polygon.length; right = left, left += 1) {
		const a = polygon[left];
		const b = polygon[right];

		if (
			(a.y > point.y) !== (b.y > point.y)
			&& point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x
		) inside = !inside;
	}

	return inside;
};

export const buildPresentationScene = <
	TLevel extends PresentationLevelSource,
	TDestination extends PresentationDestinationSource
>(
	source: PresentationSceneSource<TLevel, TDestination>,
	options: { levelId?: string; language?: string } = {}
): PresentationScene<TLevel, TDestination> => {
	const language = options.language || source.defaultLanguage || 'en';
	const activeLevel = source.levels.find((floor) => floor.id === options.levelId) ?? source.levels[0];
	const destinations = source.destinations.map((destination) =>
		translatedPresentationDestination(destination, language)
	);
	const mapItems = activeLevel
		? destinations.flatMap((destination): PresentationMapItem[] => {
			const levelIds = presentationDestinationLevelIds(destination);

			if (levelIds.length > 0 && !levelIds.includes(activeLevel.id)) return [];
			const positioned = destinationPosition(activeLevel, destination.id);

			if (!positioned) return [];

			return [{
				...positioned,
				category: destination.category,
				description: destination.description ?? '',
				destinationId: destination.id,
				levelId: activeLevel.id,
				mapNumber: destination.mapNumber,
				name: destination.name,
				presentation: isPresentationReadyDestination(destination) ? 'ready' : 'draft'
			}];
		})
		: [];
	const destinationNames = new Map<string, Set<string>>();

	for (const destination of source.destinations) {
		destinationNames.set(destination.id, new Set([
			destination.name,
			...Object.values(destination.translations ?? {})
				.map((translation) => translation.name)
				.filter((name): name is string => Boolean(name))
			].map(normalizedLabelText)));
	}

	const supersededLabelIds = activeLevel?.elements
		.filter((element) => {
			const point = element.point;

			if (element.type !== 'label' || !element.text || !point) return false;
			const normalized = normalizedLabelText(element.text);

			return mapItems.some((item) =>
				destinationNames.get(item.destinationId)?.has(normalized)
				&& (!item.geometry || pointInPolygon(point, item.geometry))
			);
		})
		.map((element) => element.id) ?? [];

	return {
		activeLevel,
		destinations,
		levels: source.levels,
		language,
		mapItems,
		projectId: source.projectId,
		supersededLabelIds,
		version: 2
	};
};

interface PresentationBounds {
	bottom: number;
	left: number;
	right: number;
	top: number;
}

const intersects = (left: PresentationBounds, right: PresentationBounds): boolean =>
	left.left < right.right
	&& left.right > right.left
	&& left.top < right.bottom
	&& left.bottom > right.top;

const placementBounds = (
	x: number,
	y: number,
	width: number,
	height: number
): PresentationBounds => ({
	bottom: y + height,
	left: x,
	right: x + width,
	top: y
});

const labelText = (item: PresentationMapItem): string =>
	item.mapNumber ? `${item.mapNumber}  ${item.name}` : item.name;

const glyphWidth = (character: string): number => {
	if (/\s/u.test(character)) return 3.5;

	if (/[ilI1|.,'`]/u.test(character)) return 3.9;

	if (/[MW@%&]/u.test(character)) return 9.6;

	if (/[A-Z0-9]/u.test(character)) return 7.6;

	return 7;
};

const estimatedTextWidth = (value: string): number =>
	[...value].reduce((width, character) => width + glyphWidth(character), 0);

const fitLabelText = (value: string, maximumWidth: number): string => {
	if (estimatedTextWidth(value) <= maximumWidth) return value;
	const ellipsis = '…';
	let result = '';

	for (const character of value) {
		if (estimatedTextWidth(`${result}${character}${ellipsis}`) > maximumWidth) break;
		result += character;
	}

	return `${result.trimEnd()}${ellipsis}`;
};

export const layoutPresentationLabels = (
	items: PresentationMapItem[],
	scale: number,
	selectedDestinationId?: string,
	viewport?: PresentationViewport
): PresentationLabelPlacement[] => {
	const detail = scale < 0.72 ? 'compact' : scale < 1.35 ? 'standard' : 'detailed';
	const selected = items.find((item) => item.destinationId === selectedDestinationId);
	const candidates = [
		...(selected ? [selected] : []),
		...items.filter((item) =>
			item.destinationId !== selectedDestinationId && item.presentation === 'ready'
		)
	];
	const occupied: PresentationBounds[] = [];
	const placements: PresentationLabelPlacement[] = [];
	const inverseScale = 1 / Math.max(0.25, scale);
	const screenFontSize = detail === 'detailed' ? 14 : 13;
	const labelHeight = (detail === 'detailed' ? 38 : 32) * inverseScale;
	const markerGap = 16 * inverseScale;
	const markerCollisionRadius = 20 * inverseScale;
	const markerBounds = items.map((item) => ({
		anchor: item.anchor,
		bounds: placementBounds(
			item.anchor.x - markerCollisionRadius,
			item.anchor.y - markerCollisionRadius,
			markerCollisionRadius * 2,
			markerCollisionRadius * 2
		),
		destinationId: item.destinationId
	}));
	const readyCount = items.filter((item) => item.presentation === 'ready').length;
	const limit = detail === 'compact'
		? (readyCount <= 6 ? 6 : selected ? 1 : 0)
		: detail === 'standard'
			? 8
			: 16;
	const viewportMargin = 12 * inverseScale;
	const collisionPadding = 10 * inverseScale;
	const horizontalPadding = 20;
	const maximumLabelWidth = detail === 'detailed' ? 260 : 220;

	for (const item of candidates) {
		if (placements.length >= limit && item.destinationId !== selectedDestinationId) continue;
		const fullText = labelText(item);
		const displayText = fitLabelText(
			fullText,
			maximumLabelWidth - horizontalPadding
		);
		const width = Math.min(
			maximumLabelWidth,
			Math.max(88, estimatedTextWidth(displayText) + horizontalPadding)
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
			const paddedBounds = placementBounds(
				bounds.left - collisionPadding,
				bounds.top - collisionPadding,
				width + collisionPadding * 2,
				labelHeight + collisionPadding * 2
			);
			const insideViewport = !viewport || (
				bounds.left >= viewportMargin
				&& bounds.right <= viewport.width - viewportMargin
				&& bounds.top >= viewportMargin
				&& bounds.bottom <= viewport.height - viewportMargin
			);
			const avoidsOtherMarkers = markerBounds.every((marker) =>
				marker.destinationId === item.destinationId
				|| Math.hypot(
					marker.anchor.x - item.anchor.x,
					marker.anchor.y - item.anchor.y
				) <= markerCollisionRadius * 1.25
				|| !intersects(paddedBounds, marker.bounds)
			);

			return insideViewport
				&& avoidsOtherMarkers
				&& occupied.every((existing) => !intersects(paddedBounds, existing));
		});

		if (!offset && item.destinationId !== selectedDestinationId) continue;
		const fallback = offset ?? offsets[0];
		const unclampedX = item.anchor.x + fallback.x;
		const unclampedY = item.anchor.y + fallback.y;
		const placement = {
			displayText,
			fontSize: screenFontSize * inverseScale,
			height: labelHeight,
			item,
			width,
			x: viewport
				? Math.max(viewportMargin, Math.min(
					viewport.width - viewportMargin - width,
					unclampedX
				))
				: unclampedX,
			y: viewport
				? Math.max(viewportMargin, Math.min(
					viewport.height - viewportMargin - labelHeight,
					unclampedY
				))
				: unclampedY
		};

		occupied.push(placementBounds(
			placement.x - collisionPadding,
			placement.y - collisionPadding,
			width + collisionPadding * 2,
			labelHeight + collisionPadding * 2
		));
		placements.push(placement);
	}

	return placements;
};

export const getPresentationThreeDimensionalReadiness = (
	scene: PresentationScene<PresentationLevelSource, PresentationDestinationSource>
): PresentationReadiness => {
	const floor = scene.activeLevel;

	if (!floor) return { ready: false, reasons: ['The active floor no longer exists.'] };
	const reasons: string[] = [];
	const polygons = floor.elements.filter((element) =>
		element.type === 'building'
		|| element.type === 'location'
		|| element.type === 'obstacle'
		|| element.type === 'walkable'
	);
	const locations = polygons.filter((polygon) => polygon.type === 'location');
	const buildings = polygons.filter((polygon) => polygon.type === 'building');
	const invalidGeometry = polygons.some((polygon) =>
		!polygon.geometry
		|| polygon.geometry.length < 3
		|| polygon.geometry.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))
		|| Math.abs(polygon.geometry.reduce((area, point, index) => {
			const next = polygon.geometry![(index + 1) % polygon.geometry!.length];

			return area + point.x * next.y - next.x * point.y;
		}, 0) / 2) < 1
	);

	if (floor.role === 'site' && buildings.length === 0) reasons.push('Add at least one building footprint.');
	else if (floor.role !== 'site' && locations.length === 0) reasons.push('Add at least one room or destination area.');

	if (invalidGeometry) reasons.push('Repair invalid or collapsed map geometry.');
	const destinationIds = new Set(floor.elements
		.filter((element) =>
			(element.type === 'location' || element.type === 'poi')
			&& Boolean(element.destinationId)
		)
		.map((element) => element.destinationId!));
	const readyDestinationIds = new Set(scene.mapItems
		.filter((item) => item.presentation === 'ready')
		.map((item) => item.destinationId));

	if ([...destinationIds].some((destinationId) => !readyDestinationIds.has(destinationId))) {
		reasons.push('Name every visible destination before presenting it in 3D.');
	}
	const camera = floor.camera3d;

	if (camera && !(
		Number.isFinite(camera.azimuthDegrees)
		&& Number.isFinite(camera.distance)
		&& camera.distance > 0
		&& Number.isFinite(camera.pitchDegrees)
		&& camera.pitchDegrees >= 5
		&& camera.pitchDegrees <= 85
		&& Number.isFinite(camera.targetX)
		&& camera.targetX >= 0
		&& camera.targetX <= floor.width
		&& Number.isFinite(camera.targetY)
		&& camera.targetY >= 0
		&& camera.targetY <= floor.height
	)) {
		reasons.push('Reset or correct the saved 3D camera.');
	}
	const vertexCount = polygons.reduce(
		(total, polygon) => total + (polygon.geometry?.length ?? 0),
		0
	);

	if (floor.elements.length > 2_000 || vertexCount > 20_000) {
		reasons.push('Simplify this floor before enabling the 3D presentation.');
	}

	return {
		ready: reasons.length === 0,
		reasons
	};
};
