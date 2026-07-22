import type {
	WayfindingEdge,
	WayfindingEdgeKind,
	WayfindingGraphDocument,
	WayfindingNode,
	WayfindingPoint,
	WayfindingTraversal,
	WayfindingWalkableMaskDocument,
	WayfindingWalkableMaskRun
} from '../../../src/utils/wayfinding';
import { WayfindingGraph } from '../../../src/utils/wayfinding';
import { addProposedEdge, addRouteNode, upsertLocationAnchor } from '../authoring.mts';
import {
	closeWalkableMask,
	extractSkeletonNetwork,
	nearestSkeletonIndex,
	retainAnchorNetworkCore,
	skeletonizeWalkableMask
} from '../centerline.mts';
import { assessWayfindingProject } from '../project.mts';
import type {
	WayfindingEvidenceItem,
	WayfindingEvidenceKey,
	WayfindingProjectDocument
} from '../project.mts';
import {
	createWayfindingRuntimeBundle,
	createWayfindingStudioProject,
	parseWayfindingStudioProject,
	synchronizeWayfindingStudioGraph,
	touchWayfindingStudioProject,
	validateWayfindingStudioDelivery,
	validateWayfindingStudioProject,
	type WayfindingStudioAsset,
	type WayfindingStudioDoorElement,
	type WayfindingStudioElement,
	type WayfindingStudioFloor,
	type WayfindingStudioLabelElement,
	type WayfindingStudioMediaElement,
	type WayfindingStudioOriginElement,
	type WayfindingStudioPointElement,
	type WayfindingStudioPolygonElement,
	type WayfindingStudioProject,
	type WayfindingStudioTransitionElement
} from '../studio-project.mts';

type SemanticPolygonTool = 'location' | 'obstacle' | 'walkable';
type Tool = 'pan' | 'sample' | 'include' | 'exclude' | 'anchor' | 'draw' | 'graph' | 'select' | SemanticPolygonTool | 'door' | 'poi' | 'origin' | 'transition' | 'label' | 'icon' | 'logo';

interface ColorSample {
	b: number;
	column: number;
	g: number;
	r: number;
	row: number;
}

interface DestinationRow extends Record<string, unknown> {
	accessible?: boolean;
	category?: string;
	description?: string;
	englishName?: string;
	floor?: string;
	hours?: string;
	id: string;
	mapNumber?: string;
	name: string;
	routeable?: boolean;
	status?: string;
}

interface DestinationTable {
	connectors?: Record<string, unknown>;
	header?: Record<string, string>;
	rows: DestinationRow[];
}

type DestinationDatasourceDocument = Record<string, DestinationTable>;

interface DraggedVertex {
	edgeId: string;
	pointIndex: number;
}

