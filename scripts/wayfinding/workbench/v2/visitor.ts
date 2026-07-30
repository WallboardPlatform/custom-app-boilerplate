import type {
	WayfindingStudioDestination,
	WayfindingStudioFloor
} from '../../studio-project.mts';

export interface VisitorFilters {
	category?: string;
	floorId?: string;
	language: string;
	query: string;
}

export const translatedDestinationName = (
	destination: WayfindingStudioDestination,
	language: string
): string => destination.translations?.[language]?.name ?? destination.name;

export const translatedDestinationDescription = (
	destination: WayfindingStudioDestination,
	language: string
): string => destination.translations?.[language]?.description
	?? destination.description
	?? 'No visitor description has been added yet.';

export const visitorDestinationMatches = (
	destination: WayfindingStudioDestination,
	filters: VisitorFilters
): boolean => {
	if (filters.floorId && destination.floor !== filters.floorId) return false;

	if (filters.category && destination.category !== filters.category) return false;
	const query = filters.query.trim().toLocaleLowerCase();

	if (!query) return true;

	return [
		translatedDestinationName(destination, filters.language),
		translatedDestinationDescription(destination, filters.language),
		destination.category,
		destination.mapNumber,
		destination.hours
	].some((value) => value?.toLocaleLowerCase().includes(query));
};

export const filterVisitorDestinations = (
	destinations: WayfindingStudioDestination[],
	filters: VisitorFilters
): WayfindingStudioDestination[] => destinations.filter((destination) =>
	visitorDestinationMatches(destination, filters)
);

export const visitorFloorOptions = (
	floors: WayfindingStudioFloor[],
	destinations: WayfindingStudioDestination[]
): WayfindingStudioFloor[] => floors.filter((floor) =>
	destinations.some((destination) => destination.floor === floor.id)
);

export const visitorCategoryOptions = (
	destinations: WayfindingStudioDestination[]
): string[] => [...new Set(
	destinations
		.map((destination) => destination.category?.trim())
		.filter((category): category is string => Boolean(category))
)].sort((left, right) => left.localeCompare(right));
