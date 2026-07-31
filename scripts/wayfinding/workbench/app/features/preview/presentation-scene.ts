import type {
	WayfindingStudioElement,
	WayfindingStudioLabelElement,
	WayfindingStudioMediaElement,
	WayfindingStudioPointElement,
	WayfindingStudioProject
} from '../../../../studio-project.mts';
import type { EditorLayerId } from '../../../../editor-core/types';
import { buildPresentationScene } from '../../../../../../src/utils/wayfinding-presentation.js';
import { buildVisitorMapItems } from './visitor-map';

const visibleInPresentationScene = (
	element: WayfindingStudioElement,
	visibility: Record<EditorLayerId, boolean>
): boolean => {
	if (
		element.type === 'location'
		|| element.type === 'origin'
		|| element.type === 'poi'
		|| element.type === 'transition'
	) return true;

	if (element.type === 'icon' || element.type === 'logo' || element.type === 'label') {
		return visibility[element.type];
	}

	return false;
};

export const presentationSceneProject = (
	project: WayfindingStudioProject,
	visibility: Record<EditorLayerId, boolean>,
	language = project.defaultLanguage ?? 'en'
): WayfindingStudioProject => ({
	...project,
	floors: project.floors.map((floor) => {
		const scene = buildPresentationScene({
			defaultLanguage: project.defaultLanguage,
			destinations: project.destinations,
			floors: project.floors,
			projectId: project.projectId
		}, { floorId: floor.id, language });
		const supersededLabelIds = new Set(scene.supersededLabelIds);
		const mapItems = buildVisitorMapItems(project, floor.id, language, project.destinations);
		const destinationSymbols = visibility.icon
			? mapItems.flatMap((item): WayfindingStudioMediaElement[] => {
				const destination = project.destinations.find((candidate) => candidate.id === item.destinationId);
				const asset = project.assets.find((candidate) =>
					candidate.kind === 'icon' && candidate.id === destination?.symbolAssetId
				);

				if (!asset) return [];
				const longEdge = Math.max(28, Math.min(floor.width, floor.height) * 0.035);
				const ratio = Math.max(0.1, (asset.naturalWidth ?? 1) / Math.max(1, asset.naturalHeight ?? 1));

				return [{
					assetId: asset.id,
					destinationId: item.destinationId,
					floorId: floor.id,
					height: ratio >= 1 ? longEdge / ratio : longEdge,
					id: `presentation-destination-symbol:${item.destinationId}`,
					point: item.anchor,
					provenance: 'reviewer-authored',
					status: item.presentation === 'ready' ? 'confirmed' : 'proposed',
					type: 'icon',
					width: ratio >= 1 ? longEdge : longEdge * ratio
				}];
			})
			: [];
		const symbolDestinationIds = new Set(
			destinationSymbols.map((symbol) => symbol.destinationId)
		);
		const destinationMarkers = mapItems
			.filter((item) => !symbolDestinationIds.has(item.destinationId))
			.map((item) => ({
				destinationId: item.destinationId,
				floorId: floor.id,
				id: `presentation-destination-marker:${item.destinationId}`,
				label: item.name,
				point: item.anchor,
				provenance: 'reviewer-authored',
				status: item.presentation === 'ready' ? 'confirmed' : 'proposed',
				type: 'poi'
			} satisfies WayfindingStudioPointElement));

		return {
			...floor,
			elements: [
				...floor.elements.filter((element) =>
					visibleInPresentationScene(element, visibility)
					&& !supersededLabelIds.has(element.id)
				),
				...(visibility.label
					? mapItems.map((item) => ({
						destinationId: item.destinationId,
						floorId: floor.id,
						fontWeight: 600,
						id: `presentation-destination-label:${item.destinationId}`,
						point: item.anchor,
						provenance: 'reviewer-authored',
						status: item.presentation === 'ready' ? 'confirmed' : 'proposed',
						text: item.mapNumber ? `${item.mapNumber}  ${item.name}` : item.name,
						type: 'label'
					} satisfies WayfindingStudioLabelElement & { destinationId: string }))
					: []),
				...destinationMarkers,
				...destinationSymbols
			]
		};
	})
});
