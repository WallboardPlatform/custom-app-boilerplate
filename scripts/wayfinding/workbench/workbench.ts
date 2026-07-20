import type {
	WayfindingEdge,
	WayfindingGraphDocument,
	WayfindingNode,
	WayfindingPoint,
	WayfindingWalkableMaskDocument,
	WayfindingWalkableMaskRun
} from '../../../src/utils/wayfinding';

type Tool = 'pan' | 'sample' | 'include' | 'exclude' | 'graph';

interface ColorSample {
	b: number;
	column: number;
	g: number;
	r: number;
	row: number;
}

interface DraggedVertex {
	edgeId: string;
	pointIndex: number;
}

interface ImagePoint extends WayfindingPoint {
	column: number;
	row: number;
}

const requireElement = <T extends Element>(selector: string): T => {
	const element: T | null = document.querySelector<T>(selector);

	if (!element) throw new Error(`Workbench element '${selector}' is missing.`);

	return element;
};

const canvas = requireElement<HTMLCanvasElement>('#stage');
const context: CanvasRenderingContext2D = canvas.getContext('2d', { alpha: false })!;
const imageFile = requireElement<HTMLInputElement>('#image-file');
const graphFile = requireElement<HTMLInputElement>('#graph-file');
const maskFile = requireElement<HTMLInputElement>('#mask-file');
const cellSizeInput = requireElement<HTMLInputElement>('#cell-size');
const toleranceInput = requireElement<HTMLInputElement>('#tolerance');
const brushInput = requireElement<HTMLInputElement>('#brush-size');
const maskConfirmedInput = requireElement<HTMLInputElement>('#mask-confirmed');
const cellSizeValue = requireElement<HTMLOutputElement>('#cell-size-value');
const toleranceValue = requireElement<HTMLOutputElement>('#tolerance-value');
const brushValue = requireElement<HTMLOutputElement>('#brush-value');
const maskStatus = requireElement<HTMLElement>('#mask-status');
const coverageStatus = requireElement<HTMLElement>('#coverage-status');
const edgeSummary = requireElement<HTMLElement>('#edge-summary');
const edgeFailures = requireElement<HTMLElement>('#edge-failures');
const selectedEdgeHost = requireElement<HTMLElement>('#selected-edge');
const edgeList = requireElement<HTMLElement>('#edge-list');
const stageEmpty = requireElement<HTMLElement>('#stage-empty');

let sourceImage: HTMLImageElement | undefined;
let sourcePixels: ImageData | undefined;
let graph: WayfindingGraphDocument | undefined;
let mask = new Uint8Array();
let maskColumns = 0;
let maskRows = 0;
let maskReviewStatus: 'confirmed' | 'proposed' = 'proposed';
let tool: Tool = 'sample';
let colorSamples: ColorSample[] = [];
let includeOverrides = new Set<number>();
let excludeOverrides = new Set<number>();
let selectedEdgeId: string | undefined;
let draggedVertex: DraggedVertex | undefined;
let insertPointForEdge: string | undefined;
let pointerDown = false;
let previousPointer = { x: 0, y: 0 };
let scale = 1;
let offsetX = 0;
let offsetY = 0;

const cellSize = (): number => Number(cellSizeInput.value);
const tolerance = (): number => Number(toleranceInput.value);
const brushRadius = (): number => Number(brushInput.value);

const graphNode = (id: string): WayfindingNode | undefined => graph?.nodes.find((node: WayfindingNode): boolean => node.id === id);

const edgePoints = (edge: WayfindingEdge): WayfindingPoint[] => {
	const from: WayfindingNode | undefined = graphNode(edge.from);
	const to: WayfindingNode | undefined = graphNode(edge.to);

	if (!from || !to) return [];

	return edge.geometry?.length ? edge.geometry : [from, to];
};

const resizeCanvas = (): void => {
	const bounds: DOMRect = canvas.getBoundingClientRect();
	const ratio: number = window.devicePixelRatio || 1;
	canvas.width = Math.max(1, Math.round(bounds.width * ratio));
	canvas.height = Math.max(1, Math.round(bounds.height * ratio));
	context.setTransform(ratio, 0, 0, ratio, 0, 0);
	draw();
};

