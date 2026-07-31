import type { Accessor } from 'solid-js';

import {
	type WayfindingStudioFloor,
	type WayfindingStudioPolygonElement,
	type WayfindingStudioProjectDefaults
} from '../../../studio-project.mts';
import type {
	EditorCamera2d,
	EditorSnapshot,
	EditorStore,
	EditorTool
} from '../../../editor-core/types';
import type {
	WayfindingNode,
	WayfindingPoint
} from '../../../../../src/utils/wayfinding.js';
import {
	buildPointAuthoring,
	buildPolygonAuthoring,
	buildRouteEdgeAuthoring,
	sampleSourceColor
} from './authoring';
import {
	detectFlatRegionBoundary,
	type RegionDetectionSource
} from './regionDetection';
import { snapPointToSourceEdge } from './source-edge-snap';

export const createCanvasAuthoringController = (options: {
	camera: Accessor<EditorCamera2d>;
	defaults: Accessor<WayfindingStudioProjectDefaults>;
	floor: Accessor<WayfindingStudioFloor>;
	floorGraphNodes: Accessor<WayfindingNode[]>;
	notify?: (message: string, tone?: 'danger' | 'info' | 'success' | 'warning') => void;
	snapshot: Accessor<EditorSnapshot>;
	store: EditorStore;
	traceSource: Accessor<RegionDetectionSource | undefined>;
}): {
	addPolygon: (
		elementType: WayfindingStudioPolygonElement['type'],
		geometry: WayfindingPoint[],
		detectedColor?: string,
		label?: string,
		holes?: WayfindingPoint[][]
	) => void;
	createPointElement: (tool: EditorTool, point: WayfindingPoint) => void;
	finishPolygonDraft: () => void;
	finishRouteDraft: () => void;
	snapFreehandPoint: (point: WayfindingPoint) => WayfindingPoint;
	traceRegion: (mapPoint: WayfindingPoint) => void;
} => {
	const snapFreehandPoint = (point: WayfindingPoint): WayfindingPoint => {
		const source = options.traceSource();
		const drawing = options.snapshot().state.drawing;

		if (!source || !drawing.snapToSourceEdges) return point;

		return snapPointToSourceEdge({
			mapHeight: options.floor().height,
			mapWidth: options.floor().width,
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
		const source = options.traceSource();
		const sourcePoint = source
			? {
				x: center.x * source.width / options.floor().width,
				y: center.y * source.height / options.floor().height
			}
			: center;

		return sampleSourceColor(source, sourcePoint);
	};

	const addPolygon = (
		elementType: WayfindingStudioPolygonElement['type'],
		geometry: WayfindingPoint[],
		detectedColor?: string,
		label = `Create ${elementType}`,
		holes: WayfindingPoint[][] = []
	): void => {
		const authoringSnapshot = options.snapshot();
		const result = buildPolygonAuthoring({
			defaults: options.defaults(),
			detectedColor,
			elementType,
			floorId: options.floor().id,
			geometry,
			inheritedColor: inheritedColorForGeometry(geometry),
			label,
			project: authoringSnapshot.state.project,
			selectedDestinationId: authoringSnapshot.state.selection?.kind === 'destination'
				? authoringSnapshot.state.selection.id
				: undefined
		});
		const obstacleResults = elementType === 'walkable'
			? holes.map((hole) => buildPolygonAuthoring({
				defaults: options.defaults(),
				elementType: 'obstacle',
				floorId: options.floor().id,
				geometry: hole,
				label: 'Preserve detected blocked island',
				project: authoringSnapshot.state.project,
				provenance: 'reviewer-authored',
				status: 'confirmed'
			}))
			: [];

		options.store.run({
			commands: [
				...result.transaction.commands,
				...obstacleResults.flatMap((obstacle) => obstacle.transaction.commands)
			],
			label: obstacleResults.length > 0
				? `${result.transaction.label} with ${obstacleResults.length} blocked island${obstacleResults.length === 1 ? '' : 's'}`
				: result.transaction.label
		});
		options.store.dispatch({ type: 'selection/set', selection: result.selection });
		options.store.dispatch({ type: 'tool/set', tool: 'select' });
	};

	const finishPolygonDraft = (): void => {
		const currentDraft = options.snapshot().state.draft;

		if (currentDraft?.kind !== 'polygon' || currentDraft.points.length < 3) return;
		addPolygon(currentDraft.elementType, currentDraft.points);
		options.store.dispatch({ type: 'draft/clear' });
	};

	const traceRegion = (mapPoint: WayfindingPoint): void => {
		const source = options.traceSource();

		if (!source) {
			options.notify?.('Add a floor background image before using Smart trace.', 'warning');

			return;
		}
		const trace = options.snapshot().state.trace;
		const imagePoint = {
			x: mapPoint.x * source.width / options.floor().width,
			y: mapPoint.y * source.height / options.floor().height
		};
		const detected = detectFlatRegionBoundary(source, imagePoint, trace);

		if (!detected) {
			options.notify?.(
				'No closed region was found here. Try a lower color range, adjust gap handling, or draw the area manually.',
				'warning'
			);

			return;
		}
		const geometry = detected.geometry.map((point) => ({
			x: point.x * options.floor().width / source.width,
			y: point.y * options.floor().height / source.height
		}));
		const holes = detected.holes.map((hole) => hole.map((point) => ({
			x: point.x * options.floor().width / source.width,
			y: point.y * options.floor().height / source.height
		})));

		addPolygon(
			trace.elementType,
			geometry,
			detected.color,
			`Smart trace ${trace.elementType}`,
			holes
		);
		options.notify?.(
			`${trace.elementType === 'location' ? 'Room' : trace.elementType === 'walkable' ? 'Walkable area' : 'Blocked area'} traced.${trace.elementType === 'walkable' && holes.length > 0 ? ` Preserved ${holes.length} enclosed blocked island${holes.length === 1 ? '' : 's'}.` : ''} Adjust the outline directly if the source image needs correction.`,
			'success'
		);
	};

	const finishRouteDraft = (): void => {
		const currentDraft = options.snapshot().state.draft;

		if (currentDraft?.kind !== 'route-edge' || currentDraft.points.length < 2) return;
		const result = buildRouteEdgeAuthoring({
			cameraScale: options.camera().scale,
			floorId: options.floor().id,
			nodes: options.floorGraphNodes(),
			points: currentDraft.points
		});

		if (!result) return;
		options.store.run(result.transaction);
		options.store.dispatch({ type: 'draft/clear' });
		options.store.dispatch({ type: 'selection/set', selection: result.selection });
		options.store.dispatch({ type: 'tool/set', tool: 'select' });
	};

	const createPointElement = (tool: EditorTool, point: WayfindingPoint): void => {
		const snapshot = options.snapshot();
		const selected = snapshot.state.selection;
		const activeAsset = snapshot.state.project.assets.find(
			(candidate) => candidate.id === snapshot.state.activeAssetId
		);
		const result = buildPointAuthoring({
			activeAsset,
			defaults: options.defaults(),
			destinationCount: snapshot.state.project.destinations.length,
			floorId: options.floor().id,
			point,
			project: snapshot.state.project,
			selectedDestinationId: selected?.kind === 'destination' ? selected.id : undefined,
			selectedElementId: selected?.kind === 'element' ? selected.id : undefined,
			tool
		});

		if (!result) return;
		options.store.run(result.transaction);
		options.store.dispatch({ type: 'selection/set', selection: result.selection });
		options.store.dispatch({ type: 'tool/set', tool: 'select' });

		if (result.element.type === 'door') {
			const door = result.element;
			const linkedLocation = door.locationId
				? options.floor().elements.find((element) =>
					element.type === 'location'
					&& element.id === door.locationId
				)
				: undefined;

			options.notify?.(
				linkedLocation
					? `Entrance snapped to ${'label' in linkedLocation ? linkedLocation.label ?? 'the room' : 'the room'} and linked for routing.`
					: 'Entrance placed. Choose its connected room in the inspector before building routes.',
				linkedLocation ? 'success' : 'warning'
			);
		}
	};

	return {
		addPolygon,
		createPointElement,
		finishPolygonDraft,
		finishRouteDraft,
		snapFreehandPoint,
		traceRegion
	};
};