interface EdgeDraft {
	levelId: string;
	points: WayfindingPoint[];
	startNodeId: string;
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
const destinationFile = requireElement<HTMLInputElement>('#destination-file');
const projectFile = requireElement<HTMLInputElement>('#project-file');
const projectIdInput = requireElement<HTMLInputElement>('#project-id');
const sourceKindInput = requireElement<HTMLSelectElement>('#source-kind');
const sourcePresentationInput = requireElement<HTMLSelectElement>('#source-presentation');
const sourceLevelsInput = requireElement<HTMLInputElement>('#source-levels');
const targetModeInput = requireElement<HTMLSelectElement>('#target-mode');
const equivalentRedrawInput = requireElement<HTMLInputElement>('#equivalent-redraw');
const allowFallbackInput = requireElement<HTMLInputElement>('#allow-fallback');
const stepFreeRequiredInput = requireElement<HTMLInputElement>('#step-free-required');
const independentMaskInput = requireElement<HTMLInputElement>('#independent-mask');
const reviewerIdInput = requireElement<HTMLInputElement>('#reviewer-id');
const reviewMethodInput = requireElement<HTMLSelectElement>('#review-method');
const evidenceList = requireElement<HTMLElement>('#evidence-list');
const projectAssessment = requireElement<HTMLElement>('#project-assessment');
const cellSizeInput = requireElement<HTMLInputElement>('#cell-size');
const toleranceInput = requireElement<HTMLInputElement>('#tolerance');
const brushInput = requireElement<HTMLInputElement>('#brush-size');
const bridgeInput = requireElement<HTMLInputElement>('#bridge-size');
const maskConfirmedInput = requireElement<HTMLInputElement>('#mask-confirmed');
const cellSizeValue = requireElement<HTMLOutputElement>('#cell-size-value');
const toleranceValue = requireElement<HTMLOutputElement>('#tolerance-value');
const brushValue = requireElement<HTMLOutputElement>('#brush-value');
const bridgeValue = requireElement<HTMLOutputElement>('#bridge-value');
const maskStatus = requireElement<HTMLElement>('#mask-status');
const coverageStatus = requireElement<HTMLElement>('#coverage-status');
const edgeSummary = requireElement<HTMLElement>('#edge-summary');
const edgeFailures = requireElement<HTMLElement>('#edge-failures');
const selectedEdgeHost = requireElement<HTMLElement>('#selected-edge');
const edgeList = requireElement<HTMLElement>('#edge-list');
const stageEmpty = requireElement<HTMLElement>('#stage-empty');
const metadataEditor = requireElement<HTMLElement>('#metadata-editor');
const metadataSummary = requireElement<HTMLElement>('#metadata-summary');
const destinationSelect = requireElement<HTMLSelectElement>('#destination-select');
const destinationMapNumber = requireElement<HTMLInputElement>('#destination-map-number');
const destinationId = requireElement<HTMLInputElement>('#destination-id');
const destinationName = requireElement<HTMLInputElement>('#destination-name');
const destinationEnglishName = requireElement<HTMLInputElement>('#destination-english-name');
const destinationCategory = requireElement<HTMLInputElement>('#destination-category');
const destinationDescription = requireElement<HTMLTextAreaElement>('#destination-description');
const destinationHours = requireElement<HTMLInputElement>('#destination-hours');
const destinationStatus = requireElement<HTMLInputElement>('#destination-status');
const destinationAccessible = requireElement<HTMLSelectElement>('#destination-accessible');
const destinationRouteStatus = requireElement<HTMLInputElement>('#destination-route-status');
const levelIdInput = requireElement<HTMLInputElement>('#level-id');
const edgeDraftHost = requireElement<HTMLElement>('#edge-draft');
const edgeDraftStatus = requireElement<HTMLElement>('#edge-draft-status');
const finishJunctionButton = requireElement<HTMLButtonElement>('#finish-junction');
const cancelEdgeButton = requireElement<HTMLButtonElement>('#cancel-edge');
const studioProjectFile = requireElement<HTMLInputElement>('#studio-project-file');
const studioProjectName = requireElement<HTMLInputElement>('#studio-project-name');
const studioFloorSelect = requireElement<HTMLSelectElement>('#studio-floor');
const studioFloorName = requireElement<HTMLInputElement>('#studio-floor-name');
const studioValidation = requireElement<HTMLElement>('#studio-validation');
const semanticDraftHost = requireElement<HTMLElement>('#semantic-draft');
const semanticEditor = requireElement<HTMLElement>('#semantic-editor');
const routeStart = requireElement<HTMLSelectElement>('#route-start');
const routeDestination = requireElement<HTMLSelectElement>('#route-destination');
const routeProfile = requireElement<HTMLSelectElement>('#route-profile');
const routeResult = requireElement<HTMLElement>('#route-result');
const semanticMediaFile = requireElement<HTMLInputElement>('#semantic-media-file');

let sourceImage: HTMLImageElement | undefined;
let sourcePixels: ImageData | undefined;
const mediaImageCache = new Map<string, HTMLImageElement>();
let graph: WayfindingGraphDocument | undefined;
let destinationDocument: DestinationDatasourceDocument | undefined;
let destinationTableName: string | undefined;
let selectedDestinationId: string | undefined;
let mask: Uint8Array = new Uint8Array();
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
let edgeDraft: EdgeDraft | undefined;
let pointerDown = false;
let previousPointer = { x: 0, y: 0 };
let scale = 1;
let offsetX = 0;
let offsetY = 0;
let currentFloorId = 'level-0';
let semanticDraft: { points: WayfindingPoint[]; type: SemanticPolygonTool } | undefined;
let selectedSemanticId: string | undefined;
let simulatedRoute: ReturnType<WayfindingGraph['route']>;
let pendingMediaAssetId: string | undefined;
let draggedSemantic: { elementId: string; vertexIndex?: number } | undefined;

const EVIDENCE_KEYS: WayfindingEvidenceKey[] = [
	'destinationMetadata',
	'destinationAnchors',
	'currentLocationAnchors',
	'orientation',
	'walkableSpace',
	'routeTopology',
	'entranceApproaches',
	'levelTransitions',
	'accessibility'
];

let studioProject: WayfindingStudioProject = createWayfindingStudioProject();
let project: WayfindingProjectDocument = studioProject.delivery;

const cellSize = (): number => Number(cellSizeInput.value);
const tolerance = (): number => Number(toleranceInput.value);
const brushRadius = (): number => Number(brushInput.value);
const bridgeRadius = (): number => Number(bridgeInput.value);

const graphNode = (id: string): WayfindingNode | undefined => graph?.nodes.find((node: WayfindingNode): boolean => node.id === id);

const graphDocument = (): WayfindingGraphDocument => {
	graph ??= { contractVersion: 2, edges: [], graphId: 'wayfinding-map', nodes: [] };

	return graph;
};

const currentFloor = (): WayfindingStudioFloor => studioProject.floors.find((floor: WayfindingStudioFloor): boolean => floor.id === currentFloorId) ?? studioProject.floors[0];
const currentElements = (): WayfindingStudioElement[] => currentFloor().elements;
const semanticElement = (): WayfindingStudioElement | undefined => currentElements().find((element: WayfindingStudioElement): boolean => element.id === selectedSemanticId);
const layerVisible = (type: WayfindingStudioElement['type']): boolean => requireElement<HTMLInputElement>(`[data-layer="${type}"]`)?.checked ?? true;
const nextId = (prefix: string): string => {
	const elements: WayfindingStudioElement[] = studioProject.floors.flatMap((floor: WayfindingStudioFloor): WayfindingStudioElement[] => floor.elements);
	const ids: Set<string> = new Set([
		...elements.map((element: WayfindingStudioElement): string => element.id),
		...elements.filter((element): element is WayfindingStudioOriginElement => element.type === 'origin').map((origin): string => origin.screenId),
		...studioProject.assets.map((asset: WayfindingStudioAsset): string => asset.id),
		...studioProject.graph.nodes.map((node: WayfindingNode): string => node.id),
		...studioProject.graph.edges.map((edge: WayfindingEdge): string => edge.id)
	]);
	let index = 1;
	while (ids.has(`${prefix}-${index}`)) index += 1;
	return `${prefix}-${index}`;
};

const destinationDatasource = (): DestinationDatasourceDocument => ({ Destinations: { rows: studioProject.destinations as DestinationRow[] } });

const syncStudioGraph = (): void => {
	persistCurrentMask();
	studioProject.delivery = project;
	studioProject.graph = graphDocument();
	studioProject.destinations = destinationRows() as WayfindingStudioProject['destinations'];
	synchronizeWayfindingStudioGraph(studioProject);
	touchWayfindingStudioProject(studioProject);
	graph = studioProject.graph;
};

const downloadText = (name: string, value: string, type = 'application/json'): void => {
	const anchor: HTMLAnchorElement = document.createElement('a');
	anchor.href = URL.createObjectURL(new Blob([value], { type }));
	anchor.download = name;
	anchor.click();
	URL.revokeObjectURL(anchor.href);
};

const readFileDataUrl = (file: File): Promise<string> => new Promise((resolve, reject): void => {
	const reader = new FileReader();
	reader.onload = (): void => { resolve(String(reader.result)); };
	reader.onerror = (): void => { reject(reader.error ?? new Error('File could not be read.')); };
	reader.readAsDataURL(file);
});

const loadSourceImage = async (url: string): Promise<void> => {
	const image = new Image();
	await new Promise<void>((resolve, reject): void => {
		image.onload = (): void => { resolve(); };
		image.onerror = (): void => { reject(new Error('The selected map image could not be decoded.')); };
		image.src = url;
	});
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
};

const cachedMediaImage = (asset: WayfindingStudioAsset): HTMLImageElement => {
	const cached: HTMLImageElement | undefined = mediaImageCache.get(asset.id);
	if (cached?.src === asset.dataUrl) return cached;
	const image = new Image();
	image.onload = draw;
	image.src = asset.dataUrl;
	mediaImageCache.set(asset.id, image);
	return image;
};

const persistCurrentMask = (): void => {
	if (mask.length === 0 || !mask.some((value: number): boolean => value === 1) || maskColumns === 0 || maskRows === 0) {
		delete currentFloor().walkableMask;
		return;
	}
	currentFloor().walkableMask = {
		cellSize: cellSize(),
		columns: maskColumns,
		contractVersion: 1,
		height: currentFloor().height,
		mapId: `${studioProject.projectId}:${currentFloorId}`,
		reviewStatus: maskReviewStatus,
		rows: maskRows,
		walkableRuns: maskRuns(),
		width: currentFloor().width
	};
};

const applyMaskDocument = (document: WayfindingWalkableMaskDocument | undefined): void => {
	if (!document) return;
	cellSizeInput.value = String(document.cellSize);
	cellSizeValue.value = String(document.cellSize);
	maskColumns = document.columns;
	maskRows = document.rows;
	mask = new Uint8Array(maskColumns * maskRows);
	for (const [row, startColumn, endColumn] of document.walkableRuns) {
		for (let column = startColumn; column <= endColumn; column += 1) if (cellInBounds(column, row)) mask[maskIndex(column, row)] = 1;
	}
	maskReviewStatus = document.reviewStatus;
	maskConfirmedInput.checked = document.reviewStatus === 'confirmed';
};

const activateFloor = async (floorId: string): Promise<void> => {
	currentFloorId = studioProject.floors.some((floor: WayfindingStudioFloor): boolean => floor.id === floorId) ? floorId : studioProject.floors[0].id;
	levelIdInput.value = currentFloorId;
	selectedSemanticId = undefined;
	selectedEdgeId = undefined;
	simulatedRoute = undefined;
	mask = new Uint8Array();
	maskColumns = 0;
	maskRows = 0;
	sourceImage = undefined;
	sourcePixels = undefined;
	const backgroundId: string | undefined = currentFloor().backgroundAssetId;
	const background: WayfindingStudioAsset | undefined = backgroundId ? studioProject.assets.find((asset: WayfindingStudioAsset): boolean => asset.id === backgroundId) : undefined;
	stageEmpty.classList.add('hidden');
	canvas.classList.add('ready');
	if (background) await loadSourceImage(background.dataUrl);
	else {
		resizeCanvas();
		fitImage();
		draw();
	}
	applyMaskDocument(currentFloor().walkableMask);
	renderSemanticEditor();
	renderStudioControls();
	renderReview();
};

const destinationRows = (): DestinationRow[] => destinationTableName && destinationDocument
	? destinationDocument[destinationTableName]?.rows ?? []
	: [];

const selectedDestination = (): DestinationRow | undefined => destinationRows().find((row: DestinationRow): boolean => row.id === selectedDestinationId);

const stringValue = (value: unknown): string => typeof value === 'string' ? value : '';

const evidenceLabel = (key: WayfindingEvidenceKey): string => key.replace(/([a-z])([A-Z])/gu, '$1 $2');

const reviewerType = (): NonNullable<WayfindingEvidenceItem['review']>['reviewerType'] => {
	if (reviewMethodInput.value === 'customer-approval') return 'customer';
	if (reviewMethodInput.value === 'field-verification') return 'site-operator';
	if (reviewMethodInput.value === 'source-authority') return 'authoritative-source';

	return 'qualified-reviewer';
};

const applyProjectControls = (): void => {
	const previousProjectId: string = studioProject.projectId;
	project.projectId = projectIdInput.value.trim() || 'wayfinding-project';
	studioProject.projectId = project.projectId;
	if (studioProject.graph.graphId === `${previousProjectId}-graph`) studioProject.graph.graphId = `${studioProject.projectId}-graph`;
	project.source.kind = sourceKindInput.value as WayfindingProjectDocument['source']['kind'];
	project.source.presentation = sourcePresentationInput.value as WayfindingProjectDocument['source']['presentation'];
	project.source.levels = Math.max(1, Number.parseInt(sourceLevelsInput.value, 10) || 1);
	project.source.equivalentRedrawAllowed = equivalentRedrawInput.checked;
	project.guidance.targetMode = targetModeInput.value as WayfindingProjectDocument['guidance']['targetMode'];
	project.guidance.allowFallback = allowFallbackInput.checked;
	project.guidance.stepFreeRequired = stepFreeRequiredInput.checked;
	project.evidence.walkableSpace.independentFrom = independentMaskInput.checked ? ['routeTopology'] : undefined;

	for (const key of EVIDENCE_KEYS) {
		const item: WayfindingEvidenceItem = project.evidence[key];

		if (item.status !== 'confirmed') {
			delete item.review;

			continue;
		}

		const reviewedBy: string = reviewerIdInput.value.trim();

		if (!reviewedBy) {
			item.status = 'proposed';
			delete item.review;

			continue;
		}

		item.review = {
			method: reviewMethodInput.value as NonNullable<WayfindingEvidenceItem['review']>['method'],
			reviewedBy,
			reviewerType: reviewerType()
		};
	}
};

const syncProjectControls = (): void => {
	projectIdInput.value = project.projectId;
	sourceKindInput.value = project.source.kind;
	sourcePresentationInput.value = project.source.presentation;
	sourceLevelsInput.value = String(project.source.levels);
	targetModeInput.value = project.guidance.targetMode;
	equivalentRedrawInput.checked = project.source.equivalentRedrawAllowed;
	allowFallbackInput.checked = project.guidance.allowFallback;
	stepFreeRequiredInput.checked = project.guidance.stepFreeRequired;
	independentMaskInput.checked = project.evidence.walkableSpace.independentFrom?.includes('routeTopology') === true;
	const reviewedItem: WayfindingEvidenceItem | undefined = EVIDENCE_KEYS
		.map((key: WayfindingEvidenceKey): WayfindingEvidenceItem => project.evidence[key])
		.find((item: WayfindingEvidenceItem): boolean => Boolean(item.review));

	if (reviewedItem?.review) {
		reviewerIdInput.value = reviewedItem.review.reviewedBy;
		reviewMethodInput.value = reviewedItem.review.method;
	}
};

const renderProjectAssessment = (): void => {
	applyProjectControls();
	evidenceList.replaceChildren(...EVIDENCE_KEYS.map((key: WayfindingEvidenceKey): HTMLElement => {
		const item: WayfindingEvidenceItem = project.evidence[key];
		const row: HTMLDivElement = document.createElement('div');
		const label: HTMLElement = document.createElement('strong');
		const status: HTMLSelectElement = document.createElement('select');
		const provenance: HTMLSelectElement = document.createElement('select');

		row.className = 'evidence-row';
		label.textContent = evidenceLabel(key);
		for (const value of ['unavailable', 'proposed', 'confirmed'] as const) {
			const option: HTMLOptionElement = document.createElement('option');
			option.value = value;
			option.textContent = value;
			status.append(option);
		}
		for (const value of ['customer-provided', 'authoritative-import', 'reviewer-authored', 'vector-extraction', 'image-analysis', 'ai-inferred'] as const) {
			const option: HTMLOptionElement = document.createElement('option');
			option.value = value;
			option.textContent = value.replace('-', ' ');
			provenance.append(option);
		}
		status.value = item.status;
		provenance.value = item.provenance;
		status.addEventListener('change', (): void => {
			item.status = status.value as WayfindingEvidenceItem['status'];
			renderProjectAssessment();
		});
		provenance.addEventListener('change', (): void => {
			item.provenance = provenance.value as WayfindingEvidenceItem['provenance'];
			renderProjectAssessment();
		});
		row.append(label, status, provenance);

		return row;
	}));

	const assessment = assessWayfindingProject(project);
	const heading: HTMLElement = document.createElement('strong');
	heading.textContent = assessment.deliveryAllowed
		? `DELIVER ${assessment.deliveryMode.toUpperCase()}`
		: 'DELIVERY BLOCKED';
	const summary: HTMLElement = document.createElement('span');
	const relevantIssues = assessment.issues.filter((issue): boolean => issue.severity !== 'info');
	summary.textContent = assessment.targetSatisfied
		? `${assessment.targetMode} target is supported by confirmed evidence.`
		: relevantIssues.map((issue): string => issue.message).join(' ') || 'Confirm the required evidence before delivery.';
	projectAssessment.replaceChildren(heading, summary);
	projectAssessment.dataset.allowed = String(assessment.deliveryAllowed);
	projectAssessment.dataset.targetSatisfied = String(assessment.targetSatisfied);
};

const renderRouteSimulator = (): void => {
	const origins: WayfindingStudioOriginElement[] = studioProject.floors.flatMap((floor: WayfindingStudioFloor): WayfindingStudioOriginElement[] => floor.elements.filter((element: WayfindingStudioElement): element is WayfindingStudioOriginElement => element.type === 'origin'));
	const locationNodes: WayfindingNode[] = studioProject.graph.nodes.filter((node: WayfindingNode): boolean => node.kind === 'location' && Boolean(node.locationId));
	const previousStart: string = routeStart.value;
	const previousDestination: string = routeDestination.value;
	routeStart.replaceChildren(...origins.map((origin: WayfindingStudioOriginElement): HTMLOptionElement => {
		const option: HTMLOptionElement = document.createElement('option');
		option.value = `semantic:${origin.id}`;
		option.textContent = `${origin.label} (${origin.floorId})`;
		return option;
	}));
	routeDestination.replaceChildren(...locationNodes.map((node: WayfindingNode): HTMLOptionElement => {
		const option: HTMLOptionElement = document.createElement('option');
		const destination = studioProject.destinations.find((row): boolean => row.id === node.locationId);
		option.value = node.id;
		option.textContent = `${destination?.name ?? node.locationId} (${node.levelId})`;
		return option;
	}));
	if (Array.from(routeStart.options).some((option): boolean => option.value === previousStart)) routeStart.value = previousStart;
	if (Array.from(routeDestination.options).some((option): boolean => option.value === previousDestination)) routeDestination.value = previousDestination;
};

const renderStudioControls = (): void => {
	syncStudioGraph();
	studioProjectName.value = studioProject.name;
	sourceLevelsInput.value = String(studioProject.floors.length);
	studioFloorSelect.replaceChildren(...[...studioProject.floors].sort((left, right): number => left.order - right.order).map((floor: WayfindingStudioFloor): HTMLOptionElement => {
		const option: HTMLOptionElement = document.createElement('option');
		option.value = floor.id;
		option.textContent = floor.name;
		return option;
	}));
	studioFloorSelect.value = currentFloorId;
	studioFloorName.value = currentFloor().name;
	const structuralIssues = validateWayfindingStudioProject(studioProject);
	const structuralErrors = structuralIssues.filter((issue): boolean => issue.severity === 'error');
	const deliveryIssues = structuralErrors.length === 0 ? validateWayfindingStudioDelivery(studioProject) : structuralIssues;
	const deliveryErrors = deliveryIssues.filter((issue): boolean => issue.severity === 'error');
	studioValidation.dataset.allowed = String(deliveryErrors.length === 0);
	studioValidation.replaceChildren();
	const heading: HTMLElement = document.createElement('strong');
	heading.textContent = structuralErrors.length > 0
		? `${structuralErrors.length} STRUCTURAL ISSUE(S)`
		: deliveryErrors.length > 0
			? 'PROJECT DRAFT / RUNTIME BLOCKED'
			: 'RUNTIME EXPORT READY';
	const summary: HTMLElement = document.createElement('span');
	summary.textContent = deliveryIssues.length === 0 ? 'Project structure and delivery evidence are valid.' : deliveryIssues.slice(0, 4).map((issue): string => issue.message).join(' ');
	studioValidation.append(heading, summary);
	renderRouteSimulator();
};

const renderSemanticEditor = (): void => {
	const element: WayfindingStudioElement | undefined = semanticElement();
	semanticEditor.replaceChildren();
	const title: HTMLHeadingElement = document.createElement('h2');
	title.textContent = element ? `${element.type.toUpperCase()} / ${element.id}` : 'Semantic selection';
	semanticEditor.append(title);
	if (!element) {
		const empty: HTMLParagraphElement = document.createElement('p');
		empty.textContent = 'Select an authored location, point, door, label, or transition on the map.';
		semanticEditor.append(empty);
		return;
	}

	const selectField = (labelText: string, values: Array<[string, string]>, value: string, update: (next: string) => void): void => {
		const label = document.createElement('label');
		label.textContent = labelText;
		const select = document.createElement('select');
		for (const [optionValue, optionLabel] of values) select.add(new Option(optionLabel, optionValue));
		select.value = value;
		select.addEventListener('change', (): void => { update(select.value); syncStudioGraph(); renderStudioControls(); draw(); });
		label.append(select);
		semanticEditor.append(label);
	};
	const textField = (labelText: string, value: string, update: (next: string) => void, type: 'number' | 'text' = 'text'): void => {
		const label = document.createElement('label');
		label.textContent = labelText;
		const input = document.createElement('input');
		input.type = type;
		input.value = value;
		input.addEventListener('input', (): void => { update(input.value); syncStudioGraph(); renderStudioControls(); draw(); });
		label.append(input);
		semanticEditor.append(label);
	};

	selectField('Review status', [['proposed', 'Proposed'], ['confirmed', 'Confirmed']], element.status, (value): void => { element.status = value as WayfindingStudioElement['status']; });
	if ('label' in element && typeof element.label === 'string') textField('Label', element.label, (value): void => {
		element.label = value;
		if ((element.type === 'location' || element.type === 'poi') && element.destinationId) {
			const destination: DestinationRow | undefined = destinationRows().find((row: DestinationRow): boolean => row.id === element.destinationId);
			if (destination) destination.name = value || destination.id;
		}
	});
	if ('destinationId' in element) textField('Destination id', element.destinationId ?? '', (value): void => {
		const previousId: string | undefined = element.destinationId;
		const nextIdValue: string | undefined = value.trim() || undefined;
		element.destinationId = nextIdValue;
		if (previousId && nextIdValue && previousId !== nextIdValue) {
			const destination: DestinationRow | undefined = destinationRows().find((row: DestinationRow): boolean => row.id === previousId);
			if (destination) destination.id = nextIdValue;
		}
	});
	if (element.type === 'door') {
		const locations: WayfindingStudioPolygonElement[] = currentElements().filter((item: WayfindingStudioElement): item is WayfindingStudioPolygonElement => item.type === 'location');
		selectField('Location', [['', 'Unassigned'], ...locations.map((location): [string, string] => [location.id, location.label ?? location.id])], element.locationId ?? '', (value): void => { element.locationId = value || undefined; });
		textField('Angle', String(element.angle), (value): void => { element.angle = Number(value) || 0; }, 'number');
		textField('Length', String(element.length), (value): void => { element.length = Math.max(4, Number(value) || 4); }, 'number');
	} else if (element.type === 'origin') {
		textField('Screen id', element.screenId, (value): void => { element.screenId = value; });
		textField('Facing degrees', String(element.facingDegrees), (value): void => { element.facingDegrees = Number(value) || 0; }, 'number');
		textField('Default language', element.defaultLanguage ?? '', (value): void => { element.defaultLanguage = value || undefined; });
	} else if (element.type === 'transition') {
		textField('Connection id', element.connectionId, (value): void => { element.connectionId = value; });
		selectField('Kind', [['stairs', 'Stairs'], ['elevator', 'Elevator'], ['escalator', 'Escalator']], element.kind, (value): void => { element.kind = value as WayfindingStudioTransitionElement['kind']; });
		selectField('Accessibility', [['true', 'Step-free'], ['false', 'Not step-free']], String(element.accessible), (value): void => { element.accessible = value === 'true'; });
	} else if (element.type === 'label') {
		textField('Text', element.text, (value): void => { element.text = value; });
	} else if (element.type === 'poi') {
		textField('Category', element.category ?? '', (value): void => { element.category = value || undefined; });
	} else if (element.type === 'icon' || element.type === 'logo') {
		textField('Width', String(element.width), (value): void => { element.width = Math.max(8, Number(value) || 8); }, 'number');
		textField('Height', String(element.height), (value): void => { element.height = Math.max(8, Number(value) || 8); }, 'number');
	}
	const remove: HTMLButtonElement = document.createElement('button');
	remove.className = 'danger';
	remove.textContent = 'Delete semantic element';
	remove.addEventListener('click', (): void => {
		const removedIds = new Set<string>([element.id]);
		if (element.type === 'location') {
			for (const door of currentElements().filter((item): item is WayfindingStudioDoorElement => item.type === 'door' && item.locationId === element.id)) removedIds.add(door.id);
		}
		currentFloor().elements = currentElements().filter((item: WayfindingStudioElement): boolean => !removedIds.has(item.id));
		if ((element.type === 'location' || element.type === 'poi') && element.destinationId) {
			const rows: DestinationRow[] = destinationRows();
			for (let index: number = rows.length - 1; index >= 0; index -= 1) if (rows[index].id === element.destinationId) rows.splice(index, 1);
			if (selectedDestinationId === element.destinationId) selectedDestinationId = rows[0]?.id;
		}
		selectedSemanticId = undefined;
		syncStudioGraph();
		renderSemanticEditor();
		renderStudioControls();
		draw();
	});
	semanticEditor.append(remove);
};

const renderMetadataEditor = (): void => {
	const rows: DestinationRow[] = destinationRows();
	metadataEditor.hidden = rows.length === 0;

	if (rows.length === 0) return;

	if (!selectedDestinationId || !rows.some((row: DestinationRow): boolean => row.id === selectedDestinationId)) {
		selectedDestinationId = rows[0].id;
	}

	destinationSelect.replaceChildren(...rows.map((row: DestinationRow): HTMLOptionElement => {
		const option: HTMLOptionElement = document.createElement('option');
		option.value = row.id;
		option.textContent = [stringValue(row.mapNumber), row.name].filter(Boolean).join(' - ');

		return option;
	}));
	destinationSelect.value = selectedDestinationId;

	const row: DestinationRow | undefined = selectedDestination();
	const graphLocationIds = new Set((graph?.nodes ?? []).filter((node: WayfindingNode): boolean => node.kind === 'location').map((node: WayfindingNode): string | undefined => node.locationId));
	const missingRouteAnchors: number = rows.filter((candidate: DestinationRow): boolean => !graphLocationIds.has(candidate.id)).length;
	metadataSummary.textContent = project.guidance.targetMode === 'route'
		? `${rows.length} destinations - ${missingRouteAnchors === 0 ? 'all rows have graph anchors' : `${missingRouteAnchors} row(s) have no graph anchor`}`
		: `${rows.length} destinations - route graph optional for ${project.guidance.targetMode} delivery`;

	if (!row) return;

	destinationMapNumber.value = stringValue(row.mapNumber);
	destinationId.value = row.id;
	destinationName.value = row.name;
	destinationEnglishName.value = stringValue(row.englishName);
	destinationCategory.value = stringValue(row.category);
	destinationDescription.value = stringValue(row.description);
	destinationHours.value = stringValue(row.hours);
	destinationStatus.value = stringValue(row.status);
	destinationAccessible.value = typeof row.accessible === 'boolean' ? String(row.accessible) : '';
	destinationRouteStatus.value = graphLocationIds.has(row.id) ? 'Graph anchor present' : 'Listed only';
	draw();
};

const updateSelectedDestination = (field: keyof DestinationRow, value: unknown): void => {
	const row: DestinationRow | undefined = selectedDestination();

	if (!row) return;

	if (value === undefined || value === '') delete row[field];
	else row[field] = value as never;

	if (field === 'name' || field === 'mapNumber') {
		const selectedOption: HTMLOptionElement | undefined = Array.from(destinationSelect.options).find((option: HTMLOptionElement): boolean => option.value === row.id);

		if (selectedOption) selectedOption.textContent = [stringValue(row.mapNumber), row.name].filter(Boolean).join(' - ');
	}
};

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
	const bounds: DOMRect = canvas.getBoundingClientRect();
	const width: number = sourceImage?.naturalWidth ?? currentFloor().width;
	const height: number = sourceImage?.naturalHeight ?? currentFloor().height;
	scale = Math.min(bounds.width / width, bounds.height / height) * 0.96;
	offsetX = (bounds.width - width * scale) / 2;
	offsetY = (bounds.height - height * scale) / 2;
};