const fitImage = (): void => {
	if (!sourceImage) return;

	const bounds: DOMRect = canvas.getBoundingClientRect();
	scale = Math.min(bounds.width / sourceImage.naturalWidth, bounds.height / sourceImage.naturalHeight) * 0.96;
	offsetX = (bounds.width - sourceImage.naturalWidth * scale) / 2;
	offsetY = (bounds.height - sourceImage.naturalHeight * scale) / 2;
};

const eventPoint = (event: PointerEvent | WheelEvent): WayfindingPoint => {
	const bounds: DOMRect = canvas.getBoundingClientRect();

	return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
};

const toImagePoint = (point: WayfindingPoint): ImagePoint => {
	const x: number = (point.x - offsetX) / scale;
	const y: number = (point.y - offsetY) / scale;

	return {
		column: Math.floor(x / cellSize()),
		row: Math.floor(y / cellSize()),
		x,
		y
	};
};

const toScreenPoint = (point: WayfindingPoint): WayfindingPoint => ({
	x: offsetX + point.x * scale,
	y: offsetY + point.y * scale
});

const maskIndex = (column: number, row: number): number => row * maskColumns + column;

const cellInBounds = (column: number, row: number): boolean => column >= 0 && row >= 0 && column < maskColumns && row < maskRows;

const resetMaskGrid = (): void => {
	if (!sourceImage) return;

	maskColumns = Math.ceil(sourceImage.naturalWidth / cellSize());
	maskRows = Math.ceil(sourceImage.naturalHeight / cellSize());
	mask = new Uint8Array(maskColumns * maskRows);
	includeOverrides = new Set<number>();
	excludeOverrides = new Set<number>();
	maskReviewStatus = 'proposed';
	maskConfirmedInput.checked = false;
};

const pixelColorAt = (x: number, y: number): Pick<ColorSample, 'r' | 'g' | 'b'> | undefined => {
	if (!sourceImage || !sourcePixels) return undefined;

	const pixelX: number = Math.max(0, Math.min(sourceImage.naturalWidth - 1, Math.round(x)));
	const pixelY: number = Math.max(0, Math.min(sourceImage.naturalHeight - 1, Math.round(y)));
	const index: number = (pixelY * sourceImage.naturalWidth + pixelX) * 4;

	return { r: sourcePixels.data[index], g: sourcePixels.data[index + 1], b: sourcePixels.data[index + 2] };
};

const colorMatches = (column: number, row: number): boolean => {
	const color = pixelColorAt((column + 0.5) * cellSize(), (row + 0.5) * cellSize());

	if (!color || colorSamples.length === 0) return false;

	return colorSamples.some((sample: ColorSample): boolean => {
		return Math.hypot(color.r - sample.r, color.g - sample.g, color.b - sample.b) <= tolerance();
	});
};

const extractConnectedMask = (): void => {
	if (!sourceImage || colorSamples.length === 0) return;

	const candidate = new Uint8Array(maskColumns * maskRows);
	const nextMask = new Uint8Array(maskColumns * maskRows);

	for (let row = 0; row < maskRows; row += 1) {
		for (let column = 0; column < maskColumns; column += 1) {
			if (colorMatches(column, row)) candidate[maskIndex(column, row)] = 1;
		}
	}

	const queue: Array<[number, number]> = colorSamples
		.filter((sample: ColorSample): boolean => cellInBounds(sample.column, sample.row) && candidate[maskIndex(sample.column, sample.row)] === 1)
		.map((sample: ColorSample): [number, number] => [sample.column, sample.row]);

	for (let cursor = 0; cursor < queue.length; cursor += 1) {
		const [column, row] = queue[cursor];
		const index: number = maskIndex(column, row);

		if (nextMask[index] === 1) continue;

		nextMask[index] = 1;

		for (const [nextColumn, nextRow] of [[column - 1, row], [column + 1, row], [column, row - 1], [column, row + 1]]) {
			if (!cellInBounds(nextColumn, nextRow)) continue;

			const nextIndex: number = maskIndex(nextColumn, nextRow);

			if (candidate[nextIndex] === 1 && nextMask[nextIndex] === 0) queue.push([nextColumn, nextRow]);
		}
	}

	for (const index of includeOverrides) nextMask[index] = 1;
	for (const index of excludeOverrides) nextMask[index] = 0;
	mask = nextMask;
	maskReviewStatus = 'proposed';
	maskConfirmedInput.checked = false;
	renderReview();
	draw();
};

