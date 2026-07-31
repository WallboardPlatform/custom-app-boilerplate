import {
	createSignal,
	type Accessor
} from 'solid-js';

import {
	buildFloorRouteNetwork,
	type RouteBuildResult
} from '../../../../editor-core/route-builder.mts';
import type { WayfindingStudioProject } from '../../../../studio-project.mts';
import type { EditorStore } from '../../../../editor-core/types';
import { getRouteReadiness } from './route-readiness';

interface RouteBuildConfirmation {
	body: string;
	confirmLabel: string;
	details: Array<{
		label: string;
		value: string;
	}>;
	title: string;
}

interface RouteBuildWorkflowOptions {
	confirm: (request: RouteBuildConfirmation) => Promise<boolean>;
	currentFloorId: Accessor<string>;
	notify: (
		message: string,
		tone?: 'danger' | 'info' | 'success' | 'warning'
	) => void;
	project: Accessor<WayfindingStudioProject>;
	store: EditorStore;
}

export interface RouteBuildWorkflow {
	buildRoutes: () => Promise<void>;
	report: Accessor<RouteBuildResult | undefined>;
}

export const useRouteBuildWorkflow = (
	options: RouteBuildWorkflowOptions
): RouteBuildWorkflow => {
	const [report, setReport] = createSignal<RouteBuildResult>();

	const buildRoutes = async (): Promise<void> => {
		const currentFloorId = options.currentFloorId();

		try {
			const result = buildFloorRouteNetwork(options.project(), currentFloorId);
			const readinessAfterBuild = getRouteReadiness(result.project, currentFloorId);
			const diff = result.diff;
			const replacesGeneratedTopology = diff.generatedEdgesBefore > 0
				|| diff.generatedNodesBefore > 0;
			const hasSafeJourney = result.connectedSemanticNodes >= 2 && result.edges > 0;

			if (!hasSafeJourney) {
				setReport(result);
				options.notify(
					'No safe route network was applied. Open the flagged item and align the start, entrance, and pedestrian space first.',
					'danger'
				);

				return;
			}

			if (replacesGeneratedTopology && !await options.confirm({
				body: 'Only Studio-generated topology will be replaced. Reviewed and hand-authored corrections remain intact, and the complete change can still be undone. Destination readiness includes every routeable directory entry, even when an entrance or map position is still missing.',
				confirmLabel: 'Apply rebuild',
				details: [
					{
						label: 'Generated route points',
						value: `${diff.generatedNodesBefore} → ${diff.generatedNodesAfter}`
					},
					{
						label: 'Generated segments',
						value: `${diff.generatedEdgesBefore} → ${diff.generatedEdgesAfter}`
					},
					{
						label: 'Manual corrections preserved',
						value: `${diff.manualNodesPreserved} points · ${diff.manualEdgesPreserved} segments`
					},
					{
						label: 'Routeable destinations ready',
						value: `${readinessAfterBuild.connectedDestinations}/${readinessAfterBuild.routeableDestinations}`
					}
				],
				title: 'Review route build changes'
			})) return;

			options.store.dispatch({
				type: 'project/replace',
				label: replacesGeneratedTopology ? 'Rebuild route network' : 'Build route network',
				project: result.project
			});
			options.store.dispatch({ type: 'selection/clear' });
			options.store.dispatch({ type: 'tool/set', tool: 'select' });
			setReport(result);
			const destinationsRemaining = Math.max(
				0,
				readinessAfterBuild.routeableDestinations - readinessAfterBuild.connectedDestinations
			);

			options.notify(
				destinationsRemaining > 0
					? `Built ${result.edges} route segments. ${readinessAfterBuild.connectedDestinations} of ${readinessAfterBuild.routeableDestinations} routeable destinations are ready; ${destinationsRemaining} still need${destinationsRemaining === 1 ? 's' : ''} setup.`
					: `Built ${result.edges} route segments. Directions are ready for all ${readinessAfterBuild.routeableDestinations} routeable destinations.`,
				destinationsRemaining > 0 ? 'warning' : 'success'
			);
		} catch (error) {
			options.notify(
				error instanceof Error ? error.message : 'The route network could not be built.',
				'danger'
			);
		}
	};

	return {
		buildRoutes,
		report
	};
};