const eventPoint = (event: MouseEvent | PointerEvent | WheelEvent): WayfindingPoint => {
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

const drawSemanticElements = (): void => {
	const colors: Record<string, string> = {
		door: '#17201f', label: '#17201f', location: '#d9981c', obstacle: '#a83c32', origin: '#138b75', poi: '#2b6cb0', transition: '#7b4bc4', walkable: '#17a886'
	};
	for (const element of currentElements()) {
		if (!layerVisible(element.type)) continue;
		const selected: boolean = element.id === selectedSemanticId;
		context.save();
		context.lineWidth = (selected ? 5 : 2.5) / scale;
		context.strokeStyle = selected ? '#ffe06c' : colors[element.type];
		context.fillStyle = `${colors[element.type]}33`;
		if (element.type === 'icon' || element.type === 'logo') {
			const asset: WayfindingStudioAsset | undefined = studioProject.assets.find((candidate: WayfindingStudioAsset): boolean => candidate.id === element.assetId);
			if (asset) {
				const image: HTMLImageElement = cachedMediaImage(asset);
				if (image.complete) context.drawImage(image, element.point.x, element.point.y, element.width, element.height);
			}
			context.strokeRect(element.point.x, element.point.y, element.width, element.height);
		} else if ('geometry' in element) {
			context.beginPath();
			context.moveTo(element.geometry[0].x, element.geometry[0].y);
			for (const vertex of element.geometry.slice(1)) context.lineTo(vertex.x, vertex.y);
			context.closePath();
			context.fill();
			context.stroke();
			if (selected) {
				context.fillStyle = '#fffdf6';
				for (const vertex of element.geometry) {
					context.beginPath();
					context.arc(vertex.x, vertex.y, 7 / scale, 0, Math.PI * 2);
					context.fill();
					context.stroke();
				}
			}
		} else if (element.type === 'door') {
			const radians: number = element.angle * Math.PI / 180;
			const dx: number = Math.cos(radians) * element.length / 2;
			const dy: number = Math.sin(radians) * element.length / 2;
			context.beginPath();
			context.moveTo(element.point.x - dx, element.point.y - dy);
			context.lineTo(element.point.x + dx, element.point.y + dy);
			context.stroke();
		} else if (element.type === 'label') {
			context.fillStyle = colors.label;
			context.font = `${Math.max(14, 18 / scale)}px Arial`;
			context.fillText(element.text, element.point.x, element.point.y);
		} else {
			context.beginPath();
			context.arc(element.point.x, element.point.y, (selected ? 12 : 8) / scale, 0, Math.PI * 2);
			context.fill();
			context.stroke();
			if (element.type === 'origin') {
				context.beginPath();
				context.moveTo(element.point.x, element.point.y);
				const radians: number = (element.facingDegrees - 90) * Math.PI / 180;
				context.lineTo(element.point.x + Math.cos(radians) * 28 / scale, element.point.y + Math.sin(radians) * 28 / scale);
				context.stroke();
			}
		}
		context.restore();
	}
	if (semanticDraft?.points.length) {
		context.beginPath();
		context.moveTo(semanticDraft.points[0].x, semanticDraft.points[0].y);
		for (const point of semanticDraft.points.slice(1)) context.lineTo(point.x, point.y);
		context.setLineDash([9 / scale, 6 / scale]);
		context.lineWidth = 3 / scale;
		context.strokeStyle = colors[semanticDraft.type];
		context.stroke();
		context.setLineDash([]);
	}
};

const pointInPolygon = (pointValue: WayfindingPoint, polygon: WayfindingPoint[]): boolean => {
	let inside = false;
	for (let left = 0, right = polygon.length - 1; left < polygon.length; right = left++) {
		const a: WayfindingPoint = polygon[left];
		const b: WayfindingPoint = polygon[right];
		if ((a.y > pointValue.y) !== (b.y > pointValue.y) && pointValue.x < (b.x - a.x) * (pointValue.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
	}
	return inside;
};

const nearestSemantic = (pointValue: WayfindingPoint): WayfindingStudioElement | undefined => [...currentElements()].reverse().find((element: WayfindingStudioElement): boolean => {
	if ('geometry' in element) return pointInPolygon(pointValue, element.geometry);
	if (element.type === 'icon' || element.type === 'logo') return pointValue.x >= element.point.x && pointValue.x <= element.point.x + element.width && pointValue.y >= element.point.y && pointValue.y <= element.point.y + element.height;
	return Math.hypot(element.point.x - pointValue.x, element.point.y - pointValue.y) <= 18 / scale;
});

const addSemanticPoint = (type: Exclude<Tool, 'anchor' | 'draw' | 'exclude' | 'graph' | 'include' | 'location' | 'obstacle' | 'pan' | 'sample' | 'select' | 'walkable'>, pointValue: WayfindingPoint): void => {
	const base = { floorId: currentFloorId, provenance: 'reviewer-authored' as const, status: 'proposed' as const };
	let element: WayfindingStudioElement;
	if (type === 'door') element = { ...base, angle: 0, id: nextId('door'), length: 36, point: pointValue, type } satisfies WayfindingStudioDoorElement;
	else if (type === 'poi') {
		const id: string = nextId('poi');
		element = { ...base, destinationId: id, id, label: `Point of interest ${id.split('-').at(-1)}`, point: pointValue, type } satisfies WayfindingStudioPointElement;
		destinationRows().push({ floor: currentFloorId, id, name: element.label ?? id, routeable: true });
	} else if (type === 'origin') element = { ...base, facingDegrees: 0, id: nextId('origin'), label: 'You are here', point: pointValue, screenId: nextId('screen'), type } satisfies WayfindingStudioOriginElement;
	else if (type === 'transition') {
		const id: string = nextId('transition');
		element = { ...base, accessible: false, connectionId: id, id, kind: 'stairs', label: 'Transition', point: pointValue, type } satisfies WayfindingStudioTransitionElement;
	} else if (type === 'icon' || type === 'logo') {
		if (!pendingMediaAssetId) {
			coverageStatus.textContent = 'Choose an icon or logo asset before placing it.';
			return;
		}
		const sourceAsset: WayfindingStudioAsset | undefined = studioProject.assets.find((asset: WayfindingStudioAsset): boolean => asset.id === pendingMediaAssetId);
		if (!sourceAsset) return;
		const asset: WayfindingStudioAsset = sourceAsset.kind === type
			? sourceAsset
			: { ...sourceAsset, id: nextId(`asset-${type}`), kind: type };
		if (asset !== sourceAsset) studioProject.assets.push(asset);
		element = { ...base, assetId: asset.id, height: 96, id: nextId(type), point: pointValue, type, width: 96 } satisfies WayfindingStudioMediaElement;
	} else element = { ...base, id: nextId('label'), point: pointValue, text: 'Label', type: 'label' } satisfies WayfindingStudioLabelElement;
	currentFloor().elements.push(element);
	selectedSemanticId = element.id;
	syncStudioGraph();
	renderSemanticEditor();
	renderStudioControls();
	draw();
};

const finishSemanticPolygon = (): void => {
	if (!semanticDraft || semanticDraft.points.length < 3) return;
	const id: string = nextId(semanticDraft.type);
	const element: WayfindingStudioPolygonElement = {
		floorId: currentFloorId,
		geometry: semanticDraft.points,
		id,
		label: semanticDraft.type === 'location' ? `Location ${id.split('-').at(-1)}` : undefined,
		provenance: 'reviewer-authored',
		status: 'proposed',
		type: semanticDraft.type
	};
	if (element.type === 'location') {
		element.destinationId = id;
		destinationRows().push({ floor: currentFloorId, id, name: element.label ?? id, routeable: true });
	}
	currentFloor().elements.push(element);
	selectedSemanticId = element.id;
	semanticDraft = undefined;
	semanticDraftHost.hidden = true;
	syncStudioGraph();
	renderSemanticEditor();
	renderStudioControls();
	draw();
};

const draw = (): void => {
	const bounds: DOMRect = canvas.getBoundingClientRect();
	context.save();
	context.setTransform(1, 0, 0, 1, 0, 0);
	context.fillStyle = '#323b39';
	context.fillRect(0, 0, canvas.width, canvas.height);
	context.restore();

	context.save();
	context.translate(offsetX, offsetY);
	context.scale(scale, scale);
	if (sourceImage) context.drawImage(sourceImage, 0, 0);
	else {
		context.fillStyle = '#f7f5ef';
		context.fillRect(0, 0, currentFloor().width, currentFloor().height);
	}
	drawSemanticElements();

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
			const fromNode: WayfindingNode | undefined = graphNode(edge.from);
			const toNode: WayfindingNode | undefined = graphNode(edge.to);
			if (!fromNode || !toNode || fromNode.levelId !== currentFloorId || toNode.levelId !== currentFloorId) continue;
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

		if (tool === 'anchor' || tool === 'draw') {
			for (const node of graph.nodes) {
				if (node.levelId !== currentFloorId) continue;
				context.beginPath();
				context.arc(node.x, node.y, (node.kind === 'location' ? 7 : 5) / scale, 0, Math.PI * 2);
				context.fillStyle = node.kind === 'location' ? '#ffd34e' : '#fff8e9';
				context.fill();
				context.lineWidth = 2 / scale;
				context.strokeStyle = '#17201f';
				context.stroke();
			}
		}

		if (edgeDraft && edgeDraft.points.length > 0) {
			context.beginPath();
			context.moveTo(edgeDraft.points[0].x, edgeDraft.points[0].y);

			for (const point of edgeDraft.points.slice(1)) context.lineTo(point.x, point.y);

			context.lineCap = 'round';
			context.lineJoin = 'round';
			context.lineWidth = 4 / scale;
			context.setLineDash([10 / scale, 6 / scale]);
			context.strokeStyle = '#ffd34e';
			context.stroke();
			context.setLineDash([]);
		}

		const selectedNode: WayfindingNode | undefined = graph.nodes.find((node: WayfindingNode): boolean => node.levelId === currentFloorId && node.locationId === selectedDestinationId);

		if (selectedNode) {
			context.beginPath();
			context.arc(selectedNode.x, selectedNode.y, 12 / scale, 0, Math.PI * 2);
			context.fillStyle = 'rgba(255, 211, 78, 0.36)';
			context.fill();
			context.lineWidth = 4 / scale;
			context.strokeStyle = '#ffd34e';
			context.stroke();
		}
	}
	if (simulatedRoute) {
		const points = simulatedRoute.path.filter((routePoint): boolean => routePoint.levelId === currentFloorId);
		if (points.length > 1) {
			context.beginPath();
			context.moveTo(points[0].x, points[0].y);
			for (const point of points.slice(1)) context.lineTo(point.x, point.y);
			context.lineWidth = 7 / scale;
			context.lineCap = 'round';
			context.lineJoin = 'round';
			context.strokeStyle = '#f04438';
			context.stroke();
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
		if (graphNode(edge.from)?.levelId !== currentFloorId || graphNode(edge.to)?.levelId !== currentFloorId) continue;
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

const nearestNode = (point: WayfindingPoint): WayfindingNode | undefined => {
	let selected: WayfindingNode | undefined;
	let minimumDistance = 16 / scale;

	for (const node of graph?.nodes ?? []) {
		if (node.levelId !== currentFloorId) continue;
		const distance: number = Math.hypot(point.x - node.x, point.y - node.y);

		if (distance < minimumDistance) {
			minimumDistance = distance;
			selected = node;
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

	if (node) {
		Object.assign(node, point);
		if (node.semanticElementId) {
			const element: WayfindingStudioElement | undefined = studioProject.floors.flatMap((floor: WayfindingStudioFloor): WayfindingStudioElement[] => floor.elements).find((candidate: WayfindingStudioElement): boolean => candidate.id === node.semanticElementId);
			if (element && 'point' in element) element.point = { ...point };
		}
	}

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

const renderEdgeDraft = (): void => {
	edgeDraftHost.hidden = !edgeDraft;
	finishJunctionButton.disabled = !edgeDraft || edgeDraft.points.length < 2;
	edgeDraftStatus.textContent = edgeDraft
		? `${edgeDraft.startNodeId} - ${Math.max(0, edgeDraft.points.length - 1)} authored point(s)`
		: 'Tap an existing node to start an edge.';
};

const placeDestinationAnchor = (point: WayfindingPoint): void => {
	const destination: DestinationRow | undefined = selectedDestination();

	if (!destination) {
		coverageStatus.textContent = 'Load and select a destination before placing an anchor';

		return;
	}

	const node: WayfindingNode = upsertLocationAnchor(graphDocument(), destination.id, point, levelIdInput.value.trim() || 'level-0');
	selectedEdgeId = undefined;
	renderMetadataEditor();
	renderReview();
	coverageStatus.textContent = `Placed ${destination.name} approach anchor at ${Math.round(node.x)}, ${Math.round(node.y)}; verify it is on walkable space`;
	draw();
};

const finishEdgeAtNode = (node: WayfindingNode): void => {
	if (!edgeDraft || node.id === edgeDraft.startNodeId || node.levelId !== edgeDraft.levelId) {
		coverageStatus.textContent = node.levelId !== edgeDraft?.levelId ? 'Cross-level edges require an explicit transition workflow' : 'Choose a different end node';

		return;
	}

	const edge: WayfindingEdge = addProposedEdge(graphDocument(), edgeDraft.startNodeId, node.id, [...edgeDraft.points, node]);
	edgeDraft = undefined;
	selectedEdgeId = edge.id;
	renderEdgeDraft();
	renderReview();
	coverageStatus.textContent = `Created proposed edge ${edge.id}; classify and confirm it after mask review`;
	draw();
};

const authorEdgePoint = (point: WayfindingPoint): void => {
	const node: WayfindingNode | undefined = nearestNode(point);

	if (!edgeDraft) {
		if (!node) {
			coverageStatus.textContent = 'Start an edge by tapping an existing destination or route node';

			return;
		}

		edgeDraft = { levelId: node.levelId, points: [{ x: node.x, y: node.y }], startNodeId: node.id };
		renderEdgeDraft();
		coverageStatus.textContent = 'Tap corridor bends, then an existing node; or finish at a new junction';
		draw();

		return;
	}

	if (node) {
		finishEdgeAtNode(node);

		return;
	}

	edgeDraft.points.push({ x: point.x, y: point.y });
	renderEdgeDraft();
	draw();
};

const finishEdgeAtJunction = (): void => {
	if (!edgeDraft || edgeDraft.points.length < 2) return;

	const endpoint: WayfindingPoint = edgeDraft.points[edgeDraft.points.length - 1];
	const node: WayfindingNode = addRouteNode(graphDocument(), endpoint, edgeDraft.levelId);
	finishEdgeAtNode(node);
};

const cancelEdgeDraft = (): void => {
	edgeDraft = undefined;
	renderEdgeDraft();
	draw();
};

const renderReview = (): void => {
	const edges: WayfindingEdge[] = graph?.edges ?? [];
	const hasWalkableMask: boolean = mask.some((value: number): boolean => value === 1);
	const invalidEdgeIds = new Set(edges.filter((edge: WayfindingEdge): boolean => hasWalkableMask && edgeFailuresFor(edge).length > 0).map((edge: WayfindingEdge): string => edge.id));
	const selected: WayfindingEdge | undefined = edges.find((edge: WayfindingEdge): boolean => edge.id === selectedEdgeId);

	maskStatus.textContent = !hasWalkableMask
		? project.guidance.targetMode === 'route' ? 'NO MASK' : 'MASK OPTIONAL'
		: maskReviewStatus === 'confirmed' ? 'MASK CONFIRMED' : 'MASK NEEDS REVIEW';
	maskStatus.dataset.confirmed = String(hasWalkableMask && maskReviewStatus === 'confirmed');
	edgeSummary.textContent = `${edges.length} edges`;
	edgeFailures.textContent = !hasWalkableMask
		? project.guidance.targetMode === 'route' ? 'Extract or load a mask to evaluate routes' : `Walkable mask is optional for ${project.guidance.targetMode} delivery`
		: invalidEdgeIds.size === 0 ? 'All edge corridors are contained' : `${invalidEdgeIds.size} edge(s) leave walkable space`;
	coverageStatus.textContent = graph && hasWalkableMask
		? `${edges.length - invalidEdgeIds.size}/${edges.length} edges contained`
		: sourceImage
			? 'Background loaded; author semantic layers'
			: `${currentElements().length} semantic element(s) on ${currentFloor().name}`;

	edgeList.replaceChildren(...edges.map((edge: WayfindingEdge): HTMLButtonElement => {
		const button: HTMLButtonElement = document.createElement('button');
		button.type = 'button';
		button.dataset.valid = String(!invalidEdgeIds.has(edge.id));
		button.className = edge.id === selectedEdgeId ? 'active' : '';
		button.innerHTML = `<i></i><strong></strong><small></small>`;
		button.querySelector('strong')!.textContent = edge.id;
		button.querySelector('small')!.textContent = edge.reviewStatus ?? 'unreviewed';
		button.addEventListener('click', (): void => { tool = 'graph'; setActiveTool(); selectEdge(edge.id); });

		return button;
	}));

	if (!selected) {
		selectedEdgeHost.innerHTML = '<p>Select an edge on the map to inspect it.</p>';

		return;
	}

	selectedEdgeHost.innerHTML = `
		<h2></h2>
		<div class="edge-fields">
			<label>Kind<select data-edge-field="kind"><option value="walk">Walk</option><option value="outdoor">Outdoor</option><option value="stairs">Stairs</option><option value="elevator">Elevator</option><option value="escalator">Escalator</option><option value="shuttle">Shuttle</option></select></label>
			<label>Traversal<select data-edge-field="traversal"><option value="outdoor-path">Outdoor path</option><option value="crossing">Crossing</option><option value="indoor-corridor">Indoor corridor</option><option value="open-area">Open area</option><option value="portal">Portal</option><option value="transition">Transition</option></select></label>
			<label>Step-free status<select data-edge-field="accessible"><option value="false">Unverified / no</option><option value="true">Verified step-free</option></select></label>
			<label>Corridor width<input data-edge-field="corridorWidth" type="number" min="0.1" step="0.5"></label>
			<label class="check"><input data-edge-field="bidirectional" type="checkbox"> Bidirectional</label>
		</div>
		<dl><dt>Review</dt><dd></dd><dt>Mask failures</dt><dd></dd></dl>
		<button type="button" data-action="insert">Insert geometry point</button>
		<button type="button" data-action="confirm">Confirm contained geometry</button>
		<button type="button" data-action="delete" class="danger">Delete edge</button>`;
	selectedEdgeHost.querySelector('h2')!.textContent = selected.id;
	const values: NodeListOf<HTMLElement> = selectedEdgeHost.querySelectorAll('dd');
	values[0].textContent = selected.reviewStatus ?? 'unreviewed';
	values[1].textContent = String(invalidEdgeIds.has(selected.id) ? edgeFailuresFor(selected).length : 0);
	const kindSelect = selectedEdgeHost.querySelector<HTMLSelectElement>('[data-edge-field="kind"]')!;
	const traversalSelect = selectedEdgeHost.querySelector<HTMLSelectElement>('[data-edge-field="traversal"]')!;
	const accessibleSelect = selectedEdgeHost.querySelector<HTMLSelectElement>('[data-edge-field="accessible"]')!;
	const corridorWidthInput = selectedEdgeHost.querySelector<HTMLInputElement>('[data-edge-field="corridorWidth"]')!;
	const bidirectionalInput = selectedEdgeHost.querySelector<HTMLInputElement>('[data-edge-field="bidirectional"]')!;
	kindSelect.value = selected.kind;
	traversalSelect.value = selected.traversal ?? 'open-area';
	accessibleSelect.value = String(selected.accessible);
	corridorWidthInput.value = String(selected.corridorWidth ?? cellSize());
	bidirectionalInput.checked = selected.bidirectional;
	const updateEdge = (): void => {
		selected.reviewStatus = 'proposed';
		renderReview();
		draw();
	};
	kindSelect.addEventListener('change', (): void => { selected.kind = kindSelect.value as WayfindingEdgeKind; updateEdge(); });
	traversalSelect.addEventListener('change', (): void => { selected.traversal = traversalSelect.value as WayfindingTraversal; updateEdge(); });
	accessibleSelect.addEventListener('change', (): void => { selected.accessible = accessibleSelect.value === 'true'; updateEdge(); });
	corridorWidthInput.addEventListener('change', (): void => {
		const width: number = Number(corridorWidthInput.value);

		if (Number.isFinite(width) && width > 0) selected.corridorWidth = width;
		updateEdge();
	});
	bidirectionalInput.addEventListener('change', (): void => { selected.bidirectional = bidirectionalInput.checked; updateEdge(); });
	selectedEdgeHost.querySelector<HTMLButtonElement>('[data-action="insert"]')!.addEventListener('click', (): void => {
		insertPointForEdge = selected.id;
		coverageStatus.textContent = 'Tap the map to insert a point on the selected edge';
	});
	selectedEdgeHost.querySelector<HTMLButtonElement>('[data-action="confirm"]')!.addEventListener('click', (): void => {
		if (mask.length === 0 || maskReviewStatus !== 'confirmed') {
			coverageStatus.textContent = 'Confirm the independently reviewed walkable mask before confirming an edge';

			return;
		}

		const failures: WayfindingPoint[] = edgeFailuresFor(selected);

		if (failures.length > 0) {
			coverageStatus.textContent = `${selected.id} leaves walkable space at ${failures.length} sampled point(s)`;

			return;
		}

		selected.reviewStatus = 'confirmed';
		renderReview();
		draw();
	});
	selectedEdgeHost.querySelector<HTMLButtonElement>('[data-action="delete"]')!.addEventListener('click', (): void => {
		if (!graph) return;

		graph.edges = graph.edges.filter((edge: WayfindingEdge): boolean => edge.id !== selected.id);
		selectedEdgeId = undefined;
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

const pointForMaskIndex = (index: number): WayfindingPoint => ({
	x: (index % maskColumns + 0.5) * cellSize(),
	y: (Math.floor(index / maskColumns) + 0.5) * cellSize()
});

const simplifyGeometry = (points: WayfindingPoint[], toleranceValue: number): WayfindingPoint[] => {
	if (points.length <= 2) return points;

	let splitIndex = -1;
	let maximumDistance = 0;
	const start: WayfindingPoint = points[0];
	const end: WayfindingPoint = points[points.length - 1];

	for (let index = 1; index < points.length - 1; index += 1) {
		const distance: number = distanceToSegment(points[index], start, end);

		if (distance > maximumDistance) {
			maximumDistance = distance;
			splitIndex = index;
		}
	}

	if (maximumDistance <= toleranceValue || splitIndex < 0) return [start, end];

	const left: WayfindingPoint[] = simplifyGeometry(points.slice(0, splitIndex + 1), toleranceValue);
	const right: WayfindingPoint[] = simplifyGeometry(points.slice(splitIndex), toleranceValue);

	return [...left.slice(0, -1), ...right];
};

const geometryContained = (points: WayfindingPoint[]): boolean => {
	const step: number = Math.max(1, cellSize() / 2);

	for (let index = 1; index < points.length; index += 1) {
		const left: WayfindingPoint = points[index - 1];
		const right: WayfindingPoint = points[index];
		const length: number = Math.hypot(right.x - left.x, right.y - left.y);
		const samples: number = Math.max(1, Math.ceil(length / step));

		for (let sampleIndex = 0; sampleIndex <= samples; sampleIndex += 1) {
			const ratio: number = sampleIndex / samples;

			if (!pointWalkable({ x: left.x + (right.x - left.x) * ratio, y: left.y + (right.y - left.y) * ratio })) return false;
		}
	}

	return true;
};

const simplifyContainedGeometry = (points: WayfindingPoint[]): WayfindingPoint[] => {
	for (const toleranceFactor of [0.75, 0.5, 0.25]) {
		const simplified: WayfindingPoint[] = simplifyGeometry(points, cellSize() * toleranceFactor);

		if (geometryContained(simplified)) return simplified;
	}

	return points;
};

const generateCenterlineGraph = (): void => {
	if (!graph || !sourceImage || mask.length === 0) return;

	mask = closeWalkableMask(mask, maskColumns, maskRows, bridgeRadius());
	maskReviewStatus = 'proposed';
	maskConfirmedInput.checked = false;
	const skeleton: Uint8Array = skeletonizeWalkableMask(mask, maskColumns, maskRows);
	const usedAnchorIndices = new Set<number>();
	const locationNodeByIndex = new Map<number, WayfindingNode>();
	const locationNodes: WayfindingNode[] = graph.nodes.filter((node: WayfindingNode): boolean => node.kind === 'location' && Boolean(node.locationId));

	for (const locationNode of locationNodes) {
		const nearestIndex: number | undefined = nearestSkeletonIndex(skeleton, maskColumns, {
			column: Math.floor(locationNode.x / cellSize()),
			row: Math.floor(locationNode.y / cellSize())
		}, usedAnchorIndices);

		if (nearestIndex === undefined) continue;

		usedAnchorIndices.add(nearestIndex);
		locationNodeByIndex.set(nearestIndex, locationNode);
	}

	const network = extractSkeletonNetwork(mask, maskColumns, maskRows, usedAnchorIndices);
	const nodeIdByIndex = new Map<number, string>();
	const nodes: WayfindingNode[] = network.nodeIndices.map((index: number, nodeIndex: number): WayfindingNode => {
		const point: WayfindingPoint = pointForMaskIndex(index);
		const locationNode: WayfindingNode | undefined = locationNodeByIndex.get(index);
		const node: WayfindingNode = locationNode
			? { ...locationNode, ...point }
			: { id: `route-auto-${String(nodeIndex + 1).padStart(4, '0')}`, kind: 'route', levelId: locationNodes[0]?.levelId ?? 'level-0', ...point };
		nodeIdByIndex.set(index, node.id);

		return node;
	});
	const edges: WayfindingEdge[] = network.chains.flatMap((chain, edgeIndex: number): WayfindingEdge[] => {
		const from: string | undefined = nodeIdByIndex.get(chain.indices[0]);
		const to: string | undefined = nodeIdByIndex.get(chain.indices[chain.indices.length - 1]);

		if (!from || !to || from === to) return [];

		return [{
			accessible: true,
			bidirectional: true,
			corridorWidth: 1,
			from,
			geometry: simplifyContainedGeometry(chain.indices.map(pointForMaskIndex)),
			id: `centerline-${String(edgeIndex + 1).padStart(4, '0')}`,
			kind: 'outdoor',
			reviewStatus: 'proposed',
			to,
			traversal: 'outdoor-path'
		}];
	});
	const anchorNodeIds = new Set(locationNodes.map((node: WayfindingNode): string => node.id));
	const retained = retainAnchorNetworkCore(nodes.map((node: WayfindingNode): string => node.id), edges, anchorNodeIds);
	const retainedNodes: WayfindingNode[] = nodes.filter((node: WayfindingNode): boolean => retained.nodeIds.has(node.id));
	const retainedEdges: WayfindingEdge[] = edges.filter((edge: WayfindingEdge): boolean => retained.edgeIds.has(edge.id));

	graph = { ...graph, contractVersion: 2, nodes: retainedNodes, edges: retainedEdges };
	selectedEdgeId = undefined;
	coverageStatus.textContent = `Generated ${retainedNodes.length} destination-core nodes and ${retainedEdges.length} edges; review the mask before confirmation`;
	renderReview();
	draw();
};

const loadJsonFile = async <T>(input: HTMLInputElement): Promise<T | undefined> => {
	const file: File | undefined = input.files?.[0];

	return file ? JSON.parse(await file.text()) as T : undefined;
};

const insertSemanticVertex = (element: WayfindingStudioPolygonElement, point: WayfindingPoint): void => {
	let segment = 1;
	let minimumDistance = Number.POSITIVE_INFINITY;
	for (let index = 1; index <= element.geometry.length; index += 1) {
		const left: WayfindingPoint = element.geometry[index - 1];
		const right: WayfindingPoint = element.geometry[index % element.geometry.length];
		const distance: number = distanceToSegment(point, left, right);
		if (distance < minimumDistance) {
			minimumDistance = distance;
			segment = index;
		}
	}
	if (minimumDistance > 24 / scale) return;
	element.geometry.splice(segment, 0, { ...point });
	element.status = 'proposed';
	touchWayfindingStudioProject(studioProject);
	syncStudioGraph();
	renderStudioControls();
	draw();
};

studioProjectFile.addEventListener('change', async (): Promise<void> => {
	const loaded: unknown = await loadJsonFile<unknown>(studioProjectFile);
	if (!loaded) return;
	try {
		studioProject = parseWayfindingStudioProject(loaded);
		project = studioProject.delivery;
		graph = studioProject.graph;
		destinationDocument = destinationDatasource();
		destinationTableName = 'Destinations';
		selectedDestinationId = studioProject.destinations[0]?.id;
		syncProjectControls();
		renderProjectAssessment();
		renderMetadataEditor();
		await activateFloor(studioProject.floors[0].id);
		coverageStatus.textContent = `Opened ${studioProject.name}`;
	} catch (error) {
		studioValidation.textContent = error instanceof Error ? error.message : 'The Studio project could not be opened.';
		studioValidation.dataset.allowed = 'false';
	}
});

semanticMediaFile.addEventListener('change', async (): Promise<void> => {
	const file: File | undefined = semanticMediaFile.files?.[0];
	if (!file) return;
	const id: string = nextId('asset');
	studioProject.assets.push({ dataUrl: await readFileDataUrl(file), id, kind: 'icon', mimeType: file.type || 'image/png', name: file.name });
	pendingMediaAssetId = id;
	coverageStatus.textContent = `${file.name} ready to place as an icon or logo`;
});

studioProjectName.addEventListener('input', (): void => { studioProject.name = studioProjectName.value.trim() || 'Wayfinding project'; touchWayfindingStudioProject(studioProject); });
studioFloorName.addEventListener('input', (): void => { currentFloor().name = studioFloorName.value.trim() || currentFloorId; touchWayfindingStudioProject(studioProject); renderStudioControls(); });
studioFloorSelect.addEventListener('change', async (): Promise<void> => { persistCurrentMask(); await activateFloor(studioFloorSelect.value); });
requireElement<HTMLButtonElement>('#studio-add-floor').addEventListener('click', async (): Promise<void> => {
	let index: number = studioProject.floors.length;
	while (studioProject.floors.some((floor: WayfindingStudioFloor): boolean => floor.id === `level-${index}`)) index += 1;
	const floor: WayfindingStudioFloor = { elements: [], height: currentFloor().height, id: `level-${index}`, name: `Level ${index}`, order: studioProject.floors.length, width: currentFloor().width };
	studioProject.floors.push(floor);
	touchWayfindingStudioProject(studioProject);
	await activateFloor(floor.id);
});
requireElement<HTMLButtonElement>('#studio-delete-floor').addEventListener('click', async (): Promise<void> => {
	if (studioProject.floors.length === 1) {
		coverageStatus.textContent = 'A Studio project must keep at least one floor.';
		return;
	}
	persistCurrentMask();
	const removedFloorId: string = currentFloorId;
	const removedDestinationIds = new Set<string>(currentElements().flatMap((element: WayfindingStudioElement): string[] => (element.type === 'location' || element.type === 'poi') && element.destinationId ? [element.destinationId] : []));
	studioProject.floors = studioProject.floors
		.filter((floor: WayfindingStudioFloor): boolean => floor.id !== removedFloorId)
		.map((floor: WayfindingStudioFloor, index: number): WayfindingStudioFloor => ({ ...floor, order: index }));
	const rows: DestinationRow[] = destinationRows();
	for (let index: number = rows.length - 1; index >= 0; index -= 1) if (rows[index].floor === removedFloorId || removedDestinationIds.has(rows[index].id)) rows.splice(index, 1);
	const retainedNodeIds = new Set<string>(studioProject.graph.nodes.filter((node: WayfindingNode): boolean => node.levelId !== removedFloorId).map((node: WayfindingNode): string => node.id));
	studioProject.graph.nodes = studioProject.graph.nodes.filter((node: WayfindingNode): boolean => retainedNodeIds.has(node.id));
	studioProject.graph.edges = studioProject.graph.edges.filter((edge: WayfindingEdge): boolean => retainedNodeIds.has(edge.from) && retainedNodeIds.has(edge.to));
	const referencedAssetIds = new Set<string>();
	for (const floor of studioProject.floors) {
		if (floor.backgroundAssetId) referencedAssetIds.add(floor.backgroundAssetId);
		for (const element of floor.elements) {
			if (element.type === 'icon' || element.type === 'logo') referencedAssetIds.add(element.assetId);
		}
	}
	studioProject.assets = studioProject.assets.filter((asset: WayfindingStudioAsset): boolean => referencedAssetIds.has(asset.id));
	for (const assetId of mediaImageCache.keys()) {
		if (!referencedAssetIds.has(assetId)) mediaImageCache.delete(assetId);
	}
	touchWayfindingStudioProject(studioProject);
	project = studioProject.delivery;
	graph = studioProject.graph;
	selectedDestinationId = rows[0]?.id;
	await activateFloor(studioProject.floors[0].id);
});
requireElement<HTMLButtonElement>('#studio-export-project').addEventListener('click', (): void => {
	syncStudioGraph();
	downloadText(`${studioProject.projectId}.wbwayfinding`, JSON.stringify(studioProject, null, 2));
});
requireElement<HTMLButtonElement>('#studio-export-runtime').addEventListener('click', (): void => {
	syncStudioGraph();
	const errors = validateWayfindingStudioDelivery(studioProject).filter((issue): boolean => issue.severity === 'error');
	if (errors.length > 0) {
		coverageStatus.textContent = `Runtime export blocked: ${errors[0].message}`;
		return;
	}
	downloadText(`${studioProject.projectId}.runtime.json`, JSON.stringify(createWayfindingRuntimeBundle(studioProject), null, 2));
});
requireElement<HTMLButtonElement>('#semantic-finish').addEventListener('click', finishSemanticPolygon);
requireElement<HTMLButtonElement>('#semantic-cancel').addEventListener('click', (): void => { semanticDraft = undefined; semanticDraftHost.hidden = true; draw(); });
for (const toggle of document.querySelectorAll<HTMLInputElement>('[data-layer]')) toggle.addEventListener('change', draw);
requireElement<HTMLButtonElement>('#route-simulate').addEventListener('click', (): void => {
	syncStudioGraph();
	const startId: string = routeStart.value;
	const destinationIdValue: string = routeDestination.value;
	if (!startId || !destinationIdValue) {
		routeResult.textContent = 'Add an origin and a routeable destination entrance first.';
		return;
	}
	simulatedRoute = new WayfindingGraph(studioProject.graph).route(startId, destinationIdValue, { profile: routeProfile.value as 'standard' | 'step-free' });
	if (!simulatedRoute) routeResult.textContent = 'No route exists for the selected profile. Connect the origin, transitions, and destination entrance.';
	else {
		const floors: string[] = [...new Set(simulatedRoute.nodeIds.map((id: string): string => studioProject.graph.nodes.find((node: WayfindingNode): boolean => node.id === id)?.levelId ?? ''))].filter(Boolean);
		routeResult.textContent = `${simulatedRoute.walkingDistance} m, ${Math.ceil(simulatedRoute.walkingSeconds / 60)} min, ${floors.join(' -> ')}`;
	}
	draw();
});

projectFile.addEventListener('change', async (): Promise<void> => {
	const loaded: WayfindingProjectDocument | undefined = await loadJsonFile<WayfindingProjectDocument>(projectFile);

	if (!loaded) return;

	try {
		assessWayfindingProject(loaded);
		project = loaded;
		syncProjectControls();
		renderProjectAssessment();
	} catch (error) {
		projectAssessment.textContent = error instanceof Error ? error.message : 'The project contract is invalid.';
		projectAssessment.dataset.allowed = 'false';
	}
});

imageFile.addEventListener('change', async (): Promise<void> => {
	const file: File | undefined = imageFile.files?.[0];

	if (!file) return;
	const dataUrl: string = await readFileDataUrl(file);
	const assetId: string = `background:${currentFloorId}`;
	const asset: WayfindingStudioAsset = { dataUrl, id: assetId, kind: 'background', mimeType: file.type || 'image/png', name: file.name };
	studioProject.assets = [...studioProject.assets.filter((candidate: WayfindingStudioAsset): boolean => candidate.id !== assetId), asset];
	currentFloor().backgroundAssetId = assetId;
	await loadSourceImage(dataUrl);
	currentFloor().width = sourceImage?.naturalWidth ?? currentFloor().width;
	currentFloor().height = sourceImage?.naturalHeight ?? currentFloor().height;
	touchWayfindingStudioProject(studioProject);
	renderStudioControls();
});

graphFile.addEventListener('change', async (): Promise<void> => {
	graph = await loadJsonFile<WayfindingGraphDocument>(graphFile);
	selectedEdgeId = undefined;
	edgeDraft = undefined;
	renderEdgeDraft();
	renderMetadataEditor();
	renderReview();
	draw();
});

maskFile.addEventListener('change', async (): Promise<void> => {
	const document: WayfindingWalkableMaskDocument | undefined = await loadJsonFile<WayfindingWalkableMaskDocument>(maskFile);

	if (!document) return;
	applyMaskDocument(document);
	currentFloor().walkableMask = document;
	renderReview();
	draw();
});

destinationFile.addEventListener('change', async (): Promise<void> => {
	const value: unknown = await loadJsonFile<unknown>(destinationFile);

	if (Array.isArray(value)) {
		destinationTableName = 'Destinations';
		destinationDocument = { Destinations: { rows: value as DestinationRow[] } };
	} else if (value && typeof value === 'object') {
		const tables = Object.entries(value as Record<string, unknown>)
			.filter((entry): entry is [string, DestinationTable] => Boolean(entry[1]) && typeof entry[1] === 'object' && Array.isArray((entry[1] as DestinationTable).rows));

		if (tables.length === 0) throw new Error('Destination datasource must contain a table with a rows array.');

		destinationDocument = value as DestinationDatasourceDocument;
		destinationTableName = tables[0][0];
	}

	selectedDestinationId = destinationRows()[0]?.id;
	renderMetadataEditor();
});

destinationSelect.addEventListener('change', (): void => {
	selectedDestinationId = destinationSelect.value;
	renderMetadataEditor();
});

for (const [input, field] of [
	[destinationMapNumber, 'mapNumber'],
	[destinationName, 'name'],
	[destinationEnglishName, 'englishName'],
	[destinationCategory, 'category'],
	[destinationDescription, 'description'],
	[destinationHours, 'hours'],
	[destinationStatus, 'status']
] as const) {
	input.addEventListener('input', (): void => { updateSelectedDestination(field, input.value); });
}

destinationAccessible.addEventListener('change', (): void => {
	updateSelectedDestination('accessible', destinationAccessible.value === '' ? undefined : destinationAccessible.value === 'true');
});

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-tool]')) {
	button.addEventListener('click', (): void => {
		if (tool === 'draw' && button.dataset.tool !== 'draw') cancelEdgeDraft();
		if (semanticDraft && button.dataset.tool !== semanticDraft.type) {
			semanticDraft = undefined;
			semanticDraftHost.hidden = true;
		}
		tool = button.dataset.tool as Tool;
		setActiveTool();
		draw();
	});
}

finishJunctionButton.addEventListener('click', finishEdgeAtJunction);
cancelEdgeButton.addEventListener('click', cancelEdgeDraft);

for (const [input, output] of [[cellSizeInput, cellSizeValue], [toleranceInput, toleranceValue], [brushInput, brushValue], [bridgeInput, bridgeValue]] as const) {
	input.addEventListener('input', (): void => { output.value = input.value; });
}

cellSizeInput.addEventListener('change', (): void => { resetMaskGrid(); renderReview(); draw(); });
toleranceInput.addEventListener('change', extractConnectedMask);
requireElement<HTMLButtonElement>('#extract-mask').addEventListener('click', extractConnectedMask);
requireElement<HTMLButtonElement>('#clear-mask').addEventListener('click', (): void => { colorSamples = []; resetMaskGrid(); renderReview(); draw(); });
requireElement<HTMLButtonElement>('#generate-centerlines').addEventListener('click', generateCenterlineGraph);
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
requireElement<HTMLButtonElement>('#export-destinations').addEventListener('click', (): void => {
	if (destinationDocument) downloadJson('destinations-datasource.json', destinationDocument);
});
requireElement<HTMLButtonElement>('#export-project').addEventListener('click', (): void => {
	applyProjectControls();
	downloadJson('wayfinding-project.json', project);
});

for (const input of [
	projectIdInput,
	sourceKindInput,
	sourcePresentationInput,
	sourceLevelsInput,
	targetModeInput,
	equivalentRedrawInput,
	allowFallbackInput,
	stepFreeRequiredInput,
	independentMaskInput,
	reviewerIdInput,
	reviewMethodInput
]) {
	input.addEventListener(input === reviewerIdInput || input === projectIdInput ? 'input' : 'change', renderProjectAssessment);
}

canvas.addEventListener('pointerdown', (event: PointerEvent): void => {
	pointerDown = true;
	previousPointer = eventPoint(event);
	canvas.setPointerCapture(event.pointerId);
	const imagePoint: ImagePoint = toImagePoint(previousPointer);

	const floor: WayfindingStudioFloor = currentFloor();
	if (imagePoint.x < 0 || imagePoint.y < 0 || imagePoint.x > floor.width || imagePoint.y > floor.height) {
		pointerDown = false;
		canvas.releasePointerCapture(event.pointerId);
		return;
	}

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
	} else if (tool === 'anchor') {
		placeDestinationAnchor(imagePoint);
	} else if (tool === 'draw') {
		authorEdgePoint(imagePoint);
	} else if (tool === 'location' || tool === 'walkable' || tool === 'obstacle') {
		semanticDraft ??= { points: [], type: tool };
		semanticDraft.points.push({ x: imagePoint.x, y: imagePoint.y });
		semanticDraftHost.hidden = false;
		draw();
	} else if (tool === 'door' || tool === 'poi' || tool === 'origin' || tool === 'transition' || tool === 'label' || tool === 'icon' || tool === 'logo') {
		addSemanticPoint(tool, imagePoint);
	} else if (tool === 'select') {
		const selected: WayfindingStudioElement | undefined = nearestSemantic(imagePoint);
		selectedSemanticId = selected?.id;
		if (selected) {
			const vertexIndex: number | undefined = 'geometry' in selected
				? selected.geometry.map((vertex: WayfindingPoint): number => Math.hypot(vertex.x - imagePoint.x, vertex.y - imagePoint.y)).findIndex((distance: number): boolean => distance <= 18 / scale)
				: undefined;
			draggedSemantic = { elementId: selected.id, vertexIndex: vertexIndex !== undefined && vertexIndex >= 0 ? vertexIndex : undefined };
		}
		renderSemanticEditor();
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
	} else if (tool === 'select' && draggedSemantic) {
		const element: WayfindingStudioElement | undefined = currentElements().find((candidate: WayfindingStudioElement): boolean => candidate.id === draggedSemantic?.elementId);
		if (!element) return;
		if ('geometry' in element) {
			if (draggedSemantic.vertexIndex !== undefined) element.geometry[draggedSemantic.vertexIndex] = { x: imagePoint.x, y: imagePoint.y };
			else {
				const center = element.geometry.reduce((sum, vertex): WayfindingPoint => ({ x: sum.x + vertex.x / element.geometry.length, y: sum.y + vertex.y / element.geometry.length }), { x: 0, y: 0 });
				const dx: number = imagePoint.x - center.x;
				const dy: number = imagePoint.y - center.y;
				element.geometry = element.geometry.map((vertex): WayfindingPoint => ({ x: vertex.x + dx, y: vertex.y + dy }));
			}
		} else element.point = { x: imagePoint.x, y: imagePoint.y };
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
	if (draggedSemantic) {
		draggedSemantic = undefined;
		syncStudioGraph();
		renderStudioControls();
		draw();
	}
});

canvas.addEventListener('dblclick', (event: MouseEvent): void => {
	if (tool !== 'select') return;
	const point: ImagePoint = toImagePoint(eventPoint(event));
	const selected: WayfindingStudioElement | undefined = semanticElement() ?? nearestSemantic(point);
	if (!selected || !('geometry' in selected)) return;
	insertSemanticVertex(selected, point);
});

canvas.addEventListener('wheel', (event: WheelEvent): void => {
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
syncProjectControls();
renderProjectAssessment();
setActiveTool();
renderEdgeDraft();
renderReview();
destinationDocument = destinationDatasource();
destinationTableName = 'Destinations';
canvas.classList.add('ready');
stageEmpty.classList.add('hidden');
renderSemanticEditor();
void activateFloor(currentFloorId);
