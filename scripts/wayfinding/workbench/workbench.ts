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
	repairWayfindingStudioProject,
	synchronizeWayfindingStudioGraph,
	touchWayfindingStudioProject,
	validateWayfindingStudioDelivery,
	validateWayfindingStudioProject,
	wayfindingStudioProjectDefaults,
	type WayfindingStudioAsset,
	type WayfindingStudioDoorElement,
	type WayfindingStudioElement,
	type WayfindingStudioFloor,
	type WayfindingStudioLanguage,
	type WayfindingStudioLabelElement,
	type WayfindingStudioMediaElement,
	type WayfindingStudioOriginElement,
	type WayfindingStudioPointElement,
	type WayfindingStudioPolygonElement,
	type WayfindingStudioPolygonPresentation,
	type WayfindingStudioProject,
	type WayfindingStudioProjectDefaults,
	type WayfindingStudioRepair,
	type WayfindingStudioTranslation,
	type WayfindingStudioTransitionElement
} from '../studio-project.mts';
import { BUILTIN_MAP_ICONS, type BuiltinMapIcon } from './icon-library';
import { WayfindingScene3d } from './scene3d';

type SemanticPolygonTool = 'location' | 'obstacle' | 'walkable';
type Tool = 'pan' | 'sample' | 'include' | 'exclude' | 'anchor' | 'draw' | 'graph' | 'select' | SemanticPolygonTool | 'door' | 'poi' | 'origin' | 'transition' | 'label' | 'icon' | 'logo';
type DrawingMode = 'lasso' | 'points' | 'smart';
type ProjectOrigin = 'local-recovery' | 'new' | 'portable-file';
type WorkspaceMode = 'map' | 'route-edit' | 'route-preview';

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
	floor?: string;
	hours?: string;
	id: string;
	mapNumber?: string;
	name: string;
	photoAssetIds?: string[];
	routeable?: boolean;
	status?: string;
	translations?: Record<string, WayfindingStudioTranslation>;
}

interface DestinationTable {
	connectors?: Record<string, unknown>;
	header?: Record<string, string>;
	rows: DestinationRow[];
}

type DestinationDatasourceDocument = Record<string, DestinationTable>;

interface RouteDestinationAvailability {
	available: boolean;
	reason?: string;
}

interface DraggedVertex {
	edgeId: string;
	pointIndex: number;
}