const paintMask = (point: ImagePoint, include: boolean): void => {
	const radiusCells: number = Math.max(1, Math.ceil(brushRadius() / cellSize()));

	for (let row = point.row - radiusCells; row <= point.row + radiusCells; row += 1) {
		for (let column = point.column - radiusCells; column <= point.column + radiusCells; column += 1) {
			if (!cellInBounds(column, row)) continue;
			if (Math.hypot(column - point.column, row - point.row) > radiusCells) continue;

			const index: number = maskIndex(column, row);
			mask[index] = include ? 1 : 0;

			if (include) {
				includeOverrides.add(index);
				excludeOverrides.delete(index);
			} else {
				excludeOverrides.add(index);
				includeOverrides.delete(index);
			}
		}
	}

	maskReviewStatus = 'proposed';
	maskConfirmedInput.checked = false;
};

const pointWalkable = (point: WayfindingPoint): boolean => {
	const column: number = Math.floor(point.x / cellSize());
	const row: number = Math.floor(point.y / cellSize());

	return cellInBounds(column, row) && mask[maskIndex(column, row)] === 1;
};

const edgeFailuresFor = (edge: WayfindingEdge): WayfindingPoint[] => {
	const points: WayfindingPoint[] = edgePoints(edge);
	const failures: WayfindingPoint[] = [];
	const halfWidth: number = Math.max(0, (edge.corridorWidth ?? cellSize()) / 2);
	const step: number = Math.max(1, cellSize() / 2);

	for (let index = 1; index < points.length; index += 1) {
		const left: WayfindingPoint = points[index - 1];
		const right: WayfindingPoint = points[index];
		const dx: number = right.x - left.x;
		const dy: number = right.y - left.y;
		const length: number = Math.hypot(dx, dy);

		if (length === 0) continue;

		const sampleCount: number = Math.max(1, Math.ceil(length / step));
		const normalX: number = -dy / length;
		const normalY: number = dx / length;

		for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
			const ratio: number = sampleIndex / sampleCount;
			const center = { x: left.x + dx * ratio, y: left.y + dy * ratio };

			for (const offset of [0, -halfWidth, halfWidth]) {
				const sample = { x: center.x + normalX * offset, y: center.y + normalY * offset };

				if (!pointWalkable(sample)) failures.push(sample);
			}
		}
	}

	return failures;
};

const draw = (): void => {
	const bounds: DOMRect = canvas.getBoundingClientRect();
	context.save();
	context.setTransform(1, 0, 0, 1, 0, 0);
	context.fillStyle = '#323b39';
	context.fillRect(0, 0, canvas.width, canvas.height);
	context.restore();

	if (!sourceImage) return;

	context.save();
	context.translate(offsetX, offsetY);
	context.scale(scale, scale);
	context.drawImage(sourceImage, 0, 0);

	if (mask.length > 0) {
		context.fillStyle = 'rgba(0, 190, 158, 0.32)';

		for (let row = 0; row < maskRows; row += 1) {
			for (let column = 0; column < maskColumns; column += 1) {
				if (mask[maskIndex(column, row)] === 1) context.fillRect(column * cellSize(), row * cellSize(), cellSize(), cellSize());
			}
		}
	}

	for (const sample of colorSamples) {
		context.beginPath();
		context.arc((sample.column + 0.5) * cellSize(), (sample.row + 0.5) * cellSize(), 7 / scale, 0, Math.PI * 2);
		context.fillStyle = `rgb(${sample.r}, ${sample.g}, ${sample.b})`;
		context.fill();
		context.lineWidth = 2 / scale;
		context.strokeStyle = '#ffffff';
		context.stroke();
	}

	if (graph) {
		for (const edge of graph.edges) {
			const points: WayfindingPoint[] = edgePoints(edge);

			if (points.length < 2) continue;

			const valid: boolean = mask.length === 0 || edgeFailuresFor(edge).length === 0;
			context.beginPath();
			context.moveTo(points[0].x, points[0].y);

			for (const point of points.slice(1)) context.lineTo(point.x, point.y);

			context.lineCap = 'round';
			context.lineJoin = 'round';
			context.lineWidth = (edge.id === selectedEdgeId ? 5 : 2.5) / scale;
			context.strokeStyle = edge.id === selectedEdgeId ? '#ffd34e' : valid ? '#008f77' : '#e13f34';
			context.stroke();

			if (tool === 'graph' && edge.id === selectedEdgeId) {
				for (const point of points) {
					context.beginPath();
					context.arc(point.x, point.y, 6 / scale, 0, Math.PI * 2);
					context.fillStyle = '#fff8e9';
					context.fill();
					context.lineWidth = 2 / scale;
					context.strokeStyle = '#17201f';
					context.stroke();
				}
			}
		}
	}

	context.restore();
};

