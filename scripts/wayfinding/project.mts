export type WayfindingGuidanceMode = 'directory' | 'highlight' | 'directional' | 'route';
export type WayfindingEvidenceStatus = 'unavailable' | 'proposed' | 'confirmed';

export type WayfindingEvidenceKey =
	| 'destinationMetadata'
	| 'destinationAnchors'
	| 'currentLocationAnchors'
	| 'orientation'
	| 'walkableSpace'
	| 'routeTopology'
	| 'entranceApproaches'
	| 'levelTransitions'
	| 'accessibility';

export interface WayfindingEvidenceItem {
	artifact?: string;
	independentFrom?: WayfindingEvidenceKey[];
	provenance: 'customer-provided' | 'ai-inferred' | 'image-analysis' | 'vector-extraction' | 'authoritative-import' | 'reviewer-authored';
	review?: {
		method: 'source-authority' | 'overlay-review' | 'field-verification' | 'customer-approval';
		note?: string;
		reviewedBy: string;
		reviewerType: 'authoritative-source' | 'customer' | 'site-operator' | 'qualified-reviewer';
	};
	status: WayfindingEvidenceStatus;
}

export interface WayfindingProjectDocument {
	contractVersion: 1;
	evidence: Record<WayfindingEvidenceKey, WayfindingEvidenceItem>;
	guidance: {
		allowFallback: boolean;
		stepFreeRequired: boolean;
		targetMode: WayfindingGuidanceMode;
	};
	projectId: string;
	source: {
		equivalentRedrawAllowed: boolean;
		fidelityReview?: string;
		kind: 'floor-plan' | 'directory-map' | 'illustrated-map' | 'isometric-map' | 'vector-map' | 'cad-bim' | 'gis' | 'mixed';
		levels: number;
		presentation: 'source-overlay' | 'redrawn-equivalent' | 'schematic' | 'calibrated-isometric';
		referenceContract?: string;
	};
}

export interface WayfindingProjectIssue {
	code: string;
	evidence: WayfindingEvidenceKey[];
	message: string;
	severity: 'blocker' | 'warning' | 'info';
}

export interface WayfindingProjectAssessment {
	capabilities: {
		destinationHighlight: boolean;
		directionalGuidance: boolean;
		standardRouting: boolean;
		stepFreeRouting: boolean;
		youAreHere: boolean;
	};
	deliveryAllowed: boolean;
	deliveryMode: WayfindingGuidanceMode | 'blocked';
	issues: WayfindingProjectIssue[];
	projectId: string;
	targetMode: WayfindingGuidanceMode;
	targetSatisfied: boolean;
}

const MODE_ORDER: WayfindingGuidanceMode[] = ['directory', 'highlight', 'directional', 'route'];

const confirmed = (project: WayfindingProjectDocument, key: WayfindingEvidenceKey): boolean => {
	return project.evidence[key].status === 'confirmed';
};

const addMissingEvidenceIssue = (
	issues: WayfindingProjectIssue[],
	project: WayfindingProjectDocument,
	mode: WayfindingGuidanceMode,
	keys: WayfindingEvidenceKey[]
): void => {
	const missing: WayfindingEvidenceKey[] = keys.filter((key: WayfindingEvidenceKey): boolean => !confirmed(project, key));

	if (missing.length === 0) return;

	issues.push({
		code: `${mode}-evidence-incomplete`,
		evidence: missing,
		message: `${mode} guidance requires confirmed ${missing.join(', ')} evidence.`,
		severity: project.guidance.targetMode === mode ? 'blocker' : 'info'
	});
};

const highestAvailableMode = (
	targetMode: WayfindingGuidanceMode,
	capabilities: Record<WayfindingGuidanceMode, boolean>
): WayfindingGuidanceMode | undefined => {
	const targetIndex: number = MODE_ORDER.indexOf(targetMode);

	for (let index = targetIndex; index >= 0; index -= 1) {
		const mode: WayfindingGuidanceMode = MODE_ORDER[index];

		if (capabilities[mode]) return mode;
	}

	return undefined;
};

