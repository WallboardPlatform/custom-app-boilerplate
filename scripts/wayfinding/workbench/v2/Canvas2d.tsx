import {
	createEffect,
	createMemo,
	createSignal,
	For,
	onCleanup,
	onMount,
	Show,
	type Accessor,
	type JSX
} from 'solid-js';
import {
	renderWayfindingFloorSvg,
	wayfindingStudioProjectDefaults,
	type WayfindingStudioElement,
	type WayfindingStudioPolygonElement
} from '../../studio-project.mts';
import { cameraForFloor } from '../../editor-core/commands';
import type {
	EditorCommand,
	EditorDraft,
	EditorSnapshot,
	EditorStore,
	EditorTool
} from '../../editor-core/types';
import type {
	WayfindingNode,
	WayfindingPoint
} from '../../../../src/utils/wayfinding.js';
import {
	floorRoutePoints,
	routePolyline,
	routeToDestination
} from './route';

interface Canvas2dProps {
	onPointerCoordinate?: (point: WayfindingPoint) => void;
	registerFit: (fit: () => void) => void;
	snapshot: Accessor<EditorSnapshot>;
	store: EditorStore;
}

type PointerLikeEvent = MouseEvent | PointerEvent | WheelEvent;
type DragInteraction =
	| {
		cameraStart: { offsetX: number; offsetY: number; scale: number };
		kind: 'pan';
		pointerId: number;
		start: WayfindingPoint;
	}
	| {
		elementId: string;
		kind: 'point';
		moved: boolean;
		original: WayfindingPoint;
		point: WayfindingPoint;
		pointerId: number;
		start: WayfindingPoint;
	}
	| {
		elementId: string;
		geometry: WayfindingPoint[];
		kind: 'polygon';
		moved: boolean;
		original: WayfindingPoint[];
		pointerId: number;
		start: WayfindingPoint;
		vertexIndex?: number;
	}
	| {
		geometry: WayfindingPoint[];
		geometryIndex: number;
		kind: 'graph-edge-point';
		moved: boolean;
		original: WayfindingPoint[];
		pointerId: number;
		routeEdgeId: string;
		start: WayfindingPoint;
	}
	| {
		kind: 'graph-node';
		moved: boolean;
		nodeId: string;
		original: WayfindingPoint;
		point: WayfindingPoint;
		pointerId: number;
		start: WayfindingPoint;
	};

const visibleGroupByLayer: Record<string, string> = {
	background: 'Background',
	door: 'Doors',
	icon: 'Icons',
	label: 'Labels',
	location: 'Locations',
	logo: 'Logos',
	obstacle: 'Obstacles',
	origin: 'Origins',
	poi: 'POIs',
	transition: 'Transitions',
	walkable: 'Walkable'
};

const polygonTools = new Set<EditorTool>(['location', 'walkable', 'obstacle']);
const pointTools = new Set<EditorTool>(['door', 'poi', 'origin', 'transition', 'label', 'icon', 'logo']);
const escaped = (value: string): string => value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
const pointString = (points: WayfindingPoint[]): string => points.map((point) => `${point.x},${point.y}`).join(' ');
const isPolygonElement = (element: WayfindingStudioElement | undefined): element is WayfindingStudioPolygonElement =>
	element?.type === 'location' || element?.type === 'walkable' || element?.type === 'obstacle';
const isPointElement = (
	element: WayfindingStudioElement | undefined
): element is Exclude<WayfindingStudioElement, WayfindingStudioPolygonElement> =>
	Boolean(element && 'point' in element);
const distanceToSegment = (
	point: WayfindingPoint,
	start: WayfindingPoint,
	end: WayfindingPoint
): number => {
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	const lengthSquared = dx * dx + dy * dy;

	if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);
	const projection = Math.max(0, Math.min(
		1,
		((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
	));

	return Math.hypot(
		point.x - (start.x + projection * dx),
		point.y - (start.y + projection * dy)
	);
};
const isEditableTarget = (target: EventTarget | null): boolean =>
	target instanceof HTMLElement
	&& (target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName));

