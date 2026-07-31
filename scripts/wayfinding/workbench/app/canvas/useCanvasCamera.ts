import {
	createEffect,
	createMemo,
	createSignal,
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
	compositionInsets?: Accessor<{ bottom: number; left: number; right: number; top: number }>;
	ephemeral?: Accessor<boolean>;
	fitInsets?: Accessor<{ bottom: number; left: number; right: number; top: number }>;
	fitOffset?: Accessor<{ x: number; y: number }>;
	fitOnResize?: Accessor<boolean>;
	floor: Accessor<WayfindingStudioFloor>;
	getViewport: () => HTMLDivElement | undefined;
	insetChangeRevision?: Accessor<string | number>;
	preserveCenterOnInsetChange?: Accessor<boolean>;
	registerFit: (fit: () => void) => void;
	snapshot: Accessor<EditorSnapshot>;
	store: EditorStore;
}

export interface CanvasCameraController {
	camera: Accessor<EditorCamera2d>;
	fit: () => void;
	fitPoints: (points: WayfindingPoint[]) => void;
	mapPoint: (event: MouseEvent | PointerEvent | WheelEvent) => WayfindingPoint;
	setCamera: (camera: EditorCamera2d) => void;
	viewportPoint: (event: MouseEvent | PointerEvent | WheelEvent) => WayfindingPoint;
	zoomAt: (event: WheelEvent) => void;
}

const MIN_SCALE = 0.08;
const MAX_SCALE = 8;

