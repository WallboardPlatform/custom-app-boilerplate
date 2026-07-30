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
	type WayfindingStudioOriginElement,
	type WayfindingStudioPolygonElement
} from '../../studio-project.mts';
import type {
	EditorDraft,
	EditorSnapshot,
	EditorStore,
	EditorTool
} from '../../editor-core/types';
import type { WayfindingPoint } from '../../../../src/utils/wayfinding.js';
import {
	floorRoutePoints,
	routeToDestination,
	type VisitorRouteProfile
} from './route';
import {
	type DragInteraction,
	isEditableTarget,
	POINT_TOOLS,
	POLYGON_TOOLS,
	polygonTypeForTool,
	toolFromShortcut
} from './canvas/interaction';
import {
	appendFreehandPoint,
	simplifyFreehandPolygon
} from './canvas/freehand';
import {
	constrainPointToAngle,
	insertGeometryPoint,
	moveGraphNodeTransaction,
	nearestSegment,
	pointerMoved,
	translateGeometry,
	translatePoint
} from './canvas/editing';
import { CanvasScene } from './canvas/CanvasScene';
import {
	edgeGeometry,
	type FloorPresentationMode,
	isPointElement,
	isPolygonElement,
	renderEditorFloorSvg
} from './canvas/model';
import {
	detectFlatRegionBoundary,
	type RegionDetectionSource
} from './canvas/regionDetection';
import { snapPointToSourceEdge } from './canvas/source-edge-snap';
import {
	buildCanvasSelectionOperation,
	describeCanvasSelection,
	type CanvasSelectionOperation,
	type CanvasSelectionDescriptor
} from './canvas/selection-controller';
import {
	buildPointAuthoring,
	buildPolygonAuthoring,
	buildRouteEdgeAuthoring,
	createAuthoringId,
	sampleSourceColor
} from './canvas/authoring';
import {
	buildVisitorMapItems,
	layoutVisitorMapLabels
} from './visitor-map';
import { useCanvasCamera } from './canvas/useCanvasCamera';
import {
	isCanvasElementInteractive,
	isRouteGraphInteractive,
	isRouteToolAvailable,
	type RouteWorkspaceView
} from './route-workspace';