let generatedId = 0;
const nextId = (prefix: string): string => {
	generatedId += 1;

	return `${prefix}-${Date.now().toString(36)}-${generatedId}`;
};

export const Canvas2d = (props: Canvas2dProps): JSX.Element => {
	let viewport!: HTMLDivElement;
	let interaction: DragInteraction | undefined;
	let spaceHeld = false;
	const [interactionGeometry, setInteractionGeometry] = createSignal<WayfindingPoint[]>();
	const [interactionGraphGeometry, setInteractionGraphGeometry] = createSignal<WayfindingPoint[]>();
	const [interactionGraphPoint, setInteractionGraphPoint] = createSignal<WayfindingPoint>();
	const currentFloorId = createMemo(() => props.snapshot().state.currentFloorId);
	const floor = createMemo(() => props.snapshot().state.project.floors.find(
		(candidate) => candidate.id === currentFloorId()
	) ?? props.snapshot().state.project.floors[0]);
	const camera = createMemo(() => cameraForFloor(props.snapshot().state, floor().id));
	const floorElements = createMemo(() => floor().elements);
	const selectedElement = createMemo(() => {
		const selection = props.snapshot().state.selection;

		return selection?.kind === 'element'
			? floorElements().find((element) => element.id === selection.id)
			: undefined;
	});
	const selectedPolygon = createMemo(() => {
		const element = selectedElement();

		return isPolygonElement(element) ? element : undefined;
	});
	const selectedPolygonGeometry = createMemo(() => interactionGeometry() ?? selectedPolygon()?.geometry ?? []);
	const selectedPoint = createMemo(() => {
		const element = selectedElement();

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

		if (!edge) return [];
		const from = floorGraphNodes().find((node) => node.id === edge.from);
		const to = floorGraphNodes().find((node) => node.id === edge.to);

		if (!from || !to) return [];

		return edge.geometry?.length ? edge.geometry : [from, to];
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
			selectedDestinationId()
		),
		floor().id
	));
	const renderedSvg = createMemo(() => {
		const state = props.snapshot().state;
		const hiddenRules: string[] = [];

		for (const [layer, group] of Object.entries(visibleGroupByLayer)) {
			if (!state.layerVisibility[layer as keyof typeof state.layerVisibility]) hiddenRules.push(`#${group}{display:none}`);
		}

		if (state.selection?.kind === 'element') {
			hiddenRules.push(`[id="${escaped(state.selection.id)}"]{filter:drop-shadow(0 0 5px #15927d);stroke:#15927d;stroke-width:5}`);

			if (interactionGeometry()) hiddenRules.push(`[id="${escaped(state.selection.id)}"]{visibility:hidden}`);
		}
		const source: string = renderWayfindingFloorSvg(state.project, floor().id);

		return source.replace('>', `><style>${hiddenRules.join('')}</style>`);
	});
	const draft = createMemo(() => props.snapshot().state.draft);
	const handleRadius = createMemo(() => Math.max(4, 7 / camera().scale));
	const defaults = createMemo(() => wayfindingStudioProjectDefaults(props.snapshot().state.project));

	const fit = (): void => {
		if (!viewport || !floor()) return;
		const padding = 72;
		const scale = Math.max(0.08, Math.min(
			(viewport.clientWidth - padding * 2) / floor().width,
			(viewport.clientHeight - padding * 2) / floor().height
		));
		props.store.dispatch({
			type: 'camera/set',
			floorId: floor().id,
			camera: {
				offsetX: (viewport.clientWidth - floor().width * scale) / 2,
				offsetY: (viewport.clientHeight - floor().height * scale) / 2,
				scale
			}
		});
	};

	const pointInViewport = (event: PointerLikeEvent): WayfindingPoint => {
		const bounds = viewport.getBoundingClientRect();

		return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
	};

	const pointInMap = (event: PointerLikeEvent): WayfindingPoint => {
		const point = pointInViewport(event);
		const current = camera();

		return {
			x: Math.max(0, Math.min(floor().width, (point.x - current.offsetX) / current.scale)),
			y: Math.max(0, Math.min(floor().height, (point.y - current.offsetY) / current.scale))
		};
	};

	const finishPolygonDraft = (): void => {
		const currentDraft = draft();

		if (currentDraft?.kind !== 'polygon' || currentDraft.points.length < 3) return;
		const elementId = nextId(currentDraft.elementType);
		const element: WayfindingStudioPolygonElement = {
			floorId: floor().id,
			geometry: currentDraft.points,
			id: elementId,
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: currentDraft.elementType
		};

		if (currentDraft.elementType === 'location') {
			const destinationId = nextId('destination');
			const locationNumber = props.snapshot().state.project.destinations.length + 1;
			element.destinationId = destinationId;
			props.store.run({
				commands: [
					{
						type: 'destination/add',
						destination: {
							floor: floor().id,
							id: destinationId,
							name: `Location ${locationNumber}`,
							routeable: true,
							status: 'confirmed'
						}
					},
					{ type: 'element/add', element, floorId: floor().id }
				],
				label: `Create Location ${locationNumber}`
			});
		} else {
			props.store.dispatch({ type: 'element/add', element, floorId: floor().id });
		}

		props.store.dispatch({ type: 'draft/clear' });
		props.store.dispatch({ type: 'selection/set', selection: { id: elementId, kind: 'element' } });
		props.store.dispatch({ type: 'tool/set', tool: 'select' });
	};

	const finishRouteDraft = (): void => {
		const currentDraft = draft();

		if (currentDraft?.kind !== 'route-edge' || currentDraft.points.length < 2) return;
		const snapDistance = 22 / camera().scale;
		const nearestNode = (point: WayfindingPoint): WayfindingNode | undefined => floorGraphNodes()
			.map((node) => ({ distance: Math.hypot(node.x - point.x, node.y - point.y), node }))
			.filter((candidate) => candidate.distance <= snapDistance)
			.sort((left, right) => left.distance - right.distance)[0]?.node;
		const firstCandidate = currentDraft.points[0];
		const lastCandidate = currentDraft.points.at(-1)!;
		const fromNode = nearestNode(firstCandidate);
		const toNode = nearestNode(lastCandidate);
		const fromId = fromNode?.id ?? nextId('route-node');
		const toId = toNode?.id ?? nextId('route-node');
		const edgeId = nextId('route-edge');
		const first = fromNode ? { x: fromNode.x, y: fromNode.y } : firstCandidate;
		const last = toNode ? { x: toNode.x, y: toNode.y } : lastCandidate;
		const geometry = [first, ...currentDraft.points.slice(1, -1), last];
		const commands = [];

		if (!fromNode) {
			commands.push({
					type: 'graph/node-add',
					node: { id: fromId, kind: 'route', levelId: floor().id, ...first }
				} as const);
		}

		if (!toNode) {
			commands.push({
					type: 'graph/node-add',
					node: { id: toId, kind: 'route', levelId: floor().id, ...last }
				} as const);
		}
		commands.push({
					type: 'graph/edge-add',
					edge: {
						accessible: true,
						bidirectional: true,
						from: fromId,
						geometry,
						id: edgeId,
						kind: 'walk',
						reviewStatus: 'confirmed',
						to: toId
					}
				} as const);

		props.store.run({
			commands,
			label: 'Create route segment'
		});
		props.store.dispatch({ type: 'draft/clear' });
		props.store.dispatch({ type: 'selection/set', selection: { id: edgeId, kind: 'graph-edge' } });
		props.store.dispatch({ type: 'tool/set', tool: 'select' });
	};

	const createPointElement = (tool: EditorTool, point: WayfindingPoint): void => {
		const base = {
			floorId: floor().id,
			id: nextId(tool),
			provenance: 'reviewer-authored' as const,
			status: 'confirmed' as const
		};
		let element: WayfindingStudioElement | undefined;

		if (tool === 'door') element = { ...base, angle: 0, length: 42, point, type: 'door' };

		if (tool === 'poi') {
			const destinationId = nextId('destination');
			const locationNumber = props.snapshot().state.project.destinations.length + 1;
			element = {
				...base,
				destinationId,
				label: `Point of interest ${locationNumber}`,
				point,
				type: 'poi'
			};
			props.store.run({
				commands: [
					{
						type: 'destination/add',
						destination: {
							floor: floor().id,
							id: destinationId,
							name: `Point of interest ${locationNumber}`,
							routeable: true,
							status: 'confirmed'
						}
					},
					{ type: 'element/add', element, floorId: floor().id }
				],
				label: `Create point of interest ${locationNumber}`
			});
			props.store.dispatch({ type: 'selection/set', selection: { id: element.id, kind: 'element' } });
			props.store.dispatch({ type: 'tool/set', tool: 'select' });

			return;
		}

		if (tool === 'origin') {
			element = {
				...base,
				facingDegrees: 0,
				label: 'You are here',
				point,
				screenId: nextId('screen'),
				type: 'origin'
			};
		}

		if (tool === 'transition') {
			element = {
				...base,
				accessible: true,
				connectionId: nextId('connection'),
				kind: 'stairs',
				label: 'Floor connection',
				point,
				type: 'transition'
			};
		}

		if (tool === 'label') {
			element = {
				...base,
				color: defaults().label.color,
				fontFamily: defaults().label.fontFamily,
				fontSize: defaults().label.fontSize,
				fontWeight: defaults().label.fontWeight,
				point,
				text: 'Label',
				textAnchor: 'middle',
				type: 'label'
			};
		}

		if (tool === 'icon' || tool === 'logo') {
			const asset = props.snapshot().state.project.assets.find(
				(candidate) => candidate.id === props.snapshot().state.activeAssetId
			);

			if (!asset || asset.kind !== tool) return;
			const naturalWidth = Math.max(1, asset.naturalWidth ?? 64);
			const naturalHeight = Math.max(1, asset.naturalHeight ?? 64);
			const size = tool === 'icon' ? defaults().iconSize : defaults().logoSize;
			const scale = size / Math.max(naturalWidth, naturalHeight);
			const selected = props.snapshot().state.selection;
			const destinationId = selected?.kind === 'destination'
				? selected.id
				: undefined;
			element = {
				...base,
				assetId: asset.id,
				destinationId,
				height: naturalHeight * scale,
				point,
				type: tool,
				width: naturalWidth * scale
			};
		}

		if (!element) return;
		props.store.dispatch({ type: 'element/add', element, floorId: floor().id });
		props.store.dispatch({ type: 'selection/set', selection: { id: element.id, kind: 'element' } });
		props.store.dispatch({ type: 'tool/set', tool: 'select' });
	};

	const removeSelection = (): void => {
		const selection = props.snapshot().state.selection;

		if (!selection) return;

		if (selection.kind === 'element') {
			const element = selectedElement();

			if (isPolygonElement(element) && selection.vertexIndex !== undefined && element.geometry.length > 3) {
				props.store.dispatch({
					type: 'element/patch',
					elementId: element.id,
					patch: { geometry: element.geometry.filter((_, index) => index !== selection.vertexIndex) }
				});
				props.store.dispatch({ type: 'selection/set', selection: { id: element.id, kind: 'element' } });

				return;
			}

			if (element) {
				const commands = [{ type: 'element/remove' as const, elementId: element.id }];
				const destinationId = 'destinationId' in element ? element.destinationId : undefined;

				if (destinationId) {
					props.store.run({
						commands: [...commands, { type: 'destination/remove', destinationId }],
						label: `Delete ${element.type}`
					});
				} else {
					props.store.dispatch(commands[0]);
				}
			}
		}

		if (selection.kind === 'graph-edge') {
			const edge = props.snapshot().state.project.graph.edges.find((candidate) => candidate.id === selection.id);

			if (edge?.geometry && selection.geometryIndex !== undefined && edge.geometry.length > 2) {
				props.store.dispatch({
					type: 'graph/edge-patch',
					edgeId: edge.id,
					patch: { geometry: edge.geometry.filter((_, index) => index !== selection.geometryIndex) }
				});
			} else {
				props.store.dispatch({ type: 'graph/edge-remove', edgeId: selection.id });
			}
		}

		if (selection.kind === 'graph-node') {
			props.store.dispatch({ type: 'graph/node-remove', nodeId: selection.id });
		}

		props.store.dispatch({ type: 'selection/clear' });
	};

	const shortcutTool = (key: string): EditorTool | undefined => {
		const routeWorkspace = props.snapshot().state.workspace === 'route-edit';
		const keyMap: Record<string, EditorTool> = routeWorkspace
			? { a: 'route-node', e: 'route-edge', h: 'pan', v: 'select' }
			: {
				b: 'obstacle',
				d: 'door',
				h: 'pan',
				i: 'icon',
				g: 'logo',
				l: 'label',
				p: 'poi',
				r: 'location',
				t: 'transition',
				v: 'select',
				w: 'walkable',
				y: 'origin'
			};

		return keyMap[key];
	};

	const keyDown = (event: KeyboardEvent): void => {
		if (isEditableTarget(event.target)) return;

		if (event.code === 'Space') {
			spaceHeld = true;
			event.preventDefault();

			return;
		}

		if (event.key === 'Escape') {
			props.store.dispatch({ type: 'draft/clear' });
			setInteractionGeometry(undefined);
			setInteractionGraphGeometry(undefined);
			setInteractionGraphPoint(undefined);
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
			removeSelection();

			return;
		}

		const tool = shortcutTool(event.key.toLocaleLowerCase());

		if (tool && !event.ctrlKey && !event.metaKey && !event.altKey) {
			props.store.dispatch({ type: 'tool/set', tool });
		}
	};

	const keyUp = (event: KeyboardEvent): void => {
		if (event.code === 'Space') spaceHeld = false;
	};

	onMount(() => {
		props.registerFit(fit);
		window.addEventListener('keydown', keyDown);
		window.addEventListener('keyup', keyUp);
		queueMicrotask(fit);
	});

	createEffect(() => {
		currentFloorId();
		queueMicrotask(fit);
	});

	const pointerDown: JSX.EventHandler<HTMLDivElement, PointerEvent> = (event): void => {
		const state = props.snapshot().state;
		const tool = state.activeTool;
		const target = event.target instanceof Element ? event.target : undefined;
		const mapPoint = pointInMap(event);

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

		if (polygonTools.has(tool) && state.workspace === 'map') {
			if (event.detail > 1) return;
			const elementType = tool as WayfindingStudioPolygonElement['type'];
			const activeDraft = draft();
			const currentDraft: Extract<EditorDraft, { kind: 'polygon' }> = activeDraft?.kind === 'polygon' && activeDraft.elementType === elementType
				? activeDraft
				: { elementType, kind: 'polygon', points: [] };
			props.store.dispatch({
				type: 'draft/set',
				draft: { ...currentDraft, points: [...currentDraft.points, mapPoint] }
			});

			return;
		}

		if (pointTools.has(tool) && state.workspace === 'map') {
			createPointElement(tool, mapPoint);

			return;
		}

		if (tool === 'route-node' && state.workspace === 'route-edit') {
			const nodeId = nextId('route-node');
			props.store.dispatch({
				type: 'graph/node-add',
				node: { id: nodeId, kind: 'route', levelId: floor().id, ...mapPoint }
			});
			props.store.dispatch({ type: 'selection/set', selection: { id: nodeId, kind: 'graph-node' } });
			props.store.dispatch({ type: 'tool/set', tool: 'select' });

			return;
		}

		if (tool === 'route-edge' && state.workspace === 'route-edit') {
			if (event.detail > 1) return;
			const currentDraft: EditorDraft = draft()?.kind === 'route-edge'
				? draft()!
				: { kind: 'route-edge', points: [] };
			props.store.dispatch({
				type: 'draft/set',
				draft: { ...currentDraft, points: [...currentDraft.points, mapPoint] }
			});

			return;
		}

		if (state.workspace === 'route-edit' && tool === 'select') {
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
				event.preventDefault();
				event.stopPropagation();
				props.store.dispatch({ type: 'selection/set', selection: { id: edgeId, kind: 'graph-edge' } });

				return;
			}
		}

		const elementTarget = target?.closest('[data-wayfinding-level]');

		if (elementTarget && state.workspace === 'map' && tool === 'select') {
			const element = floorElements().find((candidate) => candidate.id === elementTarget.id);
			props.store.dispatch({ type: 'selection/set', selection: { id: elementTarget.id, kind: 'element' } });

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

		const delta = { x: mapPoint.x - interaction.start.x, y: mapPoint.y - interaction.start.y };

		if (interaction.kind === 'point') {
			interaction.point = {
				x: Math.max(0, Math.min(floor().width, interaction.original.x + delta.x)),
				y: Math.max(0, Math.min(floor().height, interaction.original.y + delta.y))
			};
			interaction.moved = true;

			return;
		}

		if (interaction.kind === 'graph-node') {
			interaction.point = {
				x: Math.max(0, Math.min(floor().width, interaction.original.x + delta.x)),
				y: Math.max(0, Math.min(floor().height, interaction.original.y + delta.y))
			};
			interaction.moved = true;
			setInteractionGraphPoint(interaction.point);

			return;
		}

		if (interaction.kind === 'graph-edge-point') {
			const currentInteraction = interaction;

			currentInteraction.geometry = currentInteraction.original.map((candidate, index) => index === currentInteraction.geometryIndex
				? {
					x: Math.max(0, Math.min(floor().width, candidate.x + delta.x)),
					y: Math.max(0, Math.min(floor().height, candidate.y + delta.y))
				}
				: candidate);
			currentInteraction.moved = true;
			setInteractionGraphGeometry(currentInteraction.geometry);

			return;
		}
		const geometry = interaction.original.map((candidate, index): WayfindingPoint => {
			if (interaction?.kind !== 'polygon') return candidate;

			if (interaction.vertexIndex !== undefined && index !== interaction.vertexIndex) return candidate;

			return {
				x: Math.max(0, Math.min(floor().width, candidate.x + delta.x)),
				y: Math.max(0, Math.min(floor().height, candidate.y + delta.y))
			};
		});
		interaction.geometry = geometry;
		interaction.moved = true;
		setInteractionGeometry(geometry);
	};

	const pointerUp = (): void => {
		if (interaction?.kind === 'polygon' && interaction.moved) {
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

		if (interaction?.kind === 'graph-edge-point' && interaction.moved) {
			props.store.dispatch({
				type: 'graph/edge-patch',
				edgeId: interaction.routeEdgeId,
				patch: { geometry: interaction.geometry }
			});
		}

		if (interaction?.kind === 'graph-node' && interaction.moved) {
			const currentInteraction = interaction;
			const commands: EditorCommand[] = [{
				type: 'graph/node-patch' as const,
				nodeId: currentInteraction.nodeId,
				patch: currentInteraction.point
			}];

			for (const edge of floorGraphEdges()) {
				if (edge.from !== currentInteraction.nodeId && edge.to !== currentInteraction.nodeId) continue;
				const geometry = graphEdgePoints(edge.id);

				if (edge.from === currentInteraction.nodeId) geometry[0] = currentInteraction.point;

				if (edge.to === currentInteraction.nodeId) geometry[geometry.length - 1] = currentInteraction.point;
				commands.push({
					type: 'graph/edge-patch',
					edgeId: edge.id,
					patch: { geometry }
				});
			}
			props.store.run({ commands, label: 'Move route node' });
		}
		interaction = undefined;
		setInteractionGeometry(undefined);
		setInteractionGraphGeometry(undefined);
		setInteractionGraphPoint(undefined);
	};

	const wheel: JSX.EventHandler<HTMLDivElement, WheelEvent> = (event): void => {
		event.preventDefault();
		const before = pointInViewport(event);
		const current = camera();
		const scale = Math.max(0.08, Math.min(8, current.scale * (event.deltaY > 0 ? 0.9 : 1.1)));
		const mapX = (before.x - current.offsetX) / current.scale;
		const mapY = (before.y - current.offsetY) / current.scale;
		props.store.dispatch({
			type: 'camera/set',
			floorId: floor().id,
			camera: {
				offsetX: before.x - mapX * scale,
				offsetY: before.y - mapY * scale,
				scale
			}
		});
	};

	const finishDraft: JSX.EventHandler<HTMLDivElement, MouseEvent> = (event): void => {
		event.preventDefault();

		if (draft()?.kind === 'polygon') finishPolygonDraft();
		else if (draft()?.kind === 'route-edge') finishRouteDraft();
		else if (props.snapshot().state.activeTool === 'select' && selectedPolygon()) {
			const point = pointInMap(event);
			const geometry = selectedPolygon()!.geometry;
			let nearestIndex = -1;
			let nearestDistance = Number.POSITIVE_INFINITY;

			for (let index = 0; index < geometry.length; index += 1) {
				const distance = distanceToSegment(
					point,
					geometry[index],
					geometry[(index + 1) % geometry.length]
				);

				if (distance < nearestDistance) {
					nearestDistance = distance;
					nearestIndex = index;
				}
			}

			if (nearestIndex >= 0 && nearestDistance <= 14 / camera().scale) {
				insertVertexAtPoint(point, nearestIndex);
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

	const insertVertexAtPoint = (point: WayfindingPoint, afterIndex: number): void => {
		const polygon = selectedPolygon();

		if (!polygon) return;
		const geometry = [...polygon.geometry];
		geometry.splice(afterIndex + 1, 0, point);
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
	const insertGraphPoint = (event: MouseEvent, edgeId: string, afterIndex: number): void => {
		event.preventDefault();
		event.stopPropagation();
		const geometry = graphEdgePoints(edgeId);

		if (geometry.length < 2) return;
		geometry.splice(afterIndex + 1, 0, pointInMap(event));
		props.store.dispatch({
			type: 'graph/edge-patch',
			edgeId,
			patch: { geometry }
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
				'is-authoring': polygonTools.has(props.snapshot().state.activeTool) || pointTools.has(props.snapshot().state.activeTool),
				'is-panning': interaction?.kind === 'pan',
				'is-selecting': props.snapshot().state.activeTool === 'select'
			}}
			data-active-tool={props.snapshot().state.activeTool}
			ref={viewport}
			onDblClick={finishDraft}
			onPointerDown={pointerDown}
			onPointerMove={pointerMove}
			onPointerUp={pointerUp}
			onPointerCancel={pointerUp}
			onWheel={wheel}
		>
			<div
				class="map-transform"
				style={{
					height: `${floor().height}px`,
					transform: `translate(${camera().offsetX}px, ${camera().offsetY}px) scale(${camera().scale})`,
					width: `${floor().width}px`
				}}
			>
				<div class="map-svg" innerHTML={renderedSvg()} />
				<svg
					class="route-overlay"
					viewBox={`0 0 ${floor().width} ${floor().height}`}
					aria-hidden="true"
				>
					{props.snapshot().state.layerVisibility['route-network']
						&& (props.snapshot().state.workspace === 'route-edit' || props.snapshot().state.workspace === 'route-preview')
						&& props.snapshot().state.project.graph.edges.map((edge) => {
							const from = props.snapshot().state.project.graph.nodes.find((node) => node.id === edge.from);
							const to = props.snapshot().state.project.graph.nodes.find((node) => node.id === edge.to);

							if (!from || !to || from.levelId !== floor().id) return null;
							const points = edge.geometry?.length ? edge.geometry : [from, to];

							return <polyline class="route-network-line" points={routePolyline(points)} />;
						})}
					{route().length > 1 && (
						<polyline
							class="simulated-route"
							classList={{ animated: props.snapshot().state.project.defaults?.route.animation !== 'none' }}
							points={routePolyline(route())}
						/>
					)}
				</svg>
				<svg
					class="authoring-overlay"
					viewBox={`0 0 ${floor().width} ${floor().height}`}
					aria-label="Map authoring overlay"
				>
					<Show when={selectedPolygon()}>
						<polygon
							class="selected-polygon"
							points={pointString(selectedPolygonGeometry())}
							fill={selectedPolygon()?.presentation?.fillColor ?? 'transparent'}
							fill-opacity={interactionGeometry() ? 0.24 : 0.06}
						/>
						<For each={selectedPolygonGeometry()}>{(point, index) => {
							const next = createMemo(() => selectedPolygonGeometry()[(index() + 1) % selectedPolygonGeometry().length]);

							return (
								<>
									<line
										class="polygon-edge-hit interactive"
										x1={point.x}
										y1={point.y}
										x2={next().x}
										y2={next().y}
										onDblClick={(event) => insertVertex(event, index())}
									/>
									<circle
										class="polygon-vertex interactive"
										classList={{ active: selectedVertexIndex() === index() }}
										cx={point.x}
										cy={point.y}
										r={handleRadius()}
										onPointerDown={(event) => beginVertexDrag(event, index())}
									/>
								</>
							);
						}}</For>
					</Show>
					<Show when={selectedPoint()}>
						<circle
							class="selected-point-handle"
							cx={selectedPoint()!.x}
							cy={selectedPoint()!.y}
							r={handleRadius() * 1.25}
						/>
					</Show>
					<Show when={props.snapshot().state.workspace === 'route-edit'}>
						<For each={floorGraphEdges()}>{(edge) => {
							const points = createMemo(() => edge.id === selectedGraphEdge()?.id
								? selectedGraphGeometry()
								: graphEdgePoints(edge.id));

							return (
								<polyline
									class="graph-edge-hit interactive"
									classList={{ active: selectedGraphEdge()?.id === edge.id }}
									data-route-edge-id={edge.id}
									points={pointString(points())}
								/>
							);
						}}</For>
						<For each={floorGraphNodes()}>{(node) => {
							const point = createMemo(() => node.id === selectedGraphNode()?.id
								? interactionGraphPoint() ?? node
								: node);

							return (
								<circle
									class="graph-node-handle interactive"
									classList={{ active: selectedGraphNode()?.id === node.id }}
									cx={point().x}
									cy={point().y}
									data-route-node-id={node.id}
									r={handleRadius() * 0.8}
								/>
							);
						}}</For>
						<Show when={selectedGraphEdge()}>
							<For each={selectedGraphGeometry()}>{(point, index) => {
								const next = createMemo(() => selectedGraphGeometry()[index() + 1]);

								return (
									<>
										<Show when={next()}>
											{(nextPoint) => (
												<line
													class="graph-segment-hit interactive"
													data-route-edge-id={selectedGraphEdge()!.id}
													x1={point.x}
													y1={point.y}
													x2={nextPoint().x}
													y2={nextPoint().y}
													onDblClick={(event) => insertGraphPoint(event, selectedGraphEdge()!.id, index())}
												/>
											)}
										</Show>
										<circle
											class="graph-edge-point interactive"
											classList={{
												active: selectedGraphGeometryIndex() === index()
											}}
											cx={point.x}
											cy={point.y}
											data-geometry-index={index()}
											data-route-edge-point={selectedGraphEdge()!.id}
											r={handleRadius() * 0.72}
										/>
									</>
								);
							}}</For>
						</Show>
					</Show>
					<Show when={polygonDraft()}>
						<polyline class="draft-line" points={pointString(polygonDraft()!.points)} />
						<For each={polygonDraft()!.points}>{(point) => (
							<circle class="draft-point" cx={point.x} cy={point.y} r={handleRadius()} />
						)}</For>
					</Show>
					<Show when={routeDraft()}>
						<polyline class="draft-route-line" points={pointString(routeDraft()!.points)} />
						<For each={routeDraft()!.points}>{(point) => (
							<circle class="draft-point route" cx={point.x} cy={point.y} r={handleRadius()} />
						)}</For>
					</Show>
				</svg>
			</div>
			<Show when={draft()}>
				<div class="draft-hint">
					<strong>{draft()?.kind === 'polygon' ? 'Drawing area' : 'Drawing route'}</strong>
					<span>Click to add points. Enter or double-click to finish. Esc cancels.</span>
				</div>
			</Show>
		</div>
	);
};
