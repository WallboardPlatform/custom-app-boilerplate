import type {
	WayfindingStudioElement,
	WayfindingStudioLabelElement,
	WayfindingStudioProject
} from '../../studio-project.mts';
import type { EditorLayerId } from '../../editor-core/types';
import { buildVisitorMapItems } from './visitor-map';

const visibleInVisitorScene = (
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

export const visitorSceneProject = (
	project: WayfindingStudioProject,
	visibility: Record<EditorLayerId, boolean>,
	language = project.defaultLanguage ?? 'en'
): WayfindingStudioProject => ({
	...project,
	floors: project.floors.map((floor) => ({
		...floor,
		elements: [
			...floor.elements.filter((element) => visibleInVisitorScene(element, visibility)),
			...(visibility.label
				? buildVisitorMapItems(project, floor.id, language, project.destinations).map((item) => ({
					destinationId: item.destinationId,
					floorId: floor.id,
					fontWeight: 600,
					id: `visitor-destination-label:${item.destinationId}`,
					point: item.anchor,
					provenance: 'reviewer-authored',
					status: item.presentation === 'ready' ? 'confirmed' : 'proposed',
					text: item.mapNumber ? `${item.mapNumber}  ${item.name}` : item.name,
					type: 'label'
				} satisfies WayfindingStudioLabelElement & { destinationId: string }))
				: [])
		]
	}))
});
