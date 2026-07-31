export interface StudioWorkflowContract {
	browserContracts: string[];
	capabilityIds: string[];
	id: string;
	outcome: string;
}

export const STUDIO_WORKFLOW_CONTRACTS: StudioWorkflowContract[] = [
	{
		browserContracts: [
			'saves back to an opened project file and reserves Save as for a new handle',
			'discards, autosaves, restores, and replaces local recovery without resurrecting stale work',
			'opens a portable project through the standard file input',
			'reports recoverable geometry repairs and accepts the same project file again',
			'guides a first-time author from an empty project into floor-plan setup'
		],
		capabilityIds: [
			'project-file-lifecycle',
			'camera-pan-zoom-fit',
			'selection-layer-inspector-sync'
		],
		id: 'resume-edit-save',
		outcome: 'A saved project can be reopened, edited without camera jumps, and saved back to the same file.'
	},
	{
		browserContracts: [
			'authors, calibrates, illustrates, reorders, and deletes floors without losing the active floor',
			'edits project directory registries and localized destination content end to end',
			'uploads, reuses, assigns, and previews project assets end to end',
			'persists configured origin and route appearance across 2D and 3D previews'
		],
		capabilityIds: [
			'multi-floor-authoring',
			'project-directory-registries',
			'asset-library',
			'project-presentation-defaults',
			'destination-localized-details',
			'destination-media'
		],
		id: 'configure-map-product',
		outcome: 'An author can configure floors, directory languages, categories, assets, and visual defaults.'
	},
	{
		browserContracts: [
			'authors, reshapes, inserts, and removes room vertices without moving the camera',
			'authors and reshapes a freehand pedestrian space inside the route workspace',
			'snaps a freehand outline to visible floor-plan edges',
			'smart trace converts a real floor-plan region into editable project geometry',
			'rotates doors and origins directly on the canvas',
			'authors and edits POIs, floor connections, and labels with discoverable keyboard tools',
			'synchronizes layer visibility, selection, keyboard deletion, and undo'
		],
		capabilityIds: [
			'polygon-authoring',
			'freehand-polygon-authoring',
			'image-assisted-polygon-detection',
			'semantic-point-authoring',
			'selection-layer-inspector-sync'
		],
		id: 'author-map-geometry',
		outcome: 'Rooms, pedestrian space, exclusions, doors, origins, and semantic objects remain directly editable.'
	},
	{
		browserContracts: [
			'builds a route network from authored pedestrian space and linked doors',
			'authors a manual route segment in route edit mode',
			'inserts, drags, and removes route bends without replacing the edge or moving the camera',
			'places, moves, and removes route junctions without moving the camera',
			'switches between standard and step-free route profiles on the authored graph',
			'reports route metrics only after calibration and clears guidance without editing the project'
		],
		capabilityIds: [
			'walkable-and-blocked-space',
			'route-network-generation',
			'route-network-direct-editing',
			'route-node-direct-editing',
			'destination-entrance-linking',
			'route-simulation',
			'route-profiles'
		],
		id: 'build-repair-test-routes',
		outcome: 'Generated routes can be inspected, repaired by hand, and tested with visitor routing profiles.'
	},
	{
		browserContracts: [
			'visitor preview provides a clean localized directory and route experience',
			'renders a non-empty 3D scene and saves and restores its floor camera',
			'visitor 3D preserves localized discovery, floor transitions, and route guidance'
		],
		capabilityIds: [
			'visitor-directory-and-details',
			'visitor-language-floor-category-controls',
			'visitor-map-presentation',
			'three-dimensional-review',
			'three-dimensional-semantic-parity',
			'visitor-three-dimensional-experience'
		],
		id: 'accept-visitor-experience',
		outcome: 'The finished directory, details, selection, and route experience can be reviewed in 2D and 3D.'
	},
	{
		browserContracts: [
			'presents a continuous multi-floor visitor journey with an explicit transition',
			'publishes a portable wbmap package instead of an internal runtime JSON',
			'explains publish blockers and opens the affected map object'
		],
		capabilityIds: [
			'multi-floor-transitions',
			'runtime-readiness-diagnostics',
			'runtime-bundle-export'
		],
		id: 'validate-publish-handoff',
		outcome: 'Blocking defects are actionable and an accepted project publishes as one portable visitor map.'
	}
];
