import {
	createEffect,
	createMemo,
	createSignal,
	onCleanup,
	onMount,
	Show,
	untrack,
	type Accessor,
	type JSX
} from 'solid-js';
import {
	wayfindingStudioProjectDefaults,
	type WayfindingStudioDestination,
	type WayfindingStudioDoorElement,
	type WayfindingStudioElement,
	type WayfindingStudioMediaElement,
	type WayfindingStudioOriginElement
} from '../../studio-project.mts';
import type {
	EditorSnapshot,
	EditorStore
} from '../../editor-core/types';
import type { WayfindingPoint } from '../../../../src/utils/wayfinding.js';
import {
	floorRoutePoints,
	isRouteGraphInteractive,
	routeToDestination,
	type RouteWorkspaceView,
	type VisitorRouteProfile
} from './features/routing';
import {
	type DragInteraction,
	POINT_TOOLS,
	POLYGON_TOOLS
} from './canvas/interaction';
import {
	insertGeometryPoint,
	nearestSegment
} from './canvas/editing';
import { CanvasScene } from './canvas/CanvasScene';
import {
	edgeGeometry,
	type FloorPresentationMode,
	isPointElement,
	isPolygonElement,
	renderEditorFloorSvg
} from './canvas/model';
import type { RegionDetectionSource } from './canvas/regionDetection';
import {
	buildCanvasSelectionOperation,
	describeCanvasSelection,
	type CanvasSelectionOperation,
	type CanvasSelectionDescriptor
} from './canvas/selection-controller';
import {
	createAuthoringId,
	resolveDoorPlacement
} from './canvas/authoring';
import {
	editorCameraInsets,
	type CameraInsets
} from './canvas/camera-layout';
import {
	buildVisitorMapItems,
	layoutVisitorMapLabels
} from './features/preview';
import {
	previewCameraInsets,
	previewCameraOffset
} from './features/preview/preview-camera';
import { useCanvasCamera } from './canvas/useCanvasCamera';
import {
	createCanvasDragController,
	type ElementInteractionPreview
} from './canvas/useCanvasDrag';
import { createCanvasAuthoringController } from './canvas/useCanvasAuthoring';
import { createCanvasKeyboardController } from './canvas/useCanvasKeyboard';
import { createCanvasPointerDownHandler } from './canvas/useCanvasPointerDown';

interface Canvas2dProps {
	onCameraScaleChange?: (scale: number) => void;
	onNotify?: (message: string, tone?: 'danger' | 'info' | 'success' | 'warning') => void;
	onPointerCoordinate?: (point: WayfindingPoint) => void;
	onPreviewDestinationSelect?: (destinationId: string | undefined) => void;
	previewDetailSide?: Accessor<'left' | 'right'>;
	registerFit: (fit: () => void) => void;
	registerSelectionActions?: (actions: CanvasSelectionActions) => void;
	routeDestinationId?: Accessor<string | undefined>;
	routeOriginId?: Accessor<string | undefined>;
	routeProfile?: Accessor<VisitorRouteProfile>;
	routeWorkspaceView?: Accessor<RouteWorkspaceView>;
	showRouteNetwork?: Accessor<boolean>;
	snapshot: Accessor<EditorSnapshot>;
	store: EditorStore;
	visitorDestinations?: Accessor<WayfindingStudioDestination[]>;
	visitorLanguage?: Accessor<string>;
}

export interface CanvasSelectionActions {
	addPoint: () => boolean;
	clear: () => void;
	delete: () => void;
	descriptor: () => CanvasSelectionDescriptor | undefined;
	duplicate: () => boolean;
	fit: () => void;
	repair: () => boolean;
	removePoint: () => boolean;
	simplify: () => boolean;
	straighten: () => boolean;
}