const distanceToSegment = (point: WayfindingPoint, left: WayfindingPoint, right: WayfindingPoint): number => {
	const lengthSquared: number = (right.x - left.x) ** 2 + (right.y - left.y) ** 2;

	if (lengthSquared === 0) return Math.hypot(point.x - left.x, point.y - left.y);

	const ratio: number = Math.max(0, Math.min(1, ((point.x - left.x) * (right.x - left.x) + (point.y - left.y) * (right.y - left.y)) / lengthSquared));
	const projection = { x: left.x + ratio * (right.x - left.x), y: left.y + ratio * (right.y - left.y) };

	return Math.hypot(point.x - projection.x, point.y - projection.y);
};

const nearestEdge = (point: WayfindingPoint): WayfindingEdge | undefined => {
	let selected: WayfindingEdge | undefined;
	let minimumDistance = 14 / scale;

	for (const edge of graph?.edges ?? []) {
		const points: WayfindingPoint[] = edgePoints(edge);

		for (let index = 1; index < points.length; index += 1) {
			const distance: number = distanceToSegment(point, points[index - 1], points[index]);

			if (distance < minimumDistance) {
				minimumDistance = distance;
				selected = edge;
			}
		}
	}

	return selected;
};

const nearestVertex = (edge: WayfindingEdge, point: WayfindingPoint): number | undefined => {
	let selected: number | undefined;
	let minimumDistance = 12 / scale;

	for (const [index, vertex] of edgePoints(edge).entries()) {
		const distance: number = Math.hypot(point.x - vertex.x, point.y - vertex.y);

		if (distance < minimumDistance) {
			minimumDistance = distance;
			selected = index;
		}
	}

	return selected;
};

const setNodePoint = (nodeId: string, point: WayfindingPoint): void => {
	if (!graph) return;

	const node: WayfindingNode | undefined = graphNode(nodeId);

	if (node) Object.assign(node, point);

	for (const edge of graph.edges) {
		if (!edge.geometry?.length) continue;
		if (edge.from === nodeId) edge.geometry[0] = { ...point };
		if (edge.to === nodeId) edge.geometry[edge.geometry.length - 1] = { ...point };
	}
};

const moveVertex = (drag: DraggedVertex, point: WayfindingPoint): void => {
	const edge: WayfindingEdge | undefined = graph?.edges.find((candidate: WayfindingEdge): boolean => candidate.id === drag.edgeId);

	if (!edge) return;

	const points: WayfindingPoint[] = edgePoints(edge);
	edge.geometry = points.map((candidate: WayfindingPoint): WayfindingPoint => ({ ...candidate }));
	edge.geometry[drag.pointIndex] = { ...point };
	edge.reviewStatus = 'proposed';

	if (drag.pointIndex === 0) setNodePoint(edge.from, point);
	if (drag.pointIndex === edge.geometry.length - 1) setNodePoint(edge.to, point);
};

const insertPoint = (edge: WayfindingEdge, point: WayfindingPoint): void => {
	const points: WayfindingPoint[] = edgePoints(edge).map((candidate: WayfindingPoint): WayfindingPoint => ({ ...candidate }));
	let segment = 1;
	let minimumDistance = Number.POSITIVE_INFINITY;

	for (let index = 1; index < points.length; index += 1) {
		const distance: number = distanceToSegment(point, points[index - 1], points[index]);

		if (distance < minimumDistance) {
			minimumDistance = distance;
			segment = index;
		}
	}

	points.splice(segment, 0, { ...point });
	edge.geometry = points;
	edge.reviewStatus = 'proposed';
};

