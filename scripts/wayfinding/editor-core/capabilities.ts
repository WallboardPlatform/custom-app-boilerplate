export type CapabilityArea =
	| 'canvas'
	| 'delivery'
	| 'destinations'
	| 'project'
	| 'routing'
	| 'visitor';
export type CapabilityStatus = 'implemented' | 'partial' | 'planned';
export type LegacyControlDispositionStatus = 'removed' | 'structural' | 'superseded';

export interface CapabilityEvidence {
	browserContracts: string[];
	implementation: string[];
	tests: string[];
}

export interface StudioCapability {
	area: CapabilityArea;
	evidence: CapabilityEvidence;
	id: string;
	legacyControlIds: string[];
	legacyRequired: boolean;
	status: CapabilityStatus;
	summary: string;
}

export interface LegacyControlDisposition {
	controlIds: string[];
	reason: string;
	replacement?: string;
	status: LegacyControlDispositionStatus;
}

const unit = (name: string): string => `scripts/wayfinding/${name}`;
const v2 = (name: string): string => `scripts/wayfinding/workbench/v2/${name}`;

interface CapabilityOptions {
	browserContracts?: string[];
	legacyControlIds?: string[];
	legacyRequired?: boolean;
	status?: CapabilityStatus;
	tests?: string[];
}

const capability = (
	area: CapabilityArea,
	id: string,
	summary: string,
	implementation: string[],
	options: CapabilityOptions = {}
): StudioCapability => ({
	area,
	evidence: {
		browserContracts: options.browserContracts ?? [],
		implementation,
		tests: options.tests ?? []
	},
	id,
	legacyControlIds: options.legacyControlIds ?? [],
	legacyRequired: options.legacyRequired ?? true,
	status: options.status ?? 'partial',
	summary
});

const verified = (
	area: CapabilityArea,
	id: string,
	summary: string,
	implementation: string[],
	browserContracts: string[],
	options: Omit<CapabilityOptions, 'browserContracts' | 'status'> = {}
): StudioCapability => capability(area, id, summary, implementation, {
	...options,
	browserContracts,
	status: 'implemented'
});

const app = v2('App.tsx');
const canvas = v2('Canvas2d.tsx');
const canvasSpec = unit('workbench/studio-v2.spec.ts');
const inspector = v2('components/InspectorContent.tsx');
const projectPanel = v2('components/ProjectPanel.tsx');
const routePanel = v2('components/RoutePanel.tsx');
const visitorPanel = v2('components/VisitorPanel.tsx');