const nextId = createAuthoringId;
export const Canvas2d = (props: Canvas2dProps): JSX.Element => {
	let viewport!: HTMLDivElement;
	let interaction: DragInteraction | undefined;
	const store = untrack(() => props.store);
	let traceLoadVersion = 0;
	const [interactionGeometry, setInteractionGeometry] = createSignal<WayfindingPoint[]>();
	const [interactionGraphGeometry, setInteractionGraphGeometry] = createSignal<WayfindingPoint[]>();
	const [interactionGraphPoint, setInteractionGraphPoint] = createSignal<WayfindingPoint>();
	const [interactionElementPreview, setInteractionElementPreview] = createSignal<ElementInteractionPreview>();
	const [freehandGeometry, setFreehandGeometry] = createSignal<WayfindingPoint[]>();
	const [draftCursor, setDraftCursor] = createSignal<WayfindingPoint>();
	const [traceSource, setTraceSource] = createSignal<RegionDetectionSource>();
	const routeWorkspaceView = (): RouteWorkspaceView => props.routeWorkspaceView?.() ?? 'edit';
	const routeGraphInteractive = (): boolean => isRouteGraphInteractive(
		props.snapshot().state.workspace,
		routeWorkspaceView()
	);
	const currentFloorId = createMemo(() => props.snapshot().state.currentFloorId);
	const floor = createMemo(() => props.snapshot().state.project.floors.find(
		(candidate) => candidate.id === currentFloorId()
	) ?? props.snapshot().state.project.floors[0]);
	const cameraInsetRevision = createMemo(() => {
		const state = props.snapshot().state;

		return [
			state.currentFloorId,
			state.panels.left.collapsed,
			state.panels.left.width,
			state.panels.right.collapsed,
			state.panels.right.width,
			state.project.floors.length,
			state.workspace
		].join(':');
	});
	const preserveEditorCameraComposition = createMemo(() =>
		props.snapshot().state.workspace !== 'preview'
	);
	const editorCameraCompositionInsets = (): CameraInsets => {
		const state = props.snapshot().state;
		const compact = window.innerWidth <= 1_240;

		return {
			bottom: 64,
			// Wide panels already reduce and reposition the canvas viewport. Only
			// compact drawers overlay it and therefore need to become camera
			// insets. Counting docked panels twice keeps the CSS transform stable
			// while the viewport moves underneath it, visibly shifting the map.
			left: compact && !state.panels.left.collapsed ? 426 : 64,
			right: compact && !state.panels.right.collapsed ? 394 : 64,
			top: 68
		};
	};
	const cameraController = useCanvasCamera({
		compositionInsets: editorCameraCompositionInsets,
		ephemeral: () => props.snapshot().state.workspace === 'preview',
		fitInsets: () => {
			const state = props.snapshot().state;

			if (state.workspace !== 'preview') {
				// These reads make the DOM-measured overlay composition reactive.
				void state.panels.left.collapsed;
				void state.panels.left.width;
				void state.panels.right.collapsed;
				void state.panels.right.width;
				void state.project.floors.length;
				void state.selection?.id;
				void state.viewMode;

				return editorCameraInsets(viewport);
			}
			const destinationId = props.routeDestinationId?.();
			const viewportWidth = viewport?.clientWidth ?? window.innerWidth;
			const viewportHeight = viewport?.clientHeight ?? window.innerHeight;

			return previewCameraInsets({
				destinationOpen: Boolean(destinationId),
				detailOnRight: props.previewDetailSide?.() === 'right',
				preview: props.snapshot().state.workspace === 'preview',
				viewportHeight,
				viewportWidth
			});
		},
		fitOffset: () => {
			const viewportWidth = viewport?.clientWidth ?? window.innerWidth;
			const viewportHeight = viewport?.clientHeight ?? window.innerHeight;

			return previewCameraOffset({
				destinationOpen: Boolean(props.routeDestinationId?.()),
				detailOnRight: false,
				preview: props.snapshot().state.workspace === 'preview',
				viewportHeight,
				viewportWidth
			});
		},
		fitOnResize: () => props.snapshot().state.workspace === 'preview',
		floor,
		getViewport: () => viewport,
		insetChangeRevision: cameraInsetRevision,
		preserveCenterOnInsetChange: preserveEditorCameraComposition,
		registerFit: (fit): void => props.registerFit(fit),
		snapshot: () => props.snapshot(),
		store
	});
	const camera = cameraController.camera;

	createEffect(() => {
		props.onCameraScaleChange?.(camera().scale);
	});
	const floorElements = createMemo(() => floor().elements);
	const backgroundAsset = createMemo(() => props.snapshot().state.project.assets.find(
		(asset) => asset.id === floor().backgroundAssetId
	));
	const selectedElement = createMemo(() => {
		const selection = props.snapshot().state.selection;

		return selection?.kind === 'element'
			? floorElements().find((element) => element.id === selection.id)
			: undefined;
	});
	const previewProject = createMemo(() => {
		const state = props.snapshot().state;
		const preview = interactionElementPreview();

		if (!preview) return state.project;

		return {
			...state.project,
			floors: state.project.floors.map((candidateFloor) => candidateFloor.id === floor().id
				? {
					...candidateFloor,
					elements: candidateFloor.elements.map((element) => element.id === preview.elementId
						? { ...element, ...preview.patch } as WayfindingStudioElement
						: element)
				}
				: candidateFloor)
		};
	});
	const selectedElementPreview = createMemo(() => {
		const element = selectedElement();
		const preview = interactionElementPreview();

		return element && preview?.elementId === element.id
			? { ...element, ...preview.patch } as WayfindingStudioElement
			: element;
	});
	const selectedPolygon = createMemo(() => {
		const element = selectedElementPreview();

		return isPolygonElement(element) ? element : undefined;
	});
	const selectedPolygonGeometry = createMemo(() => interactionGeometry() ?? selectedPolygon()?.geometry ?? []);
	const selectedPoint = createMemo(() => {
		const element = selectedElementPreview();

		return isPointElement(element) ? element.point : undefined;
	});
	const floorGraphNodes = createMemo(() => props.snapshot().state.project.graph.nodes.filter(
		(node) => node.levelId === floor().id
	));
	const floorGraphEdges = createMemo(() => props.snapshot().state.project.graph.edges.filter((edge) => {
		const from = props.snapshot().state.project.graph.nodes.find((node) => node.id === edge.from);
		const to = props.snapshot().state.project.graph.nodes.find((node) => node.id === edge.to);

		return from?.levelId === floor().id && to?.levelId === floor().id;
	}));
	const selectedGraphNode = createMemo(() => {
		const selection = props.snapshot().state.selection;

		return selection?.kind === 'graph-node'
			? floorGraphNodes().find((node) => node.id === selection.id)
			: undefined;
	});
	const selectedGraphEdge = createMemo(() => {
		const selection = props.snapshot().state.selection;

		return selection?.kind === 'graph-edge'
			? floorGraphEdges().find((edge) => edge.id === selection.id)
			: undefined;
	});
	const selectedGraphGeometryIndex = createMemo(() => {
		const selection = props.snapshot().state.selection;

		return selection?.kind === 'graph-edge' ? selection.geometryIndex : undefined;
	});
	const graphEdgePoints = (edgeId: string): WayfindingPoint[] => {
		const edge = floorGraphEdges().find((candidate) => candidate.id === edgeId);

		return edgeGeometry(edge, floorGraphNodes());
	};
	const selectedGraphGeometry = createMemo(() => {
		const edge = selectedGraphEdge();

		if (!edge) return [];

		return interactionGraphGeometry() ?? graphEdgePoints(edge.id);
	});
	const selectedDestinationId = createMemo(() => {
		const selection = props.snapshot().state.selection;

		if (selection?.kind === 'destination') return selection.id;
		const element = selectedElement();

		return element && 'destinationId' in element ? element.destinationId : undefined;
	});
	const route = createMemo(() => floorRoutePoints(
		routeToDestination(
			props.snapshot().state.project,
			props.snapshot().state.workspace === 'preview'
				? props.routeDestinationId?.()
				: selectedDestinationId(),
			props.routeProfile?.() ?? 'standard',
			props.routeOriginId?.()
		),
		floor().id
	));
	const renderedSvg = createMemo(() => {
		const state = props.snapshot().state;
		const presentationMode: FloorPresentationMode = state.workspace === 'preview'
			? 'preview'
			: 'editor';

		return renderEditorFloorSvg(
			previewProject(),
			floor().id,
			state.layerVisibility,
			presentationMode === 'editor' ? state.selection : undefined,
			Boolean(interactionGeometry()),
			presentationMode
		);
	});
	const visitorMapItems = createMemo(() => buildVisitorMapItems(
		props.snapshot().state.project,
		floor().id,
		props.visitorLanguage?.() ?? props.snapshot().state.project.defaultLanguage ?? 'en',
		props.visitorDestinations?.() ?? props.snapshot().state.project.destinations
	));
	const visitorLabelPlacements = createMemo(() => layoutVisitorMapLabels(
		visitorMapItems(),
		camera().scale,
		selectedDestinationId(),
		{ height: floor().height, width: floor().width }
	));
	const draft = createMemo(() => props.snapshot().state.draft);
	const handleRadius = createMemo(() => Math.max(4, 7 / camera().scale));
	const defaults = createMemo(() => wayfindingStudioProjectDefaults(props.snapshot().state.project));

	createEffect(() => {
		const asset = backgroundAsset();
		traceLoadVersion += 1;
		const version = traceLoadVersion;

		setTraceSource(undefined);

		if (!asset?.dataUrl) return;
		const image = new Image();

		image.onload = (): void => {
			if (version !== traceLoadVersion) return;
			const canvas = document.createElement('canvas');
			canvas.width = image.naturalWidth;
			canvas.height = image.naturalHeight;
			const context = canvas.getContext('2d', { willReadFrequently: true });

			if (!context) return;
			context.drawImage(image, 0, 0);
			setTraceSource({
				data: context.getImageData(0, 0, canvas.width, canvas.height).data,
				height: canvas.height,
				width: canvas.width
			});
		};
		image.onerror = (): void => {
			if (version === traceLoadVersion) setTraceSource(undefined);
		};
		image.src = asset.dataUrl;
	});

	const fit = cameraController.fit;
	let lastPreviewRouteFitKey: string | undefined;

	createEffect(() => {
		const destinationId = props.routeDestinationId?.();
		const preview = props.snapshot().state.workspace === 'preview';
		const fitKey = preview && destinationId
			? `${currentFloorId()}:${destinationId}`
			: undefined;

		if (fitKey && fitKey !== lastPreviewRouteFitKey) queueMicrotask(fit);
		lastPreviewRouteFitKey = fitKey;
	});

	const fitSelection = (): void => {
		const selection = props.snapshot().state.selection;
		let points: WayfindingPoint[] = [];

		if (selection?.kind === 'element') {
			const element = selectedElement();

			if (isPolygonElement(element)) points = element.geometry;
			else if (isPointElement(element)) points = [element.point];
		} else if (selection?.kind === 'graph-node') {
			const node = floorGraphNodes().find((candidate) => candidate.id === selection.id);

			if (node) points = [{ x: node.x, y: node.y }];
		} else if (selection?.kind === 'graph-edge') {
			points = graphEdgePoints(selection.id);
		}

		if (!viewport || points.length === 0) {
			fit();

			return;
		}
		cameraController.fitPoints(points);
	};

	const pointInViewport = cameraController.viewportPoint;
	const pointInMap = cameraController.mapPoint;
	const {
		addPolygon,
		createPointElement,
		finishPolygonDraft,
		finishRouteDraft,
		snapFreehandPoint,
		traceRegion
	} = createCanvasAuthoringController({
		camera,
		defaults,
		floor,
		floorGraphNodes,
		notify: (message, tone) => props.onNotify?.(message, tone),
		snapshot: () => props.snapshot(),
		store,
		traceSource
	});

	const executeSelectionOperation = (
		operation: CanvasSelectionOperation
	): boolean => {
		const operationResult = buildCanvasSelectionOperation(
			props.snapshot().state,
			operation
		);

		if (!operationResult) return false;

		if (operationResult.transaction.commands.length > 0) {
			props.store.run(operationResult.transaction);
		}

		if (operationResult.selection) {
			props.store.dispatch({
				type: 'selection/set',
				selection: operationResult.selection
			});
		} else if (operation.type === 'delete') {
			props.store.dispatch({ type: 'selection/clear' });
		}

		if (operationResult.notification) {
			props.onNotify?.(
				operationResult.notification.message,
				operationResult.notification.tone
			);
		}

		return operationResult.transaction.commands.length > 0;
	};

	const removeSelection = (): void => {
		executeSelectionOperation({ type: 'delete' });
	};

	const addSelectionPoint = (): boolean =>
		executeSelectionOperation({ type: 'add-point' });

	const removeSelectionPoint = (): boolean =>
		executeSelectionOperation({ type: 'remove-point' });

	const simplifySelection = (): boolean =>
		executeSelectionOperation({ type: 'simplify' });

	const repairSelection = (): boolean =>
		executeSelectionOperation({ type: 'repair' });

	const straightenSelection = (): boolean =>
		executeSelectionOperation({ type: 'straighten' });

	const nudgeSelection = (delta: WayfindingPoint): boolean =>
		executeSelectionOperation({ delta, type: 'nudge' });

	const duplicateSelection = (): boolean =>
		executeSelectionOperation({ createId: nextId, type: 'duplicate' });

	const keyboard = createCanvasKeyboardController({
		cancelInteraction: () => {
			props.store.dispatch({ type: 'draft/clear' });
			setFreehandGeometry(undefined);
			setInteractionGeometry(undefined);
			setInteractionGraphGeometry(undefined);
			setInteractionGraphPoint(undefined);
			setInteractionElementPreview(undefined);
			interaction = undefined;
		},
		draft,
		duplicateSelection,
		finishPolygonDraft,
		finishRouteDraft,
		notify: (message, tone) => props.onNotify?.(message, tone),
		nudgeSelection,
		removeSelection,
		removeSelectionPoint,
		routeWorkspaceView,
		snapshot: () => props.snapshot(),
		store
	});

	onMount(() => {
		props.registerSelectionActions?.({
			addPoint: addSelectionPoint,
			clear: () => props.store.dispatch({ type: 'selection/clear' }),
			delete: removeSelection,
			descriptor: () => describeCanvasSelection(props.snapshot().state),
			duplicate: duplicateSelection,
			fit: fitSelection,
			repair: repairSelection,
			removePoint: removeSelectionPoint,
			simplify: simplifySelection,
			straighten: straightenSelection
		});
		window.addEventListener('keydown', keyboard.keyDown);
		window.addEventListener('keyup', keyboard.keyUp);
	});

	const dragController = createCanvasDragController({
		addFreehandPolygon: (elementType, geometry) =>
			addPolygon(elementType, geometry, undefined, `Freehand ${elementType}`),
		camera,
		draft,
		floor,
		floorGraphEdges,
		floorGraphNodes,
		getInteraction: () => interaction,
		mapPoint: pointInMap,
		notify: (message, tone) => props.onNotify?.(message, tone),
		onPointerCoordinate: (point) => props.onPointerCoordinate?.(point),
		resolvePointElementPatch: (elementId, point) => {
			const element = floorElements().find((candidate) => candidate.id === elementId);

			if (element?.type !== 'door') return { point };
			const placement = resolveDoorPlacement(
				props.snapshot().state.project,
				floor().id,
				point,
				element.locationId
			);

			return {
				angle: placement.angle,
				locationId: placement.location?.id,
				point: placement.point
			};
		},
		setCamera: cameraController.setCamera,
		setDraftCursor,
		setFreehandGeometry,
		setInteraction: (nextInteraction) => {
			interaction = nextInteraction;
		},
		setInteractionElementPreview,
		setInteractionGeometry,
		setInteractionGraphGeometry,
		setInteractionGraphPoint,
		snapFreehandPoint,
		store,
		viewportPoint: pointInViewport
	});

	const wheel: JSX.EventHandler<HTMLDivElement, WheelEvent> = (event): void => {
		event.preventDefault();
		cameraController.zoomAt(event);
	};

	const finishDraft: JSX.EventHandler<HTMLDivElement, MouseEvent> = (event): void => {
		event.preventDefault();

		if (draft()?.kind === 'polygon') finishPolygonDraft();
		else if (draft()?.kind === 'route-edge') finishRouteDraft();
		else if (props.snapshot().state.activeTool === 'select' && selectedPolygon()) {
			const point = pointInMap(event);
			const nearest = nearestSegment(selectedPolygon()!.geometry, point, true);

			if (nearest && nearest.distance <= 14 / camera().scale) {
				insertVertexAtPoint(point, nearest.index);
			}
		}
	};

	const beginVertexDrag = (event: PointerEvent, vertexIndex: number): void => {
		const polygon = selectedPolygon();

		if (!polygon) return;
		event.preventDefault();
		event.stopPropagation();
		props.store.dispatch({
			type: 'selection/set',
			selection: { id: polygon.id, kind: 'element', vertexIndex }
		});
		interaction = {
			elementId: polygon.id,
			geometry: structuredClone(polygon.geometry),
			kind: 'polygon',
			moved: false,
			original: structuredClone(polygon.geometry),
			pointerId: event.pointerId,
			start: pointInMap(event),
			vertexIndex
		};
		setInteractionGeometry(structuredClone(polygon.geometry));
		viewport.setPointerCapture(event.pointerId);
	};

	const beginElementDrag = (event: PointerEvent, element: WayfindingStudioElement): void => {
		if (props.snapshot().state.activeTool !== 'select') return;
		event.preventDefault();
		event.stopPropagation();
		viewport.focus({ preventScroll: true });
		props.store.dispatch({ type: 'selection/set', selection: { id: element.id, kind: 'element' } });

		if (isPolygonElement(element)) {
			interaction = {
				elementId: element.id,
				geometry: structuredClone(element.geometry),
				kind: 'polygon',
				moved: false,
				original: structuredClone(element.geometry),
				pointerId: event.pointerId,
				start: pointInMap(event)
			};
			setInteractionGeometry(structuredClone(element.geometry));
			viewport.setPointerCapture(event.pointerId);
		} else if (isPointElement(element)) {
			interaction = {
				elementId: element.id,
				kind: 'point',
				moved: false,
				original: { ...element.point },
				point: { ...element.point },
				pointerId: event.pointerId,
				start: pointInMap(event)
			};
			viewport.setPointerCapture(event.pointerId);
		}
	};

	const selectElement = (element: WayfindingStudioElement): void => {
		if (props.snapshot().state.activeTool !== 'select') return;
		viewport.focus({ preventScroll: true });
		props.store.dispatch({ type: 'selection/set', selection: { id: element.id, kind: 'element' } });
	};

	const beginDirectionDrag = (
		event: PointerEvent,
		element: WayfindingStudioDoorElement | WayfindingStudioOriginElement
	): void => {
		event.preventDefault();
		event.stopPropagation();
		const property = element.type === 'door' ? 'angle' : 'facingDegrees';
		const angle = element.type === 'door' ? element.angle : element.facingDegrees;
		interaction = {
			angle,
			elementId: element.id,
			kind: 'direction',
			moved: false,
			origin: { ...element.point },
			pointerId: event.pointerId,
			property
		};
		viewport.setPointerCapture(event.pointerId);
	};

	const beginMediaResize = (event: PointerEvent, element: WayfindingStudioMediaElement): void => {
		event.preventDefault();
		event.stopPropagation();
		interaction = {
			aspectRatio: element.width / Math.max(1, element.height),
			elementId: element.id,
			height: element.height,
			kind: 'media-resize',
			moved: false,
			origin: { ...element.point },
			originalHeight: element.height,
			originalWidth: element.width,
			pointerId: event.pointerId,
			rotationDegrees: element.rotationDegrees ?? 0,
			width: element.width
		};
		viewport.setPointerCapture(event.pointerId);
	};

	const beginMediaRotate = (event: PointerEvent, element: WayfindingStudioMediaElement): void => {
		event.preventDefault();
		event.stopPropagation();
		interaction = {
			angle: element.rotationDegrees ?? 0,
			elementId: element.id,
			kind: 'direction',
			moved: false,
			origin: { ...element.point },
			pointerId: event.pointerId,
			property: 'rotationDegrees'
		};
		viewport.setPointerCapture(event.pointerId);
	};

	const beginGraphNodeDrag = (event: PointerEvent, nodeId: string): void => {
		const node = floorGraphNodes().find((candidate) => candidate.id === nodeId);

		if (!node) return;
		event.preventDefault();
		event.stopPropagation();
		props.store.dispatch({ type: 'selection/set', selection: { id: node.id, kind: 'graph-node' } });
		interaction = {
			kind: 'graph-node',
			moved: false,
			nodeId: node.id,
			original: { x: node.x, y: node.y },
			point: { x: node.x, y: node.y },
			pointerId: event.pointerId,
			start: pointInMap(event)
		};
		setInteractionGraphPoint({ x: node.x, y: node.y });
		viewport.setPointerCapture(event.pointerId);
	};

	const beginGraphEdgePointDrag = (
		event: PointerEvent,
		edgeId: string,
		geometryIndex: number
	): void => {
		const geometry = graphEdgePoints(edgeId);

		if (!Number.isInteger(geometryIndex) || !geometry[geometryIndex]) return;
		event.preventDefault();
		event.stopPropagation();
		props.store.dispatch({
			type: 'selection/set',
			selection: { geometryIndex, id: edgeId, kind: 'graph-edge' }
		});
		interaction = {
			geometry: structuredClone(geometry),
			geometryIndex,
			kind: 'graph-edge-point',
			moved: false,
			original: structuredClone(geometry),
			pointerId: event.pointerId,
			routeEdgeId: edgeId,
			start: pointInMap(event)
		};
		setInteractionGraphGeometry(structuredClone(geometry));
		viewport.setPointerCapture(event.pointerId);
	};

	const beginInsertedPolygonVertexDrag = (
		event: PointerEvent,
		point: WayfindingPoint,
		afterIndex: number
	): void => {
		const polygon = selectedPolygon();

		if (!polygon) return;
		event.preventDefault();
		event.stopPropagation();
		const vertexIndex = afterIndex + 1;
		const geometry = insertGeometryPoint(polygon.geometry, afterIndex, point);
		props.store.dispatch({
			type: 'selection/set',
			selection: { id: polygon.id, kind: 'element', vertexIndex }
		});
		interaction = {
			elementId: polygon.id,
			geometry: structuredClone(geometry),
			inserted: true,
			kind: 'polygon',
			moved: false,
			original: structuredClone(geometry),
			pointerId: event.pointerId,
			start: pointInMap(event),
			vertexIndex
		};
		setInteractionGeometry(structuredClone(geometry));
		viewport.setPointerCapture(event.pointerId);
	};

	const beginInsertedGraphPointDrag = (
		event: PointerEvent,
		point: WayfindingPoint,
		edgeId: string,
		afterIndex: number
	): void => {
		const geometryIndex = afterIndex + 1;
		const geometry = insertGeometryPoint(graphEdgePoints(edgeId), afterIndex, point);

		if (geometry.length < 3) return;
		event.preventDefault();
		event.stopPropagation();
		props.store.dispatch({
			type: 'selection/set',
			selection: { geometryIndex, id: edgeId, kind: 'graph-edge' }
		});
		interaction = {
			geometry: structuredClone(geometry),
			geometryIndex,
			inserted: true,
			kind: 'graph-edge-point',
			moved: false,
			original: structuredClone(geometry),
			pointerId: event.pointerId,
			routeEdgeId: edgeId,
			start: pointInMap(event)
		};
		setInteractionGraphGeometry(structuredClone(geometry));
		viewport.setPointerCapture(event.pointerId);
	};

	const insertVertexAtPoint = (point: WayfindingPoint, afterIndex: number): void => {
		const polygon = selectedPolygon();

		if (!polygon) return;
		const geometry = insertGeometryPoint(polygon.geometry, afterIndex, point);
		props.store.dispatch({
			type: 'element/patch',
			elementId: polygon.id,
			patch: { geometry }
		});
		props.store.dispatch({
			type: 'selection/set',
			selection: { id: polygon.id, kind: 'element', vertexIndex: afterIndex + 1 }
		});
	};
	const insertVertex = (event: MouseEvent, afterIndex: number): void => {
		event.preventDefault();
		event.stopPropagation();
		insertVertexAtPoint(pointInMap(event), afterIndex);
	};
	const insertGraphPointAtPoint = (point: WayfindingPoint, edgeId: string, afterIndex: number): void => {
		const geometry = graphEdgePoints(edgeId);

		if (geometry.length < 2) return;
		const nextGeometry = insertGeometryPoint(geometry, afterIndex, point);
		setInteractionGraphGeometry(undefined);
		props.store.dispatch({
			type: 'graph/edge-patch',
			edgeId,
			patch: { geometry: nextGeometry }
		});
		props.store.dispatch({
			type: 'selection/set',
			selection: { geometryIndex: afterIndex + 1, id: edgeId, kind: 'graph-edge' }
		});
	};
	const pointerDown = createCanvasPointerDownHandler({
		beginElementDrag,
		beginGraphEdgePointDrag,
		beginGraphNodeDrag,
		beginVertexDrag,
		camera,
		createPointElement,
		createRouteNode: (point) => {
			const nodeId = nextId('route-node');

			props.store.dispatch({
				type: 'graph/node-add',
				node: { id: nodeId, kind: 'route', levelId: floor().id, ...point }
			});
			props.store.dispatch({
				type: 'selection/set',
				selection: { id: nodeId, kind: 'graph-node' }
			});
			props.store.dispatch({ type: 'tool/set', tool: 'select' });
		},
		draft,
		findElement: (elementId) =>
			floorElements().find((candidate) => candidate.id === elementId),
		graphEdgePoints,
		insertGraphPoint: insertGraphPointAtPoint,
		keyboard,
		mapPoint: pointInMap,
		onPreviewDestinationSelect: (destinationId) => props.onPreviewDestinationSelect?.(destinationId),
		routeGraphInteractive,
		routeWorkspaceView,
		selectedPolygon,
		setDraftCursor,
		setFreehandGeometry,
		setInteraction: (nextInteraction) => {
			interaction = nextInteraction;
		},
		snapFreehandPoint,
		snapshot: () => props.snapshot(),
		store,
		traceRegion,
		viewportPoint: pointInViewport
	});
	const polygonDraft = createMemo(() => {
		const current = draft();

		return current?.kind === 'polygon' ? current : undefined;
	});
	const routeDraft = createMemo(() => {
		const current = draft();

		return current?.kind === 'route-edge' ? current : undefined;
	});
	const selectedVertexIndex = createMemo(() => {
		const selection = props.snapshot().state.selection;

		return selection?.kind === 'element' ? selection.vertexIndex : undefined;
	});

	onCleanup(() => {
		interaction = undefined;
		window.removeEventListener('keydown', keyboard.keyDown);
		window.removeEventListener('keyup', keyboard.keyUp);
	});

	return (
		<div
			class="canvas-viewport"
			classList={{
				'is-authoring': props.snapshot().state.activeTool === 'smart-trace'
					|| props.snapshot().state.activeTool === 'freehand'
					|| POLYGON_TOOLS.has(props.snapshot().state.activeTool)
					|| POINT_TOOLS.has(props.snapshot().state.activeTool),
				'is-panning': interaction?.kind === 'pan',
				'is-selecting': props.snapshot().state.activeTool === 'select'
			}}
			data-active-tool={props.snapshot().state.activeTool}
			data-selection-geometry-index={selectedGraphGeometryIndex()}
			data-selected-edge-geometry-length={selectedGraphEdge()?.geometry?.length ?? 0}
			data-selection-id={props.snapshot().state.selection?.id}
			data-selection-kind={props.snapshot().state.selection?.kind}
			ref={viewport}
			tabIndex={0}
			onDblClick={finishDraft}
			onPointerDown={pointerDown}
			onPointerLeave={(): void => { if (!interaction) setDraftCursor(undefined); }}
			onPointerMove={dragController.pointerMove}
			onPointerUp={dragController.pointerUp}
			onPointerCancel={dragController.pointerUp}
			onWheel={wheel}
		>
			<CanvasScene
				beginDirectionDrag={beginDirectionDrag}
				activateVisitorDestination={(destinationId) => props.onPreviewDestinationSelect?.(destinationId)}
				beginElementDrag={beginElementDrag}
				beginGraphEdgePointDrag={beginGraphEdgePointDrag}
				beginGraphNodeDrag={beginGraphNodeDrag}
				beginInsertedGraphPointDrag={beginInsertedGraphPointDrag}
				beginInsertedPolygonVertexDrag={beginInsertedPolygonVertexDrag}
				beginMediaResize={beginMediaResize}
				beginMediaRotate={beginMediaRotate}
				beginVertexDrag={beginVertexDrag}
				camera={camera}
				draft={draft}
				draftCursor={draftCursor}
				elements={floorElements}
				floor={floor}
				floorGraphEdges={floorGraphEdges}
				floorGraphNodes={floorGraphNodes}
				graphEdgePoints={graphEdgePoints}
				handleRadius={handleRadius}
				insertVertex={insertVertex}
				interactionGeometry={interactionGeometry}
				interactionGraphPoint={interactionGraphPoint}
				freehandGeometry={freehandGeometry}
				polygonDraft={polygonDraft}
				renderedSvg={renderedSvg}
				route={route}
				routeDraft={routeDraft}
				routeWorkspaceView={routeWorkspaceView}
				selectedGraphEdge={selectedGraphEdge}
				selectedGraphGeometry={selectedGraphGeometry}
				selectedGraphGeometryIndex={selectedGraphGeometryIndex}
				selectedGraphNode={selectedGraphNode}
				selectedElement={selectedElementPreview}
				selectedPoint={selectedPoint}
				selectedPolygon={selectedPolygon}
				selectedPolygonGeometry={selectedPolygonGeometry}
				selectedVertexIndex={selectedVertexIndex}
				selectElement={selectElement}
				showRouteNetwork={props.showRouteNetwork}
				snapshot={props.snapshot}
				visitorLabelPlacements={visitorLabelPlacements}
				visitorMapItems={visitorMapItems}
			/>
			<Show when={draft()}>
				<div class="draft-hint">
					<strong>{draft()?.kind === 'polygon' ? 'Drawing area' : 'Drawing route'}</strong>
					<span>Click to add points. Hold Shift for 45°. Enter or double-click to finish. Esc cancels.</span>
				</div>
			</Show>
		</div>
	);
};
