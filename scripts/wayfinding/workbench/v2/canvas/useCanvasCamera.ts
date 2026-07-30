import {
	createEffect,
	createMemo,
	onCleanup,
	onMount,
	type Accessor
} from 'solid-js';
import type { WayfindingStudioFloor } from '../../../studio-project.mts';
import type {
	EditorCamera2d,
	EditorSnapshot,
	EditorStore
} from '../../../editor-core/types';
import type { WayfindingPoint } from '../../../../../src/utils/wayfinding.js';
import {
	fitCamera,
	mapPointFromViewport,
	zoomCameraAt
} from './geometry';

interface CanvasCameraOptions {
	floor: Accessor<WayfindingStudioFloor>;
	getViewport: () => HTMLDivElement | undefined;
	registerFit: (fit: () => void) => void;
	snapshot: Accessor<EditorSnapshot>;
	store: EditorStore;
}

export interface CanvasCameraController {
	camera: Accessor<EditorCamera2d>;
	fit: () => void;
	fitPoints: (points: WayfindingPoint[]) => void;
	mapPoint: (event: MouseEvent | PointerEvent | WheelEvent) => WayfindingPoint;
	viewportPoint: (event: MouseEvent | PointerEvent | WheelEvent) => WayfindingPoint;
	zoomAt: (event: WheelEvent) => void;
}

const MIN_SCALE = 0.08;
const MAX_SCALE = 8;

export const useCanvasCamera = (options: CanvasCameraOptions): CanvasCameraController => {
	let resizeObserver: ResizeObserver | undefined;
	let previousViewportSize: { height: number; width: number } | undefined;
	const camera = createMemo<EditorCamera2d>(() =>
		options.snapshot().state.camera2dByFloor[options.floor().id]
			?? { offsetX: 0, offsetY: 0, scale: 1 }
	);

	const setCamera = (nextCamera: EditorCamera2d): void => {
		options.store.dispatch({
			type: 'camera/set',
			camera: nextCamera,
			floorId: options.floor().id
		});
	};

	const fit = (): void => {
		const viewport = options.getViewport();
		const floor = options.floor();

		if (!viewport || viewport.clientWidth <= 0 || viewport.clientHeight <= 0) return;
		setCamera(fitCamera(
			{ height: viewport.clientHeight, width: viewport.clientWidth },
			{ height: floor.height, width: floor.width }
		));
	};

	const viewportPoint = (event: MouseEvent | PointerEvent | WheelEvent): WayfindingPoint => {
		const viewport = options.getViewport();

		if (!viewport) return { x: 0, y: 0 };
		const bounds = viewport.getBoundingClientRect();

		return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
	};

	const mapPoint = (event: MouseEvent | PointerEvent | WheelEvent): WayfindingPoint => {
		const floor = options.floor();

		return mapPointFromViewport(
			viewportPoint(event),
			camera(),
			{ height: floor.height, width: floor.width }
		);
	};

	const fitPoints = (points: WayfindingPoint[]): void => {
		const viewport = options.getViewport();

		if (!viewport || points.length === 0) return;
		const minX = Math.min(...points.map((point) => point.x));
		const maxX = Math.max(...points.map((point) => point.x));
		const minY = Math.min(...points.map((point) => point.y));
		const maxY = Math.max(...points.map((point) => point.y));
		const width = Math.max(24, maxX - minX);
		const height = Math.max(24, maxY - minY);
		const padding = 120;
		const scale = Math.max(MIN_SCALE, Math.min(
			MAX_SCALE,
			(viewport.clientWidth - padding * 2) / width,
			(viewport.clientHeight - padding * 2) / height
		));

		setCamera({
			offsetX: viewport.clientWidth / 2 - ((minX + maxX) / 2) * scale,
			offsetY: viewport.clientHeight / 2 - ((minY + maxY) / 2) * scale,
			scale
		});
	};

	const zoomAt = (event: WheelEvent): void => {
		const nextScale = Math.max(
			MIN_SCALE,
			Math.min(MAX_SCALE, camera().scale * Math.exp(-event.deltaY * 0.0015))
		);

		setCamera(zoomCameraAt(camera(), viewportPoint(event), nextScale));
	};

	const preserveCenterOnResize = (width: number, height: number): void => {
		const previous = previousViewportSize;

		previousViewportSize = { height, width };

		if (!previous || previous.width <= 0 || previous.height <= 0) return;
		const current = camera();
		const previousCenter = { x: previous.width / 2, y: previous.height / 2 };
		const mapCenter = mapPointFromViewport(
			previousCenter,
			current,
			{ height: Number.MAX_SAFE_INTEGER, width: Number.MAX_SAFE_INTEGER }
		);

		setCamera({
			offsetX: width / 2 - mapCenter.x * current.scale,
			offsetY: height / 2 - mapCenter.y * current.scale,
			scale: current.scale
		});
	};

	onMount(() => {
		const viewport = options.getViewport();

		options.registerFit(fit);

		if (!viewport) return;
		previousViewportSize = {
			height: viewport.clientHeight,
			width: viewport.clientWidth
		};
		resizeObserver = new ResizeObserver((entries): void => {
			const entry = entries[0];

			if (!entry) return;
			preserveCenterOnResize(entry.contentRect.width, entry.contentRect.height);
		});
		resizeObserver.observe(viewport);
	});

	createEffect(() => {
		const floorId = options.floor().id;
		const hasCamera = Boolean(options.snapshot().state.camera2dByFloor[floorId]);

		if (!hasCamera) queueMicrotask(fit);
	});

	onCleanup(() => resizeObserver?.disconnect());

	return {
		camera,
		fit,
		fitPoints,
		mapPoint,
		viewportPoint,
		zoomAt
	};
};
