import {
	Bookmark,
	RotateCcw
} from 'lucide-solid';
import {
	createEffect,
	createMemo,
	createSignal,
	onCleanup,
	onMount,
	Show,
	type Accessor,
	type JSX,
	untrack
} from 'solid-js';
import type { EditorSnapshot, EditorStore } from '../../editor-core/types';
import type { WayfindingStudioCamera3d } from '../../studio-project.mts';
import { WayfindingScene3d } from '../scene3d';
import {
	floorRoutePoints,
	routeToDestination,
	type VisitorRouteProfile
} from './features/routing';
import { presentationSceneProject } from './features/preview';
import { Button } from './ui';

const cameraStatesByStore = new WeakMap<
	EditorStore,
	Map<string, WayfindingStudioCamera3d>
>();

export const Scene3dView = (props: {
	registerFit: (fit: () => void) => void;
	routeDestinationId?: Accessor<string | undefined>;
	routeOriginId?: Accessor<string | undefined>;
	routeProfile?: Accessor<VisitorRouteProfile>;
	snapshot: Accessor<EditorSnapshot>;
	store: EditorStore;
	visitorLanguage?: Accessor<string>;
}): JSX.Element => {
	let host!: HTMLDivElement;
	let scene: WayfindingScene3d | undefined;
	let screenOverlayFrame: number | undefined;
	let readyFrame: number | undefined;
	let readyGeneration = 0;
	const [ready, setReady] = createSignal(false);
	const editorStore = untrack(() => props.store);
	const cameraStates = cameraStatesByStore.get(editorStore)
		?? new Map<string, WayfindingStudioCamera3d>();

	cameraStatesByStore.set(editorStore, cameraStates);
	const project = createMemo(() => props.snapshot().state.project);
	const renderProject = createMemo(() => props.snapshot().state.workspace === 'preview'
		? presentationSceneProject(
			project(),
			props.snapshot().state.layerVisibility,
			props.visitorLanguage?.()
		)
		: project());
	const presentationMode = createMemo(() => props.snapshot().state.workspace === 'preview' ? 'visitor' : 'editor');
	const floorId = createMemo(() => props.snapshot().state.currentFloorId);
	const selectedElementId = createMemo(() => {
		const selection = props.snapshot().state.selection;

		if (selection?.kind === 'element') return selection.id;

		if (selection?.kind !== 'destination') return undefined;

		const matchingElements = renderProject().floors
			.find((floor) => floor.id === floorId())
			?.elements
			.filter((element) => 'destinationId' in element && element.destinationId === selection.id);

		if (!matchingElements?.length) return undefined;

		if (props.snapshot().state.workspace !== 'preview') return matchingElements[0]?.id;

		return matchingElements.find((element) =>
			element.id.startsWith('presentation-destination-marker:')
			|| element.id.startsWith('presentation-destination-symbol:')
		)?.id ?? matchingElements[0]?.id;
	});
	const selectedDestinationId = createMemo(() => {
		const selection = props.snapshot().state.selection;

		return selection?.kind === 'destination' ? selection.id : undefined;
	});
	const route = createMemo(() => floorRoutePoints(
		routeToDestination(
			project(),
			props.snapshot().state.workspace === 'preview'
				? props.routeDestinationId?.()
				: selectedDestinationId(),
			props.routeProfile?.() ?? 'standard',
			props.routeOriginId?.()
		),
		floorId()
	));
	const markReadyAfterPaint = (): void => {
		readyGeneration += 1;
		const generation = readyGeneration;

		if (readyFrame !== undefined) window.cancelAnimationFrame(readyFrame);
		setReady(false);
		delete host.dataset.ready;
		readyFrame = window.requestAnimationFrame(() => {
			readyFrame = window.requestAnimationFrame(() => {
				if (generation !== readyGeneration) return;
				host.dataset.ready = 'true';
				setReady(true);
			});
		});
	};

	onMount(() => {
		scene = new WayfindingScene3d(host, {
			loadCameraState: (mode, projectId, currentFloorId): WayfindingStudioCamera3d | undefined =>
				cameraStates.get(`${projectId}:${mode}:${currentFloorId}`),
			onCameraStateChange: (mode, projectId, currentFloorId, state): void => {
				cameraStates.set(`${projectId}:${mode}:${currentFloorId}`, structuredClone(state));
			},
			onSelectElement: (elementId): void => {
				if (!elementId) return;
				const element = renderProject().floors
					.find((floor) => floor.id === floorId())
					?.elements
					.find((candidate) => candidate.id === elementId);
				const destinationId = element && 'destinationId' in element ? element.destinationId : undefined;

				props.store.dispatch({
					type: 'selection/set',
					selection: destinationId && props.snapshot().state.workspace === 'preview'
						? { id: destinationId, kind: 'destination' }
						: { id: elementId, kind: 'element' }
				});
			}
		});
		scene.setVisible(true);
		props.registerFit(() => scene?.resetCamera());
		scene.rebuild(renderProject(), floorId(), route(), presentationMode());
		markReadyAfterPaint();
	});

	createEffect(() => {
		const currentProject = renderProject();
		const currentFloorId = floorId();
		const currentRoute = route();
		const currentPresentationMode = presentationMode();

		if (!scene) return;
		scene.rebuild(currentProject, currentFloorId, currentRoute, currentPresentationMode);
		markReadyAfterPaint();
	});

	createEffect(() => {
		const elementId = selectedElementId();

		scene?.selectElement(elementId);

		if (screenOverlayFrame !== undefined) window.cancelAnimationFrame(screenOverlayFrame);
		screenOverlayFrame = window.requestAnimationFrame(() => {
			screenOverlayFrame = undefined;
			scene?.refreshScreenOverlays();
		});
	});

	onCleanup(() => {
		readyGeneration += 1;

		if (readyFrame !== undefined) window.cancelAnimationFrame(readyFrame);

		if (screenOverlayFrame !== undefined) window.cancelAnimationFrame(screenOverlayFrame);
		scene?.setVisible(false);
		scene?.dispose();
	});

	return (
		<div class="scene3d-shell" classList={{ ready: ready() }}>
			<div class="scene3d-host" ref={host} />
			<Show when={!ready()}>
				<div class="scene3d-progress" role="status">Preparing 3D map...</div>
			</Show>
			<div class="scene3d-camera-actions" aria-label="3D camera controls">
				<Button
					size="compact"
					tone="overlay"
					onClick={() => scene?.resetCamera()}
				>
					<RotateCcw size={16} /> Reset view
				</Button>
				<Button
					size="compact"
					tone="overlay"
					onClick={() => {
						const camera3d = scene?.getCameraState();

						if (!camera3d) return;
						props.store.dispatch({
							type: 'floor/update',
							floorId: floorId(),
							patch: { camera3d }
						});
					}}
				>
					<Bookmark size={16} /> Save view
				</Button>
			</div>
		</div>
	);
};
