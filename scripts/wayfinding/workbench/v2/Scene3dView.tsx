import {
	createEffect,
	createMemo,
	onCleanup,
	onMount,
	type Accessor,
	type JSX
} from 'solid-js';
import type { WayfindingRoutePoint } from '../../../../src/utils/wayfinding';
import type { EditorSnapshot, EditorStore } from '../../editor-core/types';
import { WayfindingScene3d } from '../scene3d';
import { routeToDestination } from './route';

export const Scene3dView = (props: {
	snapshot: Accessor<EditorSnapshot>;
	store: EditorStore;
}): JSX.Element => {
	let host!: HTMLDivElement;
	let scene: WayfindingScene3d | undefined;
	const project = createMemo(() => props.snapshot().state.project);
	const floorId = createMemo(() => props.snapshot().state.currentFloorId);
	const selectedElementId = createMemo(() => {
		const selection = props.snapshot().state.selection;

		return selection?.kind === 'element' ? selection.id : undefined;
	});
	const selectedDestinationId = createMemo(() => {
		const selection = props.snapshot().state.selection;

		return selection?.kind === 'destination' ? selection.id : undefined;
	});

	onMount(() => {
		scene = new WayfindingScene3d(host, {
			onSelectElement: (elementId): void => {
				if (elementId) props.store.dispatch({ type: 'selection/set', selection: { id: elementId, kind: 'element' } });
			}
		});
		scene.setVisible(true);
	});

	createEffect(() => {
		const route: WayfindingRoutePoint[] = routeToDestination(project(), selectedDestinationId());
		scene?.rebuild(project(), floorId(), route);
	});

	createEffect(() => {
		scene?.selectElement(selectedElementId());
	});

	onCleanup(() => {
		scene?.setVisible(false);
		scene?.dispose();
	});

	return <div class="scene3d-host" ref={host} />;
};