const selectEdge = (edgeId: string | undefined): void => {
	selectedEdgeId = edgeId;
	insertPointForEdge = undefined;
	renderReview();
	draw();
};

const renderReview = (): void => {
	const edges: WayfindingEdge[] = graph?.edges ?? [];
	const invalidEdgeIds = new Set(edges.filter((edge: WayfindingEdge): boolean => mask.length > 0 && edgeFailuresFor(edge).length > 0).map((edge: WayfindingEdge): string => edge.id));
	const selected: WayfindingEdge | undefined = edges.find((edge: WayfindingEdge): boolean => edge.id === selectedEdgeId);

	maskStatus.textContent = mask.length === 0 ? 'NO MASK' : maskReviewStatus === 'confirmed' ? 'MASK CONFIRMED' : 'MASK NEEDS REVIEW';
	maskStatus.dataset.confirmed = String(maskReviewStatus === 'confirmed');
	edgeSummary.textContent = `${edges.length} edges`;
	edgeFailures.textContent = mask.length === 0 ? 'Extract or load a mask to evaluate routes' : invalidEdgeIds.size === 0 ? 'All edge corridors are contained' : `${invalidEdgeIds.size} edge(s) leave walkable space`;
	coverageStatus.textContent = graph && mask.length > 0 ? `${edges.length - invalidEdgeIds.size}/${edges.length} edges contained` : sourceImage ? 'Load graph and extract mask' : 'Load an image and graph';

	edgeList.replaceChildren(...edges.map((edge: WayfindingEdge): HTMLButtonElement => {
		const button: HTMLButtonElement = document.createElement('button');
		button.type = 'button';
		button.dataset.valid = String(!invalidEdgeIds.has(edge.id));
		button.className = edge.id === selectedEdgeId ? 'active' : '';
		button.innerHTML = `<i></i><strong></strong><small></small>`;
		button.querySelector('strong')!.textContent = edge.id;
		button.querySelector('small')!.textContent = edge.reviewStatus ?? 'legacy';
		button.addEventListener('click', (): void => { tool = 'graph'; setActiveTool(); selectEdge(edge.id); });

		return button;
	}));

	if (!selected) {
		selectedEdgeHost.innerHTML = '<p>Select an edge on the map to inspect it.</p>';

		return;
	}

	selectedEdgeHost.innerHTML = '<h2></h2><dl><dt>Traversal</dt><dd></dd><dt>Review</dt><dd></dd><dt>Corridor width</dt><dd></dd><dt>Mask failures</dt><dd></dd></dl><button type="button" data-action="insert">Insert geometry point</button><button type="button" data-action="confirm">Confirm edge geometry</button>';
	selectedEdgeHost.querySelector('h2')!.textContent = selected.id;
	const values: NodeListOf<HTMLElement> = selectedEdgeHost.querySelectorAll('dd');
	values[0].textContent = selected.traversal ?? 'unclassified';
	values[1].textContent = selected.reviewStatus ?? 'legacy';
	values[2].textContent = String(selected.corridorWidth ?? 'not set');
	values[3].textContent = String(invalidEdgeIds.has(selected.id) ? edgeFailuresFor(selected).length : 0);
	selectedEdgeHost.querySelector<HTMLButtonElement>('[data-action="insert"]')!.addEventListener('click', (): void => {
		insertPointForEdge = selected.id;
		coverageStatus.textContent = 'Tap the map to insert a point on the selected edge';
	});
	selectedEdgeHost.querySelector<HTMLButtonElement>('[data-action="confirm"]')!.addEventListener('click', (): void => {
		selected.reviewStatus = 'confirmed';
		renderReview();
		draw();
	});
};

const setActiveTool = (): void => {
	for (const button of document.querySelectorAll<HTMLButtonElement>('[data-tool]')) {
		button.classList.toggle('active', button.dataset.tool === tool);
	}
	canvas.style.cursor = tool === 'pan' ? 'grab' : tool === 'graph' ? 'default' : 'crosshair';
};