export const STUDIO_CAPABILITIES: StudioCapability[] = [
	verified(
		'project',
		'project-file-lifecycle',
		'New, open, save, save as, local recovery, dirty state, and file-handle semantics.',
		[app, unit('editor-core/state.ts')],
		[
			'saves back to an opened project file and reserves Save as for a new handle',
			'discards, autosaves, restores, and replaces local recovery without resurrecting stale work',
			'reports recoverable geometry repairs and accepts the same project file again',
			'guides a first-time author from an empty project into floor-plan setup'
		],
		{
			legacyControlIds: [
				'autosave-status',
				'local-recovery-summary',
				'project-context',
				'project-context-name',
				'project-context-portable',
				'project-context-recovery',
				'project-context-source',
				'project-id',
				'project-onboarding',
				'studio-new-project',
				'studio-open-project',
				'studio-export-project',
				'studio-project-file',
				'studio-project-name',
				'studio-save-as',
				'project-file',
				'local-recovery',
				'restore-autosave',
				'discard-autosave'
			],
			tests: [unit('editor-core/store.test.mts'), canvasSpec]
		}
	),
	verified(
		'project',
		'multi-floor-authoring',
		'Add, remove, rename, switch, order, calibrate, and assign artwork to floors.',
		[projectPanel, unit('editor-core/commands.ts')],
		['authors, calibrates, illustrates, reorders, and deletes floors without losing the active floor'],
		{
			legacyControlIds: [
				'studio-add-floor',
				'studio-delete-floor',
				'studio-floor',
				'studio-floor-name',
				'studio-floor-units-per-meter',
				'image-file'
			],
			tests: [unit('editor-core/store.test.mts')]
		}
	),
	verified(
		'project',
		'project-directory-registries',
		'Manage any number of visitor languages and editable destination categories.',
		[v2('components/DirectorySettings.tsx'), inspector],
		['edits project directory registries and localized destination content end to end'],
		{
			legacyControlIds: [
				'project-language-code',
				'project-language-label',
				'project-language-list',
				'project-language-add',
				'project-category-name',
				'project-category-list',
				'project-category-add'
			],
			tests: [unit('editor-core/directory.test.mts')]
		}
	),
	verified(
		'project',
		'asset-library',
		'Import, reuse, place, resize, duplicate, assign, and undoably remove photos and symbols.',
		[v2('components/AssetLibrary.tsx'), canvas, inspector],
		['uploads, reuses, assigns, and previews project assets end to end'],
		{
			legacyControlIds: [
				'media-asset-library',
				'media-asset-state',
				'media-asset-summary',
				'choose-media-asset',
				'builtin-icon-library',
				'stop-media-placement'
			],
			tests: [canvasSpec]
		}
	),
	verified(
		'project',
		'project-presentation-defaults',
		'Project-wide geometry, typography, symbol, origin, route, and visitor presentation defaults.',
		[projectPanel],
		[
			'applies project appearance defaults to newly authored rooms',
			'persists configured origin and route appearance across 2D and 3D previews'
		],
		{
			legacyControlIds: [
				'default-location-fixed-color',
				'default-location-fixed-color-control',
				'default-location-opacity',
				'default-location-height',
				'default-walkable-opacity',
				'default-obstacle-opacity',
				'location-color-mode-help',
				'default-label-font',
				'default-label-size',
				'default-icon-size',
				'default-logo-size',
				'default-origin-color',
				'default-origin-speed',
				'default-route-color',
				'default-route-width',
				'default-route-radius',
				'default-route-animation',
				'default-route-speed',
				'default-route-speed-value',
				'default-origin-animation-2d',
				'default-origin-animation-3d'
			],
			tests: [canvasSpec]
		}
	),
	verified(
		'canvas',
		'camera-pan-zoom-fit',
		'Stable per-floor camera with pointer-centered zoom, pan, fit, and no layout-induced jumps.',
		[canvas, unit('editor-core/state.ts')],
		['keeps the map camera stable across panel, workspace, and undo interactions'],
		{
			legacyControlIds: ['fit-view', 'cursor-position', 'toggle-left-panel', 'toggle-right-panel'],
			tests: [canvasSpec]
		}
	),
	verified(
		'canvas',
		'polygon-authoring',
		'Create, select, move, reshape, insert, and remove polygon vertices without moving the camera.',
		[canvas, unit('editor-core/commands.ts')],
		['authors, reshapes, inserts, and removes room vertices without moving the camera'],
		{
			legacyControlIds: [
				'drawing-mode-help',
				'drawing-mode-points',
				'semantic-finish',
				'semantic-cancel',
				'semantic-draft',
				'semantic-draft-help',
				'tool-help',
				'tool-title',
				'trace-assist'
			],
			tests: [canvasSpec]
		}
	),
	verified(
		'canvas',
		'freehand-polygon-authoring',
		'Draw, floor-plan-snap, and simplify freehand room, walkable, and blocked outlines as one undoable edit.',
		[canvas, v2('canvas/freehand.ts'), v2('canvas/source-edge-snap.ts')],
		[
			'authors and reshapes a freehand pedestrian space inside the route workspace',
			'snaps a freehand outline to visible floor-plan edges'
		],
		{
			legacyControlIds: [
				'drawing-mode-lasso',
				'snap-to-edges',
				'snap-radius',
				'snap-enabled-control',
				'snap-radius-control',
				'snap-radius-value'
			],
			tests: [
				v2('canvas/freehand.test.mts'),
				v2('canvas/source-edge-snap.test.mts'),
				canvasSpec
			]
		}
	),
	verified(
		'canvas',
		'image-assisted-polygon-detection',
		'Detect flat-color regions with detail, tolerance, gap-closing, and minimum-opening controls.',
		[canvas, v2('canvas/regionDetection.ts'), v2('components/SmartTraceSettings.tsx')],
		['smart trace converts a real floor-plan region into editable project geometry'],
		{
			legacyControlIds: [
				'drawing-mode-smart',
				'detect-detail-control',
				'detect-detail',
				'detect-detail-value',
				'detect-gap-control',
				'tolerance',
				'detect-gap',
				'detect-gap-value',
				'detect-opening',
				'detect-opening-control',
				'detect-opening-value',
				'tolerance-value'
			],
			tests: [v2('canvas/regionDetection.test.mts'), canvasSpec]
		}
	),
	verified(
		'canvas',
		'semantic-point-authoring',
		'Place, select, move, duplicate, and edit semantic points and labels, with direct rotation for oriented doors and origins.',
		[canvas, inspector],
		[
			'nudges and duplicates selected map objects without moving the camera',
			'rotates doors and origins directly on the canvas',
			'authors and edits POIs, floor connections, and labels with discoverable keyboard tools'
		],
		{
			legacyControlIds: ['semantic-editor', 'metadata-editor', 'destination-id'],
			tests: [canvasSpec]
		}
	),
	verified(
		'canvas',
		'selection-layer-inspector-sync',
		'Canvas, layer tree, inspector, keyboard deletion, visibility, and undo share one selection model.',
		[app, canvas, inspector, projectPanel],
		[
			'opens into a map-first object workspace with direct selection actions',
			'provides a searchable route graph navigator and direct diagnostics',
			'synchronizes layer visibility, selection, keyboard deletion, and undo'
		],
		{
			legacyControlIds: [
				'object-explorer-panel',
				'object-list',
				'show-all-layers',
				'hide-all-layers',
				'delete-selection',
				'undo',
				'redo'
			],
			tests: [unit('editor-core/store.test.mts'), canvasSpec]
		}
	),
	verified(
		'canvas',
		'three-dimensional-review',
		'Mount a non-empty 3D floor, save its authored camera, and restore that floor view on demand.',
		[v2('Scene3dView.tsx')],
		['renders a non-empty 3D scene and saves and restores its floor camera'],
		{
			legacyControlIds: ['view-2d', 'view-3d', 'reset-3d-view', 'save-3d-view'],
			tests: [canvasSpec]
		}
	),
	verified(
		'canvas',
		'three-dimensional-semantic-parity',
		'Show visitor symbols, labels, origins, selections, route animation, and floor transitions in 3D.',
		[v2('Scene3dView.tsx'), unit('workbench/scene3d.ts'), v2('features/preview/presentation-scene.ts')],
		['visitor 3D preserves localized discovery, floor transitions, and route guidance'],
		{
			legacyRequired: false,
			tests: [v2('presentation-scene.test.mts'), canvasSpec]
		}
	),

	verified(
		'routing',
		'walkable-and-blocked-space',
		'Author pedestrian space and exclusions by polygon, freehand, or image detection, and preserve imported painted masks for routing.',
		[canvas, routePanel, v2('components/SmartTraceSettings.tsx')],
		[
			'authors and reshapes a freehand pedestrian space inside the route workspace',
			'builds a route network from authored pedestrian space and linked doors',
			'preserves and rebuilds routes from an imported painted pedestrian mask'
		],
		{
			legacyControlIds: [
				'polygon-pedestrian-tools',
				'pedestrian-source-status'
			],
			tests: [
				unit('editor-core/route-builder.test.mts'),
				v2('canvas/regionDetection.test.mts'),
				canvasSpec
			]
		}
	),
	verified(
		'routing',
		'route-network-generation',
		'Generate a contained, simplified, obstacle-aware graph and connect every eligible destination entrance.',
		[unit('editor-core/route-builder.mts'), routePanel],
		['builds a route network from authored pedestrian space and linked doors'],
		{
			legacyControlIds: ['generate-centerlines', 'route-build', 'route-setup-checklist'],
			tests: [unit('editor-core/route-builder.test.mts'), canvasSpec]
		}
	),
	verified(
		'routing',
		'route-network-direct-editing',
		'Draw graph segments and move, insert, or remove route bends without replacing the edge.',
		[canvas, inspector],
		[
			'authors a manual route segment in route edit mode',
			'inserts, drags, and removes route bends without replacing the edge or moving the camera'
		],
		{
			legacyControlIds: [
				'cancel-edge',
				'edge-draft',
				'edge-failures',
				'edge-list',
				'edge-summary',
				'level-id',
				'route-inspect',
				'selected-edge'
			],
			tests: [canvasSpec]
		}
	),
	verified(
		'routing',
		'route-node-direct-editing',
		'Place, move, connect, inspect, and remove graph endpoints and junctions.',
		[canvas, inspector],
		['places, moves, and removes route junctions without moving the camera'],
		{
			legacyControlIds: ['finish-junction', 'edge-draft-status'],
			tests: [canvasSpec]
		}
	),
	verified(
		'routing',
		'route-simulation',
		'Select start, destination, and profile; preview, clear, animate, and inspect calibrated route metrics.',
		[app, routePanel, v2('route.ts')],
		[
			'switches between standard and step-free route profiles on the authored graph',
			'reports route metrics only after calibration and clears guidance without editing the project'
		],
		{
			legacyControlIds: [
				'route-start',
				'route-destination',
				'route-simulate',
				'route-clear',
				'route-result',
				'route-preview-network'
			],
			tests: [v2('route.test.mts'), canvasSpec]
		}
	),
	verified(
		'routing',
		'route-profiles',
		'Standard and step-free routing honors edge restrictions and presents accessibility state clearly.',
		[app, routePanel, v2('route.ts')],
		['switches between standard and step-free route profiles on the authored graph'],
		{
			legacyControlIds: ['route-profile', 'step-free-required'],
			tests: [v2('route.test.mts'), canvasSpec]
		}
	),
	verified(
		'routing',
		'multi-floor-transitions',
		'Present a continuous visitor journey with explicit floor transitions and correct destination floor.',
		[v2('route.ts'), inspector, visitorPanel],
		['presents a continuous multi-floor visitor journey with an explicit transition'],
		{
			tests: [v2('route.test.mts'), canvasSpec]
		}
	),

	verified(
		'destinations',
		'destination-localized-details',
		'Edit names and descriptions for every configured language plus categories, status, hours, contact, and accessibility.',
		[inspector, v2('components/DirectorySettings.tsx')],
		['edits project directory registries and localized destination content end to end'],
		{
			legacyControlIds: [
				'metadata-summary',
				'destination-category-manage',
				'destination-description',
				'destination-language',
				'destination-map-number',
				'destination-name',
				'destination-select',
				'destination-translated-name',
				'destination-translated-description',
				'destination-category-options',
				'destination-status',
				'destination-hours',
				'destination-accessible'
			],
			tests: [unit('editor-core/directory.test.mts'), v2('visitor.test.mts'), canvasSpec]
		}
	),
	verified(
		'destinations',
		'destination-media',
		'Assign a brand mark and visitor photo gallery to a destination and preview both.',
		[inspector, v2('components/AssetLibrary.tsx'), visitorPanel],
		['uploads, reuses, assigns, and previews project assets end to end'],
		{
			legacyControlIds: ['semantic-media-file', 'runtime-preview-brands', 'runtime-preview-photos'],
			tests: [canvasSpec]
		}
	),
	verified(
		'destinations',
		'destination-entrance-linking',
		'Link destination geometry to one or more routeable entrances with visible diagnostics.',
		[inspector, unit('editor-core/route-builder.mts')],
		['builds a route network from authored pedestrian space and linked doors'],
		{
			legacyControlIds: ['destination-route-status'],
			tests: [unit('editor-core/route-builder.test.mts'), canvasSpec]
		}
	),

	verified(
		'visitor',
		'visitor-directory-and-details',
		'Search and filter a localized directory, inspect destination details, and request directions.',
		[visitorPanel, v2('visitor.ts')],
		['visitor preview provides a clean localized directory and route experience'],
		{
			legacyControlIds: [
				'runtime-preview',
				'runtime-preview-category',
				'runtime-preview-details-close',
				'runtime-preview-search',
				'runtime-preview-results',
				'runtime-preview-details',
				'runtime-preview-name',
				'runtime-preview-description',
				'runtime-preview-facts'
			],
			tests: [v2('visitor.test.mts'), canvasSpec]
		}
	),
	verified(
		'visitor',
		'visitor-language-floor-category-controls',
		'Switch language and floor, filter categories, and preserve a selected multi-floor destination.',
		[visitorPanel, v2('visitor.ts')],
		[
			'visitor preview provides a clean localized directory and route experience',
			'presents a continuous multi-floor visitor journey with an explicit transition'
		],
		{
			legacyControlIds: [
				'runtime-preview-language',
				'runtime-preview-floor',
				'runtime-preview-category-filter'
			],
			tests: [v2('visitor.test.mts'), canvasSpec]
		}
	),
	verified(
		'visitor',
		'visitor-map-presentation',
		'Render semantic destinations, selected highlights, labels, symbols, and route guidance without editor geometry.',
		[visitorPanel, v2('visitor-map.ts'), v2('canvas/CanvasScene.tsx')],
		['visitor preview provides a clean localized directory and route experience'],
		{
			legacyControlIds: [
				'runtime-preview-icons',
				'runtime-preview-labels',
				'runtime-preview-route'
			],
			tests: [v2('visitor-map.test.mts'), canvasSpec]
		}
	),
	verified(
		'visitor',
		'visitor-three-dimensional-experience',
		'Offer the same search, selection, details, floor, and route journey in 3D.',
		[v2('Scene3dView.tsx'), visitorPanel, v2('features/preview/presentation-scene.ts')],
		['visitor 3D preserves localized discovery, floor transitions, and route guidance'],
		{
			legacyRequired: false,
			tests: [v2('presentation-scene.test.mts'), canvasSpec]
		}
	),
	capability(
		'visitor',
		'visitor-share-position-and-analytics',
		'Support shareable destinations, kiosk/mobile handoff, positioning hooks, and privacy-safe usage analytics.',
		[],
		{ legacyRequired: false, status: 'planned' }
	),

	verified(
		'delivery',
		'runtime-bundle-export',
		'Export a portable visitor runtime package without approval theatre.',
		[app, unit('studio-project.mts')],
		['saves back to an opened project file and reserves Save as for a new handle'],
		{
			legacyControlIds: ['studio-export-runtime'],
			tests: [unit('runtime-package.test.mts'), canvasSpec]
		}
	),
	verified(
		'delivery',
		'runtime-readiness-diagnostics',
		'Explain concrete missing destination, floor, asset, or route data in actionable user language.',
		[app, unit('runtime-package.mts')],
		['explains publish blockers and opens the affected map object'],
		{
			legacyControlIds: ['coverage-status', 'studio-notice', 'studio-validation'],
			tests: [unit('runtime-package.test.mts'), canvasSpec]
		}
	)
];