export const useCanvasCamera = (options: CanvasCameraOptions): CanvasCameraController => {
	let resizeObserver: ResizeObserver | undefined;
	let insetCompositionTimer: ReturnType<typeof setTimeout> | undefined;
	let preserveInsetComposition = false;
	let previousInsets: { bottom: number; left: number; right: number; top: number } | undefined;
	let previousInsetFloorId: string | undefined;
	let previousViewportSize: { height: number; width: number } | undefined;
	const [ephemeralCameraByFloor, setEphemeralCameraByFloor] = createSignal<
		Record<string, EditorCamera2d>
	>({});
	const camera = createMemo<EditorCamera2d>(() => {
		const floorId = options.floor().id;
		const stored = options.snapshot().state.camera2dByFloor[floorId]
			?? { offsetX: 0, offsetY: 0, scale: 1 };

		return options.ephemeral?.()
			? ephemeralCameraByFloor()[floorId] ?? stored
			: stored;
	});

	const setCamera = (nextCamera: EditorCamera2d): void => {
		const floorId = options.floor().id;

		if (options.ephemeral?.()) {
			setEphemeralCameraByFloor((current) => ({
				...current,
				[floorId]: nextCamera
			}));

			return;
		}
		options.store.dispatch({
			type: 'camera/set',
			camera: nextCamera,
			floorId
		});
	};

	const fit = (): void => {
		const viewport = options.getViewport();
		const floor = options.floor();

		if (!viewport || viewport.clientWidth <= 0 || viewport.clientHeight <= 0) return;
		const insets = options.fitInsets?.() ?? { bottom: 0, left: 0, right: 0, top: 0 };
		const availableWidth = Math.max(1, viewport.clientWidth - insets.left - insets.right);
		const availableHeight = Math.max(1, viewport.clientHeight - insets.top - insets.bottom);
		const fitted = fitCamera(
			{ height: availableHeight, width: availableWidth },
			{ height: floor.height, width: floor.width }
		);
		const offset = options.fitOffset?.() ?? { x: 0, y: 0 };

		setCamera({
			...fitted,
			offsetX: fitted.offsetX + insets.left + offset.x,
			offsetY: fitted.offsetY + insets.top + offset.y
		});
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
		const insets = options.fitInsets?.() ?? { bottom: 0, left: 0, right: 0, top: 0 };
		const availableWidth = Math.max(1, viewport.clientWidth - insets.left - insets.right);
		const availableHeight = Math.max(1, viewport.clientHeight - insets.top - insets.bottom);
		const minX = Math.min(...points.map((point) => point.x));
		const maxX = Math.max(...points.map((point) => point.x));
		const minY = Math.min(...points.map((point) => point.y));
		const maxY = Math.max(...points.map((point) => point.y));
		const width = Math.max(24, maxX - minX);
		const height = Math.max(24, maxY - minY);
		const padding = Math.min(
			96,
			Math.max(24, Math.min(availableWidth, availableHeight) * 0.08)
		);
		const scale = Math.max(MIN_SCALE, Math.min(
			MAX_SCALE,
			(availableWidth - padding * 2) / width,
			(availableHeight - padding * 2) / height
		));
		const offset = options.fitOffset?.() ?? { x: 0, y: 0 };

		setCamera({
			offsetX: insets.left + availableWidth / 2 - ((minX + maxX) / 2) * scale + offset.x,
			offsetY: insets.top + availableHeight / 2 - ((minY + maxY) / 2) * scale + offset.y,
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

	const preserveCenterAcrossInsets = (): void => {
		const viewport = options.getViewport();
		const floorId = options.floor().id;
		const nextInsets = options.compositionInsets?.()
			?? options.fitInsets?.()
			?? { bottom: 0, left: 0, right: 0, top: 0 };

		if (!viewport || viewport.clientWidth <= 0 || viewport.clientHeight <= 0) return;

		if (!previousInsets || previousInsetFloorId !== floorId) {
			previousInsets = nextInsets;
			previousInsetFloorId = floorId;

			return;
		}
		const previous = previousInsets;

		previousInsets = nextInsets;

		if (
			previous.bottom === nextInsets.bottom
			&& previous.left === nextInsets.left
			&& previous.right === nextInsets.right
			&& previous.top === nextInsets.top
		) return;
		const current = camera();
		const previousCenter = {
			x: previous.left + (viewport.clientWidth - previous.left - previous.right) / 2,
			y: previous.top + (viewport.clientHeight - previous.top - previous.bottom) / 2
		};
		const nextCenter = {
			x: nextInsets.left + (viewport.clientWidth - nextInsets.left - nextInsets.right) / 2,
			y: nextInsets.top + (viewport.clientHeight - nextInsets.top - nextInsets.bottom) / 2
		};
		const mapCenter = mapPointFromViewport(
			previousCenter,
			current,
			{ height: Number.MAX_SAFE_INTEGER, width: Number.MAX_SAFE_INTEGER }
		);

		setCamera({
			offsetX: nextCenter.x - mapCenter.x * current.scale,
			offsetY: nextCenter.y - mapCenter.y * current.scale,
			scale: current.scale
		});
	};

	const scheduleInsetComposition = (): void => {
		if (insetCompositionTimer) clearTimeout(insetCompositionTimer);

		if (!preserveInsetComposition) return;
		insetCompositionTimer = setTimeout(preserveCenterAcrossInsets, 0);
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

			if (options.fitOnResize?.()) {
				previousViewportSize = {
					height: entry.contentRect.height,
					width: entry.contentRect.width
				};
				fit();

				return;
			}
			preserveCenterOnResize(entry.contentRect.width, entry.contentRect.height);
			scheduleInsetComposition();
		});
		resizeObserver.observe(viewport);
	});

	createEffect(() => {
		const floorId = options.floor().id;
		const hasCamera = options.ephemeral?.()
			? Boolean(ephemeralCameraByFloor()[floorId])
			: Boolean(options.snapshot().state.camera2dByFloor[floorId]);

		if (!hasCamera) queueMicrotask(fit);
	});

	createEffect(() => {
		const preserve = options.preserveCenterOnInsetChange?.() ?? false;

		// Only structural overlays participate here. Selection controls are
		// transient and must never move a handle while the user begins a drag.
		options.insetChangeRevision?.();
		preserveInsetComposition = preserve;

		if (insetCompositionTimer) clearTimeout(insetCompositionTimer);

		if (!preserve) {
			previousInsets = undefined;
			previousInsetFloorId = undefined;

			return;
		}
		scheduleInsetComposition();
	});

	onCleanup(() => {
		if (insetCompositionTimer) clearTimeout(insetCompositionTimer);
		resizeObserver?.disconnect();
	});

	return {
		camera,
		fit,
		fitPoints,
		mapPoint,
		setCamera,
		viewportPoint,
		zoomAt
	};
};