const downloadJson = (filename: string, value: unknown): void => {
	const link: HTMLAnchorElement = document.createElement('a');
	link.download = filename;
	link.href = URL.createObjectURL(new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: 'application/json' }));
	link.click();
	setTimeout((): void => { URL.revokeObjectURL(link.href); }, 0);
};

const maskRuns = (): WayfindingWalkableMaskRun[] => {
	const runs: WayfindingWalkableMaskRun[] = [];

	for (let row = 0; row < maskRows; row += 1) {
		let start = -1;

		for (let column = 0; column <= maskColumns; column += 1) {
			const walkable: boolean = column < maskColumns && mask[maskIndex(column, row)] === 1;

			if (walkable && start < 0) start = column;
			if (!walkable && start >= 0) {
				runs.push([row, start, column - 1]);
				start = -1;
			}
		}
	}

	return runs;
};

const loadJsonFile = async <T>(input: HTMLInputElement): Promise<T | undefined> => {
	const file: File | undefined = input.files?.[0];

	return file ? JSON.parse(await file.text()) as T : undefined;
};

imageFile.addEventListener('change', async (): Promise<void> => {
	const file: File | undefined = imageFile.files?.[0];

	if (!file) return;

	const url: string = URL.createObjectURL(file);
	const image = new Image();
	await new Promise<void>((resolve, reject): void => {
		image.onload = (): void => { resolve(); };
		image.onerror = (): void => { reject(new Error('The selected map image could not be decoded.')); };
		image.src = url;
	});
	URL.revokeObjectURL(url);
	sourceImage = image;
	const sourceCanvas: HTMLCanvasElement = document.createElement('canvas');
	sourceCanvas.width = image.naturalWidth;
	sourceCanvas.height = image.naturalHeight;
	const sourceContext: CanvasRenderingContext2D = sourceCanvas.getContext('2d', { willReadFrequently: true })!;
	sourceContext.drawImage(image, 0, 0);
	sourcePixels = sourceContext.getImageData(0, 0, image.naturalWidth, image.naturalHeight);
	colorSamples = [];
	resetMaskGrid();
	stageEmpty.classList.add('hidden');
	canvas.classList.add('ready');
	resizeCanvas();
	fitImage();
	renderReview();
	draw();
});

graphFile.addEventListener('change', async (): Promise<void> => {
	graph = await loadJsonFile<WayfindingGraphDocument>(graphFile);
	selectedEdgeId = undefined;
	renderReview();
	draw();
});

maskFile.addEventListener('change', async (): Promise<void> => {
	const document: WayfindingWalkableMaskDocument | undefined = await loadJsonFile<WayfindingWalkableMaskDocument>(maskFile);

	if (!document) return;

	cellSizeInput.value = String(document.cellSize);
	cellSizeValue.value = String(document.cellSize);
	maskColumns = document.columns;
	maskRows = document.rows;
	mask = new Uint8Array(maskColumns * maskRows);

	for (const [row, startColumn, endColumn] of document.walkableRuns) {
		for (let column = startColumn; column <= endColumn; column += 1) {
			if (cellInBounds(column, row)) mask[maskIndex(column, row)] = 1;
		}
	}

	maskReviewStatus = document.reviewStatus;
	maskConfirmedInput.checked = document.reviewStatus === 'confirmed';
	renderReview();
	draw();
});

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-tool]')) {
	button.addEventListener('click', (): void => {
		tool = button.dataset.tool as Tool;
		setActiveTool();
		draw();
	});
}

for (const [input, output] of [[cellSizeInput, cellSizeValue], [toleranceInput, toleranceValue], [brushInput, brushValue]] as const) {
	input.addEventListener('input', (): void => { output.value = input.value; });
}