/**
 * Controls that do not map to a v2 capability must be explicitly accounted for.
 * This is intentionally exhaustive: adding a v1 control without a migration or
 * disposition makes the capability audit fail.
 */
export const LEGACY_CONTROL_DISPOSITIONS: LegacyControlDisposition[] = [
	{
		controlIds: [
			'workspace-map',
			'workspace-route-edit',
			'workspace-route-preview',
			'workspace-runtime-preview'
		],
		reason: 'The Solid workspace switcher owns the same four editing contexts without preserving DOM ids.',
		replacement: 'App workspace tabs',
		status: 'superseded'
	},
	{
		controlIds: ['graph-file', 'mask-file', 'destination-file'],
		reason: 'Loose migration files caused partial and contradictory project state.',
		replacement: 'Open project imports one canonical .wbwayfinding document',
		status: 'superseded'
	},
	{
		controlIds: [
			'mask-pedestrian-tools',
			'brush-value',
			'extract-mask',
			'clear-mask',
			'brush-size',
			'bridge-size',
			'bridge-value',
			'cell-size',
			'cell-size-value',
			'independent-mask',
			'mask-status'
		],
		reason: 'Raster-mask controls produced hard-to-refine route space and exposed specialist grid tuning in the primary workflow. Imported masks remain visible and routeable.',
		replacement: 'Editable freehand polygons, Smart trace, blocked-area polygons, and painted-mask compatibility',
		status: 'superseded'
	},
	{
		controlIds: [
			'source-kind',
			'source-presentation',
			'source-levels',
			'target-mode',
			'equivalent-redraw',
			'allow-fallback',
			'reviewer-id',
			'review-method',
			'evidence-list',
			'project-assessment',
			'mask-confirmed'
		],
		reason: 'The old approval theatre blocked valid exports without improving authored geometry or route quality.',
		replacement: 'Actionable runtime readiness diagnostics',
		status: 'removed'
	},
	{
		controlIds: ['export-project', 'export-mask', 'export-graph', 'export-destinations'],
		reason: 'Specialist fragments could drift apart and were not a visitor-deployable artifact.',
		replacement: 'Save .wbwayfinding or export the complete runtime bundle',
		status: 'superseded'
	},
	{
		controlIds: [
			'confirm-accept',
			'confirm-cancel',
			'confirm-dialog',
			'confirm-message',
			'confirm-title',
			'object-count',
			'shortcut-close',
			'shortcut-dialog',
			'shortcut-help',
			'stage',
			'stage-3d',
			'stage-empty',
			'studio-version'
		],
		reason: 'These ids belonged to v1 shell containers, counters, or dialogs rather than product workflows.',
		replacement: 'Solid components with accessible state and custom dialogs',
		status: 'structural'
	}
];

export const capabilityById = (id: string): StudioCapability | undefined =>
	STUDIO_CAPABILITIES.find((candidate) => candidate.id === id);

export const incompleteLegacyCapabilities = (): StudioCapability[] =>
	STUDIO_CAPABILITIES.filter((candidate) => candidate.legacyRequired && candidate.status !== 'implemented');