interface Canvas2dProps {
	onNotify?: (message: string, tone?: 'danger' | 'info' | 'success' | 'warning') => void;
	onPointerCoordinate?: (point: WayfindingPoint) => void;
	onPreviewDestinationSelect?: (destinationId: string | undefined) => void;
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

interface ElementInteractionPreview {
	elementId: string;
	patch: Partial<WayfindingStudioElement>;
}

const nextId = createAuthoringId;

const rotateAround = (
	point: WayfindingPoint,
	origin: WayfindingPoint,
	degrees: number
): WayfindingPoint => {
	const radians = degrees * Math.PI / 180;
	const cosine = Math.cos(radians);
	const sine = Math.sin(radians);
	const deltaX = point.x - origin.x;
	const deltaY = point.y - origin.y;

	return {
		x: origin.x + deltaX * cosine - deltaY * sine,
		y: origin.y + deltaX * sine + deltaY * cosine
	};
};

export const Canvas2d = (props: Canvas2dProps): JSX.Element => {
	let viewport!: HTMLDivElement;
	let interaction: DragInteraction | undefined;
	const store = untrack(() => props.store);
	let lastRouteEdgeClick: {
		edgeId: string;
		point: WayfindingPoint;
		time: number;
	} | undefined;
	let spaceHeld = false;
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
	const cameraController = useCanvasCamera({
		floor,
		getViewport: () => viewport,
		registerFit: (fit): void => props.registerFit(fit),
		snapshot: () => props.snapshot(),
		store
	});
	const camera = cameraController.camera;
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
	const snapFreehandPoint = (point: WayfindingPoint): WayfindingPoint => {
		const source = traceSource();
		const drawing = props.snapshot().state.drawing;

		if (!source || !drawing.snapToSourceEdges) return point;

		return snapPointToSourceEdge({
			mapHeight: floor().height,
			mapWidth: floor().width,
			point,
			radius: drawing.snapRadius,
			source
		});
	};

	const inheritedColorForGeometry = (geometry: WayfindingPoint[]): string | undefined => {
		const center = geometry.reduce(
			(sum, point) => ({
				x: sum.x + point.x / geometry.length,
				y: sum.y + point.y / geometry.length
			}),
			{ x: 0, y: 0 }
		);
		const source = traceSource();
		const sourcePoint = source
			? {
				x: center.x * source.width / floor().width,
				y: center.y * source.height / floor().height
			}
			: center;

		return sampleSourceColor(source, sourcePoint);
	};

	const addPolygon = (
		elementType: WayfindingStudioPolygonElement['type'],
		geometry: WayfindingPoint[],
		detectedColor?: string,
		label = `Create ${elementType}`
	): void => {
		const authoringSnapshot = props.snapshot();
		const result = buildPolygonAuthoring({
			defaults: defaults(),
			detectedColor,
			elementType,
			floorId: floor().id,
			geometry,
			inheritedColor: inheritedColorForGeometry(geometry),
			label,
			project: authoringSnapshot.state.project,
			selectedDestinationId: authoringSnapshot.state.selection?.kind === 'destination'
				? authoringSnapshot.state.selection.id
				: undefined
		});

		props.store.run(result.transaction);
		props.store.dispatch({ type: 'selection/set', selection: result.selection });
		props.store.dispatch({ type: 'tool/set', tool: 'select' });
	};

	const finishPolygonDraft = (): void => {
		const currentDraft = draft();

		if (currentDraft?.kind !== 'polygon' || currentDraft.points.length < 3) return;
		addPolygon(currentDraft.elementType, currentDraft.points);
		props.store.dispatch({ type: 'draft/clear' });
	};

	const traceRegion = (mapPoint: WayfindingPoint): void => {
		const source = traceSource();

		if (!source) {
			props.onNotify?.('Add a floor background image before using Smart trace.', 'warning');

			return;
		}
		const trace = props.snapshot().state.trace;
		const imagePoint = {
			x: mapPoint.x * source.width / floor().width,
			y: mapPoint.y * source.height / floor().height
		};
		const detected = detectFlatRegionBoundary(source, imagePoint, trace);

		if (!detected) {
			props.onNotify?.(
				'No closed region was found here. Try a lower color range, adjust gap handling, or draw the area manually.',
				'warning'
			);

			return;
		}
		const geometry = detected.geometry.map((point) => ({
			x: point.x * floor().width / source.width,
			y: point.y * floor().height / source.height
		}));

		addPolygon(trace.elementType, geometry, detected.color, `Smart trace ${trace.elementType}`);
		props.onNotify?.(
			`${trace.elementType === 'location' ? 'Room' : trace.elementType === 'walkable' ? 'Walkable area' : 'Blocked area'} traced. Review its outline before continuing.`,
			'success'
		);
	};

	const finishRouteDraft = (): void => {
		const currentDraft = draft();

		if (currentDraft?.kind !== 'route-edge' || currentDraft.points.length < 2) return;
		const result = buildRouteEdgeAuthoring({
			cameraScale: camera().scale,
			floorId: floor().id,
			nodes: floorGraphNodes(),
			points: currentDraft.points
		});

		if (!result) return;
		props.store.run(result.transaction);
		props.store.dispatch({ type: 'draft/clear' });
		props.store.dispatch({ type: 'selection/set', selection: result.selection });
		props.store.dispatch({ type: 'tool/set', tool: 'select' });
	};

	const createPointElement = (tool: EditorTool, point: WayfindingPoint): void => {
		const snapshot = props.snapshot();
		const selected = snapshot.state.selection;
		const activeAsset = snapshot.state.project.assets.find(
			(candidate) => candidate.id === snapshot.state.activeAssetId
		);
		const result = buildPointAuthoring({
			activeAsset,
			defaults: defaults(),
			destinationCount: snapshot.state.project.destinations.length,
			floorId: floor().id,
			point,
			selectedDestinationId: selected?.kind === 'destination' ? selected.id : undefined,
			tool
		});

		if (!result) return;
		props.store.run(result.transaction);
		props.store.dispatch({ type: 'selection/set', selection: result.selection });
		props.store.dispatch({ type: 'tool/set', tool: 'select' });
	};

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

	const keyDown = (event: KeyboardEvent): void => {
		if (isEditableTarget(event.target)) return;

		if (event.code === 'Space') {
			spaceHeld = true;
			event.preventDefault();

			return;
		}

		if (event.key === 'Escape') {
			props.store.dispatch({ type: 'draft/clear' });
			setFreehandGeometry(undefined);
			setInteractionGeometry(undefined);
			setInteractionGraphGeometry(undefined);
			setInteractionGraphPoint(undefined);
			setInteractionElementPreview(undefined);
			interaction = undefined;

			return;
		}

		if (event.key === 'Enter') {
			if (draft()?.kind === 'polygon') finishPolygonDraft();

			if (draft()?.kind === 'route-edge') finishRouteDraft();

			return;
		}

		if (event.key === 'Delete' || event.key === 'Backspace') {
			event.preventDefault();
			const selection = props.snapshot().state.selection;
			const hasSelectedPoint = (
				selection?.kind === 'element' && selection.vertexIndex !== undefined
			) || (
				selection?.kind === 'graph-edge' && selection.geometryIndex !== undefined
			);

			if (hasSelectedPoint) {
				if (!removeSelectionPoint()) {
					props.onNotify?.(
						selection?.kind === 'graph-edge'
							? 'Route endpoints belong to their route points and cannot be removed.'
							: 'A room or area outline needs at least three points.',
						'warning'
					);
				}

				return;
			}
			removeSelection();

			return;
		}

		if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'd') {
			if (duplicateSelection()) event.preventDefault();

			return;
		}

		if (event.key.startsWith('Arrow')) {
			const distance = event.shiftKey ? 10 : 1;
			const delta = event.key === 'ArrowLeft'
				? { x: -distance, y: 0 }
				: event.key === 'ArrowRight'
					? { x: distance, y: 0 }
					: event.key === 'ArrowUp'
						? { x: 0, y: -distance }
						: { x: 0, y: distance };

			if (nudgeSelection(delta)) event.preventDefault();

			return;
		}

		const tool = toolFromShortcut(
			event.key.toLocaleLowerCase(),
			props.snapshot().state.workspace === 'route-edit'
		);

		const toolAvailable = tool && (
			props.snapshot().state.workspace !== 'route-edit'
			|| isRouteToolAvailable(routeWorkspaceView(), tool)
		);

		if (tool && toolAvailable && !event.ctrlKey && !event.metaKey && !event.altKey) {
			props.store.dispatch({ type: 'tool/set', tool });
		}
	};

