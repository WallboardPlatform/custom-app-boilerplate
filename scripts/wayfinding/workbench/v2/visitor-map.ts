import type {
	WayfindingStudioDestination,
	WayfindingStudioMediaElement,
	WayfindingStudioProject
} from '../../studio-project.mts';
import type { WayfindingPoint } from '../../../../src/utils/wayfinding.js';
import {
	buildPresentationScene,
	isPresentationReadyDestination,
	layoutPresentationLabels,
	type PresentationLabelPlacement,
	type PresentationViewport
} from '../../../../src/utils/wayfinding-presentation.js';

export type VisitorMapDetail = 'compact' | 'standard' | 'detailed';

export interface VisitorMapItem {
	anchor: WayfindingPoint;
	category?: string;
	description: string;
	destinationId: string;
	floorId?: string;
	geometry?: WayfindingPoint[];
	logoDataUrl?: string;
	mapNumber?: string;
	name: string;
	presentation: 'draft' | 'ready';
	symbolDataUrl?: string;
}

export type VisitorMapLabelPlacement = PresentationLabelPlacement;
export type VisitorMapViewport = PresentationViewport;

export const visitorMarkerIds = (
	items: VisitorMapItem[],
	scale: number,
	selectedDestinationId?: string
): Set<string> => {
	const detail = visitorMapDetail(scale);
	const ready = items.filter((item) => item.presentation === 'ready');
	const prioritized = [
		...ready.filter((item) => Boolean(item.symbolDataUrl || item.logoDataUrl)),
		...ready.filter((item) => !item.symbolDataUrl && !item.logoDataUrl)
	];
	const visible = detail === 'compact'
		? prioritized.filter((item) => Boolean(item.symbolDataUrl)).slice(0, 6)
		: prioritized.slice(0, detail === 'standard' ? 10 : 24);
	const ids = new Set(visible.map((item) => item.destinationId));

	if (selectedDestinationId) ids.add(selectedDestinationId);

	return ids;
};

export const visitorMapDetail = (scale: number): VisitorMapDetail => {
	if (scale < 0.72) return 'compact';

	if (scale < 1.35) return 'standard';

	return 'detailed';
};

export const isVisitorReadyDestination = (
	destination: WayfindingStudioDestination,
	name = destination.name
): boolean => isPresentationReadyDestination(destination, name)
	|| Boolean(destination.symbolAssetId)
	|| Boolean(destination.logoAssetId)
	|| Boolean(destination.photoAssetIds?.length);

export const buildVisitorMapItems = (
	project: WayfindingStudioProject,
	floorId: string,
	language: string,
	destinations: WayfindingStudioDestination[]
): VisitorMapItem[] => {
	const scene = buildPresentationScene({
		defaultLanguage: project.defaultLanguage,
		destinations,
		floors: project.floors,
		projectId: project.projectId
	}, { floorId, language });

	return scene.mapItems.map((item): VisitorMapItem => {
		const destination = destinations.find((candidate) => candidate.id === item.destinationId);
		const logo = project.assets.find((asset) =>
			asset.id === destination?.logoAssetId && (asset.kind === 'logo' || asset.kind === 'icon')
		);
		const linkedSymbolAssetId = project.floors
			.flatMap((floor) => floor.elements)
			.find((element): element is WayfindingStudioMediaElement =>
				element.type === 'icon'
				&& element.destinationId === destination?.id
			)?.assetId;
		const symbol = project.assets.find((asset) =>
			asset.kind === 'icon'
				&& asset.id === (destination?.symbolAssetId ?? linkedSymbolAssetId)
		);

		return {
			...item,
			logoDataUrl: logo?.dataUrl,
			presentation: destination && isVisitorReadyDestination(destination, item.name)
				? 'ready'
				: 'draft',
			symbolDataUrl: symbol?.dataUrl
		};
	});
};

export const layoutVisitorMapLabels = (
	items: VisitorMapItem[],
	scale: number,
	selectedDestinationId?: string,
	viewport?: VisitorMapViewport
): VisitorMapLabelPlacement[] => layoutPresentationLabels(
	items,
	scale,
	selectedDestinationId,
	viewport
);
