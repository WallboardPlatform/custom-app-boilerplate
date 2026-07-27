import type { WayfindingStudioProject } from '../../../studio-project.mts';
import type {
	EditorSnapshot,
	EditorStore
} from '../../../editor-core/types';

export const updateProject = (
	store: EditorStore,
	snapshot: EditorSnapshot,
	label: string,
	update: (project: WayfindingStudioProject) => void
): void => {
	const project: WayfindingStudioProject = structuredClone(snapshot.state.project);
	update(project);
	store.dispatch({ type: 'project/replace', project, label });
};