cellSizeInput.addEventListener('change', (): void => { resetMaskGrid(); renderReview(); draw(); });
toleranceInput.addEventListener('change', extractConnectedMask);
requireElement<HTMLButtonElement>('#extract-mask').addEventListener('click', extractConnectedMask);
requireElement<HTMLButtonElement>('#clear-mask').addEventListener('click', (): void => { colorSamples = []; resetMaskGrid(); renderReview(); draw(); });
maskConfirmedInput.addEventListener('change', (): void => { maskReviewStatus = maskConfirmedInput.checked ? 'confirmed' : 'proposed'; renderReview(); });
requireElement<HTMLButtonElement>('#export-mask').addEventListener('click', (): void => {
	if (!sourceImage || mask.length === 0) return;

	downloadJson('walkable-mask.json', {
		cellSize: cellSize(),
		columns: maskColumns,
		contractVersion: 1,
		height: sourceImage.naturalHeight,
		mapId: graph?.graphId ?? 'wayfinding-map',
		reviewStatus: maskReviewStatus,
		rows: maskRows,
		walkableRuns: maskRuns(),
		width: sourceImage.naturalWidth
	} satisfies WayfindingWalkableMaskDocument);
});
requireElement<HTMLButtonElement>('#export-graph').addEventListener('click', (): void => { if (graph) downloadJson('route-graph.json', graph); });

canvas.addEventListener('pointerdown', (event: PointerEvent): void => {
	pointerDown = true;
	previousPointer = eventPoint(event);
	canvas.setPointerCapture(event.pointerId);
	const imagePoint: ImagePoint = toImagePoint(previousPointer);

	if (!sourceImage || imagePoint.x < 0 || imagePoint.y < 0 || imagePoint.x > sourceImage.naturalWidth || imagePoint.y > sourceImage.naturalHeight) return;

	if (insertPointForEdge && graph) {
		const edge: WayfindingEdge | undefined = graph.edges.find((candidate: WayfindingEdge): boolean => candidate.id === insertPointForEdge);

		if (edge) insertPoint(edge, imagePoint);
		insertPointForEdge = undefined;
		renderReview();
		draw();

		return;
	}

	if (tool === 'sample') {
		const color = pixelColorAt(imagePoint.x, imagePoint.y);

		if (color) colorSamples.push({ ...color, column: imagePoint.column, row: imagePoint.row });
		extractConnectedMask();
	} else if (tool === 'include' || tool === 'exclude') {
		paintMask(imagePoint, tool === 'include');
		renderReview();
		draw();
	} else if (tool === 'graph' && graph) {
		const edge: WayfindingEdge | undefined = selectedEdgeId
			? graph.edges.find((candidate: WayfindingEdge): boolean => candidate.id === selectedEdgeId)
			: nearestEdge(imagePoint);
		const vertex: number | undefined = edge ? nearestVertex(edge, imagePoint) : undefined;

		if (edge && vertex !== undefined) draggedVertex = { edgeId: edge.id, pointIndex: vertex };
		else selectEdge(nearestEdge(imagePoint)?.id);
	}
});

canvas.addEventListener('pointermove', (event: PointerEvent): void => {
	if (!pointerDown) return;

	const point: WayfindingPoint = eventPoint(event);
	const imagePoint: ImagePoint = toImagePoint(point);

	if (tool === 'pan') {
		offsetX += point.x - previousPointer.x;
		offsetY += point.y - previousPointer.y;
		previousPointer = point;
		draw();
	} else if (tool === 'include' || tool === 'exclude') {
		paintMask(imagePoint, tool === 'include');
		draw();
	} else if (tool === 'graph' && draggedVertex) {
		moveVertex(draggedVertex, imagePoint);
		draw();
	}
});

canvas.addEventListener('pointerup', (): void => {
	pointerDown = false;

	if (draggedVertex) {
		draggedVertex = undefined;
		renderReview();
		draw();
	}
});

canvas.addEventListener('wheel', (event: WheelEvent): void => {
	if (!sourceImage) return;

	event.preventDefault();
	const pointer: WayfindingPoint = eventPoint(event);
	const before: ImagePoint = toImagePoint(pointer);
	const nextScale: number = Math.max(0.1, Math.min(8, scale * (event.deltaY < 0 ? 1.12 : 0.89)));
	scale = nextScale;
	offsetX = pointer.x - before.x * scale;
	offsetY = pointer.y - before.y * scale;
	draw();
}, { passive: false });

window.addEventListener('resize', resizeCanvas);
setActiveTool();
renderReview();
resizeCanvas();