interface DraggedDoorRotation {
	elementId: string;
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

interface DetectedRegion {
	color: string;
	geometry: WayfindingPoint[];
}

interface HistoryState {
	currentFloorId: string;
	project: WayfindingStudioProject;
	view: {
		offsetX: number;
		offsetY: number;
		scale: number;
	};
}

interface AutosaveRecord {
	currentFloorId: string;
	id: 'latest';
	openedProjectFileName?: string;
	project: WayfindingStudioProject;
	projectFileHandle?: StudioFileHandle;
	savedAt: string;
}

interface DraggedSemantic {
	elementId: string;
	grabOffset?: WayfindingPoint;
	pointerStart: WayfindingPoint;
	started: boolean;
	vertexIndex?: number;
}

interface StudioWritableFile {
	close(): Promise<void>;
	write(data: Blob | string): Promise<void>;
}

interface StudioFileHandle {
	createWritable(): Promise<StudioWritableFile>;
	getFile(): Promise<File>;
	name: string;
	queryPermission?(options: { mode: 'readwrite' }): Promise<PermissionState>;
	requestPermission?(options: { mode: 'readwrite' }): Promise<PermissionState>;
}

interface StudioFilePickerWindow extends Window {
	showOpenFilePicker?(options: Record<string, unknown>): Promise<StudioFileHandle[]>;
	showSaveFilePicker?(options: Record<string, unknown>): Promise<StudioFileHandle>;
}

const AUTOSAVE_DATABASE = 'wallboard-wayfinding-studio';
const AUTOSAVE_STORE = 'drafts';
const AUTOSAVE_DELAY_MS = 700;
const DEFAULT_ROUTE_RESULT = 'Add an origin and a destination entrance, then connect them to the graph.';
const STUDIO_VERSION = '0.15';
const OBJECT_EXPLORER_STORAGE_KEY = 'wallboard-wayfinding-studio:layers-open';

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
const autosaveStatus = requireElement<HTMLElement>('#autosave-status');
const coverageStatus = requireElement<HTMLElement>('#coverage-status');
const edgeSummary = requireElement<HTMLElement>('#edge-summary');
const edgeFailures = requireElement<HTMLElement>('#edge-failures');
const selectedEdgeHost = requireElement<HTMLElement>('#selected-edge');
const edgeList = requireElement<HTMLElement>('#edge-list');
const stageEmpty = requireElement<HTMLElement>('#stage-empty');
const stage3dHost = requireElement<HTMLElement>('#stage-3d');
const stageShell = requireElement<HTMLElement>('.stage-shell');
const metadataEditor = requireElement<HTMLElement>('#metadata-editor');
const metadataSummary = requireElement<HTMLElement>('#metadata-summary');
const destinationSelect = requireElement<HTMLSelectElement>('#destination-select');
const destinationMapNumber = requireElement<HTMLInputElement>('#destination-map-number');
const destinationId = requireElement<HTMLInputElement>('#destination-id');
const destinationName = requireElement<HTMLInputElement>('#destination-name');
const destinationLanguage = requireElement<HTMLSelectElement>('#destination-language');
const destinationTranslatedName = requireElement<HTMLInputElement>('#destination-translated-name');
const destinationTranslatedDescription = requireElement<HTMLTextAreaElement>('#destination-translated-description');
const destinationCategory = requireElement<HTMLSelectElement>('#destination-category');
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
const localRecovery = requireElement<HTMLElement>('#local-recovery');
const localRecoverySummary = requireElement<HTMLElement>('#local-recovery-summary');
const studioVersion = requireElement<HTMLElement>('#studio-version');
const restoreAutosaveButton = requireElement<HTMLButtonElement>('#restore-autosave');
const discardAutosaveButton = requireElement<HTMLButtonElement>('#discard-autosave');
const semanticDraftHost = requireElement<HTMLElement>('#semantic-draft');
const semanticEditor = requireElement<HTMLElement>('#semantic-editor');
const routeStart = requireElement<HTMLSelectElement>('#route-start');
const routeDestination = requireElement<HTMLSelectElement>('#route-destination');
const routeProfile = requireElement<HTMLSelectElement>('#route-profile');
const routeResult = requireElement<HTMLElement>('#route-result');
const routeBuildButton = requireElement<HTMLButtonElement>('#route-build');
const routeClearButton = requireElement<HTMLButtonElement>('#route-clear');
const routeInspectButton = requireElement<HTMLButtonElement>('#route-inspect');
const routePreviewNetworkInput = requireElement<HTMLInputElement>('#route-preview-network');
const routePreviewAnimationInput = requireElement<HTMLSelectElement>('#route-preview-animation');
const routePreviewSpeedInput = requireElement<HTMLInputElement>('#route-preview-speed');
const routePreviewSpeedValue = requireElement<HTMLOutputElement>('#route-preview-speed-value');
const routePreviewColorInput = requireElement<HTMLInputElement>('#route-preview-color');
const routePreviewWidthInput = requireElement<HTMLInputElement>('#route-preview-width');
const studioNotice = requireElement<HTMLElement>('#studio-notice');
const workspaceMapButton = requireElement<HTMLButtonElement>('#workspace-map');
const workspaceRoutePreviewButton = requireElement<HTMLButtonElement>('#workspace-route-preview');
const workspaceRouteEditButton = requireElement<HTMLButtonElement>('#workspace-route-edit');
const routeSetupChecklist = requireElement<HTMLElement>('#route-setup-checklist');
const semanticMediaFile = requireElement<HTMLInputElement>('#semantic-media-file');
const undoButton = requireElement<HTMLButtonElement>('#undo');
const redoButton = requireElement<HTMLButtonElement>('#redo');
const deleteSelectionButton = requireElement<HTMLButtonElement>('#delete-selection');
const fitViewButton = requireElement<HTMLButtonElement>('#fit-view');
const view2dButton = requireElement<HTMLButtonElement>('#view-2d');
const view3dButton = requireElement<HTMLButtonElement>('#view-3d');
const reset3dViewButton = requireElement<HTMLButtonElement>('#reset-3d-view');
const save3dViewButton = requireElement<HTMLButtonElement>('#save-3d-view');
const shortcutHelpButton = requireElement<HTMLButtonElement>('#shortcut-help');
const footerShortcutHelpButton = requireElement<HTMLButtonElement>('#footer-shortcut-help');
const shortcutDialog = requireElement<HTMLDialogElement>('#shortcut-dialog');
const shortcutCloseButton = requireElement<HTMLButtonElement>('#shortcut-close');
const toolTitle = requireElement<HTMLElement>('#tool-title');
const toolHelp = requireElement<HTMLElement>('#tool-help');
const projectPanel = requireElement<HTMLElement>('.project-panel');
const projectContext = requireElement<HTMLElement>('#project-context');
const projectContextName = requireElement<HTMLElement>('#project-context-name');
const projectContextSource = requireElement<HTMLElement>('#project-context-source');
const projectContextRecovery = requireElement<HTMLElement>('#project-context-recovery');
const projectContextPortable = requireElement<HTMLElement>('#project-context-portable');
const newProjectButton = requireElement<HTMLButtonElement>('#studio-new-project');
const openProjectButton = requireElement<HTMLButtonElement>('#studio-open-project');
const saveAsButton = requireElement<HTMLButtonElement>('#studio-save-as');
const drawingModePoints = requireElement<HTMLButtonElement>('#drawing-mode-points');
const drawingModeLasso = requireElement<HTMLButtonElement>('#drawing-mode-lasso');
const drawingModeSmart = requireElement<HTMLButtonElement>('#drawing-mode-smart');
const drawingModeHelp = requireElement<HTMLElement>('#drawing-mode-help');
const snapEnabledControl = requireElement<HTMLElement>('#snap-enabled-control');
const snapRadiusControl = requireElement<HTMLElement>('#snap-radius-control');
const snapToEdgesInput = requireElement<HTMLInputElement>('#snap-to-edges');
const snapRadiusInput = requireElement<HTMLInputElement>('#snap-radius');
const snapRadiusValue = requireElement<HTMLOutputElement>('#snap-radius-value');
const detectDetailControl = requireElement<HTMLElement>('#detect-detail-control');
const detectDetailInput = requireElement<HTMLInputElement>('#detect-detail');
const detectDetailValue = requireElement<HTMLOutputElement>('#detect-detail-value');
const detectOpeningControl = requireElement<HTMLElement>('#detect-opening-control');
const detectOpeningInput = requireElement<HTMLInputElement>('#detect-opening');
const detectOpeningValue = requireElement<HTMLOutputElement>('#detect-opening-value');
const detectGapControl = requireElement<HTMLElement>('#detect-gap-control');
const detectGapInput = requireElement<HTMLInputElement>('#detect-gap');
const detectGapValue = requireElement<HTMLOutputElement>('#detect-gap-value');
const traceAssist = requireElement<HTMLElement>('#trace-assist');
const semanticDraftHelp = requireElement<HTMLElement>('#semantic-draft-help');
const mediaAssetState = requireElement<HTMLElement>('#media-asset-state');
const mediaAssetSummary = requireElement<HTMLElement>('#media-asset-summary');
const chooseMediaAsset = requireElement<HTMLButtonElement>('#choose-media-asset');
const stopMediaPlacement = requireElement<HTMLButtonElement>('#stop-media-placement');
const mediaAssetLibrary = requireElement<HTMLElement>('#media-asset-library');
const builtinIconLibrary = requireElement<HTMLElement>('#builtin-icon-library');
const showAllLayers = requireElement<HTMLButtonElement>('#show-all-layers');
const hideAllLayers = requireElement<HTMLButtonElement>('#hide-all-layers');
const objectExplorerPanel = requireElement<HTMLDetailsElement>('#object-explorer-panel');
const objectCount = requireElement<HTMLElement>('#object-count');
const objectList = requireElement<HTMLElement>('#object-list');
const defaultLocationOpacityInput = requireElement<HTMLInputElement>('#default-location-opacity');
const defaultLocationHeightInput = requireElement<HTMLInputElement>('#default-location-height');
const defaultWalkableOpacityInput = requireElement<HTMLInputElement>('#default-walkable-opacity');
const defaultObstacleOpacityInput = requireElement<HTMLInputElement>('#default-obstacle-opacity');
const defaultLabelFontInput = requireElement<HTMLSelectElement>('#default-label-font');
const defaultLabelSizeInput = requireElement<HTMLInputElement>('#default-label-size');
const defaultIconSizeInput = requireElement<HTMLInputElement>('#default-icon-size');
const defaultLogoSizeInput = requireElement<HTMLInputElement>('#default-logo-size');
const defaultRouteColorInput = requireElement<HTMLInputElement>('#default-route-color');
const defaultRouteWidthInput = requireElement<HTMLInputElement>('#default-route-width');
const defaultRouteRadiusInput = requireElement<HTMLInputElement>('#default-route-radius');
const defaultRouteAnimationInput = requireElement<HTMLSelectElement>('#default-route-animation');
const defaultRouteSpeedInput = requireElement<HTMLInputElement>('#default-route-speed');
const defaultRouteSpeedValue = requireElement<HTMLOutputElement>('#default-route-speed-value');
const cursorPosition = requireElement<HTMLOutputElement>('#cursor-position');
const confirmDialog = requireElement<HTMLDialogElement>('#confirm-dialog');
const confirmTitle = requireElement<HTMLElement>('#confirm-title');
const confirmMessage = requireElement<HTMLElement>('#confirm-message');
const confirmCancel = requireElement<HTMLButtonElement>('#confirm-cancel');
const confirmAccept = requireElement<HTMLButtonElement>('#confirm-accept');
const projectLanguageList = requireElement<HTMLElement>('#project-language-list');
const projectLanguageCode = requireElement<HTMLInputElement>('#project-language-code');
const projectLanguageLabel = requireElement<HTMLInputElement>('#project-language-label');
const projectLanguageAdd = requireElement<HTMLButtonElement>('#project-language-add');
const projectCategoryList = requireElement<HTMLElement>('#project-category-list');
const projectCategoryName = requireElement<HTMLInputElement>('#project-category-name');
const projectCategoryAdd = requireElement<HTMLButtonElement>('#project-category-add');
const randomizeLocationColors = requireElement<HTMLButtonElement>('#randomize-location-colors');

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
let tool: Tool = 'select';
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
const semanticDraftRedo: WayfindingPoint[] = [];
let selectedSemanticId: string | undefined;
let selectedSemanticVertexIndex: number | undefined;
let insertPointForSemanticId: string | undefined;
let simulatedRoute: ReturnType<WayfindingGraph['route']>;
let viewMode: '2d' | '3d' = '2d';
let workspaceMode: WorkspaceMode = 'map';
let pendingMediaAssetId: string | undefined;
let draggedSemantic: DraggedSemantic | undefined;
let draggedDoorRotation: DraggedDoorRotation | undefined;
let dragHistoryState: HistoryState | undefined;
let dragMutated = false;
let restoringHistory = false;
let toolBeforeTemporaryPan: Tool | undefined;
let autosaveDatabase: IDBDatabase | undefined;
let autosaveEnabled = false;
let autosaveTimer: number | undefined;
let autosaveSnapshot = '';
let autosaveWrite: Promise<void> = Promise.resolve();
let pendingRecovery: AutosaveRecord | undefined;
let drawingMode: DrawingMode = 'points';
let lassoDrawing = false;
let projectOrigin: ProjectOrigin = 'new';
let openedProjectFileName: string | undefined;
let projectFileHandle: StudioFileHandle | undefined;
let portableSnapshot: string | undefined;
let lastLocalSaveAt: string | undefined;
let routeAnimationFrame: number | undefined;
let routeAnimationPhase = 0;
let routeAnimationPreviousTime = 0;
const undoStack: HistoryState[] = [];
const redoStack: HistoryState[] = [];
const HISTORY_LIMIT = 30;

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

const EVIDENCE_COPY: Record<WayfindingEvidenceKey, { description: string; label: string }> = {
	accessibility: { description: 'Step-free access and accessibility claims.', label: 'Accessibility' },
	currentLocationAnchors: { description: 'Installed screen positions used as route starts.', label: 'Screen positions' },
	destinationAnchors: { description: 'The map position or entrance for each destination.', label: 'Destination positions' },
	destinationMetadata: { description: 'Names, categories, descriptions, and public details.', label: 'Destination details' },
	entranceApproaches: { description: 'Where a route should enter each destination.', label: 'Entrances' },
	levelTransitions: { description: 'Stairs, elevators, and links between floors.', label: 'Floor connections' },
	orientation: { description: 'Which direction each installed screen faces.', label: 'Screen direction' },
	routeTopology: { description: 'The connected route network used for directions.', label: 'Route network' },
	walkableSpace: { description: 'Areas where visitors are allowed to travel.', label: 'Walkable areas' }
};

const humanizeEvidenceMessage = (message: string): string => EVIDENCE_KEYS.reduce(
	(value: string, key: WayfindingEvidenceKey): string => value.replaceAll(key, EVIDENCE_COPY[key].label.toLowerCase()),
	message
);

const TOOL_COPY: Record<Tool, { description: string; label: string }> = {
	anchor: { description: 'Choose a destination, then click its walkable entrance on the map.', label: 'Place entrance' },
	door: { description: 'Click a doorway, then assign it to a room in the selection panel.', label: 'Add door' },
	draw: { description: 'Start on an existing route point, add corridor bends, then finish on another point.', label: 'Draw route' },
	exclude: { description: 'Paint over incorrectly detected walkable cells to remove them.', label: 'Exclude from mask' },
	graph: { description: 'Select a route segment to move its points or change its properties.', label: 'Edit route' },
	icon: { description: 'Choose an image asset first, then click where the icon should appear.', label: 'Place icon' },
	include: { description: 'Paint over missing walkable cells to add them to the mask.', label: 'Include in mask' },
	label: { description: 'Click the map to place editable text.', label: 'Add text label' },
	location: { description: 'Click each corner of the room or area, then choose Finish.', label: 'Draw room or area' },
	logo: { description: 'Choose an image asset first, then click where the logo should appear.', label: 'Place logo' },
	obstacle: { description: 'Click each corner of an area that routes must avoid, then choose Finish.', label: 'Draw blocked area' },
	origin: { description: 'Click the installed screen position. Its direction can be edited after placement.', label: 'Place You are here' },
	pan: { description: 'Drag the map without changing authored items.', label: 'Pan map' },
	poi: { description: 'Click a landmark or point of interest, then edit its public details.', label: 'Add point of interest' },
	sample: { description: 'Click representative route colors to propose a connected walkable mask.', label: 'Sample walkable color' },
	select: { description: 'Click an item to edit it. Drag the item or one of its corners to reposition it.', label: 'Select & move' },
	transition: { description: 'Click a stair, elevator, or escalator that connects floors.', label: 'Add floor connection' },
	walkable: { description: 'Click each corner of a verified walkable area, then choose Finish.', label: 'Draw walkable area' }
};

const ELEMENT_LABELS: Record<WayfindingStudioElement['type'], string> = {
	door: 'Door',
	icon: 'Icon',
	label: 'Text label',
	location: 'Room / area',
	logo: 'Logo',
	obstacle: 'Blocked area',
	origin: 'You are here',
	poi: 'Point of interest',
	transition: 'Floor connection',
	walkable: 'Walkable area'
};

const TOOL_SHORTCUTS: Partial<Record<string, Tool>> = {
	a: 'anchor',
	b: 'obstacle',
	d: 'door',
	e: 'draw',
	g: 'logo',
	h: 'pan',
	i: 'icon',
	l: 'label',
	p: 'poi',
	r: 'location',
	t: 'transition',
	v: 'select',
	w: 'walkable',
	x: 'graph',
	y: 'origin'
};

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
const removeRedundantRoutePoints = (points: WayfindingPoint[]): WayfindingPoint[] => {
	const result: WayfindingPoint[] = [];

	for (const point of points) {
		const previous: WayfindingPoint | undefined = result[result.length - 1];
		if (previous && Math.hypot(previous.x - point.x, previous.y - point.y) < 0.5) continue;
		result.push(point);

		while (result.length >= 3) {
			const left: WayfindingPoint = result[result.length - 3];
			const middle: WayfindingPoint = result[result.length - 2];
			const right: WayfindingPoint = result[result.length - 1];
			if (distanceToSegment(middle, left, right) > 0.5) break;
			result.splice(result.length - 2, 1);
		}
	}

	return result;
};
const simulatedRoutePoints = (): WayfindingPoint[] => {
	const points: WayfindingPoint[] = simulatedRoute?.path
		.filter((routePoint): boolean => routePoint.levelId === currentFloorId)
		.map((routePoint): WayfindingPoint => ({ x: routePoint.x, y: routePoint.y }))
		.reduce((result: WayfindingPoint[], point: WayfindingPoint): WayfindingPoint[] => {
			const previous: WayfindingPoint | undefined = result[result.length - 1];
			if (!previous || previous.x !== point.x || previous.y !== point.y) result.push(point);

			return result;
		}, []) ?? [];

	// Keep the preview on the authored graph. Simplifying across edge boundaries can create
	// a visually shorter line that was never part of the generated or reviewed network.
	return removeRedundantRoutePoints(points);
};
const scene3d = new WayfindingScene3d(stage3dHost, {
	onSelectElement: (elementId: string): void => {
		if (workspaceMode === 'route-preview' && routeToSemanticElement(elementId)) return;
		selectedSemanticId = elementId;
		selectedSemanticVertexIndex = undefined;
		selectedEdgeId = undefined;
		renderSemanticEditor();
		renderReview();
		scene3d.selectElement(elementId);
	}
});
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
const projectCategories = (): string[] => Array.from(new Set([
	...(studioProject.categories ?? []),
	...destinationRows().map((destination: DestinationRow): string | undefined => destination.category).filter((category): category is string => Boolean(category))
])).map((category: string): string => category.trim()).filter(Boolean).sort((left: string, right: string): number => left.localeCompare(right));
const rememberCategory = (category: string): void => {
	const normalized: string = category.trim();
	if (!normalized) return;
	studioProject.categories = Array.from(new Set([...(studioProject.categories ?? []), normalized]))
		.sort((left: string, right: string): number => left.localeCompare(right));
};

const projectLanguages = (): WayfindingStudioLanguage[] => {
	const languages: WayfindingStudioLanguage[] = studioProject.languages?.length
		? studioProject.languages
		: [{ code: 'en', label: 'English' }];
	studioProject.languages = languages;
	if (!studioProject.defaultLanguage || !languages.some((language: WayfindingStudioLanguage): boolean => language.code === studioProject.defaultLanguage)) {
		studioProject.defaultLanguage = languages[0].code;
	}

	return languages;
};

const renderProjectCollections = (): void => {
	const languages: WayfindingStudioLanguage[] = projectLanguages();
	projectLanguageList.replaceChildren(...languages.map((language: WayfindingStudioLanguage): HTMLElement => {
		const row: HTMLDivElement = document.createElement('div');
		const identity: HTMLDivElement = document.createElement('div');
		const code: HTMLElement = document.createElement('code');
		const label: HTMLSpanElement = document.createElement('span');
		const actions: HTMLDivElement = document.createElement('div');
		const makeDefault: HTMLButtonElement = document.createElement('button');
		const remove: HTMLButtonElement = document.createElement('button');
		const isDefault: boolean = language.code === studioProject.defaultLanguage;
		row.className = 'settings-list-row';
		row.dataset.default = String(isDefault);
		code.textContent = language.code;
		label.textContent = language.label;
		identity.append(code, label);
		makeDefault.type = 'button';
		makeDefault.className = 'text-action';
		makeDefault.textContent = isDefault ? 'Default' : 'Make default';
		makeDefault.disabled = isDefault;
		makeDefault.addEventListener('click', (): void => {
			const before: HistoryState = captureHistoryState();
			studioProject.defaultLanguage = language.code;
			touchWayfindingStudioProject(studioProject);
			recordHistory(before);
			renderStudioControls();
			renderMetadataEditor();
		});
		remove.type = 'button';
		remove.className = 'text-action danger-text';
		remove.textContent = 'Remove';
		remove.disabled = languages.length === 1 || isDefault;
		remove.title = isDefault ? 'Choose another default language before removing this one.' : '';
		remove.addEventListener('click', (): void => {
			const before: HistoryState = captureHistoryState();
			studioProject.languages = projectLanguages().filter((candidate: WayfindingStudioLanguage): boolean => candidate.code !== language.code);
			for (const destination of destinationRows()) {
				if (!destination.translations) continue;
				delete destination.translations[language.code];
				if (Object.keys(destination.translations).length === 0) delete destination.translations;
			}
			touchWayfindingStudioProject(studioProject);
			recordHistory(before);
			renderStudioControls();
			renderMetadataEditor();
		});
		actions.append(makeDefault, remove);
		row.append(identity, actions);

		return row;
	}));

	projectCategoryList.replaceChildren(...projectCategories().map((category: string): HTMLElement => {
		const row: HTMLDivElement = document.createElement('div');
		const label: HTMLSpanElement = document.createElement('span');
		const remove: HTMLButtonElement = document.createElement('button');
		const usageCount: number = destinationRows().filter((destination: DestinationRow): boolean => destination.category === category).length;
		row.className = 'settings-list-row';
		label.textContent = usageCount > 0 ? `${category} (${usageCount})` : category;
		remove.type = 'button';
		remove.className = 'text-action danger-text';
		remove.textContent = 'Remove';
		remove.addEventListener('click', async (): Promise<void> => {
			if (usageCount > 0 && !await confirmAction(
				`Remove "${category}" from the category list and ${usageCount} destination${usageCount === 1 ? '' : 's'}?`,
				'Remove category?',
				'Remove'
			)) return;
			const before: HistoryState = captureHistoryState();
			studioProject.categories = (studioProject.categories ?? []).filter((candidate: string): boolean => candidate !== category);
			for (const destination of destinationRows()) if (destination.category === category) delete destination.category;
			touchWayfindingStudioProject(studioProject);
			recordHistory(before);
			renderStudioControls();
			renderMetadataEditor();
		});
		row.append(label, remove);

		return row;
	}));
};

const portableProjectBaseName = (): string => {
	const normalized: string = (studioProject.name.trim() || 'Wayfinding project')
		.replace(/[<>:"/\\|?*\u0000-\u001f]/gu, '-')
		.replace(/\s+/gu, ' ')
		.replace(/[. ]+$/gu, '');

	return normalized || 'Wayfinding project';
};

const renderProjectContext = (): void => {
	const floor: WayfindingStudioFloor | undefined = studioProject.floors.find((candidate: WayfindingStudioFloor): boolean => candidate.id === currentFloorId) ?? studioProject.floors[0];
	const currentSnapshot: string = JSON.stringify(studioProject);
	const portableState: 'current' | 'dirty' | 'missing' = !portableSnapshot
		? 'missing'
		: portableSnapshot === currentSnapshot ? 'current' : 'dirty';
	const sourceLabels: Record<ProjectOrigin, string> = {
		'local-recovery': 'Browser recovery draft',
		'new': 'New browser draft',
		'portable-file': openedProjectFileName ? `Project file: ${openedProjectFileName}` : 'Project file'
	};
	projectContextName.textContent = `${studioProject.name} / ${floor?.name ?? currentFloorId}`;
	projectContextSource.textContent = sourceLabels[projectOrigin];
	projectContextRecovery.textContent = pendingRecovery
		? 'Older recovery waiting'
		: lastLocalSaveAt ? `Saved locally ${savedTimeLabel(lastLocalSaveAt)}` : autosaveEnabled ? 'Ready' : 'Starting...';
	projectContextPortable.textContent = portableState === 'current'
		? openedProjectFileName ? `Saved to ${openedProjectFileName}` : 'Saved copy is current'
		: portableState === 'dirty' ? 'Unsaved file changes' : 'Not saved to file';
	projectContext.dataset.portable = portableState;
	projectPanel.dataset.hasContent = String(Boolean(
		floor?.backgroundAssetId
		|| floor?.elements.length
		|| studioProject.assets.length
		|| studioProject.destinations.length
	));
};

const renderDrawingMode = (): void => {
	const lasso: boolean = drawingMode === 'lasso';
	const points: boolean = drawingMode === 'points';
	const smart: boolean = drawingMode === 'smart';
	drawingModePoints.classList.toggle('active', points);
	drawingModePoints.setAttribute('aria-pressed', String(points));
	drawingModeLasso.classList.toggle('active', lasso);
	drawingModeLasso.setAttribute('aria-pressed', String(lasso));
	drawingModeSmart.classList.toggle('active', smart);
	drawingModeSmart.setAttribute('aria-pressed', String(smart));
	drawingModeHelp.textContent = smart
		? 'Choose Room, Walkable, or Blocked, then click inside a flat-color region. Studio traces its visible boundary.'
		: lasso
			? 'Press and drag around an area. Studio simplifies the trace into editable points.'
			: 'Best for precise straight-edged rooms and regions.';
	semanticDraftHelp.textContent = smart
		? 'Click inside a visually enclosed region. Adjust Color tolerance under Advanced tools if detection leaks or stops early.'
		: lasso
			? 'Keep dragging around the boundary, then release to create an editable polygon.'
			: 'Tap each corner. Finish after at least three points.';
	traceAssist.hidden = !lasso && !smart;
	snapEnabledControl.hidden = !lasso;
	snapRadiusControl.hidden = !lasso;
	snapRadiusInput.disabled = !snapToEdgesInput.checked || !lasso;
	detectDetailControl.hidden = !smart;
	detectOpeningControl.hidden = !smart;
	detectGapControl.hidden = !smart;
};

const renderMediaAssetState = (): void => {
	const asset: WayfindingStudioAsset | undefined = studioProject.assets.find((candidate: WayfindingStudioAsset): boolean => candidate.id === pendingMediaAssetId);
	mediaAssetState.dataset.ready = String(Boolean(asset));
	mediaAssetSummary.textContent = asset
		? `${asset.name} stays selected. Click the map repeatedly to place more copies; choose Stop placing when finished.`
		: 'Choose an image before placing it. Icon means a functional map symbol; Logo means a brand or tenant mark.';
	chooseMediaAsset.textContent = asset ? 'Change image' : 'Choose image';
	stopMediaPlacement.hidden = !asset;
	mediaAssetLibrary.replaceChildren();
	const reusableAssets: WayfindingStudioAsset[] = studioProject.assets.filter((candidate: WayfindingStudioAsset): boolean => candidate.kind === 'icon' || candidate.kind === 'logo');
	for (const reusable of reusableAssets) {
		const button: HTMLButtonElement = document.createElement('button');
		const preview: HTMLImageElement = document.createElement('img');
		const label: HTMLSpanElement = document.createElement('span');
		button.type = 'button';
		button.className = 'media-library-item';
		button.classList.toggle('active', reusable.id === pendingMediaAssetId);
		button.title = `Reuse ${reusable.name} as a ${reusable.kind}`;
		preview.src = reusable.dataUrl;
		preview.alt = '';
		label.textContent = reusable.name;
		button.append(preview, label);
		button.addEventListener('click', (): void => {
			pendingMediaAssetId = reusable.id;
			if (reusable.kind === 'icon' || reusable.kind === 'logo') activateTool(reusable.kind);
			renderMediaAssetState();
		});
		mediaAssetLibrary.append(button);
	}
	builtinIconLibrary.replaceChildren(...BUILTIN_MAP_ICONS.map((icon: BuiltinMapIcon): HTMLButtonElement => {
		const button: HTMLButtonElement = document.createElement('button');
		const preview: HTMLImageElement = document.createElement('img');
		const label: HTMLSpanElement = document.createElement('span');
		button.type = 'button';
		button.className = 'builtin-icon';
		button.title = `Place ${icon.label}`;
		preview.src = icon.dataUrl;
		preview.alt = '';
		label.textContent = icon.label;
		button.append(preview, label);
		button.addEventListener('click', (): void => {
			const assetId = `builtin:${icon.id}`;
			if (!studioProject.assets.some((candidate: WayfindingStudioAsset): boolean => candidate.id === assetId)) {
				studioProject.assets.push({
					dataUrl: icon.dataUrl,
					id: assetId,
					kind: 'icon',
					mimeType: 'image/svg+xml',
					name: icon.label,
					naturalHeight: 64,
					naturalWidth: 64
				});
			}
			pendingMediaAssetId = assetId;
			activateTool('icon');
			renderMediaAssetState();
			scheduleAutosave();
			coverageStatus.textContent = `${icon.label} is ready. Click the map to place copies.`;
		});

		return button;
	}));
};

const setAutosaveStatus = (label: string, state: 'ready' | 'saving' | 'saved' | 'recovery' | 'error', title: string): void => {
	const stableLabels: Record<typeof state, string> = {
		error: 'SAVE ERROR',
		ready: 'AUTOSAVE',
		recovery: 'RECOVERY',
		saved: 'SAVED',
		saving: 'SAVING'
	};
	autosaveStatus.textContent = stableLabels[state];
	autosaveStatus.dataset.state = state;
	autosaveStatus.dataset.detail = label;
	autosaveStatus.title = title;
	renderProjectContext();
};

const confirmAction = (message: string, title = 'Continue?', acceptLabel = 'Continue'): Promise<boolean> => new Promise((resolve): void => {
	confirmTitle.textContent = title;
	confirmMessage.textContent = message;
	confirmAccept.textContent = acceptLabel;
	const finish = (accepted: boolean): void => {
		confirmAccept.removeEventListener('click', accept);
		confirmCancel.removeEventListener('click', cancel);
		confirmDialog.removeEventListener('cancel', dismiss);
		if (confirmDialog.open) confirmDialog.close();
		resolve(accepted);
	};
	const accept = (): void => { finish(true); };
	const cancel = (): void => { finish(false); };
	const dismiss = (event: Event): void => {
		event.preventDefault();
		finish(false);
	};
	confirmAccept.addEventListener('click', accept);
	confirmCancel.addEventListener('click', cancel);
	confirmDialog.addEventListener('cancel', dismiss);
	confirmDialog.showModal();
	confirmCancel.focus();
});

let noticeTimer: number | undefined;
const showStudioNotice = (message: string, kind: 'error' | 'warning' = 'warning'): void => {
	studioNotice.textContent = message;
	studioNotice.dataset.kind = kind;
	studioNotice.title = 'Click to dismiss';
	studioNotice.hidden = false;
	if (noticeTimer !== undefined) window.clearTimeout(noticeTimer);
	noticeTimer = kind === 'warning'
		? window.setTimeout((): void => { studioNotice.hidden = true; }, 10_000)
		: undefined;
};

studioNotice.addEventListener('click', (): void => {
	studioNotice.hidden = true;
	if (noticeTimer !== undefined) window.clearTimeout(noticeTimer);
	noticeTimer = undefined;
});

const clearSimulatedRoute = (message = DEFAULT_ROUTE_RESULT): void => {
	simulatedRoute = undefined;
	routeResult.textContent = message;
	routeClearButton.disabled = true;
	routeInspectButton.disabled = true;
	draw();
};

const refresh3d = (): void => {
	if (viewMode !== '3d') return;
	scene3d.rebuild(studioProject, currentFloorId, simulatedRoutePoints());
	scene3d.selectElement(selectedSemanticId);
};

const setViewMode = (mode: '2d' | '3d'): void => {
	viewMode = mode;
	const showing3d: boolean = mode === '3d';
	view2dButton.classList.toggle('active', !showing3d);
	view2dButton.setAttribute('aria-pressed', String(!showing3d));
	view3dButton.classList.toggle('active', showing3d);
	view3dButton.setAttribute('aria-pressed', String(showing3d));
	canvas.classList.toggle('view-hidden', showing3d);
	stageShell.classList.toggle('view-3d', showing3d);
	scene3d.setVisible(showing3d);
	fitViewButton.disabled = showing3d;

	if (showing3d) {
		stageEmpty.classList.add('hidden');
		refresh3d();
		coverageStatus.textContent = workspaceMode === 'route-preview'
			? '3D route preview: click a destination to draw guidance from the selected start.'
			: '3D preview: drag to rotate, wheel to zoom, and select a shape to edit it.';
	} else {
		window.requestAnimationFrame((): void => {
			resizeCanvas();
		});
	}
};

const resetWorkspaceInteraction = (mode: WorkspaceMode): void => {
	pointerDown = false;
	lassoDrawing = false;
	semanticDraft = undefined;
	semanticDraftRedo.length = 0;
	edgeDraft = undefined;
	draggedSemantic = undefined;
	draggedDoorRotation = undefined;
	draggedVertex = undefined;
	dragHistoryState = undefined;
	dragMutated = false;
	insertPointForEdge = undefined;
	insertPointForSemanticId = undefined;
	selectedSemanticVertexIndex = undefined;
	semanticDraftHost.hidden = true;
	renderEdgeDraft();
	activateTool(mode === 'route-edit' ? 'graph' : 'select');
};

const setWorkspaceMode = (mode: WorkspaceMode): void => {
	if (workspaceMode !== mode) resetWorkspaceInteraction(mode);
	workspaceMode = mode;
	document.body.dataset.workspace = mode;
	for (const [button, value] of [
		[workspaceMapButton, 'map'],
		[workspaceRoutePreviewButton, 'route-preview'],
		[workspaceRouteEditButton, 'route-edit']
	] as const) {
		const active: boolean = mode === value;
		button.classList.toggle('active', active);
		button.setAttribute('aria-pressed', String(active));
	}
	if (mode === 'route-edit' && viewMode === '3d') setViewMode('2d');
	if (mode === 'route-preview') {
		coverageStatus.textContent = 'Route preview: choose a destination or click one directly on the map.';
	} else if (mode === 'route-edit') {
		coverageStatus.textContent = 'Route edit: define walkable space, build the network, then inspect or adjust segments.';
	} else {
		coverageStatus.textContent = 'Map edit: add, select, and style map elements.';
	}
	renderReview();
	draw();
};

const openAutosaveDatabase = (): Promise<IDBDatabase> => new Promise((resolve, reject): void => {
	const request: IDBOpenDBRequest = indexedDB.open(AUTOSAVE_DATABASE, 1);
	request.addEventListener('upgradeneeded', (): void => {
		const database: IDBDatabase = request.result;
		if (!database.objectStoreNames.contains(AUTOSAVE_STORE)) database.createObjectStore(AUTOSAVE_STORE, { keyPath: 'id' });
	});
	request.addEventListener('success', (): void => { resolve(request.result); });
	request.addEventListener('error', (): void => { reject(request.error ?? new Error('Local recovery storage could not be opened.')); });
});

const readAutosaveRecord = (database: IDBDatabase): Promise<AutosaveRecord | undefined> => new Promise((resolve, reject): void => {
	const transaction: IDBTransaction = database.transaction(AUTOSAVE_STORE, 'readonly');
	const request: IDBRequest<AutosaveRecord | undefined> = transaction.objectStore(AUTOSAVE_STORE).get('latest');
	request.addEventListener('success', (): void => { resolve(request.result); });
	request.addEventListener('error', (): void => { reject(request.error ?? new Error('Local recovery could not be read.')); });
});

const writeAutosaveRecord = (database: IDBDatabase, record: AutosaveRecord): Promise<void> => new Promise((resolve, reject): void => {
	const transaction: IDBTransaction = database.transaction(AUTOSAVE_STORE, 'readwrite');
	transaction.objectStore(AUTOSAVE_STORE).put(record);
	transaction.addEventListener('complete', (): void => { resolve(); });
	transaction.addEventListener('abort', (): void => { reject(transaction.error ?? new Error('Local recovery could not be saved.')); });
	transaction.addEventListener('error', (): void => { reject(transaction.error ?? new Error('Local recovery could not be saved.')); });
});

const deleteAutosaveRecord = (database: IDBDatabase): Promise<void> => new Promise((resolve, reject): void => {
	const transaction: IDBTransaction = database.transaction(AUTOSAVE_STORE, 'readwrite');
	transaction.objectStore(AUTOSAVE_STORE).delete('latest');
	transaction.addEventListener('complete', (): void => { resolve(); });
	transaction.addEventListener('abort', (): void => { reject(transaction.error ?? new Error('Local recovery could not be discarded.')); });
	transaction.addEventListener('error', (): void => { reject(transaction.error ?? new Error('Local recovery could not be discarded.')); });
});

const savedTimeLabel = (savedAt: string): string => new Intl.DateTimeFormat(undefined, {
	hour: '2-digit',
	minute: '2-digit'
}).format(new Date(savedAt));

async function persistAutosave(force = false): Promise<void> {
	if (!autosaveEnabled || !autosaveDatabase) return;
	if (autosaveTimer !== undefined) {
		window.clearTimeout(autosaveTimer);
		autosaveTimer = undefined;
	}
	synchronizeStudioState();
	const snapshot: string = JSON.stringify(studioProject);
	if (!force && snapshot === autosaveSnapshot) return;
	const savedAt = new Date().toISOString();
	const record: AutosaveRecord = {
		currentFloorId,
		id: 'latest',
		openedProjectFileName,
		project: cloneStudioProject(studioProject),
		projectFileHandle,
		savedAt
	};
	setAutosaveStatus('SAVING...', 'saving', 'Saving a local recovery draft in this browser.');
	try {
		const database: IDBDatabase = autosaveDatabase;
		autosaveWrite = autosaveWrite.catch((): void => undefined).then(async (): Promise<void> => {
			try {
				await writeAutosaveRecord(database, record);
			} catch (error) {
				if (!(error instanceof DOMException) || error.name !== 'DataCloneError' || !record.projectFileHandle) throw error;
				const portableRecord: AutosaveRecord = { ...record };
				delete portableRecord.projectFileHandle;
				await writeAutosaveRecord(database, portableRecord);
			}
		});
		await autosaveWrite;
		autosaveSnapshot = snapshot;
		lastLocalSaveAt = savedAt;
		setAutosaveStatus(`SAVED ${savedTimeLabel(savedAt)}`, 'saved', `Crash recovery updated at ${new Date(savedAt).toLocaleString()}. Use Save to update the project file.`);
	} catch (error) {
		const detail: string = error instanceof Error ? error.message : 'Unknown storage error';
		setAutosaveStatus('AUTOSAVE FAILED', 'error', `${detail} Use Save to preserve the project file.`);
	}
}

function scheduleAutosave(): void {
	renderProjectContext();
	if (!autosaveEnabled || !autosaveDatabase) return;
	if (autosaveTimer !== undefined) window.clearTimeout(autosaveTimer);
	autosaveTimer = window.setTimeout((): void => {
		autosaveTimer = undefined;
		void persistAutosave();
	}, AUTOSAVE_DELAY_MS);
}

const synchronizeStudioState = (): void => {
	persistCurrentMask();
	studioProject.delivery = project;
	studioProject.graph = graphDocument();
	studioProject.destinations = destinationRows() as WayfindingStudioProject['destinations'];
	synchronizeWayfindingStudioGraph(studioProject);
	graph = studioProject.graph;
};

const syncStudioGraph = (): void => {
	synchronizeStudioState();
	touchWayfindingStudioProject(studioProject);
	scheduleAutosave();
};

const cloneStudioProject = (value: WayfindingStudioProject): WayfindingStudioProject => JSON.parse(JSON.stringify(value)) as WayfindingStudioProject;

const captureHistoryState = (): HistoryState => {
	synchronizeStudioState();

	return {
		currentFloorId,
		project: cloneStudioProject(studioProject),
		view: { offsetX, offsetY, scale }
	};
};

const updateEditActions = (): void => {
	undoButton.disabled = (undoStack.length === 0 && !semanticDraft?.points.length) || restoringHistory;
	redoButton.disabled = (redoStack.length === 0 && semanticDraftRedo.length === 0) || restoringHistory;
	deleteSelectionButton.disabled = (!selectedSemanticId && !selectedEdgeId) || restoringHistory;
};

const recordHistory = (before: HistoryState): void => {
	undoStack.push(before);
	if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
	redoStack.length = 0;
	clearSimulatedRoute('The map changed. Simulate the route again.');
	scheduleAutosave();
	updateEditActions();
};

const clearHistory = (): void => {
	undoStack.length = 0;
	redoStack.length = 0;
	semanticDraftRedo.length = 0;
	updateEditActions();
};

const restoreHistoryState = async (state: HistoryState): Promise<void> => {
	restoringHistory = true;
	updateEditActions();
	studioProject = parseWayfindingStudioProject(cloneStudioProject(state.project));
	project = studioProject.delivery;
	graph = studioProject.graph;
	destinationDocument = destinationDatasource();
	destinationTableName = 'Destinations';
	selectedDestinationId = studioProject.destinations[0]?.id;
	selectedSemanticId = undefined;
	selectedSemanticVertexIndex = undefined;
	selectedEdgeId = undefined;
	semanticDraft = undefined;
	semanticDraftRedo.length = 0;
	edgeDraft = undefined;
	insertPointForEdge = undefined;
	insertPointForSemanticId = undefined;
	draggedSemantic = undefined;
	draggedVertex = undefined;
	simulatedRoute = undefined;
	semanticDraftHost.hidden = true;
	renderEdgeDraft();
	syncProjectControls();
	renderProjectAssessment();
	renderMetadataEditor();
	await activateFloor(state.currentFloorId);
	scale = state.view.scale;
	offsetX = state.view.offsetX;
	offsetY = state.view.offsetY;
	draw();
	restoringHistory = false;
	updateEditActions();
};

const undo = async (): Promise<void> => {
	if (restoringHistory) return;
	if (semanticDraft?.points.length) {
		const point: WayfindingPoint | undefined = semanticDraft.points.pop();
		if (point) semanticDraftRedo.push(point);
		semanticDraftHost.hidden = false;
		updateEditActions();
		draw();
		coverageStatus.textContent = 'Removed the last polygon point.';
		return;
	}
	const previous: HistoryState | undefined = undoStack.pop();
	if (!previous) return;
	redoStack.push(captureHistoryState());
	await restoreHistoryState(previous);
	coverageStatus.textContent = 'Undid the last map edit';
};

const redo = async (): Promise<void> => {
	if (restoringHistory) return;
	if (semanticDraft && semanticDraftRedo.length > 0) {
		const point: WayfindingPoint | undefined = semanticDraftRedo.pop();
		if (point) semanticDraft.points.push(point);
		updateEditActions();
		draw();
		coverageStatus.textContent = 'Restored the polygon point.';
		return;
	}
	const next: HistoryState | undefined = redoStack.pop();
	if (!next) return;
	undoStack.push(captureHistoryState());
	await restoreHistoryState(next);
	coverageStatus.textContent = 'Redid the map edit';
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

const readImageDimensions = (dataUrl: string): Promise<{ height: number; width: number }> => new Promise((resolve, reject): void => {
	const image = new Image();
	image.onload = (): void => { resolve({ height: image.naturalHeight, width: image.naturalWidth }); };
	image.onerror = (): void => { reject(new Error('The selected image could not be decoded.')); };
	image.src = dataUrl;
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
	selectedSemanticVertexIndex = undefined;
	insertPointForSemanticId = undefined;
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
		const heading: HTMLDivElement = document.createElement('div');
		const label: HTMLElement = document.createElement('strong');
		const description: HTMLSpanElement = document.createElement('span');
		const fields: HTMLDivElement = document.createElement('div');
		const statusLabel: HTMLLabelElement = document.createElement('label');
		const provenanceLabel: HTMLLabelElement = document.createElement('label');
		const status: HTMLSelectElement = document.createElement('select');
		const provenance: HTMLSelectElement = document.createElement('select');

		row.className = 'evidence-row';
		heading.className = 'evidence-heading';
		fields.className = 'evidence-fields';
		label.textContent = EVIDENCE_COPY[key].label;
		description.textContent = EVIDENCE_COPY[key].description;
		statusLabel.textContent = 'Status';
		provenanceLabel.textContent = 'Source';
		for (const value of ['unavailable', 'proposed', 'confirmed'] as const) {
			const option: HTMLOptionElement = document.createElement('option');
			option.value = value;
			option.textContent = value[0].toUpperCase() + value.slice(1);
			status.append(option);
		}
		for (const value of ['customer-provided', 'authoritative-import', 'reviewer-authored', 'vector-extraction', 'image-analysis', 'ai-inferred'] as const) {
			const option: HTMLOptionElement = document.createElement('option');
			option.value = value;
			option.textContent = value.split('-').map((part: string): string => part[0].toUpperCase() + part.slice(1)).join(' ');
			provenance.append(option);
		}
		status.value = item.status;
		provenance.value = item.provenance;
		status.addEventListener('change', (): void => {
			item.status = status.value as WayfindingEvidenceItem['status'];
			renderProjectAssessment();
			scheduleAutosave();
		});
		provenance.addEventListener('change', (): void => {
			item.provenance = provenance.value as WayfindingEvidenceItem['provenance'];
			renderProjectAssessment();
			scheduleAutosave();
		});
		heading.append(label, description);
		statusLabel.append(status);
		provenanceLabel.append(provenance);
		fields.append(statusLabel, provenanceLabel);
		row.append(heading, fields);

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
		: relevantIssues.map((issue): string => humanizeEvidenceMessage(issue.message)).join(' ') || 'Confirm the required evidence before delivery.';
	projectAssessment.replaceChildren(heading, summary);
	projectAssessment.dataset.allowed = String(assessment.deliveryAllowed);
	projectAssessment.dataset.targetSatisfied = String(assessment.targetSatisfied);
};

const routeDestinationAvailability = (node: WayfindingNode): RouteDestinationAvailability => {
	const destination: DestinationRow | undefined = destinationRows().find((row: DestinationRow): boolean => row.id === node.locationId);
	if (destination?.routeable === false) return { available: false, reason: 'routing disabled' };
	const floor: WayfindingStudioFloor | undefined = studioProject.floors.find((candidate: WayfindingStudioFloor): boolean => candidate.id === node.levelId);
	const element: WayfindingStudioElement | undefined = floor?.elements.find((candidate: WayfindingStudioElement): boolean =>
		candidate.id === node.semanticElementId
		|| ((candidate.type === 'location' || candidate.type === 'poi') && candidate.destinationId === node.locationId)
	);
	if (element?.type === 'location') {
		const hasLinkedDoor: boolean = Boolean(floor?.elements.some((candidate: WayfindingStudioElement): boolean =>
			candidate.type === 'door' && candidate.locationId === element.id
		));
		const hasAuthoredRouteEntry: boolean = studioProject.graph.edges.some((edge: WayfindingEdge): boolean =>
			edge.from === node.id || edge.to === node.id
		);
		if (!hasLinkedDoor && !hasAuthoredRouteEntry) return { available: false, reason: 'needs linked door' };
	}

	return { available: true };
};

const renderRouteSimulator = (): void => {
	const origins: WayfindingStudioOriginElement[] = studioProject.floors.flatMap((floor: WayfindingStudioFloor): WayfindingStudioOriginElement[] => floor.elements.filter((element: WayfindingStudioElement): element is WayfindingStudioOriginElement => element.type === 'origin'));
	const locationNodes: WayfindingNode[] = studioProject.graph.nodes.filter((node: WayfindingNode): boolean => node.kind === 'location' && Boolean(node.locationId));
	const floorElements: WayfindingStudioElement[] = currentElements();
	const floorNodeIds = new Set(studioProject.graph.nodes.filter((node: WayfindingNode): boolean => node.levelId === currentFloorId).map((node: WayfindingNode): string => node.id));
	const hasOrigin: boolean = origins.some((origin: WayfindingStudioOriginElement): boolean => origin.floorId === currentFloorId);
	const hasDestination: boolean = locationNodes.some((node: WayfindingNode): boolean => node.levelId === currentFloorId);
	const hasDestinationApproach: boolean = floorElements.some((element: WayfindingStudioElement): boolean => {
		if (element.type === 'poi' && element.destinationId) return true;
		return element.type === 'door' && Boolean(element.locationId);
	});
	const hasWalkableArea: boolean = floorElements.some((element: WayfindingStudioElement): boolean => element.type === 'walkable')
		|| mask.some((value: number): boolean => value === 1);
	const hasRouteNetwork: boolean = studioProject.graph.edges.some((edge: WayfindingEdge): boolean => floorNodeIds.has(edge.from) && floorNodeIds.has(edge.to));
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
		const availability: RouteDestinationAvailability = routeDestinationAvailability(node);
		option.value = node.id;
		option.textContent = `${destination?.name ?? node.locationId} (${node.levelId})${availability.reason ? ` - ${availability.reason}` : ''}`;
		option.disabled = !availability.available;
		return option;
	}));
	if (Array.from(routeStart.options).some((option): boolean => option.value === previousStart)) routeStart.value = previousStart;
	if (Array.from(routeDestination.options).some((option): boolean => option.value === previousDestination && !option.disabled)) {
		routeDestination.value = previousDestination;
	} else {
		const firstAvailable: HTMLOptionElement | undefined = Array.from(routeDestination.options).find((option): boolean => !option.disabled);
		routeDestination.value = firstAvailable?.value ?? '';
	}
	const setupItems: Array<[boolean, string, string]> = [
		[hasOrigin, 'Start point', hasOrigin ? 'You are here is placed' : 'Add You are here'],
		[hasDestination, 'Destination', hasDestination ? 'Routeable destination exists' : 'Add a room or point of interest'],
		[hasDestinationApproach, 'Entrance', hasDestinationApproach ? 'Destination entrance is linked' : 'Add a door near the room and link it'],
		[hasWalkableArea, 'Walkable space', hasWalkableArea ? 'Walkable area is available' : 'Draw a walkable area'],
		[hasRouteNetwork, 'Route network', hasRouteNetwork ? 'Routes are built' : 'Choose Build routes']
	];
	routeSetupChecklist.replaceChildren(...setupItems.map(([ready, label, detail]): HTMLLIElement => {
		const item: HTMLLIElement = document.createElement('li');
		const state: HTMLSpanElement = document.createElement('span');
		const copy: HTMLDivElement = document.createElement('div');
		const heading: HTMLElement = document.createElement('strong');
		const description: HTMLSpanElement = document.createElement('span');
		item.dataset.ready = String(ready);
		state.textContent = ready ? 'Ready' : 'Next';
		heading.textContent = label;
		description.textContent = detail;
		copy.append(heading, description);
		item.append(state, copy);

		return item;
	}));
	routeClearButton.disabled = !simulatedRoute;
	routeInspectButton.disabled = !simulatedRoute;
};

const projectDefaults = (): WayfindingStudioProjectDefaults => {
	studioProject.defaults = wayfindingStudioProjectDefaults(studioProject);

	return studioProject.defaults;
};

const syncProjectDefaultControls = (): void => {
	const defaults: WayfindingStudioProjectDefaults = projectDefaults();
	defaultLocationOpacityInput.value = String(Math.round(defaults.location.fillOpacity * 100));
	defaultLocationHeightInput.value = String(defaults.location.extrusionHeight);
	defaultWalkableOpacityInput.value = String(Math.round(defaults.walkable.fillOpacity * 100));
	defaultObstacleOpacityInput.value = String(Math.round(defaults.obstacle.fillOpacity * 100));
	defaultLabelFontInput.value = defaults.label.fontFamily;
	defaultLabelSizeInput.value = String(defaults.label.fontSize);
	defaultIconSizeInput.value = String(defaults.iconSize);
	defaultLogoSizeInput.value = String(defaults.logoSize);
	defaultRouteColorInput.value = defaults.route.color;
	defaultRouteWidthInput.value = String(defaults.route.lineWidth);
	defaultRouteRadiusInput.value = String(defaults.route.cornerRadius);
	defaultRouteAnimationInput.value = defaults.route.animation;
	defaultRouteSpeedInput.value = String(defaults.route.animationSpeed);
	defaultRouteSpeedValue.value = String(defaults.route.animationSpeed);
	routePreviewAnimationInput.value = defaults.route.animation;
	routePreviewSpeedInput.value = String(defaults.route.animationSpeed);
	routePreviewSpeedValue.value = String(defaults.route.animationSpeed);
	routePreviewColorInput.value = defaults.route.color;
	routePreviewWidthInput.value = String(defaults.route.lineWidth);
};

const objectName = (element: WayfindingStudioElement): string => {
	if (element.type === 'location' || element.type === 'poi' || element.type === 'origin' || element.type === 'transition') {
		return element.label?.trim() || element.id;
	}
	if (element.type === 'label') return element.text.trim() || element.id;
	if (element.type === 'icon' || element.type === 'logo') {
		return studioProject.assets.find((asset: WayfindingStudioAsset): boolean => asset.id === element.assetId)?.name ?? element.id;
	}
	if (element.type === 'door') return element.locationId ? `Door to ${element.locationId}` : element.id;

	return element.id;
};

const renderObjectExplorer = (): void => {
	const elements: WayfindingStudioElement[] = currentElements();
	objectCount.textContent = `${elements.length} item${elements.length === 1 ? '' : 's'}`;
	objectList.replaceChildren();
	if (elements.length === 0) {
		const empty: HTMLParagraphElement = document.createElement('p');
		empty.className = 'object-list-empty';
		empty.textContent = 'No map objects on this floor yet.';
		objectList.append(empty);
		return;
	}

	const typeLabels: Record<WayfindingStudioElement['type'], string> = {
		door: 'Doors',
		icon: 'Icons',
		label: 'Labels',
		location: 'Rooms and areas',
		logo: 'Logos',
		obstacle: 'Blocked areas',
		origin: 'You are here',
		poi: 'Points of interest',
		transition: 'Floor connections',
		walkable: 'Walkable areas'
	};
	const groups = new Map<WayfindingStudioElement['type'], WayfindingStudioElement[]>();
	for (const element of elements) groups.set(element.type, [...(groups.get(element.type) ?? []), element]);
	for (const [type, items] of groups) {
		const section: HTMLElement = document.createElement('section');
		const heading: HTMLButtonElement = document.createElement('button');
		const list: HTMLDivElement = document.createElement('div');
		heading.type = 'button';
		heading.className = 'object-group-heading';
		heading.textContent = `${typeLabels[type]} (${items.length})`;
		list.className = 'object-group-items';
		for (const element of items) {
			const button: HTMLButtonElement = document.createElement('button');
			const name: HTMLSpanElement = document.createElement('span');
			const status: HTMLElement = document.createElement('small');
			button.type = 'button';
			button.className = 'object-item';
			button.classList.toggle('active', element.id === selectedSemanticId);
			button.dataset.type = element.type;
			name.textContent = objectName(element);
			status.textContent = element.status;
			button.append(name, status);
			button.addEventListener('click', (): void => {
				selectedSemanticId = element.id;
				selectedSemanticVertexIndex = undefined;
				selectedEdgeId = undefined;
				activateTool('select');
				renderSemanticEditor();
				renderReview();
				renderObjectExplorer();
				draw();
			});
			list.append(button);
		}
		heading.addEventListener('click', (): void => { list.hidden = !list.hidden; });
		section.append(heading, list);
		objectList.append(section);
	}
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
			? 'DRAFT / DELIVERY NOT APPROVED'
			: 'RUNTIME EXPORT READY';
	const summary: HTMLElement = document.createElement('span');
	summary.textContent = deliveryIssues.length === 0 ? 'Project structure and delivery evidence are valid.' : deliveryIssues.slice(0, 4).map((issue): string => humanizeEvidenceMessage(issue.message)).join(' ');
	studioValidation.append(heading, summary);
	renderRouteSimulator();
	renderProjectContext();
	renderMediaAssetState();
	syncProjectDefaultControls();
	renderProjectCollections();
	renderObjectExplorer();
};

const selectedSemanticPolygon = (): WayfindingStudioPolygonElement | undefined => {
	const element: WayfindingStudioElement | undefined = semanticElement();

	return element && 'geometry' in element ? element : undefined;
};

const nearestSemanticVertex = (element: WayfindingStudioPolygonElement, point: WayfindingPoint, radius = 22 / scale): number | undefined => {
	const index: number = element.geometry
		.map((vertex: WayfindingPoint): number => Math.hypot(vertex.x - point.x, vertex.y - point.y))
		.findIndex((distance: number): boolean => distance <= radius);

	return index >= 0 ? index : undefined;
};

const deleteSelectedSemanticVertex = (): boolean => {
	const element: WayfindingStudioPolygonElement | undefined = selectedSemanticPolygon();
	if (!element || selectedSemanticVertexIndex === undefined) return false;
	if (element.geometry.length <= 3) {
		coverageStatus.textContent = 'A polygon needs at least three points. Delete the whole item or move its remaining points.';
		return true;
	}
	const before: HistoryState = captureHistoryState();
	element.geometry.splice(selectedSemanticVertexIndex, 1);
	element.status = 'proposed';
	selectedSemanticVertexIndex = undefined;
	insertPointForSemanticId = undefined;
	syncStudioGraph();
	recordHistory(before);
	coverageStatus.textContent = `Removed a point from ${element.id}`;
	renderSemanticEditor();
	renderStudioControls();
	draw();

	return true;
};

const deleteCurrentSelection = (): void => {
	if (deleteSelectedSemanticVertex()) return;
	const element: WayfindingStudioElement | undefined = semanticElement();
	const edge: WayfindingEdge | undefined = graph?.edges.find((candidate: WayfindingEdge): boolean => candidate.id === selectedEdgeId);
	if (!element && !edge) return;
	const before: HistoryState = captureHistoryState();
	if (element) {
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
		selectedSemanticVertexIndex = undefined;
		insertPointForSemanticId = undefined;
		coverageStatus.textContent = `Deleted ${element.type} ${element.id}`;
	} else if (edge && graph) {
		graph.edges = graph.edges.filter((candidate: WayfindingEdge): boolean => candidate.id !== edge.id);
		selectedEdgeId = undefined;
		coverageStatus.textContent = `Deleted route ${edge.id}`;
	}
	syncStudioGraph();
	recordHistory(before);
	renderSemanticEditor();
	renderStudioControls();
	renderReview();
	draw();
};

const renderSemanticEditor = (): void => {
	renderObjectExplorer();
	const element: WayfindingStudioElement | undefined = semanticElement();
	semanticEditor.replaceChildren();
	const title: HTMLHeadingElement = document.createElement('h2');
	title.textContent = element ? ELEMENT_LABELS[element.type] : 'Semantic selection';
	semanticEditor.append(title);
	if (!element) {
		const empty: HTMLParagraphElement = document.createElement('p');
		empty.textContent = 'Select an authored location, point, door, label, or transition on the map.';
		semanticEditor.append(empty);
		updateEditActions();
		return;
	}
	const identity: HTMLElement = document.createElement('span');
	identity.className = 'selection-id';
	identity.textContent = element.id;
	semanticEditor.append(identity);

	const selectField = (labelText: string, values: Array<[string, string]>, value: string, update: (next: string) => void, host: HTMLElement = semanticEditor, note?: string): void => {
		const label = document.createElement('label');
		label.textContent = labelText;
		const select = document.createElement('select');
		for (const [optionValue, optionLabel] of values) select.add(new Option(optionLabel, optionValue));
		select.value = value;
		select.addEventListener('change', (): void => {
			const before: HistoryState = captureHistoryState();
			update(select.value);
			syncStudioGraph();
			recordHistory(before);
			renderStudioControls();
			draw();
		});
		label.append(select);
		if (note) {
			const hint: HTMLElement = document.createElement('span');
			hint.className = 'field-note';
			hint.textContent = note;
			label.append(hint);
		}
		host.append(label);
	};
	const textField = (labelText: string, value: string, update: (next: string) => void, type: 'color' | 'number' | 'text' = 'text', host: HTMLElement = semanticEditor, note?: string): HTMLInputElement => {
		const label = document.createElement('label');
		label.textContent = labelText;
		const input = document.createElement('input');
		let before: HistoryState | undefined;
		let dirty = false;
		input.type = type;
		input.value = value;
		input.addEventListener('focus', (): void => { before = captureHistoryState(); });
		input.addEventListener('input', (): void => {
			update(input.value);
			dirty = true;
		});
		const commit = (): void => {
			if (!dirty) return;
			syncStudioGraph();
			if (before) recordHistory(before);
			before = undefined;
			dirty = false;
			renderStudioControls();
			draw();
		};
		input.addEventListener('change', commit);
		input.addEventListener('blur', commit);
		input.addEventListener('keydown', (event: KeyboardEvent): void => {
			if (event.key === 'Enter') input.blur();
		});
		label.append(input);
		if (note) {
			const hint: HTMLElement = document.createElement('span');
			hint.className = 'field-note';
			hint.textContent = note;
			label.append(hint);
		}
		host.append(label);
		return input;
	};
	const textAreaField = (labelText: string, value: string, update: (next: string) => void, host: HTMLElement = semanticEditor): void => {
		const label = document.createElement('label');
		label.textContent = labelText;
		const textarea = document.createElement('textarea');
		let before: HistoryState | undefined;
		let dirty = false;
		textarea.rows = 3;
		textarea.value = value;
		textarea.addEventListener('focus', (): void => { before = captureHistoryState(); });
		textarea.addEventListener('input', (): void => {
			update(textarea.value);
			dirty = true;
		});
		const commit = (): void => {
			if (!dirty) return;
			syncStudioGraph();
			if (before) recordHistory(before);
			before = undefined;
			dirty = false;
			renderStudioControls();
			draw();
		};
		textarea.addEventListener('change', commit);
		textarea.addEventListener('blur', commit);
		label.append(textarea);
		host.append(label);
	};
	const destination: DestinationRow | undefined = (element.type === 'location' || element.type === 'poi') && element.destinationId
		? destinationRows().find((row: DestinationRow): boolean => row.id === element.destinationId)
		: undefined;
		const updateDestination = (field: keyof DestinationRow, value: unknown): void => {
			if (!destination) return;
			if (value === undefined || value === '') delete destination[field];
			else destination[field] = value as never;
		};
		const updateTranslation = (languageCode: string, field: keyof WayfindingStudioTranslation, value: string): void => {
			if (!destination) return;
			destination.translations ??= {};
			destination.translations[languageCode] ??= {};
			if (value.trim()) destination.translations[languageCode][field] = value;
			else {
				delete destination.translations[languageCode][field];
				if (Object.keys(destination.translations[languageCode]).length === 0) delete destination.translations[languageCode];
				if (Object.keys(destination.translations).length === 0) delete destination.translations;
			}
		};

	if (destination && (element.type === 'location' || element.type === 'poi')) {
		const heading: HTMLHeadingElement = document.createElement('h3');
		heading.className = 'public-details-heading';
		heading.textContent = 'Public details';
		semanticEditor.append(heading);
			textField('Name', destination.name, (value): void => {
				destination.name = value || destination.id;
				element.label = value || destination.id;
			});
			textAreaField('Description', stringValue(destination.description), (value): void => { updateDestination('description', value); });
			const translationLanguages: WayfindingStudioLanguage[] = projectLanguages()
				.filter((language: WayfindingStudioLanguage): boolean => language.code !== studioProject.defaultLanguage);
			if (translationLanguages.length > 0) {
				const translations: HTMLDetailsElement = document.createElement('details');
				const translationSummary: HTMLElement = document.createElement('summary');
				const translationFields: HTMLDivElement = document.createElement('div');
				translations.className = 'translation-editor';
				translationSummary.textContent = `Translations (${translationLanguages.length})`;
				translationFields.className = 'translation-fields';
				for (const language of translationLanguages) {
					const languageHeading: HTMLHeadingElement = document.createElement('h4');
					const current: WayfindingStudioTranslation | undefined = destination.translations?.[language.code];
					languageHeading.textContent = `${language.label} (${language.code})`;
					translationFields.append(languageHeading);
					textField('Name', current?.name ?? '', (value): void => {
						updateTranslation(language.code, 'name', value);
					}, 'text', translationFields);
					textAreaField('Description', current?.description ?? '', (value): void => {
						updateTranslation(language.code, 'description', value);
					}, translationFields);
				}
				translations.append(translationSummary, translationFields);
				semanticEditor.append(translations);
			}
		const categoryInput: HTMLInputElement = textField('Category', stringValue(destination.category), (value): void => {
			updateDestination('category', value);
			if (element.type === 'poi') element.category = value || undefined;
			rememberCategory(value);
		});
		const categoryList: HTMLDataListElement = document.createElement('datalist');
		categoryList.id = `category-options-${element.id}`;
		for (const category of projectCategories()) categoryList.append(new Option(category, category));
		categoryInput.setAttribute('list', categoryList.id);
		semanticEditor.append(categoryList);
		const categoryManager: HTMLDetailsElement = document.createElement('details');
		const categorySummary: HTMLElement = document.createElement('summary');
		const categoryChips: HTMLDivElement = document.createElement('div');
		categorySummary.textContent = `Project categories (${projectCategories().length})`;
		categoryChips.className = 'category-chips';
		for (const category of projectCategories()) {
			const chip: HTMLButtonElement = document.createElement('button');
			chip.type = 'button';
			chip.textContent = `${category} x`;
			chip.title = `Remove ${category} from category suggestions. Existing locations keep their value.`;
			chip.addEventListener('click', (): void => {
				const before: HistoryState = captureHistoryState();
				studioProject.categories = (studioProject.categories ?? []).filter((candidate: string): boolean => candidate !== category);
				syncStudioGraph();
				recordHistory(before);
				renderSemanticEditor();
			});
			categoryChips.append(chip);
		}
			categoryManager.append(categorySummary, categoryChips);
			semanticEditor.append(categoryManager);
			textField('Directory number', stringValue(destination.mapNumber), (value): void => { updateDestination('mapNumber', value); });
			textField('Opening hours', stringValue(destination.hours), (value): void => { updateDestination('hours', value); });
		textField('Public status', stringValue(destination.status), (value): void => { updateDestination('status', value); });
		selectField('Accessibility', [['', 'Unverified'], ['true', 'Step-free verified'], ['false', 'Not step-free']], typeof destination.accessible === 'boolean' ? String(destination.accessible) : '', (value): void => {
			updateDestination('accessible', value === '' ? undefined : value === 'true');
		});

		const mediaHeading: HTMLHeadingElement = document.createElement('h3');
		const gallery: HTMLDivElement = document.createElement('div');
		const addPhotos: HTMLButtonElement = document.createElement('button');
		const photoInput: HTMLInputElement = document.createElement('input');
		mediaHeading.className = 'public-details-heading';
		mediaHeading.textContent = 'Location photos';
		gallery.className = 'destination-photo-gallery';
		for (const assetId of destination.photoAssetIds ?? []) {
			const asset: WayfindingStudioAsset | undefined = studioProject.assets.find((candidate: WayfindingStudioAsset): boolean => candidate.id === assetId && candidate.kind === 'photo');
			if (!asset) continue;
			const item: HTMLElement = document.createElement('figure');
			const image: HTMLImageElement = document.createElement('img');
			const removePhoto: HTMLButtonElement = document.createElement('button');
			image.src = asset.dataUrl;
			image.alt = asset.name;
			removePhoto.type = 'button';
			removePhoto.textContent = 'Remove';
			removePhoto.addEventListener('click', (): void => {
				const before: HistoryState = captureHistoryState();
				destination.photoAssetIds = (destination.photoAssetIds ?? []).filter((candidate: string): boolean => candidate !== assetId);
				const stillReferenced: boolean = studioProject.destinations.some((candidate): boolean => candidate.photoAssetIds?.includes(assetId) ?? false);
				if (!stillReferenced) studioProject.assets = studioProject.assets.filter((candidate: WayfindingStudioAsset): boolean => candidate.id !== assetId);
				syncStudioGraph();
				recordHistory(before);
				renderSemanticEditor();
			});
			item.append(image, removePhoto);
			gallery.append(item);
		}
		addPhotos.type = 'button';
		addPhotos.textContent = 'Add photos';
		addPhotos.className = 'secondary';
		photoInput.type = 'file';
		photoInput.accept = 'image/*';
		photoInput.multiple = true;
		photoInput.hidden = true;
		addPhotos.addEventListener('click', (): void => { photoInput.click(); });
		photoInput.addEventListener('change', async (): Promise<void> => {
			const files: File[] = Array.from(photoInput.files ?? []);
			if (files.length === 0) return;
			const before: HistoryState = captureHistoryState();
			const assetIds: string[] = [];
			for (const file of files) {
				const dataUrl: string = await readFileDataUrl(file);
				const dimensions: { height: number; width: number } = await readImageDimensions(dataUrl);
				const id: string = nextId('asset-photo');
				studioProject.assets.push({ dataUrl, id, kind: 'photo', mimeType: file.type || 'image/png', name: file.name, naturalHeight: dimensions.height, naturalWidth: dimensions.width });
				assetIds.push(id);
			}
			destination.photoAssetIds = [...(destination.photoAssetIds ?? []), ...assetIds];
			syncStudioGraph();
			recordHistory(before);
			renderSemanticEditor();
		});
		semanticEditor.append(mediaHeading, gallery, addPhotos, photoInput);
	}

	if ('geometry' in element) {
		const defaults = projectDefaults()[element.type];
		const appearanceHeading: HTMLHeadingElement = document.createElement('h3');
		appearanceHeading.className = 'public-details-heading';
		appearanceHeading.textContent = 'Map appearance';
		const appearanceFields: HTMLDivElement = document.createElement('div');
		appearanceFields.className = 'appearance-fields';
		textField('Fill color', element.presentation?.fillColor ?? defaults.fillColor, (value): void => {
			element.presentation ??= {};
			element.presentation.fillColor = value;
		}, 'color', appearanceFields);
		textField('Opacity %', String(Math.round((element.presentation?.fillOpacity ?? defaults.fillOpacity) * 100)), (value): void => {
			element.presentation ??= {};
			element.presentation.fillOpacity = Math.min(1, Math.max(0, (Number(value) || 0) / 100));
		}, 'number', appearanceFields);
		textField('3D visual height', String(element.presentation?.extrusionHeight ?? defaults.extrusionHeight), (value): void => {
			element.presentation ??= {};
			element.presentation.extrusionHeight = Math.min(100, Math.max(0, Number(value) || 0));
		}, 'number', appearanceFields, '0 is flat; 100 is the tallest visual profile. This is a design scale, not metres.');
		semanticEditor.append(appearanceHeading, appearanceFields);

		const heading: HTMLHeadingElement = document.createElement('h3');
		heading.className = 'public-details-heading';
		heading.textContent = 'Shape points';
		const status: HTMLParagraphElement = document.createElement('p');
		status.className = 'shape-point-status';
		status.textContent = selectedSemanticVertexIndex === undefined
			? `${element.geometry.length} points. Click a white corner handle to select it.`
			: `Point ${selectedSemanticVertexIndex + 1} of ${element.geometry.length} selected. Drag it or use the arrow keys to move it.`;
		const actions: HTMLDivElement = document.createElement('div');
		actions.className = 'shape-point-actions';
		const addPoint: HTMLButtonElement = document.createElement('button');
		addPoint.type = 'button';
		addPoint.textContent = insertPointForSemanticId === element.id ? 'Cancel add point' : 'Add point on edge';
		addPoint.classList.toggle('active', insertPointForSemanticId === element.id);
		addPoint.addEventListener('click', (): void => {
			insertPointForSemanticId = insertPointForSemanticId === element.id ? undefined : element.id;
			coverageStatus.textContent = insertPointForSemanticId
				? 'Click the polygon edge where the new point should be inserted.'
				: 'Point insertion cancelled.';
			renderSemanticEditor();
			draw();
		});
		const deletePoint: HTMLButtonElement = document.createElement('button');
		deletePoint.type = 'button';
		deletePoint.className = 'danger';
		deletePoint.textContent = 'Delete selected point';
		deletePoint.disabled = selectedSemanticVertexIndex === undefined;
		deletePoint.addEventListener('click', (): void => { deleteSelectedSemanticVertex(); });
		actions.append(addPoint, deletePoint);
		semanticEditor.append(heading, status, actions);
		if (element.type === 'walkable') {
			const exclusion: HTMLButtonElement = document.createElement('button');
			exclusion.type = 'button';
			exclusion.textContent = 'Draw blocked island inside';
			exclusion.title = 'Create an obstacle over furniture, planters, voids, or other non-walkable areas without redrawing the surrounding walkable polygon.';
			exclusion.addEventListener('click', (): void => {
				activateTool('obstacle');
				coverageStatus.textContent = 'Draw around the blocked island. Routes will treat authored blocked areas as exclusions.';
			});
			semanticEditor.append(exclusion);
		}
	}

	if (!destination && 'label' in element && typeof element.label === 'string') textField('Label', element.label, (value): void => {
		element.label = value;
	});
	if (element.type === 'door') {
		const locations: WayfindingStudioPolygonElement[] = currentElements().filter((item: WayfindingStudioElement): item is WayfindingStudioPolygonElement => item.type === 'location');
		selectField('Connected room / area', [['', 'Unassigned'], ...locations.map((location): [string, string] => [location.id, location.label ?? location.id])], element.locationId ?? '', (value): void => { element.locationId = value || undefined; }, semanticEditor, 'Links this entrance to its destination. Route guidance terminates at the door center.');
		textField('Rotation (degrees)', String(element.angle), (value): void => { element.angle = Number(value) || 0; }, 'number', semanticEditor, 'Rotate the door marker to align it with the wall. This also records the entrance orientation.');
		const rotationActions: HTMLDivElement = document.createElement('div');
		rotationActions.className = 'shape-point-actions';
		for (const [label, angle] of [['Horizontal', 0], ['Vertical', 90], ['-15 deg', element.angle - 15], ['+15 deg', element.angle + 15]] as const) {
			const rotate: HTMLButtonElement = document.createElement('button');
			rotate.type = 'button';
			rotate.textContent = label;
			rotate.addEventListener('click', (): void => {
				const before: HistoryState = captureHistoryState();
				element.angle = ((angle % 360) + 360) % 360;
				syncStudioGraph();
				recordHistory(before);
				renderSemanticEditor();
				draw();
			});
			rotationActions.append(rotate);
		}
		semanticEditor.append(rotationActions);
		textField('Marker length', String(element.length), (value): void => { element.length = Math.max(4, Number(value) || 4); }, 'number');
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
		selectField('Font family', [['sans-serif', 'Sans serif'], ['serif', 'Serif'], ['monospace', 'Monospace']], element.fontFamily ?? 'sans-serif', (value): void => { element.fontFamily = value as WayfindingStudioLabelElement['fontFamily']; });
		textField('Font size', String(element.fontSize ?? 24), (value): void => { element.fontSize = Math.min(512, Math.max(6, Number(value) || 24)); }, 'number');
		selectField('Weight', [['400', 'Regular'], ['600', 'Semibold'], ['700', 'Bold']], String(element.fontWeight ?? 600), (value): void => { element.fontWeight = Number(value) as WayfindingStudioLabelElement['fontWeight']; });
		textField('Text color', element.color ?? '#17201f', (value): void => { element.color = value; }, 'color');
		selectField('Alignment', [['start', 'Left'], ['middle', 'Center'], ['end', 'Right']], element.textAnchor ?? 'start', (value): void => { element.textAnchor = value as WayfindingStudioLabelElement['textAnchor']; });
		textField('Outline color', element.outlineColor ?? '#ffffff', (value): void => { element.outlineColor = value; }, 'color');
		textField('Outline width', String(element.outlineWidth ?? 0), (value): void => { element.outlineWidth = Math.min(16, Math.max(0, Number(value) || 0)); }, 'number', semanticEditor, 'Use a small outline when the map artwork makes text hard to read.');
	} else if (element.type === 'icon' || element.type === 'logo') {
		textField('Width', String(element.width), (value): void => { element.width = Math.max(8, Number(value) || 8); }, 'number');
		textField('Height', String(element.height), (value): void => { element.height = Math.max(8, Number(value) || 8); }, 'number');
	}
	const advanced: HTMLDetailsElement = document.createElement('details');
	const advancedSummary: HTMLElement = document.createElement('summary');
	advancedSummary.textContent = 'Advanced identity and review';
	advanced.append(advancedSummary);
	selectField('Review status', [['proposed', 'Proposed'], ['confirmed', 'Confirmed']], element.status, (value): void => { element.status = value as WayfindingStudioElement['status']; }, advanced);
	if ('destinationId' in element) textField('Destination id', element.destinationId ?? '', (value): void => {
		const previousId: string | undefined = element.destinationId;
		const nextIdValue: string | undefined = value.trim() || undefined;
		element.destinationId = nextIdValue;
		if (previousId && nextIdValue && previousId !== nextIdValue) {
			const linkedDestination: DestinationRow | undefined = destinationRows().find((row: DestinationRow): boolean => row.id === previousId);
			if (linkedDestination) linkedDestination.id = nextIdValue;
			if (selectedDestinationId === previousId) selectedDestinationId = nextIdValue;
		}
	}, 'text', advanced, 'Used by datasources and routes. Change only when integrating an existing project.');
	semanticEditor.append(advanced);
	const remove: HTMLButtonElement = document.createElement('button');
	remove.className = 'danger';
	remove.textContent = 'Delete semantic element';
	remove.addEventListener('click', deleteCurrentSelection);
	semanticEditor.append(remove);
	updateEditActions();
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
	const previousTranslationLanguage: string = destinationLanguage.value;
	const translationLanguages: WayfindingStudioLanguage[] = projectLanguages()
		.filter((language: WayfindingStudioLanguage): boolean => language.code !== studioProject.defaultLanguage);
	destinationLanguage.replaceChildren(...translationLanguages.map((language: WayfindingStudioLanguage): HTMLOptionElement => {
		const option: HTMLOptionElement = document.createElement('option');
		option.value = language.code;
		option.textContent = `${language.label} (${language.code})`;

		return option;
	}));
	if (translationLanguages.some((language: WayfindingStudioLanguage): boolean => language.code === previousTranslationLanguage)) {
		destinationLanguage.value = previousTranslationLanguage;
	}
	const translationCode: string | undefined = destinationLanguage.value || translationLanguages[0]?.code;
	const translation: WayfindingStudioTranslation | undefined = translationCode ? row.translations?.[translationCode] : undefined;
	destinationLanguage.disabled = translationLanguages.length === 0;
	destinationTranslatedName.disabled = translationLanguages.length === 0;
	destinationTranslatedDescription.disabled = translationLanguages.length === 0;
	destinationTranslatedName.placeholder = translationLanguages.length === 0 ? 'Add another project language first' : '';
	destinationTranslatedDescription.placeholder = translationLanguages.length === 0 ? 'Add another project language first' : '';
	destinationTranslatedName.value = translation?.name ?? '';
	destinationTranslatedDescription.value = translation?.description ?? '';
	const categories: string[] = projectCategories();
	destinationCategory.replaceChildren(
		new Option('No category', ''),
		...categories.map((category: string): HTMLOptionElement => new Option(category, category))
	);
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
	touchWayfindingStudioProject(studioProject);
	scheduleAutosave();
};

const updateSelectedTranslation = (field: keyof WayfindingStudioTranslation, value: string): void => {
	const row: DestinationRow | undefined = selectedDestination();
	const languageCode: string = destinationLanguage.value;
	if (!row || !languageCode) return;
	row.translations ??= {};
	row.translations[languageCode] ??= {};
	if (value.trim()) row.translations[languageCode][field] = value;
	else {
		delete row.translations[languageCode][field];
		if (Object.keys(row.translations[languageCode]).length === 0) delete row.translations[languageCode];
		if (Object.keys(row.translations).length === 0) delete row.translations;
	}
	touchWayfindingStudioProject(studioProject);
	scheduleAutosave();
};

const edgePoints = (edge: WayfindingEdge): WayfindingPoint[] => {
	const from: WayfindingNode | undefined = graphNode(edge.from);
	const to: WayfindingNode | undefined = graphNode(edge.to);

	if (!from || !to) return [];

	return edge.geometry?.length ? edge.geometry : [from, to];
};

const resizeCanvas = (): void => {
	if (canvas.classList.contains('view-hidden')) return;
	const bounds: DOMRect = canvas.getBoundingClientRect();
	if (bounds.width < 2 || bounds.height < 2) return;
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

const fitView = (): void => {
	fitImage();
	draw();
};

const nudgeSelectedSemantic = (dx: number, dy: number): void => {
	const element: WayfindingStudioElement | undefined = semanticElement();
	if (!element) return;
	const before: HistoryState = captureHistoryState();
	if ('geometry' in element) {
		if (selectedSemanticVertexIndex !== undefined) {
			const point: WayfindingPoint | undefined = element.geometry[selectedSemanticVertexIndex];
			if (!point) return;
			element.geometry[selectedSemanticVertexIndex] = { x: point.x + dx, y: point.y + dy };
		} else element.geometry = element.geometry.map((point: WayfindingPoint): WayfindingPoint => ({ x: point.x + dx, y: point.y + dy }));
	} else {
		element.point = { x: element.point.x + dx, y: element.point.y + dy };
	}
	element.status = 'proposed';
	syncStudioGraph();
	recordHistory(before);
	renderStudioControls();
	draw();
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
	const width: number = sourceImage?.naturalWidth ?? currentFloor().width;
	const height: number = sourceImage?.naturalHeight ?? currentFloor().height;
	maskColumns = Math.ceil(width / cellSize());
	maskRows = Math.ceil(height / cellSize());
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

const colorDistance = (
	left: Pick<ColorSample, 'r' | 'g' | 'b'>,
	right: Pick<ColorSample, 'r' | 'g' | 'b'>
): number => Math.hypot(left.r - right.r, left.g - right.g, left.b - right.b);

const edgeStrengthAt = (x: number, y: number): number => {
	const left = pixelColorAt(x - 1, y);
	const right = pixelColorAt(x + 1, y);
	const top = pixelColorAt(x, y - 1);
	const bottom = pixelColorAt(x, y + 1);
	if (!left || !right || !top || !bottom) return 0;

	return colorDistance(left, right) + colorDistance(top, bottom);
};

const snapPointToSourceEdge = (point: WayfindingPoint): WayfindingPoint => {
	if (!snapToEdgesInput.checked || !sourcePixels || !sourceImage) return { ...point };
	const radius: number = Number(snapRadiusInput.value);
	const stride: number = radius > 18 ? 2 : 1;
	let best: WayfindingPoint = { ...point };
	let bestScore = edgeStrengthAt(point.x, point.y);

	for (let y = Math.round(point.y - radius); y <= point.y + radius; y += stride) {
		for (let x = Math.round(point.x - radius); x <= point.x + radius; x += stride) {
			const distance: number = Math.hypot(x - point.x, y - point.y);
			if (distance > radius) continue;
			const score: number = edgeStrengthAt(x, y) - distance * 3;
			if (score > bestScore) {
				best = { x, y };
				bestScore = score;
			}
		}
	}

	return bestScore >= 55 ? best : { ...point };
};

interface BoundaryEdge {
	end: [number, number];
	start: [number, number];
}

const polygonArea = (points: WayfindingPoint[]): number => points.reduce((area: number, point: WayfindingPoint, index: number): number => {
	const next: WayfindingPoint = points[(index + 1) % points.length];

	return area + point.x * next.y - next.x * point.y;
}, 0) / 2;

const colorToHex = (color: Pick<ColorSample, 'r' | 'g' | 'b'>): string => {
	return `#${[color.r, color.g, color.b].map((value: number): string => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')).join('')}`;
};

const distanceToLine = (point: WayfindingPoint, start: WayfindingPoint, end: WayfindingPoint): number => {
	const length: number = Math.hypot(end.x - start.x, end.y - start.y);
	if (length === 0) return Math.hypot(point.x - start.x, point.y - start.y);

	return Math.abs((end.x - start.x) * (start.y - point.y) - (start.x - point.x) * (end.y - start.y)) / length;
};

const lineProjection = (point: WayfindingPoint, start: WayfindingPoint, end: WayfindingPoint): number => {
	const dx: number = end.x - start.x;
	const dy: number = end.y - start.y;
	const lengthSquared: number = dx * dx + dy * dy;

	return lengthSquared === 0 ? 0 : ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
};

const removeShallowBoundaryDetails = (points: WayfindingPoint[], gridSize: number, cleanupDistance: number): WayfindingPoint[] => {
	if (points.length < 6 || cleanupDistance <= 0) return points;
	const xs: number[] = points.map((point: WayfindingPoint): number => point.x);
	const ys: number[] = points.map((point: WayfindingPoint): number => point.y);
	const minimumDimension: number = Math.max(gridSize, Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)));
	const maximumChord: number = Math.max(gridSize * 8, cleanupDistance * 8, Math.min(96, minimumDimension * 0.2));
	const maximumDepth: number = Math.max(gridSize * 4, cleanupDistance * 2, Math.min(48, minimumDimension * 0.11));
	const lineTolerance: number = Math.max(gridSize * 2.5, cleanupDistance, minimumDimension * 0.008);
	const cleaned: WayfindingPoint[] = [...points];
	let changed = true;
	let pass = 0;

	while (changed && pass < 8 && cleaned.length >= 6) {
		changed = false;
		pass += 1;
		for (let startIndex = 1; startIndex < cleaned.length - 3 && !changed; startIndex += 1) {
			for (let endIndex = startIndex + 3; endIndex < Math.min(cleaned.length - 1, startIndex + 8); endIndex += 1) {
				const start: WayfindingPoint = cleaned[startIndex];
				const end: WayfindingPoint = cleaned[endIndex];
				const previous: WayfindingPoint = cleaned[startIndex - 1];
				const next: WayfindingPoint = cleaned[endIndex + 1];
				const chord: number = Math.hypot(end.x - start.x, end.y - start.y);
				if (chord < gridSize * 2 || chord > maximumChord) continue;
				if (distanceToLine(previous, start, end) > lineTolerance || distanceToLine(next, start, end) > lineTolerance) continue;
				if (lineProjection(previous, start, end) > 0.05 || lineProjection(next, start, end) < 0.95) continue;
				const detail: WayfindingPoint[] = cleaned.slice(startIndex, endIndex + 1);
				const maximumDeviation: number = Math.max(...detail.slice(1, -1).map((candidate: WayfindingPoint): number => distanceToLine(candidate, start, end)));
				const pathLength: number = detail.slice(1).reduce((length: number, candidate: WayfindingPoint, index: number): number => {
					const prior: WayfindingPoint = detail[index];

					return length + Math.hypot(candidate.x - prior.x, candidate.y - prior.y);
				}, 0);
				if (maximumDeviation > maximumDepth || pathLength < chord * 1.35) continue;
				cleaned.splice(startIndex + 1, endIndex - startIndex - 1);
				changed = true;
				break;
			}
		}
	}

	return cleaned;
};

const removeRedundantPolygonPoints = (points: WayfindingPoint[], toleranceValue: number): WayfindingPoint[] => {
	const cleaned: WayfindingPoint[] = [...points];
	let changed = true;
	while (changed && cleaned.length > 3) {
		changed = false;
		for (let index = 0; index < cleaned.length; index += 1) {
			const previous: WayfindingPoint = cleaned[(index - 1 + cleaned.length) % cleaned.length];
			const current: WayfindingPoint = cleaned[index];
			const next: WayfindingPoint = cleaned[(index + 1) % cleaned.length];
			if (Math.hypot(current.x - previous.x, current.y - previous.y) <= toleranceValue
				|| distanceToSegment(current, previous, next) <= toleranceValue) {
				cleaned.splice(index, 1);
				changed = true;
				break;
			}
		}
	}

	return cleaned;
};

const morphRegionMask = (
	source: Uint8Array,
	columns: number,
	rows: number,
	radius: number,
	operation: 'dilate' | 'erode'
): Uint8Array => {
	if (radius <= 0) return source.slice();
	const result = new Uint8Array(source.length);
	const offsets: Array<[number, number]> = [];
	for (let dy = -radius; dy <= radius; dy += 1) {
		for (let dx = -radius; dx <= radius; dx += 1) {
			if (dx * dx + dy * dy <= radius * radius) offsets.push([dx, dy]);
		}
	}
	for (let row = 0; row < rows; row += 1) {
		for (let column = 0; column < columns; column += 1) {
			const index: number = row * columns + column;
			if (operation === 'dilate' && source[index] !== 1) continue;
			if (operation === 'erode' && source[index] !== 1) continue;
			if (operation === 'dilate') {
				for (const [dx, dy] of offsets) {
					const targetColumn: number = column + dx;
					const targetRow: number = row + dy;
					if (targetColumn < 0 || targetRow < 0 || targetColumn >= columns || targetRow >= rows) continue;
					result[targetRow * columns + targetColumn] = 1;
				}
				continue;
			}
			let survives = true;
			for (const [dx, dy] of offsets) {
				const targetColumn: number = column + dx;
				const targetRow: number = row + dy;
				if (targetColumn < 0 || targetRow < 0 || targetColumn >= columns || targetRow >= rows
					|| source[targetRow * columns + targetColumn] !== 1) {
					survives = false;
					break;
				}
			}
			if (survives) result[index] = 1;
		}
	}

	return result;
};

const closeRegionMask = (source: Uint8Array, columns: number, rows: number, gapCells: number): Uint8Array => {
	const radius: number = Math.max(0, Math.ceil(gapCells / 2));
	if (radius === 0) return source.slice();

	return morphRegionMask(morphRegionMask(source, columns, rows, radius, 'dilate'), columns, rows, radius, 'erode');
};

const detectFlatRegionBoundary = (point: WayfindingPoint): DetectedRegion | undefined => {
	if (!sourceImage || !sourcePixels) return undefined;
	const gridSize: number = Math.max(2, Math.round(Math.max(sourceImage.naturalWidth, sourceImage.naturalHeight) / 900));
	const columns: number = Math.ceil(sourceImage.naturalWidth / gridSize);
	const rows: number = Math.ceil(sourceImage.naturalHeight / gridSize);
	const seedColumn: number = Math.max(0, Math.min(columns - 1, Math.floor(point.x / gridSize)));
	const seedRow: number = Math.max(0, Math.min(rows - 1, Math.floor(point.y / gridSize)));
	const seedColor = pixelColorAt((seedColumn + 0.5) * gridSize, (seedRow + 0.5) * gridSize);
	if (!seedColor) return undefined;
	const candidate = new Uint8Array(columns * rows);
	const threshold: number = Math.max(8, tolerance());
	for (let row = 0; row < rows; row += 1) {
		for (let column = 0; column < columns; column += 1) {
			const color = pixelColorAt((column + 0.5) * gridSize, (row + 0.5) * gridSize);
			if (color && colorDistance(color, seedColor) <= threshold) candidate[row * columns + column] = 1;
		}
	}
	const minimumOpeningCells: number = Math.max(0, Math.ceil(Number(detectOpeningInput.value) / gridSize));
	const openingRadius: number = Math.max(0, Math.floor((minimumOpeningCells - 1) / 2));
	const traversable: Uint8Array = openingRadius > 0
		? morphRegionMask(candidate, columns, rows, openingRadius, 'erode')
		: candidate.slice();
	let floodSeedColumn: number = seedColumn;
	let floodSeedRow: number = seedRow;
	if (traversable[seedRow * columns + seedColumn] !== 1) {
		let nearestDistance = Number.POSITIVE_INFINITY;
		const searchRadius: number = Math.max(2, minimumOpeningCells + 1);
		for (let row = Math.max(0, seedRow - searchRadius); row <= Math.min(rows - 1, seedRow + searchRadius); row += 1) {
			for (let column = Math.max(0, seedColumn - searchRadius); column <= Math.min(columns - 1, seedColumn + searchRadius); column += 1) {
				if (traversable[row * columns + column] !== 1) continue;
				const distance: number = (column - seedColumn) ** 2 + (row - seedRow) ** 2;
				if (distance >= nearestDistance) continue;
				nearestDistance = distance;
				floodSeedColumn = column;
				floodSeedRow = row;
			}
		}
		if (!Number.isFinite(nearestDistance)) return undefined;
	}
	let region: Uint8Array = new Uint8Array(columns * rows);
	const queued = new Uint8Array(columns * rows);
	const queue: Array<[number, number]> = [[floodSeedColumn, floodSeedRow]];
	queued[floodSeedRow * columns + floodSeedColumn] = 1;

	for (let cursor = 0; cursor < queue.length; cursor += 1) {
		const [column, row] = queue[cursor];
		const index: number = row * columns + column;
		if (traversable[index] !== 1) continue;
		region[index] = 1;
		for (const [nextColumn, nextRow] of [[column - 1, row], [column + 1, row], [column, row - 1], [column, row + 1]] as Array<[number, number]>) {
			if (nextColumn < 0 || nextRow < 0 || nextColumn >= columns || nextRow >= rows) continue;
			const nextIndex: number = nextRow * columns + nextColumn;
			if (queued[nextIndex] === 1 || traversable[nextIndex] !== 1) continue;
			queued[nextIndex] = 1;
			queue.push([nextColumn, nextRow]);
		}
	}
	if (openingRadius > 0) {
		const restored: Uint8Array = morphRegionMask(region, columns, rows, openingRadius, 'dilate');
		for (let index = 0; index < region.length; index += 1) {
			region[index] = restored[index] === 1 && candidate[index] === 1 ? 1 : 0;
		}
	}
	const gapCells: number = Math.max(0, Math.ceil(Number(detectGapInput.value) / gridSize));
	region = closeRegionMask(region, columns, rows, gapCells);

	const regionSize: number = region.reduce((sum: number, value: number): number => sum + value, 0);
	if (regionSize < 12 || regionSize > columns * rows * 0.48) return undefined;
	const averageColor = { b: 0, g: 0, r: 0 };
	for (let row = 0; row < rows; row += 1) {
		for (let column = 0; column < columns; column += 1) {
			if (region[row * columns + column] !== 1) continue;
			const color = pixelColorAt((column + 0.5) * gridSize, (row + 0.5) * gridSize);
			if (!color) continue;
			averageColor.r += color.r;
			averageColor.g += color.g;
			averageColor.b += color.b;
		}
	}
	averageColor.r /= regionSize;
	averageColor.g /= regionSize;
	averageColor.b /= regionSize;
	const boundaryEdges: BoundaryEdge[] = [];
	const inside = (column: number, row: number): boolean => column >= 0 && row >= 0 && column < columns && row < rows && region[row * columns + column] === 1;
	for (let row = 0; row < rows; row += 1) {
		for (let column = 0; column < columns; column += 1) {
			if (!inside(column, row)) continue;
			if (!inside(column, row - 1)) boundaryEdges.push({ start: [column, row], end: [column + 1, row] });
			if (!inside(column + 1, row)) boundaryEdges.push({ start: [column + 1, row], end: [column + 1, row + 1] });
			if (!inside(column, row + 1)) boundaryEdges.push({ start: [column + 1, row + 1], end: [column, row + 1] });
			if (!inside(column - 1, row)) boundaryEdges.push({ start: [column, row + 1], end: [column, row] });
		}
	}
	const key = ([x, y]: [number, number]): string => `${x}:${y}`;
	const outgoing = new Map<string, number[]>();
	for (const [index, edge] of boundaryEdges.entries()) outgoing.set(key(edge.start), [...(outgoing.get(key(edge.start)) ?? []), index]);
	const unused = new Set<number>(boundaryEdges.map((_, index: number): number => index));
	const loops: WayfindingPoint[][] = [];

	while (unused.size > 0) {
		const firstIndex: number = unused.values().next().value as number;
		const first: BoundaryEdge = boundaryEdges[firstIndex];
		const loop: WayfindingPoint[] = [{ x: first.start[0] * gridSize, y: first.start[1] * gridSize }];
		let edgeIndex: number | undefined = firstIndex;
		let guard = 0;
		while (edgeIndex !== undefined && guard < boundaryEdges.length + 1) {
			guard += 1;
			const edge: BoundaryEdge = boundaryEdges[edgeIndex];
			unused.delete(edgeIndex);
			loop.push({ x: edge.end[0] * gridSize, y: edge.end[1] * gridSize });
			if (key(edge.end) === key(first.start)) break;
			edgeIndex = (outgoing.get(key(edge.end)) ?? []).find((candidate: number): boolean => unused.has(candidate));
		}
		if (loop.length >= 4) loops.push(loop);
	}

		const outer: WayfindingPoint[] | undefined = loops.sort((left, right): number => Math.abs(polygonArea(right)) - Math.abs(polygonArea(left)))[0];
		if (!outer) return undefined;
		const cleanupDistance: number = Number(detectDetailInput.value);
		const simplified: WayfindingPoint[] = simplifyGeometry(outer.slice(0, -1), Math.max(gridSize * 1.5, cleanupDistance * 0.55, 3));
		const cleaned: WayfindingPoint[] = removeRedundantPolygonPoints(
			removeShallowBoundaryDetails(simplified, gridSize, cleanupDistance),
			Math.max(1, gridSize * 1.25, cleanupDistance * 0.35)
		);

	return cleaned.length >= 3 ? { color: colorToHex(averageColor), geometry: cleaned } : undefined;
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
	const insideAuthoredObstacle: boolean = currentElements().some((element: WayfindingStudioElement): boolean =>
		element.type === 'obstacle' && pointInPolygon(point, element.geometry)
	);
	if (insideAuthoredObstacle) return false;
	const column: number = Math.floor(point.x / cellSize());
	const row: number = Math.floor(point.y / cellSize());

	return cellInBounds(column, row) && mask[maskIndex(column, row)] === 1;
};

const pointWalkableWithClearance = (point: WayfindingPoint, clearance: number): boolean => {
	if (!pointWalkable(point)) return false;
	if (clearance <= 0) return true;
	for (const angle of [0, Math.PI / 4, Math.PI / 2, Math.PI * 3 / 4, Math.PI, Math.PI * 5 / 4, Math.PI * 3 / 2, Math.PI * 7 / 4]) {
		if (!pointWalkable({
			x: point.x + Math.cos(angle) * clearance,
			y: point.y + Math.sin(angle) * clearance
		})) return false;
	}

	return true;
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

const doorRotationHandlePoint = (door: WayfindingStudioDoorElement): WayfindingPoint => {
	const radians: number = door.angle * Math.PI / 180;
	const distance: number = door.length / 2 + 26 / scale;

	return {
		x: door.point.x + Math.cos(radians) * distance,
		y: door.point.y + Math.sin(radians) * distance
	};
};

const drawSemanticElements = (): void => {
	const colors: Record<string, string> = {
		door: '#17201f', label: '#17201f', location: '#d9981c', obstacle: '#a83c32', origin: '#138b75', poi: '#2b6cb0', transition: '#7b4bc4', walkable: '#17a886'
	};
	const defaults: WayfindingStudioProjectDefaults = projectDefaults();
	for (const element of currentElements()) {
		if (!layerVisible(element.type)) continue;
		const selected: boolean = element.id === selectedSemanticId;
		const polygon: WayfindingStudioPolygonElement | undefined = 'geometry' in element ? element : undefined;
		const polygonDefaults = polygon ? defaults[polygon.type] : undefined;
		context.save();
		context.lineWidth = (selected ? 5 : 2.5) / scale;
		context.strokeStyle = selected ? '#ffe06c' : polygonDefaults ? polygon?.presentation?.fillColor ?? polygonDefaults.fillColor : colors[element.type];
		context.fillStyle = polygonDefaults ? polygon?.presentation?.fillColor ?? polygonDefaults.fillColor : colors[element.type];
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
			context.globalAlpha = element.presentation?.fillOpacity ?? polygonDefaults?.fillOpacity ?? 0.2;
			context.fill();
			context.globalAlpha = 1;
			if (workspaceMode !== 'route-preview' || selected) {
				context.lineJoin = 'round';
				context.lineWidth = (selected ? 6 : 4) / scale;
				context.strokeStyle = selected ? '#ffe06c' : 'rgba(255, 255, 255, 0.94)';
				context.stroke();
				context.lineWidth = (selected ? 2.5 : 1.5) / scale;
				context.strokeStyle = selected ? '#17201f' : '#087d6b';
				context.stroke();
			}
			if (selected) {
				context.fillStyle = '#fffdf6';
				for (const [index, vertex] of element.geometry.entries()) {
					context.beginPath();
					context.arc(vertex.x, vertex.y, (index === selectedSemanticVertexIndex ? 10 : 7) / scale, 0, Math.PI * 2);
					context.fill();
					context.stroke();
					if (index === selectedSemanticVertexIndex) {
						context.beginPath();
						context.fillStyle = '#17201f';
						context.arc(vertex.x, vertex.y, 3 / scale, 0, Math.PI * 2);
						context.fill();
						context.fillStyle = '#fffdf6';
					}
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
			if (selected && workspaceMode === 'map') {
				const handle: WayfindingPoint = doorRotationHandlePoint(element);
				context.beginPath();
				context.moveTo(element.point.x + dx, element.point.y + dy);
				context.lineTo(handle.x, handle.y);
				context.strokeStyle = '#d94135';
				context.lineWidth = 2 / scale;
				context.stroke();
				context.beginPath();
				context.arc(handle.x, handle.y, 8 / scale, 0, Math.PI * 2);
				context.fillStyle = '#ffffff';
				context.fill();
				context.stroke();
			}
		} else if (element.type === 'label') {
			const fontFamilies: Record<NonNullable<WayfindingStudioLabelElement['fontFamily']>, string> = {
				monospace: '"Courier New", monospace',
				'sans-serif': 'Arial, sans-serif',
				serif: 'Georgia, serif'
			};
			const fontSize: number = element.fontSize ?? defaults.label.fontSize;
			const outlineWidth: number = element.outlineWidth ?? defaults.label.outlineWidth;
			context.font = `${element.fontWeight ?? defaults.label.fontWeight} ${fontSize}px ${fontFamilies[element.fontFamily ?? defaults.label.fontFamily]}`;
			context.textAlign = element.textAnchor === 'middle' ? 'center' : element.textAnchor === 'end' ? 'right' : 'left';
			context.textBaseline = 'alphabetic';
			if (outlineWidth > 0) {
				context.strokeStyle = element.outlineColor ?? defaults.label.outlineColor;
				context.lineWidth = outlineWidth;
				context.lineJoin = 'round';
				context.strokeText(element.text, element.point.x, element.point.y);
			}
			context.fillStyle = element.color ?? defaults.label.color;
			context.fillText(element.text, element.point.x, element.point.y);
			if (selected) {
				context.beginPath();
				context.arc(element.point.x, element.point.y, 6 / scale, 0, Math.PI * 2);
				context.fillStyle = '#ffe06c';
				context.fill();
			}
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

function routeDestinationAt(pointValue: WayfindingPoint): WayfindingStudioElement | undefined {
	return [...currentElements()].reverse().find((element: WayfindingStudioElement): boolean => {
		if (!((element.type === 'location' || element.type === 'poi') && element.destinationId)) return false;
		if (element.type === 'location') return pointInPolygon(pointValue, element.geometry);
		if (element.type !== 'poi') return false;

		return Math.hypot(element.point.x - pointValue.x, element.point.y - pointValue.y) <= Math.max(24, 24 / scale);
	});
}

function simulateSelectedRoute(): boolean {
	syncStudioGraph();
	const startId: string = routeStart.value;
	const destinationNodeId: string = routeDestination.value;
	if (!startId || !destinationNodeId) {
		routeResult.textContent = 'Add an origin and a routeable destination entrance first.';
		routeClearButton.disabled = true;
		routeInspectButton.disabled = true;
		return false;
	}
	simulatedRoute = new WayfindingGraph(studioProject.graph).route(startId, destinationNodeId, { profile: routeProfile.value as 'standard' | 'step-free' });
	if (!simulatedRoute) {
		routeResult.textContent = 'No route exists for the selected profile. Connect the origin, transitions, and destination entrance.';
		routeClearButton.disabled = true;
		routeInspectButton.disabled = true;
		draw();
		return false;
	}
	const floors: string[] = [...new Set(simulatedRoute.nodeIds
		.map((id: string): string => studioProject.graph.nodes.find((node: WayfindingNode): boolean => node.id === id)?.levelId ?? ''))]
		.filter(Boolean);
	routeResult.textContent = `${simulatedRoute.walkingDistance} m, ${Math.ceil(simulatedRoute.walkingSeconds / 60)} min, ${simulatedRoute.edgeIds.length} network segment${simulatedRoute.edgeIds.length === 1 ? '' : 's'}, ${floors.join(' -> ')}`;
	routeClearButton.disabled = false;
	routeInspectButton.disabled = false;
	draw();

	return true;
}

function routeToSemanticElement(elementId: string): boolean {
	const element: WayfindingStudioElement | undefined = studioProject.floors
		.flatMap((floor: WayfindingStudioFloor): WayfindingStudioElement[] => floor.elements)
		.find((candidate: WayfindingStudioElement): boolean => candidate.id === elementId);
	if (!element || !((element.type === 'location' || element.type === 'poi') && element.destinationId)) return false;
	const destinationNode: WayfindingNode | undefined = studioProject.graph.nodes.find((node: WayfindingNode): boolean =>
		node.kind === 'location' && (node.semanticElementId === element.id || node.locationId === element.destinationId)
	);
	if (!destinationNode) {
		routeResult.textContent = 'This destination has no route entrance yet. Add or link a door in Route edit.';
		return false;
	}
	const availability: RouteDestinationAvailability = routeDestinationAvailability(destinationNode);
	if (!availability.available) {
		routeResult.textContent = availability.reason === 'needs linked door'
			? 'This room is not route-ready. Add a door at its public entrance and link it to the room in Map edit.'
			: 'Routing is disabled for this destination in its public details.';
		return false;
	}
	const matchingOption: HTMLOptionElement | undefined = Array.from(routeDestination.options).find((option: HTMLOptionElement): boolean => option.value === destinationNode.id);
	if (!matchingOption) renderRouteSimulator();
	routeDestination.value = destinationNode.id;
	selectedDestinationId = element.destinationId;
	selectedSemanticId = element.id;
	selectedSemanticVertexIndex = undefined;
	selectedEdgeId = undefined;
	scene3d.selectElement(element.id);

	return simulateSelectedRoute();
}

const distanceToPolygonBoundary = (pointValue: WayfindingPoint, geometry: WayfindingPoint[]): number => {
	return geometry.reduce((minimum: number, vertex: WayfindingPoint, index: number): number => {
		return Math.min(minimum, distanceToSegment(pointValue, vertex, geometry[(index + 1) % geometry.length]));
	}, Number.POSITIVE_INFINITY);
};

const nearestLocationForDoor = (pointValue: WayfindingPoint): WayfindingStudioPolygonElement | undefined => {
	const locations: WayfindingStudioPolygonElement[] = currentElements().filter((element: WayfindingStudioElement): element is WayfindingStudioPolygonElement => element.type === 'location');
	const containing: WayfindingStudioPolygonElement | undefined = locations.find((location: WayfindingStudioPolygonElement): boolean => pointInPolygon(pointValue, location.geometry));
	if (containing) return containing;
	const maximumDistance: number = Math.max(36, Math.min(currentFloor().width, currentFloor().height) * 0.035);
	const ranked = locations
		.map((location: WayfindingStudioPolygonElement) => ({ distance: distanceToPolygonBoundary(pointValue, location.geometry), location }))
		.sort((left, right): number => left.distance - right.distance);

	return ranked[0]?.distance <= maximumDistance ? ranked[0].location : undefined;
};

const linkUnassignedDoorsToNearbyLocations = (): number => {
	let linked = 0;
	for (const door of currentElements().filter((element: WayfindingStudioElement): element is WayfindingStudioDoorElement => element.type === 'door' && !element.locationId)) {
		const location: WayfindingStudioPolygonElement | undefined = nearestLocationForDoor(door.point);
		if (!location) continue;
		door.locationId = location.id;
		linked += 1;
	}

	return linked;
};

const rasterizeAuthoredWalkableAreas = (): boolean => {
	const walkableAreas: WayfindingStudioPolygonElement[] = currentElements().filter((element: WayfindingStudioElement): element is WayfindingStudioPolygonElement => element.type === 'walkable');
	if (walkableAreas.length === 0) return false;
	const obstacles: WayfindingStudioPolygonElement[] = currentElements().filter((element: WayfindingStudioElement): element is WayfindingStudioPolygonElement => element.type === 'obstacle');
	resetMaskGrid();
	for (let row = 0; row < maskRows; row += 1) {
		for (let column = 0; column < maskColumns; column += 1) {
			const pointValue: WayfindingPoint = {
				x: Math.min(currentFloor().width, (column + 0.5) * cellSize()),
				y: Math.min(currentFloor().height, (row + 0.5) * cellSize())
			};
			const included: boolean = walkableAreas.some((area: WayfindingStudioPolygonElement): boolean => pointInPolygon(pointValue, area.geometry));
			const excluded: boolean = obstacles.some((area: WayfindingStudioPolygonElement): boolean => pointInPolygon(pointValue, area.geometry));
			if (included && !excluded) mask[maskIndex(column, row)] = 1;
		}
	}
	maskReviewStatus = 'proposed';
	maskConfirmedInput.checked = false;
	persistCurrentMask();

	return mask.some((value: number): boolean => value === 1);
};

const addSemanticPoint = (
	type: Exclude<Tool, 'anchor' | 'draw' | 'exclude' | 'graph' | 'include' | 'location' | 'obstacle' | 'pan' | 'sample' | 'select' | 'walkable'>,
	pointValue: WayfindingPoint,
	options: { before?: HistoryState; deferHistory?: boolean } = {}
): WayfindingStudioElement | undefined => {
	const before: HistoryState = options.before ?? captureHistoryState();
	const base = { floorId: currentFloorId, provenance: 'reviewer-authored' as const, status: 'proposed' as const };
	const defaults: WayfindingStudioProjectDefaults = projectDefaults();
	let element: WayfindingStudioElement;
	if (type === 'door') {
		const location: WayfindingStudioPolygonElement | undefined = nearestLocationForDoor(pointValue);
		element = { ...base, angle: 0, id: nextId('door'), length: 36, locationId: location?.id, point: pointValue, type } satisfies WayfindingStudioDoorElement;
	}
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
			return undefined;
		}
		const sourceAsset: WayfindingStudioAsset | undefined = studioProject.assets.find((asset: WayfindingStudioAsset): boolean => asset.id === pendingMediaAssetId);
		if (!sourceAsset) return undefined;
		const asset: WayfindingStudioAsset = sourceAsset.kind === type
			? sourceAsset
			: { ...sourceAsset, id: nextId(`asset-${type}`), kind: type };
		if (asset !== sourceAsset) studioProject.assets.push(asset);
		const naturalWidth: number = asset.naturalWidth ?? 96;
		const naturalHeight: number = asset.naturalHeight ?? 96;
		const targetSize: number = type === 'icon' ? defaults.iconSize : defaults.logoSize;
		const ratio: number = targetSize / Math.max(naturalWidth, naturalHeight);
		const width: number = Math.max(12, naturalWidth * ratio);
		const height: number = Math.max(12, naturalHeight * ratio);
		const floor: WayfindingStudioFloor = currentFloor();
		const point: WayfindingPoint = {
			x: Math.max(0, Math.min(floor.width - width, pointValue.x - width / 2)),
			y: Math.max(0, Math.min(floor.height - height, pointValue.y - height / 2))
		};
		element = { ...base, assetId: asset.id, height, id: nextId(type), point, type, width } satisfies WayfindingStudioMediaElement;
	} else element = { ...base, ...defaults.label, id: nextId('label'), point: pointValue, text: 'Label', textAnchor: 'start', type: 'label' } satisfies WayfindingStudioLabelElement;
	currentFloor().elements.push(element);
	selectedSemanticId = element.id;
	syncStudioGraph();
	if (!options.deferHistory) recordHistory(before);
	if (element.type === 'door') {
		const linkedLocation: WayfindingStudioPolygonElement | undefined = element.locationId
			? currentElements().find((candidate: WayfindingStudioElement): candidate is WayfindingStudioPolygonElement => candidate.type === 'location' && candidate.id === element.locationId)
			: undefined;
		coverageStatus.textContent = linkedLocation
			? `Door linked to ${linkedLocation.label ?? linkedLocation.id}. Change it in Connected room / area if needed.`
			: 'Door added. Choose its Connected room / area before building routes.';
	}
	renderSemanticEditor();
	renderStudioControls();
	draw();

	return element;
};

const commitSemanticPolygon = (
	type: SemanticPolygonTool,
	points: WayfindingPoint[],
	presentation?: WayfindingStudioPolygonPresentation
): void => {
	if (points.length < 3) return;
	const before: HistoryState = captureHistoryState();
	const id: string = nextId(type);
	const defaults: WayfindingStudioProjectDefaults = projectDefaults();
	const element: WayfindingStudioPolygonElement = {
		floorId: currentFloorId,
		geometry: points,
		id,
		label: type === 'location' ? `Location ${id.split('-').at(-1)}` : undefined,
		presentation: { ...defaults[type], ...presentation },
		provenance: 'reviewer-authored',
		status: 'proposed',
		type
	};
	if (element.type === 'location') {
		element.destinationId = id;
		destinationRows().push({ floor: currentFloorId, id, name: element.label ?? id, routeable: true });
	}
	currentFloor().elements.push(element);
	selectedSemanticId = element.id;
	semanticDraft = undefined;
	semanticDraftRedo.length = 0;
	semanticDraftHost.hidden = true;
	syncStudioGraph();
	recordHistory(before);
	renderSemanticEditor();
	renderStudioControls();
	draw();
};

const finishSemanticPolygon = (): void => {
	if (!semanticDraft || semanticDraft.points.length < 3) return;
	commitSemanticPolygon(semanticDraft.type, semanticDraft.points);
};

const draw = (): void => {
	const bounds: DOMRect = canvas.getBoundingClientRect();
	const showRouteNetwork: boolean = workspaceMode === 'route-edit'
		|| (workspaceMode === 'route-preview' && routePreviewNetworkInput.checked);
	canvas.dataset.viewScale = String(scale);
	canvas.dataset.viewOffsetX = String(offsetX);
	canvas.dataset.viewOffsetY = String(offsetY);
	canvas.dataset.semanticDraftPointCount = String(semanticDraft?.points.length ?? 0);
	canvas.dataset.routeNetworkVisible = String(showRouteNetwork);
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

	if (workspaceMode === 'route-edit' && mask.length > 0) {
		context.fillStyle = 'rgba(0, 190, 158, 0.32)';

		for (let row = 0; row < maskRows; row += 1) {
			for (let column = 0; column < maskColumns; column += 1) {
				if (mask[maskIndex(column, row)] === 1) context.fillRect(column * cellSize(), row * cellSize(), cellSize(), cellSize());
			}
		}
	}

	if (workspaceMode === 'route-edit') {
		for (const sample of colorSamples) {
			context.beginPath();
			context.arc((sample.column + 0.5) * cellSize(), (sample.row + 0.5) * cellSize(), 7 / scale, 0, Math.PI * 2);
			context.fillStyle = `rgb(${sample.r}, ${sample.g}, ${sample.b})`;
			context.fill();
			context.lineWidth = 2 / scale;
			context.strokeStyle = '#ffffff';
			context.stroke();
		}
	}

	if (graph && showRouteNetwork) {
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
			const selectedInEditor: boolean = workspaceMode === 'route-edit' && edge.id === selectedEdgeId;
			context.lineWidth = (selectedInEditor ? 5 : workspaceMode === 'route-preview' ? 2 : 2.5) / scale;
			context.strokeStyle = selectedInEditor
				? '#ffd34e'
				: valid ? workspaceMode === 'route-preview' ? 'rgba(0, 112, 94, 0.58)' : '#008f77' : '#e13f34';
			context.stroke();

			if (workspaceMode === 'route-edit' && tool === 'graph' && edge.id === selectedEdgeId) {
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

		if (workspaceMode === 'route-edit' && (tool === 'anchor' || tool === 'draw')) {
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

		if (workspaceMode === 'route-edit' && edgeDraft && edgeDraft.points.length > 0) {
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

		const selectedNode: WayfindingNode | undefined = workspaceMode === 'route-edit'
			? graph.nodes.find((node: WayfindingNode): boolean => node.levelId === currentFloorId && node.locationId === selectedDestinationId)
			: undefined;

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
	if (simulatedRoute && workspaceMode !== 'map') {
		const points: WayfindingPoint[] = simulatedRoutePoints();
		const routeDefaults: WayfindingStudioProjectDefaults['route'] = projectDefaults().route;
		canvas.dataset.previewRoutePointCount = String(points.length);
		canvas.dataset.routeAnimation = routeDefaults.animation;
		if (points.length > 1) {
			context.beginPath();
			traceRoundedRoute(context, points, routeDefaults.cornerRadius);
			context.lineWidth = routeDefaults.lineWidth / scale;
			context.lineCap = 'round';
			context.lineJoin = 'round';
			context.strokeStyle = routeDefaults.color;
			if (routeDefaults.animation === 'flow') {
				context.setLineDash([18 / scale, 12 / scale]);
				context.lineDashOffset = -routeAnimationPhase / scale;
			} else if (routeDefaults.animation === 'pulse') {
				context.globalAlpha = 0.68 + (Math.sin(routeAnimationPhase / 8) + 1) * 0.16;
				context.lineWidth = (routeDefaults.lineWidth + (Math.sin(routeAnimationPhase / 8) + 1) * 1.5) / scale;
			}
			context.stroke();
			context.setLineDash([]);
			context.globalAlpha = 1;
		}
	} else canvas.dataset.previewRoutePointCount = '0';

	context.restore();
	refresh3d();
	scheduleRouteAnimation();
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
	if (edgeId) {
		selectedSemanticId = undefined;
		selectedSemanticVertexIndex = undefined;
		insertPointForSemanticId = undefined;
		renderSemanticEditor();
	}
	insertPointForEdge = undefined;
	renderReview();
	updateEditActions();
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

	const before: HistoryState = captureHistoryState();
	const node: WayfindingNode = upsertLocationAnchor(graphDocument(), destination.id, point, levelIdInput.value.trim() || 'level-0');
	syncStudioGraph();
	recordHistory(before);
	selectedEdgeId = undefined;
	renderMetadataEditor();
	renderReview();
	coverageStatus.textContent = `Placed ${destination.name} approach anchor at ${Math.round(node.x)}, ${Math.round(node.y)}; verify it is on walkable space`;
	draw();
};

const finishEdgeAtNode = (node: WayfindingNode, before: HistoryState = captureHistoryState()): void => {
	if (!edgeDraft || node.id === edgeDraft.startNodeId || node.levelId !== edgeDraft.levelId) {
		coverageStatus.textContent = node.levelId !== edgeDraft?.levelId ? 'Cross-level edges require an explicit transition workflow' : 'Choose a different end node';

		return;
	}

	const edge: WayfindingEdge = addProposedEdge(graphDocument(), edgeDraft.startNodeId, node.id, [...edgeDraft.points, node]);
	syncStudioGraph();
	recordHistory(before);
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

	const before: HistoryState = captureHistoryState();
	const endpoint: WayfindingPoint = edgeDraft.points[edgeDraft.points.length - 1];
	const node: WayfindingNode = addRouteNode(graphDocument(), endpoint, edgeDraft.levelId);
	finishEdgeAtNode(node, before);
};

const cancelEdgeDraft = (): void => {
	edgeDraft = undefined;
	renderEdgeDraft();
	draw();
};

interface RouteSegmentPreset {
	kind: WayfindingEdgeKind;
	label: string;
	traversal: WayfindingTraversal;
	value: string;
}

const ROUTE_SEGMENT_PRESETS: RouteSegmentPreset[] = [
	{ kind: 'walk', label: 'Indoor corridor', traversal: 'indoor-corridor', value: 'indoor' },
	{ kind: 'walk', label: 'Open indoor area', traversal: 'open-area', value: 'open' },
	{ kind: 'outdoor', label: 'Outdoor path', traversal: 'outdoor-path', value: 'outdoor' },
	{ kind: 'outdoor', label: 'Pedestrian crossing', traversal: 'crossing', value: 'crossing' },
	{ kind: 'walk', label: 'Doorway or portal', traversal: 'portal', value: 'portal' },
	{ kind: 'stairs', label: 'Stairs', traversal: 'transition', value: 'stairs' },
	{ kind: 'elevator', label: 'Elevator', traversal: 'transition', value: 'elevator' },
	{ kind: 'escalator', label: 'Escalator', traversal: 'transition', value: 'escalator' },
	{ kind: 'shuttle', label: 'Shuttle', traversal: 'transition', value: 'shuttle' }
];

const routeNodeName = (nodeId: string): string => {
	const node: WayfindingNode | undefined = graphNode(nodeId);

	if (!node) return 'Missing point';
	if (node.locationId) return destinationRows().find((destination: DestinationRow): boolean => destination.id === node.locationId)?.name ?? node.locationId;
	if (node.semanticElementId) {
		const element: WayfindingStudioElement | undefined = studioProject.floors
			.flatMap((floor): WayfindingStudioElement[] => floor.elements)
			.find((candidate): boolean => candidate.id === node.semanticElementId);

		if (element && 'label' in element && element.label) return element.label;
		if (element?.type === 'transition') return element.label;
	}

	return node.kind === 'transition' ? 'Floor connection' : 'Route junction';
};

const routeSegmentName = (edge: WayfindingEdge): string => `${routeNodeName(edge.from)} to ${routeNodeName(edge.to)}`;

const renderReview = (): void => {
	const edges: WayfindingEdge[] = graph?.edges ?? [];
	const hasWalkableMask: boolean = mask.some((value: number): boolean => value === 1);
	const invalidEdgeIds = new Set(edges.filter((edge: WayfindingEdge): boolean => hasWalkableMask && edgeFailuresFor(edge).length > 0).map((edge: WayfindingEdge): string => edge.id));
	const selected: WayfindingEdge | undefined = edges.find((edge: WayfindingEdge): boolean => edge.id === selectedEdgeId);

	maskStatus.textContent = !hasWalkableMask
		? project.guidance.targetMode === 'route' ? 'NO WALKABLE AREA' : 'WALKABLE OPTIONAL'
		: maskReviewStatus === 'confirmed' ? 'WALKABLE READY' : 'WALKABLE DRAFT';
	maskStatus.title = !hasWalkableMask
		? project.guidance.targetMode === 'route'
			? 'Draw a walkable area before building a routed map.'
			: 'Highlight-only projects do not require a walkable area.'
		: maskReviewStatus === 'confirmed'
			? 'The authored walkable area has been reviewed.'
			: 'The walkable area is usable for editing but still needs review before routed delivery.';
	maskStatus.dataset.confirmed = String(hasWalkableMask && maskReviewStatus === 'confirmed');
	edgeSummary.textContent = `${edges.length} route segment${edges.length === 1 ? '' : 's'}`;
	edgeFailures.textContent = !hasWalkableMask
		? project.guidance.targetMode === 'route' ? 'Extract or load a mask to evaluate routes' : `Walkable mask is optional for ${project.guidance.targetMode} delivery`
		: invalidEdgeIds.size === 0 ? 'All route segments stay inside walkable space' : `${invalidEdgeIds.size} route segment${invalidEdgeIds.size === 1 ? '' : 's'} leave walkable space`;
	coverageStatus.textContent = graph && hasWalkableMask
		? `${edges.length - invalidEdgeIds.size}/${edges.length} route segments contained`
		: sourceImage
			? 'Background loaded; author semantic layers'
			: `${currentElements().length} items / ${currentFloor().name}`;

	edgeList.replaceChildren(...edges.map((edge: WayfindingEdge): HTMLButtonElement => {
		const button: HTMLButtonElement = document.createElement('button');
		button.type = 'button';
		button.dataset.valid = String(!invalidEdgeIds.has(edge.id));
		button.className = edge.id === selectedEdgeId ? 'active' : '';
		button.innerHTML = `<i></i><strong></strong><small></small>`;
		button.querySelector('strong')!.textContent = routeSegmentName(edge);
		const floorName: string = studioProject.floors.find((floor): boolean => floor.id === graphNode(edge.from)?.levelId)?.name ?? 'Unknown floor';
		button.querySelector('small')!.textContent = `${floorName} / ${edge.reviewStatus === 'confirmed' ? 'Reviewed' : 'Needs review'}`;
		button.addEventListener('click', (): void => { tool = 'graph'; setActiveTool(); selectEdge(edge.id); });

		return button;
	}));

	if (!selected) {
		selectedEdgeHost.innerHTML = '<p>Select a route segment on the map to inspect it.</p>';
		updateEditActions();

		return;
	}

	selectedEdgeHost.innerHTML = `
		<h2>Route segment</h2>
		<p class="segment-summary"></p>
		<div class="edge-fields">
			<label>Segment type<select data-edge-field="preset"></select></label>
			<label>Direction<select data-edge-field="direction"><option value="both">Both directions</option><option value="one">From start to end</option></select></label>
			<label class="check"><input data-edge-field="accessible" type="checkbox"> Verified step-free</label>
		</div>
		<div class="segment-health"><div><span>Review</span><strong data-segment-review></strong></div><div><span>Walkable check</span><strong data-segment-mask></strong></div></div>
		<button type="button" data-action="insert">Add a bend</button>
		<button type="button" data-action="confirm">Mark segment as reviewed</button>
		<details class="segment-advanced">
			<summary>Advanced segment settings</summary>
			<span class="selection-id" data-segment-id></span>
			<div class="edge-fields">
				<label>Technical kind<select data-edge-field="kind"><option value="walk">Walk</option><option value="outdoor">Outdoor</option><option value="stairs">Stairs</option><option value="elevator">Elevator</option><option value="escalator">Escalator</option><option value="shuttle">Shuttle</option></select></label>
				<label>Traversal model<select data-edge-field="traversal"><option value="outdoor-path">Outdoor path</option><option value="crossing">Crossing</option><option value="indoor-corridor">Indoor corridor</option><option value="open-area">Open area</option><option value="portal">Portal</option><option value="transition">Transition</option></select></label>
				<label>Corridor width<input data-edge-field="corridorWidth" type="number" min="0.1" step="0.5"></label>
			</div>
		</details>
		<button type="button" data-action="delete" class="danger">Delete route segment</button>`;
	selectedEdgeHost.querySelector<HTMLElement>('.segment-summary')!.textContent = routeSegmentName(selected);
	selectedEdgeHost.querySelector<HTMLElement>('[data-segment-review]')!.textContent = selected.reviewStatus === 'confirmed' ? 'Reviewed' : 'Needs review';
	selectedEdgeHost.querySelector<HTMLElement>('[data-segment-mask]')!.textContent = invalidEdgeIds.has(selected.id) ? `${edgeFailuresFor(selected).length} point failures` : hasWalkableMask ? 'Contained' : 'Not checked';
	selectedEdgeHost.querySelector<HTMLElement>('[data-segment-id]')!.textContent = selected.id;
	const presetSelect = selectedEdgeHost.querySelector<HTMLSelectElement>('[data-edge-field="preset"]')!;
	const directionSelect = selectedEdgeHost.querySelector<HTMLSelectElement>('[data-edge-field="direction"]')!;
	const kindSelect = selectedEdgeHost.querySelector<HTMLSelectElement>('[data-edge-field="kind"]')!;
	const traversalSelect = selectedEdgeHost.querySelector<HTMLSelectElement>('[data-edge-field="traversal"]')!;
	const accessibleInput = selectedEdgeHost.querySelector<HTMLInputElement>('[data-edge-field="accessible"]')!;
	const corridorWidthInput = selectedEdgeHost.querySelector<HTMLInputElement>('[data-edge-field="corridorWidth"]')!;
	for (const preset of ROUTE_SEGMENT_PRESETS) presetSelect.add(new Option(preset.label, preset.value));
	const selectedPreset: RouteSegmentPreset | undefined = ROUTE_SEGMENT_PRESETS.find((preset): boolean => preset.kind === selected.kind && preset.traversal === (selected.traversal ?? 'open-area'));
	if (!selectedPreset) presetSelect.add(new Option('Custom technical settings', 'custom'));
	presetSelect.value = selectedPreset?.value ?? 'custom';
	directionSelect.value = selected.bidirectional ? 'both' : 'one';
	accessibleInput.checked = selected.accessible;
	kindSelect.value = selected.kind;
	traversalSelect.value = selected.traversal ?? 'open-area';
	corridorWidthInput.value = String(selected.corridorWidth ?? cellSize());
	const updateEdge = (before: HistoryState): void => {
		selected.reviewStatus = 'proposed';
		syncStudioGraph();
		recordHistory(before);
		renderReview();
		draw();
	};
	presetSelect.addEventListener('change', (): void => {
		const preset: RouteSegmentPreset | undefined = ROUTE_SEGMENT_PRESETS.find((candidate): boolean => candidate.value === presetSelect.value);
		if (!preset) return;
		const before: HistoryState = captureHistoryState();
		selected.kind = preset.kind;
		selected.traversal = preset.traversal;
		updateEdge(before);
	});
	directionSelect.addEventListener('change', (): void => {
		const before: HistoryState = captureHistoryState();
		selected.bidirectional = directionSelect.value === 'both';
		updateEdge(before);
	});
	accessibleInput.addEventListener('change', (): void => {
		const before: HistoryState = captureHistoryState();
		selected.accessible = accessibleInput.checked;
		updateEdge(before);
	});
	kindSelect.addEventListener('change', (): void => {
		const before: HistoryState = captureHistoryState();
		selected.kind = kindSelect.value as WayfindingEdgeKind;
		updateEdge(before);
	});
	traversalSelect.addEventListener('change', (): void => {
		const before: HistoryState = captureHistoryState();
		selected.traversal = traversalSelect.value as WayfindingTraversal;
		updateEdge(before);
	});
	corridorWidthInput.addEventListener('change', (): void => {
		const before: HistoryState = captureHistoryState();
		const width: number = Number(corridorWidthInput.value);

		if (Number.isFinite(width) && width > 0) selected.corridorWidth = width;
		updateEdge(before);
	});
	selectedEdgeHost.querySelector<HTMLButtonElement>('[data-action="insert"]')!.addEventListener('click', (): void => {
		insertPointForEdge = selected.id;
		coverageStatus.textContent = 'Click the route segment where you want to add a bend.';
	});
	selectedEdgeHost.querySelector<HTMLButtonElement>('[data-action="confirm"]')!.addEventListener('click', (): void => {
		if (mask.length === 0 || maskReviewStatus !== 'confirmed') {
			coverageStatus.textContent = 'Confirm the independently reviewed walkable area before reviewing this route segment.';

			return;
		}

		const failures: WayfindingPoint[] = edgeFailuresFor(selected);

		if (failures.length > 0) {
			coverageStatus.textContent = `This route segment leaves walkable space at ${failures.length} sampled point(s).`;

			return;
		}

		selected.reviewStatus = 'confirmed';
		renderReview();
		draw();
	});
	selectedEdgeHost.querySelector<HTMLButtonElement>('[data-action="delete"]')!.addEventListener('click', deleteCurrentSelection);
	updateEditActions();
};

const setActiveTool = (): void => {
	for (const button of document.querySelectorAll<HTMLButtonElement>('[data-tool]')) {
		button.classList.toggle('active', button.dataset.tool === tool);
	}
	toolTitle.textContent = TOOL_COPY[tool].label;
	toolHelp.textContent = TOOL_COPY[tool].description;
	canvas.style.cursor = tool === 'pan' ? 'grab' : tool === 'graph' || tool === 'select' ? 'default' : 'crosshair';
};

const activateTool = (nextTool: Tool): void => {
	if (tool === 'draw' && nextTool !== 'draw') cancelEdgeDraft();
	if (semanticDraft && nextTool !== semanticDraft.type) {
		semanticDraft = undefined;
		semanticDraftRedo.length = 0;
		lassoDrawing = false;
		semanticDraftHost.hidden = true;
	}
	if (nextTool !== 'select') {
		selectedSemanticVertexIndex = undefined;
		insertPointForSemanticId = undefined;
	}
	tool = nextTool;
	setActiveTool();
	if ((nextTool === 'icon' || nextTool === 'logo') && !pendingMediaAssetId) {
		coverageStatus.textContent = `Choose an image, then click the map to place the ${nextTool}.`;
		semanticMediaFile.click();
	}
	draw();
};

const restoreTemporaryPan = (): void => {
	if (!toolBeforeTemporaryPan) return;
	tool = toolBeforeTemporaryPan;
	toolBeforeTemporaryPan = undefined;
	setActiveTool();
	draw();
};

const serializeStudioProject = (): string => {
	syncStudioGraph();
	void persistAutosave(true);

	return `${JSON.stringify(studioProject, null, 2)}\n`;
};

const markProjectFileSaved = (filename: string, handle?: StudioFileHandle): void => {
	projectFileHandle = handle;
	openedProjectFileName = filename;
	portableSnapshot = JSON.stringify(studioProject);
	projectOrigin = 'portable-file';
	renderProjectContext();
};

const ensureWritePermission = async (handle: StudioFileHandle): Promise<boolean> => {
	if (!handle.queryPermission || !handle.requestPermission) return true;
	const options = { mode: 'readwrite' as const };
	const current: PermissionState = await handle.queryPermission(options);

	return current === 'granted' || await handle.requestPermission(options) === 'granted';
};

const writeStudioProject = async (handle: StudioFileHandle, value: string): Promise<void> => {
	if (!await ensureWritePermission(handle)) throw new Error('Write access to the project file was not granted.');
	const writable: StudioWritableFile = await handle.createWritable();
	await writable.write(value);
	await writable.close();
	markProjectFileSaved(handle.name, handle);
	coverageStatus.textContent = `Saved ${handle.name}`;
	showStudioNotice(`Saved ${handle.name}.`);
};

const saveStudioProjectAs = async (): Promise<void> => {
	const value: string = serializeStudioProject();
	const filename = `${portableProjectBaseName()}.wbwayfinding`;
	const picker = (window as StudioFilePickerWindow).showSaveFilePicker;

	if (picker) {
		try {
			const handle: StudioFileHandle = await picker.call(window, {
				suggestedName: filename,
				types: [{
					accept: { 'application/json': ['.wbwayfinding'] },
					description: 'Wallboard Wayfinding project'
				}]
			});
			await writeStudioProject(handle, value);
			return;
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') return;
			const detail: string = error instanceof Error ? error.message : 'The project file could not be saved.';
			showStudioNotice(`${detail} Use Save as to choose another file.`, 'error');
			coverageStatus.textContent = detail;
			return;
		}
	}

	downloadText(filename, value);
	markProjectFileSaved(filename);
	coverageStatus.textContent = `Downloaded ${filename}. This browser cannot overwrite downloaded files; Save will download an updated copy.`;
};

const saveStudioProject = async (): Promise<void> => {
	const value: string = serializeStudioProject();

	if (projectFileHandle) {
		try {
			await writeStudioProject(projectFileHandle, value);
		} catch (error) {
			const detail: string = error instanceof Error ? error.message : 'The opened project file could not be updated.';
			showStudioNotice(`${detail} Use Save as to choose another file.`, 'error');
			coverageStatus.textContent = detail;
		}
		return;
	}

	await saveStudioProjectAs();
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

const maskNeighborIndices = (index: number, source: Uint8Array = mask): number[] => {
	const column: number = index % maskColumns;
	const row: number = Math.floor(index / maskColumns);
	const neighbors: number[] = [];

	for (const [columnOffset, rowOffset] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
		const nextColumn: number = column + columnOffset;
		const nextRow: number = row + rowOffset;
		if (nextColumn < 0 || nextRow < 0 || nextColumn >= maskColumns || nextRow >= maskRows) continue;
		const nextIndex: number = maskIndex(nextColumn, nextRow);
		if (source[nextIndex] === 1) neighbors.push(nextIndex);
	}

	return neighbors;
};

const nearestWalkableIndex = (anchorIndex: number, source: Uint8Array): number | undefined => {
	if (source[anchorIndex] === 1) return anchorIndex;
	const anchorColumn: number = anchorIndex % maskColumns;
	const anchorRow: number = Math.floor(anchorIndex / maskColumns);
	let nearestIndex: number | undefined;
	let nearestDistance = Number.POSITIVE_INFINITY;
	const maximumRadius = Math.max(3, Math.ceil(36 / cellSize()));

	for (let rowOffset = -maximumRadius; rowOffset <= maximumRadius; rowOffset += 1) {
		for (let columnOffset = -maximumRadius; columnOffset <= maximumRadius; columnOffset += 1) {
			const column: number = anchorColumn + columnOffset;
			const row: number = anchorRow + rowOffset;
			if (column < 0 || row < 0 || column >= maskColumns || row >= maskRows) continue;
			const index: number = maskIndex(column, row);
			if (source[index] !== 1) continue;
			const distance: number = columnOffset * columnOffset + rowOffset * rowOffset;
			if (distance >= nearestDistance) continue;
			nearestDistance = distance;
			nearestIndex = index;
		}
	}

	return nearestIndex;
};

const shortestMaskPathToSkeleton = (startIndex: number, skeleton: Uint8Array, source: Uint8Array): number[] | undefined => {
	if (source[startIndex] !== 1) return undefined;
	const queue: number[] = [startIndex];
	const visited = new Set<number>([startIndex]);
	const previous = new Map<number, number>();
	let targetIndex: number | undefined;

	for (let cursor = 0; cursor < queue.length; cursor += 1) {
		const index: number = queue[cursor];
		if (skeleton[index] === 1) {
			targetIndex = index;
			break;
		}

		for (const neighbor of maskNeighborIndices(index, source)) {
			if (visited.has(neighbor)) continue;
			visited.add(neighbor);
			previous.set(neighbor, index);
			queue.push(neighbor);
		}
	}

	if (targetIndex === undefined) return undefined;
	const path: number[] = [targetIndex];
	let index: number = targetIndex;
	while (index !== startIndex) {
		const previousIndex: number | undefined = previous.get(index);
		if (previousIndex === undefined) return undefined;
		index = previousIndex;
		path.push(index);
	}

	return path.reverse();
};

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

const geometryContained = (points: WayfindingPoint[], clearance = 0): boolean => {
	const step: number = Math.max(1, cellSize() / 2);

	for (let index = 1; index < points.length; index += 1) {
		const left: WayfindingPoint = points[index - 1];
		const right: WayfindingPoint = points[index];
		const length: number = Math.hypot(right.x - left.x, right.y - left.y);
		const samples: number = Math.max(1, Math.ceil(length / step));

		for (let sampleIndex = 0; sampleIndex <= samples; sampleIndex += 1) {
			const ratio: number = sampleIndex / samples;

			if (!pointWalkableWithClearance(
				{ x: left.x + (right.x - left.x) * ratio, y: left.y + (right.y - left.y) * ratio },
				clearance
			)) return false;
		}
	}

	return true;
};

const simplifyContainedGeometry = (points: WayfindingPoint[], clearance = 0): WayfindingPoint[] => {
	for (const toleranceFactor of [8, 6, 4, 3, 2, 1, 0.75, 0.5, 0.25]) {
		const simplified: WayfindingPoint[] = simplifyGeometry(points, cellSize() * toleranceFactor);

		if (geometryContained(simplified, clearance)) return simplified;
	}

	return points;
};

function traceRoundedRoute(target: CanvasRenderingContext2D, points: WayfindingPoint[], radius: number): void {
	target.moveTo(points[0].x, points[0].y);

	for (let index = 1; index < points.length - 1; index += 1) {
		const previous: WayfindingPoint = points[index - 1];
		const current: WayfindingPoint = points[index];
		const next: WayfindingPoint = points[index + 1];
		const incomingLength: number = Math.hypot(current.x - previous.x, current.y - previous.y);
		const outgoingLength: number = Math.hypot(next.x - current.x, next.y - current.y);
		const cornerRadius: number = Math.min(radius, incomingLength / 2, outgoingLength / 2);
		const incomingRatio: number = incomingLength === 0 ? 0 : cornerRadius / incomingLength;
		const outgoingRatio: number = outgoingLength === 0 ? 0 : cornerRadius / outgoingLength;
		const entry: WayfindingPoint = {
			x: current.x - (current.x - previous.x) * incomingRatio,
			y: current.y - (current.y - previous.y) * incomingRatio
		};
		const exit: WayfindingPoint = {
			x: current.x + (next.x - current.x) * outgoingRatio,
			y: current.y + (next.y - current.y) * outgoingRatio
		};

		target.lineTo(entry.x, entry.y);
		target.quadraticCurveTo(current.x, current.y, exit.x, exit.y);
	}

	const end: WayfindingPoint = points[points.length - 1];
	target.lineTo(end.x, end.y);
}

const routeAnimationActive = (): boolean => Boolean(
	simulatedRoute
	&& workspaceMode !== 'map'
	&& viewMode === '2d'
	&& projectDefaults().route.animation !== 'none'
);

const scheduleRouteAnimation = (): void => {
	if (!routeAnimationActive()) {
		if (routeAnimationFrame !== undefined) window.cancelAnimationFrame(routeAnimationFrame);
		routeAnimationFrame = undefined;
		routeAnimationPreviousTime = 0;
		return;
	}
	if (routeAnimationFrame !== undefined) return;
	routeAnimationFrame = window.requestAnimationFrame((time: number): void => {
		routeAnimationFrame = undefined;
		const elapsed: number = routeAnimationPreviousTime === 0 ? 0 : Math.min(50, time - routeAnimationPreviousTime);
		routeAnimationPreviousTime = time;
		routeAnimationPhase += elapsed * projectDefaults().route.animationSpeed / 1000;
		draw();
	});
};

const generateCenterlineGraph = (): boolean => {
	const before: HistoryState = captureHistoryState();
	const linkedDoors: number = linkUnassignedDoorsToNearbyLocations();
	synchronizeWayfindingStudioGraph(studioProject);
	graph = studioProject.graph;
	const usedAuthoredAreas: boolean = rasterizeAuthoredWalkableAreas();
	if ((!usedAuthoredAreas && !mask.some((value: number): boolean => value === 1)) || maskColumns === 0 || maskRows === 0) {
		coverageStatus.textContent = 'Draw at least one Walkable area before building routes.';
		routeResult.textContent = 'Route setup is incomplete: draw the pedestrian area, then choose Build routes.';
		renderStudioControls();
		return false;
	}

	const elementsById = new Map(currentElements().map((element: WayfindingStudioElement): [string, WayfindingStudioElement] => [element.id, element]));
	const linkedLocationIds = new Set(currentElements()
		.filter((element: WayfindingStudioElement): element is WayfindingStudioDoorElement => element.type === 'door' && Boolean(element.locationId))
		.map((door: WayfindingStudioDoorElement): string => door.locationId as string));
	const anchorNodes: WayfindingNode[] = graph.nodes.filter((node: WayfindingNode): boolean => {
		if (node.levelId !== currentFloorId || !node.semanticElementId) return false;
		const element: WayfindingStudioElement | undefined = elementsById.get(node.semanticElementId);
		if (!element) return false;
		if (element.type === 'origin' || element.type === 'transition' || element.type === 'poi') return true;

		return element.type === 'location' && linkedLocationIds.has(element.id);
	});
	const startNodes: WayfindingNode[] = anchorNodes.filter((node: WayfindingNode): boolean => elementsById.get(node.semanticElementId ?? '')?.type === 'origin');
	const destinationNodes: WayfindingNode[] = anchorNodes.filter((node: WayfindingNode): boolean => node.kind === 'location');
	if (startNodes.length === 0) {
		coverageStatus.textContent = 'Add a You are here point on the walkable area before building routes.';
		routeResult.textContent = 'Route setup is incomplete: no start point is available.';
		renderStudioControls();
		return false;
	}
	if (destinationNodes.length === 0) {
		coverageStatus.textContent = 'Add a destination and place or assign a door at its walkable entrance.';
		routeResult.textContent = 'Route setup is incomplete: a room needs a linked door, or add a point of interest.';
		renderStudioControls();
		return false;
	}

	mask = closeWalkableMask(mask, maskColumns, maskRows, bridgeRadius());
	maskReviewStatus = 'proposed';
	maskConfirmedInput.checked = false;
	const authoredMask: Uint8Array = new Uint8Array(mask);
	const anchorIndexById = new Map<string, number>();
	for (const anchorNode of anchorNodes) {
		const column: number = Math.max(0, Math.min(maskColumns - 1, Math.floor(anchorNode.x / cellSize())));
		const row: number = Math.max(0, Math.min(maskRows - 1, Math.floor(anchorNode.y / cellSize())));
		const index: number | undefined = nearestWalkableIndex(maskIndex(column, row), authoredMask);
		if (index !== undefined) anchorIndexById.set(anchorNode.id, index);
	}
	persistCurrentMask();
	const skeleton: Uint8Array = skeletonizeWalkableMask(authoredMask, maskColumns, maskRows);
	const attachmentIndices = new Set<number>();
	const attachmentByAnchorId = new Map<string, number>();
	const connectorGeometryByAnchorId = new Map<string, WayfindingPoint[]>();

	for (const anchorNode of anchorNodes) {
		const anchorIndex: number | undefined = anchorIndexById.get(anchorNode.id);
		const path: number[] | undefined = anchorIndex === undefined ? undefined : shortestMaskPathToSkeleton(anchorIndex, skeleton, authoredMask);
		if (!path?.length) continue;
		const attachmentIndex: number = path[path.length - 1];
		const cellPath: WayfindingPoint[] = path.map(pointForMaskIndex);
		const geometry: WayfindingPoint[] = simplifyContainedGeometry([
			{ x: anchorNode.x, y: anchorNode.y },
			...cellPath
		]);
		attachmentIndices.add(attachmentIndex);
		attachmentByAnchorId.set(anchorNode.id, attachmentIndex);
		connectorGeometryByAnchorId.set(anchorNode.id, geometry);
	}
	const connectedAnchorIds = new Set(attachmentByAnchorId.keys());
	if (!startNodes.some((node: WayfindingNode): boolean => connectedAnchorIds.has(node.id))
		|| !destinationNodes.some((node: WayfindingNode): boolean => connectedAnchorIds.has(node.id))) {
		coverageStatus.textContent = 'The start or destination entrance is too far from the Walkable area. Move it onto the pedestrian space and build again.';
		routeResult.textContent = 'Route setup is incomplete: an endpoint could not connect to walkable space.';
		renderStudioControls();
		return false;
	}

	const network = extractSkeletonNetwork(authoredMask, maskColumns, maskRows, attachmentIndices);
	const nodeIdByIndex = new Map<number, string>();
	const generatedNodes: WayfindingNode[] = network.nodeIndices.map((index: number, nodeIndex: number): WayfindingNode => {
		const point: WayfindingPoint = pointForMaskIndex(index);
		const node: WayfindingNode = { id: `route-auto:${currentFloorId}:${String(nodeIndex + 1).padStart(4, '0')}`, kind: 'route', levelId: currentFloorId, ...point };
		nodeIdByIndex.set(index, node.id);

		return node;
	});
	const generatedEdges: WayfindingEdge[] = network.chains.flatMap((chain, edgeIndex: number): WayfindingEdge[] => {
		const from: string | undefined = nodeIdByIndex.get(chain.indices[0]);
		const to: string | undefined = nodeIdByIndex.get(chain.indices[chain.indices.length - 1]);
		if (!from || !to || from === to) return [];

		return [{
			accessible: true,
			bidirectional: true,
			corridorWidth: cellSize(),
			from,
			geometry: simplifyContainedGeometry(chain.indices.map(pointForMaskIndex), cellSize() * 0.75),
			id: `centerline:${currentFloorId}:${String(edgeIndex + 1).padStart(4, '0')}`,
			kind: 'walk',
			reviewStatus: 'proposed',
			to,
			traversal: 'indoor-corridor'
		}];
	});
	const connectorEdges: WayfindingEdge[] = anchorNodes.flatMap((anchorNode: WayfindingNode, connectorIndex: number): WayfindingEdge[] => {
		const attachmentIndex: number | undefined = attachmentByAnchorId.get(anchorNode.id);
		const attachmentId: string | undefined = attachmentIndex === undefined ? undefined : nodeIdByIndex.get(attachmentIndex);
		if (attachmentIndex === undefined || !attachmentId) return [];
		const geometry: WayfindingPoint[] | undefined = connectorGeometryByAnchorId.get(anchorNode.id);
		if (!geometry?.length) return [];

		return [{
			accessible: true,
			bidirectional: true,
			corridorWidth: cellSize(),
			from: anchorNode.id,
			geometry,
			id: `approach:${currentFloorId}:${String(connectorIndex + 1).padStart(4, '0')}`,
			kind: 'walk',
			reviewStatus: 'proposed',
			to: attachmentId,
			traversal: 'portal'
		}];
	});
	const retained = retainAnchorNetworkCore(
		[...generatedNodes.map((node: WayfindingNode): string => node.id), ...anchorNodes.map((node: WayfindingNode): string => node.id)],
		[...generatedEdges, ...connectorEdges],
		connectedAnchorIds
	);
	const retainedNodes: WayfindingNode[] = generatedNodes.filter((node: WayfindingNode): boolean => retained.nodeIds.has(node.id));
	const retainedEdges: WayfindingEdge[] = [...generatedEdges, ...connectorEdges].filter((edge: WayfindingEdge): boolean => retained.edgeIds.has(edge.id));
	if (retainedEdges.length === 0) {
		coverageStatus.textContent = 'The Walkable area is disconnected between the start and destination. Extend it so both endpoints share one continuous area.';
		routeResult.textContent = 'No connected route network could be built from the current walkable geometry.';
		renderStudioControls();
		return false;
	}

	const previousNodes = new Map(graph.nodes.map((node: WayfindingNode): [string, WayfindingNode] => [node.id, node]));
	const otherFloorNodes: WayfindingNode[] = graph.nodes.filter((node: WayfindingNode): boolean => node.levelId !== currentFloorId);
	const otherFloorEdges: WayfindingEdge[] = graph.edges.filter((edge: WayfindingEdge): boolean => {
		const from: WayfindingNode | undefined = previousNodes.get(edge.from);
		const to: WayfindingNode | undefined = previousNodes.get(edge.to);

		return from?.levelId !== currentFloorId || to?.levelId !== currentFloorId;
	});
	const currentFloorSemanticNodes: WayfindingNode[] = graph.nodes.filter((node: WayfindingNode): boolean => node.levelId === currentFloorId && Boolean(node.semanticElementId));
	graph = {
		...graph,
		contractVersion: 2,
		edges: [...otherFloorEdges, ...retainedEdges],
		nodes: [...otherFloorNodes, ...currentFloorSemanticNodes, ...retainedNodes]
	};
	selectedEdgeId = undefined;
	syncStudioGraph();
	recordHistory(before);
	const linkedCopy: string = linkedDoors > 0 ? ` Auto-linked ${linkedDoors} nearby door${linkedDoors === 1 ? '' : 's'}.` : '';
	const routeableLocations: WayfindingStudioPolygonElement[] = currentElements().filter((element: WayfindingStudioElement): element is WayfindingStudioPolygonElement =>
		element.type === 'location'
		&& Boolean(element.destinationId)
		&& destinationRows().find((destination: DestinationRow): boolean => destination.id === element.destinationId)?.routeable !== false
	);
	const unlinkedLocations: WayfindingStudioPolygonElement[] = routeableLocations.filter((location: WayfindingStudioPolygonElement): boolean =>
		!currentElements().some((element: WayfindingStudioElement): boolean => element.type === 'door' && element.locationId === location.id)
	);
	const authoringCopy: string = unlinkedLocations.length > 0
		? ` ${unlinkedLocations.length} room${unlinkedLocations.length === 1 ? '' : 's'} still need${unlinkedLocations.length === 1 ? 's' : ''} a linked door.`
		: '';
	coverageStatus.textContent = `Built ${retainedEdges.length} route segment${retainedEdges.length === 1 ? '' : 's'} connecting the start and ${routeableLocations.length - unlinkedLocations.length}/${routeableLocations.length} routeable rooms.${linkedCopy}${authoringCopy}`;
	routeResult.textContent = `Routes are ready to simulate for ${routeableLocations.length - unlinkedLocations.length}/${routeableLocations.length} routeable rooms.${authoringCopy} They remain proposed until the walkable area is reviewed.`;
	renderReview();
	renderStudioControls();
	draw();

	return true;
};

const requestRouteRegeneration = async (): Promise<boolean> => {
	const currentGraph: WayfindingGraphDocument = graph ?? studioProject.graph;
	const currentNodeIds = new Set(currentGraph.nodes
		.filter((node: WayfindingNode): boolean => node.levelId === currentFloorId)
		.map((node: WayfindingNode): string => node.id));
	const currentEdges = currentGraph.edges.filter((edge: WayfindingEdge): boolean =>
		currentNodeIds.has(edge.from) || currentNodeIds.has(edge.to)
	);

	if (currentEdges.length > 0 && !await confirmAction(
		`This replaces ${currentEdges.length} existing route segment${currentEdges.length === 1 ? '' : 's'} on ${currentFloor().name}, including manual adjustments.`,
		'Rebuild this floor’s routes?',
		'Rebuild routes'
	)) return false;

	return generateCenterlineGraph();
};

const loadJsonFile = async <T>(input: HTMLInputElement): Promise<T | undefined> => {
	const file: File | undefined = input.files?.[0];

	return file ? JSON.parse(await file.text()) as T : undefined;
};

const closestPointOnSegment = (point: WayfindingPoint, left: WayfindingPoint, right: WayfindingPoint): WayfindingPoint => {
	const dx: number = right.x - left.x;
	const dy: number = right.y - left.y;
	const lengthSquared: number = dx * dx + dy * dy;
	if (lengthSquared === 0) return { ...left };
	const ratio: number = Math.max(0, Math.min(1, ((point.x - left.x) * dx + (point.y - left.y) * dy) / lengthSquared));

	return { x: left.x + dx * ratio, y: left.y + dy * ratio };
};

const insertSemanticVertex = (element: WayfindingStudioPolygonElement, point: WayfindingPoint): number | undefined => {
	let segment = 1;
	let minimumDistance = Number.POSITIVE_INFINITY;
	let insertedPoint: WayfindingPoint = { ...point };
	for (let index = 1; index <= element.geometry.length; index += 1) {
		const left: WayfindingPoint = element.geometry[index - 1];
		const right: WayfindingPoint = element.geometry[index % element.geometry.length];
		const distance: number = distanceToSegment(point, left, right);
		if (distance < minimumDistance) {
			minimumDistance = distance;
			segment = index;
			insertedPoint = closestPointOnSegment(point, left, right);
		}
	}
	if (minimumDistance > 24 / scale) return undefined;
	const before: HistoryState = captureHistoryState();
	element.geometry.splice(segment, 0, insertedPoint);
	element.status = 'proposed';
	touchWayfindingStudioProject(studioProject);
	syncStudioGraph();
	recordHistory(before);
	renderStudioControls();
	draw();

	return segment;
};

const openStudioProject = async (loaded: unknown, preferredFloorId?: string): Promise<WayfindingStudioRepair[]> => {
	const recovered = repairWayfindingStudioProject(loaded);
	studioProject = recovered.project;
	project = studioProject.delivery;
	graph = studioProject.graph;
	destinationDocument = destinationDatasource();
	destinationTableName = 'Destinations';
	selectedDestinationId = studioProject.destinations[0]?.id;
	selectedSemanticId = undefined;
	selectedSemanticVertexIndex = undefined;
	selectedEdgeId = undefined;
	semanticDraft = undefined;
	semanticDraftRedo.length = 0;
	edgeDraft = undefined;
	insertPointForEdge = undefined;
	insertPointForSemanticId = undefined;
	draggedSemantic = undefined;
	draggedVertex = undefined;
	simulatedRoute = undefined;
	pendingMediaAssetId = undefined;
	renderMediaAssetState();
	clearHistory();
	syncProjectControls();
	renderProjectAssessment();
	renderMetadataEditor();
	await activateFloor(preferredFloorId ?? studioProject.floors[0].id);

	return recovered.repairs;
};

const adoptCurrentProjectForAutosave = (savedAt?: string): void => {
	pendingRecovery = undefined;
	localRecovery.hidden = true;
	autosaveEnabled = true;
	synchronizeStudioState();
	autosaveSnapshot = JSON.stringify(studioProject);
	if (savedAt) {
		lastLocalSaveAt = savedAt;
		setAutosaveStatus(`SAVED ${savedTimeLabel(savedAt)}`, 'saved', `Recovered local work saved at ${new Date(savedAt).toLocaleString()}.`);
	}
	else {
		setAutosaveStatus('AUTOSAVE READY', 'ready', 'Crash recovery updates locally after a short pause. Use Save to update the project file.');
		void persistAutosave(true);
	}
};

const initializeAutosave = async (): Promise<void> => {
	if (typeof indexedDB === 'undefined') {
		setAutosaveStatus('AUTOSAVE UNAVAILABLE', 'error', 'This browser does not provide local recovery storage. Use Save frequently.');
		return;
	}
	try {
		autosaveDatabase = await openAutosaveDatabase();
		const record: AutosaveRecord | undefined = await readAutosaveRecord(autosaveDatabase);
		if (record) {
			pendingRecovery = record;
			const source = record.openedProjectFileName ? ` linked to ${record.openedProjectFileName}` : '';
			localRecoverySummary.textContent = `${record.project.name}${source}, saved ${new Date(record.savedAt).toLocaleString()}. Restore it or discard it before new edits are autosaved.`;
			localRecovery.hidden = false;
			setAutosaveStatus('RECOVERY FOUND', 'recovery', `Unsaved local work from ${new Date(record.savedAt).toLocaleString()} is available.`);
			return;
		}
		autosaveEnabled = true;
		synchronizeStudioState();
		autosaveSnapshot = JSON.stringify(studioProject);
		setAutosaveStatus('AUTOSAVE READY', 'ready', 'Crash recovery updates locally after a short pause. Use Save to update the project file.');
	} catch (error) {
		const detail: string = error instanceof Error ? error.message : 'Unknown storage error';
		setAutosaveStatus('AUTOSAVE UNAVAILABLE', 'error', `${detail} Use Save frequently.`);
	}
};

const startNewProject = async (): Promise<void> => {
	synchronizeStudioState();
	const hasAuthoredWork: boolean = studioProject.assets.length > 0
		|| studioProject.destinations.length > 0
		|| studioProject.floors.some((floor: WayfindingStudioFloor): boolean => floor.elements.length > 0);
	if (hasAuthoredWork && !await confirmAction(
		'The current browser recovery will be replaced. Save the project first if you need a portable copy.',
		'Start a new project?',
		'Start new project'
	)) return;
	if (autosaveDatabase) await deleteAutosaveRecord(autosaveDatabase);
	pendingRecovery = undefined;
	localRecovery.hidden = true;
	await openStudioProject(createWayfindingStudioProject('wayfinding-project'));
	projectOrigin = 'new';
	openedProjectFileName = undefined;
	projectFileHandle = undefined;
	portableSnapshot = undefined;
	lastLocalSaveAt = undefined;
	studioProjectFile.value = '';
	imageFile.value = '';
	adoptCurrentProjectForAutosave();
	coverageStatus.textContent = 'New project ready. Add a floor background image to begin.';
	renderProjectContext();
};

const openStudioProjectFile = async (file: File, handle?: StudioFileHandle): Promise<void> => {
	try {
		const loaded: unknown = JSON.parse(await file.text()) as unknown;
		const repairs: WayfindingStudioRepair[] = await openStudioProject(loaded);
		projectOrigin = 'portable-file';
		openedProjectFileName = file.name;
		projectFileHandle = handle;
		portableSnapshot = repairs.length === 0 ? JSON.stringify(studioProject) : undefined;
		lastLocalSaveAt = undefined;
		adoptCurrentProjectForAutosave();
		if (repairs.length > 0) {
			const details: string = repairs.map((repair: WayfindingStudioRepair): string => repair.message).join(' ');
			showStudioNotice(`Opened with ${repairs.length} automatic repair${repairs.length === 1 ? '' : 's'}. ${details}`);
			coverageStatus.textContent = 'Project recovered. Review the repaired geometry, then save the project file.';
		} else {
			showStudioNotice(`Opened ${studioProject.name}.`);
			coverageStatus.textContent = `Opened ${studioProject.name}`;
		}
		renderProjectContext();
	} catch (error) {
		const detail: string = error instanceof Error ? error.message : 'The Studio project could not be opened.';
		studioValidation.textContent = detail;
		studioValidation.dataset.allowed = 'false';
		showStudioNotice(detail, 'error');
		coverageStatus.textContent = detail;
	}
};

studioProjectFile.addEventListener('change', async (): Promise<void> => {
	const file: File | undefined = studioProjectFile.files?.[0];
	if (!file) return;
	await openStudioProjectFile(file);
	studioProjectFile.value = '';
});

const chooseStudioProject = async (): Promise<void> => {
	const picker = (window as StudioFilePickerWindow).showOpenFilePicker;
	if (!picker) {
		studioProjectFile.click();
		return;
	}
	try {
		const handles: StudioFileHandle[] = await picker.call(window, {
			multiple: false,
			types: [{
				accept: { 'application/json': ['.json', '.wbwayfinding'] },
				description: 'Wallboard Wayfinding project'
			}]
		});
		const handle: StudioFileHandle | undefined = handles[0];
		if (!handle) return;
		await openStudioProjectFile(await handle.getFile(), handle);
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') return;
		const detail: string = error instanceof Error ? error.message : 'The Studio project could not be opened.';
		showStudioNotice(detail, 'error');
		coverageStatus.textContent = detail;
	}
};

newProjectButton.addEventListener('click', (): void => { void startNewProject(); });
openProjectButton.addEventListener('click', (): void => { void chooseStudioProject(); });

semanticMediaFile.addEventListener('change', async (): Promise<void> => {
	const file: File | undefined = semanticMediaFile.files?.[0];
	if (!file) return;
	const dataUrl: string = await readFileDataUrl(file);
	const dimensions: { height: number; width: number } = await readImageDimensions(dataUrl);
	const kind: 'icon' | 'logo' = tool === 'logo' ? 'logo' : 'icon';
	const id: string = nextId('asset');
	studioProject.assets.push({
		dataUrl,
		id,
		kind,
		mimeType: file.type || 'image/png',
		name: file.name,
		naturalHeight: dimensions.height,
		naturalWidth: dimensions.width
	});
	pendingMediaAssetId = id;
	semanticMediaFile.value = '';
	scheduleAutosave();
	renderMediaAssetState();
	coverageStatus.textContent = `${file.name} is ready. Click the map to place the ${kind}.`;
});

studioProjectName.addEventListener('input', (): void => { studioProject.name = studioProjectName.value.trim() || 'Wayfinding project'; touchWayfindingStudioProject(studioProject); scheduleAutosave(); });
studioFloorName.addEventListener('input', (): void => { currentFloor().name = studioFloorName.value.trim() || currentFloorId; touchWayfindingStudioProject(studioProject); renderStudioControls(); });
studioFloorSelect.addEventListener('change', async (): Promise<void> => { persistCurrentMask(); await activateFloor(studioFloorSelect.value); });
requireElement<HTMLButtonElement>('#studio-add-floor').addEventListener('click', async (): Promise<void> => {
	const before: HistoryState = captureHistoryState();
	let index: number = studioProject.floors.length;
	while (studioProject.floors.some((floor: WayfindingStudioFloor): boolean => floor.id === `level-${index}`)) index += 1;
	const floor: WayfindingStudioFloor = { elements: [], height: currentFloor().height, id: `level-${index}`, name: `Level ${index}`, order: studioProject.floors.length, width: currentFloor().width };
	studioProject.floors.push(floor);
	touchWayfindingStudioProject(studioProject);
	recordHistory(before);
	await activateFloor(floor.id);
});
requireElement<HTMLButtonElement>('#studio-delete-floor').addEventListener('click', async (): Promise<void> => {
	if (studioProject.floors.length === 1) {
		coverageStatus.textContent = 'A Studio project must keep at least one floor.';
		return;
	}
	const before: HistoryState = captureHistoryState();
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
	recordHistory(before);
	await activateFloor(studioProject.floors[0].id);
});
requireElement<HTMLButtonElement>('#studio-export-project').addEventListener('click', (): void => { void saveStudioProject(); });
saveAsButton.addEventListener('click', (): void => { void saveStudioProjectAs(); });
requireElement<HTMLButtonElement>('#studio-export-runtime').addEventListener('click', (): void => {
	syncStudioGraph();
	const errors = validateWayfindingStudioDelivery(studioProject).filter((issue): boolean => issue.severity === 'error');
	if (errors.length > 0) {
		const details = errors.slice(0, 4).map((issue, index): string => `${index + 1}. ${issue.message}`).join(' ');
		const remaining = errors.length > 4 ? ` ${errors.length - 4} more issue${errors.length - 4 === 1 ? '' : 's'} remain.` : '';
		const message = `Runtime export is blocked. ${details}${remaining}`;
		coverageStatus.textContent = message;
		coverageStatus.title = errors.map((issue): string => issue.message).join('\n');
		showStudioNotice(message, 'error');
		return;
	}
	downloadText(`${portableProjectBaseName()}.runtime.json`, JSON.stringify(createWayfindingRuntimeBundle(studioProject), null, 2));
	showStudioNotice('Runtime bundle exported.');
});
requireElement<HTMLButtonElement>('#semantic-finish').addEventListener('click', finishSemanticPolygon);
requireElement<HTMLButtonElement>('#semantic-cancel').addEventListener('click', (): void => {
	semanticDraft = undefined;
	semanticDraftRedo.length = 0;
	lassoDrawing = false;
	semanticDraftHost.hidden = true;
	draw();
});
drawingModePoints.addEventListener('click', (): void => {
	drawingMode = 'points';
	renderDrawingMode();
});
drawingModeLasso.addEventListener('click', (): void => {
	drawingMode = 'lasso';
	renderDrawingMode();
});
drawingModeSmart.addEventListener('click', (): void => {
	drawingMode = 'smart';
	renderDrawingMode();
});
snapToEdgesInput.addEventListener('change', renderDrawingMode);
snapRadiusInput.addEventListener('input', (): void => {
	snapRadiusValue.value = snapRadiusInput.value;
});
detectDetailInput.addEventListener('input', (): void => {
	detectDetailValue.value = detectDetailInput.value;
});
detectOpeningInput.addEventListener('input', (): void => {
	detectOpeningValue.value = `${detectOpeningInput.value} px`;
});
detectGapInput.addEventListener('input', (): void => {
	detectGapValue.value = detectGapInput.value;
});
projectLanguageAdd.addEventListener('click', (): void => {
	const code: string = projectLanguageCode.value.trim().toLowerCase().replace(/_/gu, '-');
	const label: string = projectLanguageLabel.value.trim();
	if (!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/u.test(code) || !label) {
		showStudioNotice('Enter a language code such as en, hu, or fr-ca and a display name.', 'error');
		return;
	}
	if (projectLanguages().some((language: WayfindingStudioLanguage): boolean => language.code === code)) {
		showStudioNotice(`${code} is already a project language.`, 'error');
		return;
	}
	const before: HistoryState = captureHistoryState();
	studioProject.languages = [...projectLanguages(), { code, label }];
	projectLanguageCode.value = '';
	projectLanguageLabel.value = '';
	touchWayfindingStudioProject(studioProject);
	recordHistory(before);
	renderStudioControls();
	renderMetadataEditor();
	renderSemanticEditor();
});
projectCategoryAdd.addEventListener('click', (): void => {
	const category: string = projectCategoryName.value.trim();
	if (!category) return;
	const before: HistoryState = captureHistoryState();
	rememberCategory(category);
	projectCategoryName.value = '';
	touchWayfindingStudioProject(studioProject);
	recordHistory(before);
	renderStudioControls();
	renderMetadataEditor();
});
for (const input of [projectLanguageCode, projectLanguageLabel, projectCategoryName]) {
	input.addEventListener('keydown', (event: KeyboardEvent): void => {
		if (event.key !== 'Enter') return;
		event.preventDefault();
		if (input === projectCategoryName) projectCategoryAdd.click();
		else projectLanguageAdd.click();
	});
}
randomizeLocationColors.addEventListener('click', (): void => {
	const locations: WayfindingStudioPolygonElement[] = studioProject.floors.flatMap((floor: WayfindingStudioFloor): WayfindingStudioPolygonElement[] =>
		floor.elements.filter((element: WayfindingStudioElement): element is WayfindingStudioPolygonElement => element.type === 'location')
	);
	if (locations.length === 0) {
		showStudioNotice('There are no rooms or areas to recolor yet.');
		return;
	}
	const palette = ['#f4c95d', '#69c3b3', '#f29b7f', '#9ebce3', '#c4d79b', '#c5b1d8', '#f1b75e', '#80b9b0', '#e88777', '#8faed2', '#b4cc8c', '#b99bc7'];
	const before: HistoryState = captureHistoryState();
	const offset: number = Math.floor(Math.random() * palette.length);
	locations.forEach((location: WayfindingStudioPolygonElement, index: number): void => {
		location.presentation ??= {};
		location.presentation.fillColor = palette[(index + offset) % palette.length];
	});
	touchWayfindingStudioProject(studioProject);
	recordHistory(before);
	renderSemanticEditor();
	draw();
	showStudioNotice(`Applied distinct colors to ${locations.length} room${locations.length === 1 ? '' : 's'}.`);
});
const updateProjectDefaults = (mutate: (defaults: WayfindingStudioProjectDefaults) => void): void => {
	const before: HistoryState = captureHistoryState();
	const defaults: WayfindingStudioProjectDefaults = projectDefaults();
	mutate(defaults);
	touchWayfindingStudioProject(studioProject);
	recordHistory(before);
	syncProjectDefaultControls();
	draw();
};
defaultLocationOpacityInput.addEventListener('change', (): void => {
	updateProjectDefaults((defaults): void => { defaults.location.fillOpacity = Number(defaultLocationOpacityInput.value) / 100; });
});
defaultLocationHeightInput.addEventListener('change', (): void => {
	updateProjectDefaults((defaults): void => { defaults.location.extrusionHeight = Number(defaultLocationHeightInput.value); });
});
defaultWalkableOpacityInput.addEventListener('change', (): void => {
	updateProjectDefaults((defaults): void => { defaults.walkable.fillOpacity = Number(defaultWalkableOpacityInput.value) / 100; });
});
defaultObstacleOpacityInput.addEventListener('change', (): void => {
	updateProjectDefaults((defaults): void => { defaults.obstacle.fillOpacity = Number(defaultObstacleOpacityInput.value) / 100; });
});
defaultLabelFontInput.addEventListener('change', (): void => {
	updateProjectDefaults((defaults): void => { defaults.label.fontFamily = defaultLabelFontInput.value as WayfindingStudioProjectDefaults['label']['fontFamily']; });
});
defaultLabelSizeInput.addEventListener('change', (): void => {
	updateProjectDefaults((defaults): void => { defaults.label.fontSize = Number(defaultLabelSizeInput.value); });
});
defaultIconSizeInput.addEventListener('change', (): void => {
	updateProjectDefaults((defaults): void => { defaults.iconSize = Number(defaultIconSizeInput.value); });
});
defaultLogoSizeInput.addEventListener('change', (): void => {
	updateProjectDefaults((defaults): void => { defaults.logoSize = Number(defaultLogoSizeInput.value); });
});
const updateRouteDefaults = (mutate: (route: WayfindingStudioProjectDefaults['route']) => void): void => {
	updateProjectDefaults((defaults): void => { mutate(defaults.route); });
};
for (const input of [defaultRouteColorInput, routePreviewColorInput]) {
	input.addEventListener('change', (): void => {
		updateRouteDefaults((route): void => { route.color = input.value; });
	});
}
for (const input of [defaultRouteWidthInput, routePreviewWidthInput]) {
	input.addEventListener('change', (): void => {
		updateRouteDefaults((route): void => { route.lineWidth = Number(input.value); });
	});
}
defaultRouteRadiusInput.addEventListener('change', (): void => {
	updateRouteDefaults((route): void => { route.cornerRadius = Number(defaultRouteRadiusInput.value); });
});
for (const input of [defaultRouteAnimationInput, routePreviewAnimationInput]) {
	input.addEventListener('change', (): void => {
		updateRouteDefaults((route): void => { route.animation = input.value as WayfindingStudioProjectDefaults['route']['animation']; });
	});
}
for (const input of [defaultRouteSpeedInput, routePreviewSpeedInput]) {
	input.addEventListener('input', (): void => {
		defaultRouteSpeedValue.value = input.value;
		routePreviewSpeedValue.value = input.value;
	});
	input.addEventListener('change', (): void => {
		updateRouteDefaults((route): void => { route.animationSpeed = Number(input.value); });
	});
}
chooseMediaAsset.addEventListener('click', (): void => { semanticMediaFile.click(); });
stopMediaPlacement.addEventListener('click', (): void => {
	pendingMediaAssetId = undefined;
	activateTool('select');
	renderMediaAssetState();
	coverageStatus.textContent = 'Image placement finished. Select an item to move, resize, duplicate, or delete it.';
});
for (const toggle of document.querySelectorAll<HTMLInputElement>('[data-layer]')) toggle.addEventListener('change', draw);
try {
	const storedExplorerState: string | null = window.localStorage.getItem(OBJECT_EXPLORER_STORAGE_KEY);
	if (storedExplorerState !== null) objectExplorerPanel.open = storedExplorerState === 'true';
} catch {
	// The editor remains usable when storage is unavailable.
}
objectExplorerPanel.addEventListener('toggle', (): void => {
	try {
		window.localStorage.setItem(OBJECT_EXPLORER_STORAGE_KEY, String(objectExplorerPanel.open));
	} catch {
		// The collapsed state is a convenience, not project data.
	}
});
showAllLayers.addEventListener('click', (): void => {
	for (const toggle of document.querySelectorAll<HTMLInputElement>('[data-layer]')) toggle.checked = true;
	draw();
});
hideAllLayers.addEventListener('click', (): void => {
	for (const toggle of document.querySelectorAll<HTMLInputElement>('[data-layer]')) toggle.checked = false;
	draw();
});
requireElement<HTMLButtonElement>('#route-simulate').addEventListener('click', (): void => { simulateSelectedRoute(); });
routeClearButton.addEventListener('click', (): void => {
	clearSimulatedRoute('Route preview cleared. Choose Simulate route to draw it again.');
});
routePreviewNetworkInput.addEventListener('change', draw);
routeInspectButton.addEventListener('click', (): void => {
	if (!simulatedRoute) return;
	const currentFloorEdgeId: string | undefined = simulatedRoute.edgeIds.find((edgeId: string): boolean => {
		const edge: WayfindingEdge | undefined = studioProject.graph.edges.find((candidate: WayfindingEdge): boolean => candidate.id === edgeId);
		return edge ? graphNode(edge.from)?.levelId === currentFloorId : false;
	});
	setWorkspaceMode('route-edit');
	selectedEdgeId = currentFloorEdgeId ?? simulatedRoute.edgeIds[0];
	activateTool('graph');
	renderReview();
	draw();
	coverageStatus.textContent = 'Inspecting the exact network segments used by the preview route.';
});
for (const input of [routeStart, routeDestination, routeProfile]) {
	input.addEventListener('change', (): void => {
		if (simulatedRoute) clearSimulatedRoute('Route selection changed. Choose Simulate route to draw the new route.');
	});
}
restoreAutosaveButton.addEventListener('click', async (): Promise<void> => {
	if (!pendingRecovery) return;
	const record: AutosaveRecord = pendingRecovery;
	try {
		await openStudioProject(record.project, record.currentFloorId);
		projectOrigin = 'local-recovery';
		openedProjectFileName = record.openedProjectFileName;
		projectFileHandle = record.projectFileHandle;
		portableSnapshot = undefined;
		adoptCurrentProjectForAutosave(record.savedAt);
		coverageStatus.textContent = `Restored local work for ${studioProject.name}`;
		renderProjectContext();
	} catch (error) {
		const detail: string = error instanceof Error ? error.message : 'The local recovery draft is invalid.';
		setAutosaveStatus('RESTORE FAILED', 'error', detail);
		coverageStatus.textContent = detail;
	}
});
discardAutosaveButton.addEventListener('click', async (): Promise<void> => {
	if (!autosaveDatabase) return;
	try {
		await deleteAutosaveRecord(autosaveDatabase);
		pendingRecovery = undefined;
		localRecovery.hidden = true;
		autosaveEnabled = true;
		synchronizeStudioState();
		autosaveSnapshot = JSON.stringify(studioProject);
		setAutosaveStatus('AUTOSAVE READY', 'ready', 'Local recovery was discarded. New changes will be saved locally.');
		coverageStatus.textContent = 'Discarded the previous local recovery draft';
		renderProjectContext();
	} catch (error) {
		const detail: string = error instanceof Error ? error.message : 'The local recovery draft could not be discarded.';
		setAutosaveStatus('DISCARD FAILED', 'error', detail);
	}
});

projectFile.addEventListener('change', async (): Promise<void> => {
	const loaded: WayfindingProjectDocument | undefined = await loadJsonFile<WayfindingProjectDocument>(projectFile);

	if (!loaded) return;

	try {
		assessWayfindingProject(loaded);
		project = loaded;
		syncProjectControls();
		renderProjectAssessment();
		scheduleAutosave();
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
	scheduleAutosave();
});

graphFile.addEventListener('change', async (): Promise<void> => {
	graph = await loadJsonFile<WayfindingGraphDocument>(graphFile);
	selectedEdgeId = undefined;
	edgeDraft = undefined;
	renderEdgeDraft();
	renderMetadataEditor();
	renderReview();
	draw();
	scheduleAutosave();
});

maskFile.addEventListener('change', async (): Promise<void> => {
	const document: WayfindingWalkableMaskDocument | undefined = await loadJsonFile<WayfindingWalkableMaskDocument>(maskFile);

	if (!document) return;
	applyMaskDocument(document);
	currentFloor().walkableMask = document;
	renderReview();
	draw();
	scheduleAutosave();
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
	scheduleAutosave();
});

destinationSelect.addEventListener('change', (): void => {
	selectedDestinationId = destinationSelect.value;
	renderMetadataEditor();
});

for (const [input, field] of [
	[destinationMapNumber, 'mapNumber'],
	[destinationName, 'name'],
	[destinationDescription, 'description'],
	[destinationHours, 'hours'],
	[destinationStatus, 'status']
] as const) {
	input.addEventListener('input', (): void => { updateSelectedDestination(field, input.value); });
}

destinationCategory.addEventListener('change', (): void => {
	updateSelectedDestination('category', destinationCategory.value);
});
destinationLanguage.addEventListener('change', renderMetadataEditor);
destinationTranslatedName.addEventListener('input', (): void => {
	updateSelectedTranslation('name', destinationTranslatedName.value);
});
destinationTranslatedDescription.addEventListener('input', (): void => {
	updateSelectedTranslation('description', destinationTranslatedDescription.value);
});
destinationAccessible.addEventListener('change', (): void => {
	updateSelectedDestination('accessible', destinationAccessible.value === '' ? undefined : destinationAccessible.value === 'true');
});

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-tool]')) {
	button.addEventListener('click', (): void => {
		activateTool(button.dataset.tool as Tool);
	});
}

undoButton.addEventListener('click', (): void => { void undo(); });
redoButton.addEventListener('click', (): void => { void redo(); });
deleteSelectionButton.addEventListener('click', deleteCurrentSelection);
fitViewButton.addEventListener('click', fitView);
view2dButton.addEventListener('click', (): void => { setViewMode('2d'); });
view3dButton.addEventListener('click', (): void => { setViewMode('3d'); });
workspaceMapButton.addEventListener('click', (): void => { setWorkspaceMode('map'); });
workspaceRoutePreviewButton.addEventListener('click', (): void => { setWorkspaceMode('route-preview'); });
workspaceRouteEditButton.addEventListener('click', (): void => { setWorkspaceMode('route-edit'); });
reset3dViewButton.addEventListener('click', (): void => {
	scene3d.resetCamera();
	coverageStatus.textContent = currentFloor().camera3d ? 'Restored the saved 3D camera for this floor.' : 'Restored the default 3D camera.';
});
save3dViewButton.addEventListener('click', (): void => {
	const camera = scene3d.getCameraState();

	if (!camera) return;
	const before: HistoryState = captureHistoryState();
	currentFloor().camera3d = camera;
	touchWayfindingStudioProject(studioProject);
	recordHistory(before);
	coverageStatus.textContent = `Saved the default 3D camera for ${currentFloor().name}.`;
});
const showShortcutHelp = (): void => { if (!shortcutDialog.open) shortcutDialog.showModal(); };
shortcutHelpButton.addEventListener('click', showShortcutHelp);
footerShortcutHelpButton.addEventListener('click', showShortcutHelp);
shortcutCloseButton.addEventListener('click', (): void => { shortcutDialog.close(); });
shortcutDialog.addEventListener('click', (event: MouseEvent): void => {
	if (event.target === shortcutDialog) shortcutDialog.close();
});

window.addEventListener('keydown', (event: KeyboardEvent): void => {
	const target: EventTarget | null = event.target;
	const isEditingText: boolean = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable);
	if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
		event.preventDefault();
		if (event.shiftKey) void saveStudioProjectAs();
		else void saveStudioProject();
		return;
	}
	if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
		if (isEditingText) return;
		event.preventDefault();
		if (event.shiftKey) void redo();
		else void undo();
		return;
	}
	if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
		if (isEditingText) return;
		event.preventDefault();
		void redo();
		return;
	}
	if ((event.key === 'Delete' || event.key === 'Backspace') && !isEditingText) {
		event.preventDefault();
		deleteCurrentSelection();
		return;
	}
	if (event.key === 'Escape' && !isEditingText) {
		if (shortcutDialog.open) {
			shortcutDialog.close();
			return;
		}
		if (semanticDraft) {
			semanticDraft = undefined;
			semanticDraftRedo.length = 0;
			lassoDrawing = false;
			semanticDraftHost.hidden = true;
		} else if (edgeDraft) cancelEdgeDraft();
		else if (insertPointForSemanticId || selectedSemanticVertexIndex !== undefined) {
			insertPointForSemanticId = undefined;
			selectedSemanticVertexIndex = undefined;
			renderSemanticEditor();
		}
		else {
			selectedSemanticId = undefined;
			selectedSemanticVertexIndex = undefined;
			selectedEdgeId = undefined;
			renderSemanticEditor();
			renderReview();
		}
		updateEditActions();
		draw();
		return;
	}
	if (isEditingText || event.ctrlKey || event.metaKey || event.altKey) return;
	if (event.key === '2' || event.key === '3') {
		event.preventDefault();
		setViewMode(event.key === '3' ? '3d' : '2d');
		return;
	}
	if (event.key === '?' || (event.key === '/' && event.shiftKey)) {
		event.preventDefault();
		showShortcutHelp();
		return;
	}
	if (event.key === ' ' && !event.repeat && tool !== 'pan') {
		event.preventDefault();
		toolBeforeTemporaryPan = tool;
		tool = 'pan';
		setActiveTool();
		draw();
		return;
	}
	if (event.key === 'Enter') {
		if (semanticDraft?.points.length && semanticDraft.points.length >= 3) {
			event.preventDefault();
			finishSemanticPolygon();
		} else if (edgeDraft?.points.length && edgeDraft.points.length >= 2) {
			event.preventDefault();
			finishEdgeAtJunction();
		}
		return;
	}
	if (event.key.toLowerCase() === 'f') {
		event.preventDefault();
		fitView();
		return;
	}
	const nudgeByKey: Partial<Record<string, WayfindingPoint>> = {
		ArrowDown: { x: 0, y: 1 },
		ArrowLeft: { x: -1, y: 0 },
		ArrowRight: { x: 1, y: 0 },
		ArrowUp: { x: 0, y: -1 }
	};
	const nudge: WayfindingPoint | undefined = nudgeByKey[event.key];
	if (nudge && semanticElement()) {
		event.preventDefault();
		const distance: number = event.shiftKey ? 10 : 1;
		nudgeSelectedSemantic(nudge.x * distance, nudge.y * distance);
		return;
	}
	const shortcutTool: Tool | undefined = TOOL_SHORTCUTS[event.key.toLowerCase()];
	if (shortcutTool) {
		event.preventDefault();
		activateTool(shortcutTool);
	}
});

window.addEventListener('keyup', (event: KeyboardEvent): void => {
	if (event.key === ' ') restoreTemporaryPan();
});
window.addEventListener('blur', restoreTemporaryPan);

finishJunctionButton.addEventListener('click', finishEdgeAtJunction);
cancelEdgeButton.addEventListener('click', cancelEdgeDraft);

for (const [input, output] of [[cellSizeInput, cellSizeValue], [toleranceInput, toleranceValue], [brushInput, brushValue], [bridgeInput, bridgeValue]] as const) {
	input.addEventListener('input', (): void => { output.value = input.value; });
}

cellSizeInput.addEventListener('change', (): void => { resetMaskGrid(); renderReview(); draw(); });
toleranceInput.addEventListener('change', extractConnectedMask);
requireElement<HTMLButtonElement>('#extract-mask').addEventListener('click', extractConnectedMask);
requireElement<HTMLButtonElement>('#clear-mask').addEventListener('click', (): void => { colorSamples = []; resetMaskGrid(); renderReview(); draw(); });
requireElement<HTMLButtonElement>('#generate-centerlines').addEventListener('click', (): void => { void requestRouteRegeneration(); });
routeBuildButton.addEventListener('click', (): void => { void requestRouteRegeneration(); });
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
	input.addEventListener(input === reviewerIdInput || input === projectIdInput ? 'input' : 'change', (): void => {
		renderProjectAssessment();
		scheduleAutosave();
	});
}

canvas.addEventListener('pointerdown', (event: PointerEvent): void => {
	pointerDown = true;
	previousPointer = eventPoint(event);
	canvas.setPointerCapture(event.pointerId);
	const imagePoint: ImagePoint = toImagePoint(previousPointer);

	if (tool === 'pan') return;

	const floor: WayfindingStudioFloor = currentFloor();
	if (imagePoint.x < 0 || imagePoint.y < 0 || imagePoint.x > floor.width || imagePoint.y > floor.height) {
		pointerDown = false;
		canvas.releasePointerCapture(event.pointerId);
		return;
	}

	if (workspaceMode === 'route-preview') {
		const destination: WayfindingStudioElement | undefined = routeDestinationAt(imagePoint);
		if (destination) routeToSemanticElement(destination.id);
		else routeResult.textContent = 'Click a room or point of interest, or choose a destination from the list.';
		pointerDown = false;
		canvas.releasePointerCapture(event.pointerId);
		return;
	}

	if (insertPointForEdge && graph) {
		const edge: WayfindingEdge | undefined = graph.edges.find((candidate: WayfindingEdge): boolean => candidate.id === insertPointForEdge);

		if (edge) {
			const before: HistoryState = captureHistoryState();
			insertPoint(edge, imagePoint);
			syncStudioGraph();
			recordHistory(before);
		}
		insertPointForEdge = undefined;
		renderReview();
		draw();

		return;
	}

	if (insertPointForSemanticId) {
		const element: WayfindingStudioElement | undefined = currentElements().find((candidate: WayfindingStudioElement): boolean => candidate.id === insertPointForSemanticId);
		if (element && 'geometry' in element) {
			const insertedIndex: number | undefined = insertSemanticVertex(element, imagePoint);
			if (insertedIndex !== undefined) {
				selectedSemanticId = element.id;
				selectedSemanticVertexIndex = insertedIndex;
				insertPointForSemanticId = undefined;
				coverageStatus.textContent = `Added point ${insertedIndex + 1} to ${element.id}`;
			} else coverageStatus.textContent = 'Click closer to the selected polygon edge, or choose Cancel add point.';
		}
		renderSemanticEditor();
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
		if (drawingMode === 'smart') {
			const detected: DetectedRegion | undefined = detectFlatRegionBoundary(imagePoint);
			if (detected) {
				commitSemanticPolygon(tool, detected.geometry, { fillColor: detected.color });
				coverageStatus.textContent = `Detected an editable ${tool} boundary with ${detected.geometry.length} points and sampled ${detected.color}. Small doorway details were straightened; inspect and adjust it before confirmation.`;
			} else {
				coverageStatus.textContent = 'No enclosed flat-color region was found. Adjust Color tolerance, or use Click corners / Freehand lasso.';
			}
			pointerDown = false;
			canvas.releasePointerCapture(event.pointerId);
		} else if (drawingMode === 'lasso') {
			const point: WayfindingPoint = snapToEdgesInput.checked ? snapPointToSourceEdge(imagePoint) : imagePoint;
			semanticDraft = { points: [point], type: tool };
			semanticDraftRedo.length = 0;
			lassoDrawing = true;
		} else {
			semanticDraft ??= { points: [], type: tool };
			semanticDraft.points.push(imagePoint);
			semanticDraftRedo.length = 0;
		}
		semanticDraftHost.hidden = drawingMode === 'smart';
		updateEditActions();
		draw();
	} else if (tool === 'door' || tool === 'poi' || tool === 'origin' || tool === 'transition' || tool === 'label' || tool === 'icon' || tool === 'logo') {
		if (tool === 'door') {
			const before: HistoryState = captureHistoryState();
			const element: WayfindingStudioElement | undefined = addSemanticPoint(tool, imagePoint, { before, deferHistory: true });
			if (element?.type === 'door') {
				draggedDoorRotation = { elementId: element.id };
				dragHistoryState = before;
				dragMutated = true;
				coverageStatus.textContent = 'Drag to set the door angle, then release. Hold Shift to snap to 15-degree increments.';
			}
		} else addSemanticPoint(tool, imagePoint);
	} else if (tool === 'select') {
		const currentSelection: WayfindingStudioElement | undefined = semanticElement();
		if (currentSelection?.type === 'door') {
			const handle: WayfindingPoint = doorRotationHandlePoint(currentSelection);
			if (Math.hypot(imagePoint.x - handle.x, imagePoint.y - handle.y) <= 14 / scale) {
				draggedDoorRotation = { elementId: currentSelection.id };
				dragHistoryState = captureHistoryState();
				dragMutated = false;
				coverageStatus.textContent = 'Drag to rotate the door. Hold Shift to snap to 15-degree increments.';
				draw();
				return;
			}
		}
		const currentPolygon: WayfindingStudioPolygonElement | undefined = selectedSemanticPolygon();
		const currentVertexIndex: number | undefined = currentPolygon ? nearestSemanticVertex(currentPolygon, imagePoint) : undefined;
		const selected: WayfindingStudioElement | undefined = currentVertexIndex !== undefined ? currentPolygon : nearestSemantic(imagePoint);
		selectedSemanticId = selected?.id;
		selectedSemanticVertexIndex = currentVertexIndex;
		selectedEdgeId = undefined;
		if (selected) {
			const vertexIndex: number | undefined = 'geometry' in selected
				? currentVertexIndex ?? nearestSemanticVertex(selected, imagePoint)
				: undefined;
			selectedSemanticVertexIndex = vertexIndex;
			let grabOffset: WayfindingPoint | undefined;
			if (vertexIndex === undefined) {
				if ('geometry' in selected) {
					const center: WayfindingPoint = selected.geometry.reduce(
						(sum: WayfindingPoint, vertex: WayfindingPoint): WayfindingPoint => ({
							x: sum.x + vertex.x / selected.geometry.length,
							y: sum.y + vertex.y / selected.geometry.length
						}),
						{ x: 0, y: 0 }
					);
					grabOffset = { x: center.x - imagePoint.x, y: center.y - imagePoint.y };
				} else {
					grabOffset = { x: selected.point.x - imagePoint.x, y: selected.point.y - imagePoint.y };
				}
			}
			draggedSemantic = {
				elementId: selected.id,
				grabOffset,
				pointerStart: previousPointer,
				started: false,
				vertexIndex
			};
			dragHistoryState = captureHistoryState();
			dragMutated = false;
		} else selectedSemanticVertexIndex = undefined;
		renderSemanticEditor();
		renderReview();
		draw();
	} else if (tool === 'graph' && graph) {
		const edge: WayfindingEdge | undefined = selectedEdgeId
			? graph.edges.find((candidate: WayfindingEdge): boolean => candidate.id === selectedEdgeId)
			: nearestEdge(imagePoint);
		const vertex: number | undefined = edge ? nearestVertex(edge, imagePoint) : undefined;

		if (edge && vertex !== undefined) {
			draggedVertex = { edgeId: edge.id, pointIndex: vertex };
			dragHistoryState = captureHistoryState();
			dragMutated = false;
		}
		else selectEdge(nearestEdge(imagePoint)?.id);
	}
});

canvas.addEventListener('pointermove', (event: PointerEvent): void => {
	const point: WayfindingPoint = eventPoint(event);
	const imagePoint: ImagePoint = toImagePoint(point);
	const floor: WayfindingStudioFloor = currentFloor();
	const inBounds: boolean = imagePoint.x >= 0 && imagePoint.y >= 0 && imagePoint.x <= floor.width && imagePoint.y <= floor.height;
	cursorPosition.value = inBounds ? `x ${Math.round(imagePoint.x)}, y ${Math.round(imagePoint.y)}` : 'x -, y -';
	if (!pointerDown) return;

	if (tool === 'pan') {
		offsetX += point.x - previousPointer.x;
		offsetY += point.y - previousPointer.y;
		previousPointer = point;
		draw();
	} else if (tool === 'include' || tool === 'exclude') {
		paintMask(imagePoint, tool === 'include');
		draw();
	} else if (lassoDrawing && semanticDraft && (tool === 'location' || tool === 'walkable' || tool === 'obstacle')) {
		const floor: WayfindingStudioFloor = currentFloor();
		if (imagePoint.x >= 0 && imagePoint.y >= 0 && imagePoint.x <= floor.width && imagePoint.y <= floor.height) {
			const previous: WayfindingPoint = semanticDraft.points.at(-1) as WayfindingPoint;
			if (Math.hypot(imagePoint.x - previous.x, imagePoint.y - previous.y) >= Math.max(3, 6 / scale)) {
				semanticDraft.points.push(snapToEdgesInput.checked ? snapPointToSourceEdge(imagePoint) : imagePoint);
				draw();
			}
		}
	} else if (tool === 'graph' && draggedVertex) {
		moveVertex(draggedVertex, imagePoint);
		dragMutated = true;
		draw();
	} else if (draggedDoorRotation) {
		const element: WayfindingStudioElement | undefined = currentElements().find((candidate: WayfindingStudioElement): boolean => candidate.id === draggedDoorRotation?.elementId);
		if (element?.type !== 'door') return;
		let angle: number = Math.atan2(imagePoint.y - element.point.y, imagePoint.x - element.point.x) * 180 / Math.PI;
		if (event.shiftKey) angle = Math.round(angle / 15) * 15;
		element.angle = (angle + 360) % 360;
		element.status = 'proposed';
		dragMutated = true;
		draw();
	} else if (tool === 'select' && draggedSemantic) {
		const element: WayfindingStudioElement | undefined = currentElements().find((candidate: WayfindingStudioElement): boolean => candidate.id === draggedSemantic?.elementId);
		if (!element) return;
		if (!draggedSemantic.started) {
			if (Math.hypot(point.x - draggedSemantic.pointerStart.x, point.y - draggedSemantic.pointerStart.y) < 4) return;
			draggedSemantic.started = true;
		}
		if ('geometry' in element) {
			if (draggedSemantic.vertexIndex !== undefined) element.geometry[draggedSemantic.vertexIndex] = { x: imagePoint.x, y: imagePoint.y };
			else {
				const center = element.geometry.reduce((sum, vertex): WayfindingPoint => ({ x: sum.x + vertex.x / element.geometry.length, y: sum.y + vertex.y / element.geometry.length }), { x: 0, y: 0 });
				const target: WayfindingPoint = {
					x: imagePoint.x + (draggedSemantic.grabOffset?.x ?? 0),
					y: imagePoint.y + (draggedSemantic.grabOffset?.y ?? 0)
				};
				const dx: number = target.x - center.x;
				const dy: number = target.y - center.y;
				element.geometry = element.geometry.map((vertex): WayfindingPoint => ({ x: vertex.x + dx, y: vertex.y + dy }));
			}
		} else {
			element.point = {
				x: imagePoint.x + (draggedSemantic.grabOffset?.x ?? 0),
				y: imagePoint.y + (draggedSemantic.grabOffset?.y ?? 0)
			};
		}
		element.status = 'proposed';
		dragMutated = true;
		draw();
	}
});

canvas.addEventListener('pointerleave', (): void => {
	if (!pointerDown) cursorPosition.value = 'x -, y -';
});

canvas.addEventListener('pointerup', (): void => {
	pointerDown = false;
	if (lassoDrawing && semanticDraft) {
		lassoDrawing = false;
		semanticDraft.points = simplifyGeometry(semanticDraft.points, Math.max(2, 4 / scale));
		if (semanticDraft.points.length >= 3) finishSemanticPolygon();
		else {
			semanticDraft = undefined;
			semanticDraftRedo.length = 0;
			semanticDraftHost.hidden = true;
			coverageStatus.textContent = 'The freehand trace was too short. Drag around a complete area.';
			draw();
		}
	}

	if (draggedVertex) {
		draggedVertex = undefined;
		syncStudioGraph();
		if (dragHistoryState && dragMutated) recordHistory(dragHistoryState);
		renderReview();
		draw();
	}
	if (draggedSemantic) {
		draggedSemantic = undefined;
		syncStudioGraph();
		if (dragHistoryState && dragMutated) recordHistory(dragHistoryState);
		renderSemanticEditor();
		renderStudioControls();
		draw();
	}
	if (draggedDoorRotation) {
		draggedDoorRotation = undefined;
		syncStudioGraph();
		if (dragHistoryState && dragMutated) recordHistory(dragHistoryState);
		renderSemanticEditor();
		renderStudioControls();
		draw();
	}
	dragHistoryState = undefined;
	dragMutated = false;
});

canvas.addEventListener('dblclick', (event: MouseEvent): void => {
	if (tool !== 'select') return;
	const point: ImagePoint = toImagePoint(eventPoint(event));
	const selected: WayfindingStudioElement | undefined = semanticElement() ?? nearestSemantic(point);
	if (!selected || !('geometry' in selected)) return;
	const insertedIndex: number | undefined = insertSemanticVertex(selected, point);
	if (insertedIndex === undefined) return;
	selectedSemanticId = selected.id;
	selectedSemanticVertexIndex = insertedIndex;
	insertPointForSemanticId = undefined;
	coverageStatus.textContent = `Added point ${insertedIndex + 1} to ${selected.id}`;
	renderSemanticEditor();
	draw();
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
document.addEventListener('visibilitychange', (): void => {
	if (document.visibilityState === 'hidden') void persistAutosave();
});
window.addEventListener('pagehide', (): void => { void persistAutosave(); scene3d.dispose(); });
studioVersion.textContent = `Editor v${STUDIO_VERSION}`;
syncProjectControls();
renderProjectAssessment();
setActiveTool();
renderDrawingMode();
renderMediaAssetState();
renderProjectContext();
renderEdgeDraft();
renderReview();
destinationDocument = destinationDatasource();
destinationTableName = 'Destinations';
canvas.classList.add('ready');
stageEmpty.classList.add('hidden');
setViewMode('2d');
setWorkspaceMode('map');
renderSemanticEditor();
void (async (): Promise<void> => {
	await activateFloor(currentFloorId);
	await initializeAutosave();
})();