export const assessWayfindingProject = (project: WayfindingProjectDocument): WayfindingProjectAssessment => {
	const issues: WayfindingProjectIssue[] = [];
	const directory: boolean = confirmed(project, 'destinationMetadata');
	const destinationHighlight: boolean = directory && confirmed(project, 'destinationAnchors');
	const youAreHere: boolean = confirmed(project, 'currentLocationAnchors');
	const directionalGuidance: boolean = destinationHighlight && youAreHere && confirmed(project, 'orientation');
	const routeEvidence: WayfindingEvidenceKey[] = [
		'destinationMetadata',
		'destinationAnchors',
		'currentLocationAnchors',
		'walkableSpace',
		'routeTopology',
		'entranceApproaches'
	];

	if (project.source.levels > 1) routeEvidence.push('levelTransitions');

	const walkableSpaceIsIndependent: boolean = project.evidence.walkableSpace.independentFrom?.includes('routeTopology') === true;
	const routeProjectionReady: boolean = project.source.kind !== 'isometric-map' || project.source.presentation === 'calibrated-isometric';
	const standardRouting: boolean = routeEvidence.every((key: WayfindingEvidenceKey): boolean => confirmed(project, key))
		&& walkableSpaceIsIndependent
		&& routeProjectionReady;
	const stepFreeRouting: boolean = standardRouting && confirmed(project, 'accessibility');
	const capabilities: Record<WayfindingGuidanceMode, boolean> = {
		directory,
		highlight: destinationHighlight,
		directional: directionalGuidance,
		route: project.guidance.stepFreeRequired ? stepFreeRouting : standardRouting
	};

	addMissingEvidenceIssue(issues, project, 'directory', ['destinationMetadata']);
	addMissingEvidenceIssue(issues, project, 'highlight', ['destinationMetadata', 'destinationAnchors']);
	addMissingEvidenceIssue(issues, project, 'directional', ['destinationMetadata', 'destinationAnchors', 'currentLocationAnchors', 'orientation']);
	addMissingEvidenceIssue(issues, project, 'route', routeEvidence);

	if (routeEvidence.every((key: WayfindingEvidenceKey): boolean => confirmed(project, key)) && !walkableSpaceIsIndependent) {
		issues.push({
			code: 'walkable-space-not-independent',
			evidence: ['walkableSpace', 'routeTopology'],
			message: 'Route certification requires a confirmed walkable-space artifact that was not derived from the route topology.',
			severity: project.guidance.targetMode === 'route' ? 'blocker' : 'info'
		});
	}

	if (project.guidance.stepFreeRequired && !confirmed(project, 'accessibility')) {
		issues.push({
			code: 'step-free-evidence-incomplete',
			evidence: ['accessibility'],
			message: 'Step-free routing requires confirmed accessibility evidence for every used edge and transition.',
			severity: 'blocker'
		});
	}

	if (project.source.kind === 'isometric-map' && project.source.presentation !== 'calibrated-isometric' && project.guidance.targetMode === 'route') {
		issues.push({
			code: 'isometric-projection-uncalibrated',
			evidence: ['destinationAnchors', 'routeTopology'],
			message: 'Routing on isometric artwork requires a separately authored topology and a calibrated projection into the presentation layer.',
			severity: 'blocker'
		});
	}

	const targetSatisfied: boolean = capabilities[project.guidance.targetMode];
	const fallbackMode: WayfindingGuidanceMode | undefined = project.guidance.allowFallback
		? highestAvailableMode(project.guidance.targetMode, capabilities)
		: undefined;
	const deliveryMode: WayfindingGuidanceMode | 'blocked' = targetSatisfied
		? project.guidance.targetMode
		: fallbackMode ?? 'blocked';

	if (!targetSatisfied && deliveryMode !== 'blocked') {
		issues.push({
			code: 'guidance-mode-downgraded',
			evidence: [],
			message: `Requested ${project.guidance.targetMode} guidance is not certified; deliver ${deliveryMode} mode until the missing evidence is confirmed.`,
			severity: 'warning'
		});
	}

	return {
		capabilities: {
			destinationHighlight,
			directionalGuidance,
			standardRouting,
			stepFreeRouting,
			youAreHere
		},
		deliveryAllowed: deliveryMode !== 'blocked',
		deliveryMode,
		issues,
		projectId: project.projectId,
		targetMode: project.guidance.targetMode,
		targetSatisfied
	};
};
