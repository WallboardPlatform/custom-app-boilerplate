import type {
	WayfindingStudioElement,
	WayfindingStudioLabelElement,
	WayfindingStudioProject
} from '../../../../studio-project.mts';
import type { EditorLayerId } from '../../../../editor-core/types';
import { buildPresentationScene } from '../../../../../../src/utils/wayfinding-presentation.js';
import { buildVisitorMapItems } from '../../visitor-map';

const visibleInPresentationScene = (
	element: WayfindingStudioElement,
	visibility: Record<EditorLayerId, boolean>
): boolean => {
	if (
		element.type === 'location'
		|| element.type === 'obstacle'
		|| element.type === 'origin'
		|| element.type === 'poi'
		|| element.type === 'transition'
		|| element.type === 'walkable'
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

		return {
			...floor,
			elements: [
				...floor.elements.filter((element) =>
					visibleInPresentationScene(element, visibility)
					&& !supersededLabelIds.has(element.id)
				),
				...(visibility.label
					? buildVisitorMapItems(project, floor.id, language, project.destinations).map((item) => ({
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
					: [])
			]
		};
	})
});