	const keyUp = (event: KeyboardEvent): void => {
		if (event.code === 'Space') spaceHeld = false;
	};

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
		window.addEventListener('keydown', keyDown);
		window.addEventListener('keyup', keyUp);
	});

	const pointerDown: JSX.EventHandler<HTMLDivElement, PointerEvent> = (event): void => {
		const state = props.snapshot().state;
		const tool = state.activeTool;
		const target = event.target instanceof Element ? event.target : undefined;
		const mapPoint = pointInMap(event);

		viewport.focus({ preventScroll: true });

		if (event.button === 1 || spaceHeld || tool === 'pan') {
			event.preventDefault();
			interaction = {
				cameraStart: { ...camera() },
				kind: 'pan',
				pointerId: event.pointerId,
				start: pointInViewport(event)
			};
			viewport.setPointerCapture(event.pointerId);

			return;
		}

		if (event.button !== 0) return;

		if (
			tool === 'smart-trace'
			&& (
				state.workspace === 'map'
				|| (state.workspace === 'route-edit' && routeWorkspaceView() === 'space')
			)
		) {
			traceRegion(mapPoint);

			return;
		}

		if (
			tool === 'freehand'
			&& (
				state.workspace === 'map'
				|| (state.workspace === 'route-edit' && routeWorkspaceView() === 'space')
			)
		) {
			event.preventDefault();
			const elementType: WayfindingStudioPolygonElement['type'] = state.workspace === 'route-edit'
				? 'walkable'
				: 'location';
			interaction = {
				elementType,
				kind: 'freehand',
				pointerId: event.pointerId,
				points: [snapFreehandPoint(mapPoint)]
			};
			setFreehandGeometry(interaction.points);
			viewport.setPointerCapture(event.pointerId);

			return;
		}

		if (
			POLYGON_TOOLS.has(tool)
			&& (
				state.workspace === 'map'
				|| (
					state.workspace === 'route-edit'
					&& routeWorkspaceView() === 'space'
					&& (tool === 'walkable' || tool === 'obstacle')
				)
			)
		) {
			if (event.detail > 1) return;
			const elementType = polygonTypeForTool(tool);

			if (!elementType) return;
			const activeDraft = draft();
			const currentDraft: Extract<EditorDraft, { kind: 'polygon' }> = activeDraft?.kind === 'polygon' && activeDraft.elementType === elementType
				? activeDraft
				: { elementType, kind: 'polygon', points: [] };
			const point = event.shiftKey && currentDraft.points.length > 0
				? constrainPointToAngle(currentDraft.points.at(-1)!, mapPoint)
				: mapPoint;
			props.store.dispatch({
				type: 'draft/set',
				draft: { ...currentDraft, points: [...currentDraft.points, point] }
			});
			setDraftCursor(point);

			return;
		}

		if (POINT_TOOLS.has(tool) && state.workspace === 'map') {
			createPointElement(tool, mapPoint);

			return;
		}

		if (tool === 'route-node' && routeGraphInteractive()) {
			const nodeId = nextId('route-node');
			props.store.dispatch({
				type: 'graph/node-add',
				node: { id: nodeId, kind: 'route', levelId: floor().id, ...mapPoint }
			});
			props.store.dispatch({ type: 'selection/set', selection: { id: nodeId, kind: 'graph-node' } });
			props.store.dispatch({ type: 'tool/set', tool: 'select' });

			return;
		}

		if (tool === 'route-edge' && routeGraphInteractive()) {
			if (event.detail > 1) return;
			const currentDraft: EditorDraft = draft()?.kind === 'route-edge'
				? draft()!
				: { kind: 'route-edge', points: [] };
			const point = event.shiftKey && currentDraft.points.length > 0
				? constrainPointToAngle(currentDraft.points.at(-1)!, mapPoint)
				: mapPoint;
			props.store.dispatch({
				type: 'draft/set',
				draft: { ...currentDraft, points: [...currentDraft.points, point] }
			});
			setDraftCursor(point);

			return;
		}

		if (routeGraphInteractive() && tool === 'select') {
			const graphNodeTarget = target?.closest('[data-route-node-id]');
			const graphEdgePointTarget = target?.closest('[data-route-edge-point]');
			const graphEdgeTarget = target?.closest('[data-route-edge-id]');

			if (graphNodeTarget) {
				const nodeId = graphNodeTarget.getAttribute('data-route-node-id');
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
					start: mapPoint
				};
				setInteractionGraphPoint({ x: node.x, y: node.y });
				viewport.setPointerCapture(event.pointerId);

				return;
			}

			if (graphEdgePointTarget) {
				const edgeId = graphEdgePointTarget.getAttribute('data-route-edge-point');
				const geometryIndex = Number(graphEdgePointTarget.getAttribute('data-geometry-index'));
				const geometry = edgeId ? graphEdgePoints(edgeId) : [];

				if (!edgeId || !Number.isInteger(geometryIndex) || !geometry[geometryIndex]) return;
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
					start: mapPoint
				};
				setInteractionGraphGeometry(structuredClone(geometry));
				viewport.setPointerCapture(event.pointerId);

				return;
			}

			if (graphEdgeTarget) {
				const edgeId = graphEdgeTarget.getAttribute('data-route-edge-id');

				if (!edgeId) return;
				const geometry = graphEdgePoints(edgeId);
				const nearest = nearestSegment(geometry, mapPoint, false);

				const now = performance.now();
				const isClickPair = lastRouteEdgeClick?.edgeId === edgeId
					&& now - lastRouteEdgeClick.time <= 420
					&& Math.hypot(
						mapPoint.x - lastRouteEdgeClick.point.x,
						mapPoint.y - lastRouteEdgeClick.point.y
					) <= 14 / camera().scale;
				lastRouteEdgeClick = { edgeId, point: mapPoint, time: now };

				if (isClickPair && nearest && nearest.distance <= 14 / camera().scale) {
					event.preventDefault();
					event.stopPropagation();
					lastRouteEdgeClick = undefined;
					insertGraphPointAtPoint(mapPoint, edgeId, nearest.index);

					return;
				}
				event.preventDefault();
				event.stopPropagation();
				props.store.dispatch({ type: 'selection/set', selection: { id: edgeId, kind: 'graph-edge' } });

				return;
			}
		}

		const polygonVertexTarget = target?.closest('[data-polygon-vertex-index]');

		if (
			(state.workspace === 'map' || state.workspace === 'route-edit')
			&& tool === 'select'
			&& polygonVertexTarget
			&& selectedPolygon()
			&& isCanvasElementInteractive(
				state.workspace,
				routeWorkspaceView(),
				selectedPolygon()!.type
			)
		) {
			const vertexIndex = Number(polygonVertexTarget.getAttribute('data-polygon-vertex-index'));

			if (!Number.isInteger(vertexIndex)) return;
			beginVertexDrag(event, vertexIndex);

			return;
		}

		const elementTarget = target?.closest('[data-editor-element-id], [data-wayfinding-level]');
		const visitorDestinationTarget = target?.closest('[data-visitor-destination-id]');

		if (state.workspace === 'preview') {
			const destinationId = visitorDestinationTarget?.getAttribute('data-visitor-destination-id');

			if (destinationId) {
				event.preventDefault();
				event.stopPropagation();
				props.store.dispatch({
					type: 'selection/set',
					selection: { id: destinationId, kind: 'destination' }
				});
				props.onPreviewDestinationSelect?.(destinationId);
			} else if (!spaceHeld) {
				props.store.dispatch({ type: 'selection/clear' });
				props.onPreviewDestinationSelect?.(undefined);
			}

			return;
		}

		if (
			elementTarget
			&& tool === 'select'
			&& (state.workspace === 'map' || state.workspace === 'route-edit')
		) {
			const elementId = elementTarget.getAttribute('data-editor-element-id') || elementTarget.id;
			const element = floorElements().find((candidate) => candidate.id === elementId);

			if (!element) return;

			if (!isCanvasElementInteractive(state.workspace, routeWorkspaceView(), element.type)) return;
			props.store.dispatch({ type: 'selection/set', selection: { id: element.id, kind: 'element' } });

			if (isPolygonElement(element)) {
				interaction = {
					elementId: element.id,
					geometry: structuredClone(element.geometry),
					kind: 'polygon',
					moved: false,
					original: structuredClone(element.geometry),
					pointerId: event.pointerId,
					start: mapPoint
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
					start: mapPoint
				};
				viewport.setPointerCapture(event.pointerId);
			}

			return;
		}

		if (tool === 'select' && selectedPolygon() && target?.closest('.authoring-overlay')) {
			return;
		}

		if (tool === 'select') props.store.dispatch({ type: 'selection/clear' });
	};

	const pointerMove: JSX.EventHandler<HTMLDivElement, PointerEvent> = (event): void => {
		const point = pointInViewport(event);
		const mapPoint = pointInMap(event);
		props.onPointerCoordinate?.(mapPoint);
		const activeDraft = draft();
		const previousDraftPoint = activeDraft?.points.at(-1);

		setDraftCursor(activeDraft && previousDraftPoint
			? event.shiftKey
				? constrainPointToAngle(previousDraftPoint, mapPoint)
				: mapPoint
			: undefined);

		if (!interaction) return;

		if (interaction.kind === 'pan') {
			props.store.dispatch({
				type: 'camera/set',
				floorId: floor().id,
				camera: {
					...interaction.cameraStart,
					offsetX: interaction.cameraStart.offsetX + point.x - interaction.start.x,
					offsetY: interaction.cameraStart.offsetY + point.y - interaction.start.y
				}
			});

			return;
		}

		if (interaction.kind === 'freehand') {
			const snappedPoint = snapFreehandPoint(mapPoint);
			interaction.points = appendFreehandPoint(
				interaction.points,
				snappedPoint,
				Math.max(1.5, 4 / camera().scale)
			);
			setFreehandGeometry(interaction.points);

			return;
		}

		if (interaction.kind === 'point') {
			if (!interaction.moved && !pointerMoved(interaction.start, mapPoint, camera().scale)) return;
			interaction.point = translatePoint(
				interaction.original,
				interaction.start,
				mapPoint,
				floor().width,
				floor().height
			);
			interaction.moved = true;
			setInteractionElementPreview({
				elementId: interaction.elementId,
				patch: { point: interaction.point }
			});

			return;
		}

		if (interaction.kind === 'direction') {
			const deltaX = mapPoint.x - interaction.origin.x;
			const deltaY = mapPoint.y - interaction.origin.y;
			const angle = interaction.property === 'angle'
				? Math.atan2(deltaY, deltaX) * 180 / Math.PI
				: Math.atan2(deltaX, -deltaY) * 180 / Math.PI;
			interaction.angle = event.shiftKey ? Math.round(angle / 15) * 15 : angle;
			interaction.moved = true;
			setInteractionElementPreview({
				elementId: interaction.elementId,
				patch: { [interaction.property]: interaction.angle }
			});

			return;
		}

		if (interaction.kind === 'media-resize') {
			const localPoint = rotateAround(mapPoint, interaction.origin, -interaction.rotationDegrees);
			const rawHalfWidth = Math.max(1, Math.abs(localPoint.x - interaction.origin.x));
			const rawHalfHeight = Math.max(1, Math.abs(localPoint.y - interaction.origin.y));
			const currentWidth = interaction.originalWidth;
			const currentHeight = interaction.originalHeight;
			const scale = Math.max(
				rawHalfWidth / Math.max(1, currentWidth / 2),
				rawHalfHeight / Math.max(1, currentHeight / 2),
				12 / Math.max(1, Math.min(currentWidth, currentHeight))
			);
			const maxWidth = Math.max(12, 2 * Math.min(interaction.origin.x, floor().width - interaction.origin.x));
			const maxHeight = Math.max(12, 2 * Math.min(interaction.origin.y, floor().height - interaction.origin.y));
			const boundedScale = Math.min(
				scale,
				maxWidth / Math.max(1, currentWidth),
				maxHeight / Math.max(1, currentHeight)
			);
			interaction.width = currentWidth * boundedScale;
			interaction.height = interaction.width / interaction.aspectRatio;
			interaction.moved = true;
			setInteractionElementPreview({
				elementId: interaction.elementId,
				patch: {
					height: interaction.height,
					width: interaction.width
				}
			});

			return;
		}

		if (interaction.kind === 'graph-node') {
			if (!interaction.moved && !pointerMoved(interaction.start, mapPoint, camera().scale)) return;
			interaction.point = translatePoint(
				interaction.original,
				interaction.start,
				mapPoint,
				floor().width,
				floor().height
			);
			interaction.moved = true;
			setInteractionGraphPoint(interaction.point);

			return;
		}

		if (interaction.kind === 'graph-edge-point') {
			const currentInteraction = interaction;

			if (!currentInteraction.moved && !pointerMoved(currentInteraction.start, mapPoint, camera().scale)) return;
			currentInteraction.geometry = translateGeometry(
				currentInteraction.original,
				currentInteraction.start,
				mapPoint,
				floor().width,
				floor().height,
				currentInteraction.geometryIndex
			);
			currentInteraction.moved = true;
			setInteractionGraphGeometry(currentInteraction.geometry);

			return;
		}

		if (!interaction.moved && !pointerMoved(interaction.start, mapPoint, camera().scale)) return;
		const geometry = translateGeometry(
			interaction.original,
			interaction.start,
			mapPoint,
			floor().width,
			floor().height,
			interaction.vertexIndex
		);
		interaction.geometry = geometry;
		interaction.moved = true;
		setInteractionGeometry(geometry);
	};

	const pointerUp = (): void => {
		if (interaction?.kind === 'freehand') {
			const geometry = simplifyFreehandPolygon(
				interaction.points,
				Math.max(1, 3 / camera().scale)
			);

			if (geometry.length >= 3) {
				addPolygon(interaction.elementType, geometry, undefined, `Freehand ${interaction.elementType}`);
			} else {
				props.onNotify?.('Draw a larger closed area before releasing the pointer.', 'warning');
			}
		}

		if (interaction?.kind === 'polygon' && (interaction.moved || interaction.inserted)) {
			props.store.dispatch({
				type: 'element/patch',
				elementId: interaction.elementId,
				patch: { geometry: interaction.geometry }
			});
		}

		if (interaction?.kind === 'point' && interaction.moved) {
			props.store.dispatch({
				type: 'element/patch',
				elementId: interaction.elementId,
				patch: { point: interaction.point }
			});
		}

		if (interaction?.kind === 'direction' && interaction.moved) {
			props.store.dispatch({
				type: 'element/patch',
				elementId: interaction.elementId,
				patch: { [interaction.property]: interaction.angle }
			});
		}

		if (interaction?.kind === 'media-resize' && interaction.moved) {
			props.store.dispatch({
				type: 'element/patch',
				elementId: interaction.elementId,
				patch: {
					height: interaction.height,
					width: interaction.width
				}
			});
		}

		if (interaction?.kind === 'graph-edge-point' && (interaction.moved || interaction.inserted)) {
			const currentInteraction = interaction;

			props.store.dispatch({
				type: 'graph/edge-patch',
				edgeId: currentInteraction.routeEdgeId,
				patch: { geometry: currentInteraction.geometry }
			});
			props.store.dispatch({
				type: 'selection/set',
				selection: {
					geometryIndex: currentInteraction.geometryIndex,
					id: currentInteraction.routeEdgeId,
					kind: 'graph-edge'
				}
			});
		}

		if (interaction?.kind === 'graph-node' && interaction.moved) {
			const currentInteraction = interaction;
			props.store.run(moveGraphNodeTransaction(
				currentInteraction.nodeId,
				currentInteraction.point,
				floorGraphNodes(),
				floorGraphEdges()
			));
		}
		interaction = undefined;
		setFreehandGeometry(undefined);
		setInteractionGeometry(undefined);
		setInteractionGraphGeometry(undefined);
		setInteractionGraphPoint(undefined);
		setInteractionElementPreview(undefined);
	};

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
		window.removeEventListener('keydown', keyDown);
		window.removeEventListener('keyup', keyUp);
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
			onPointerMove={pointerMove}
			onPointerUp={pointerUp}
			onPointerCancel={pointerUp}
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
