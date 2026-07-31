import {
	createMemo,
	type Accessor
} from 'solid-js';

import type {
	WayfindingStudioDestination,
	WayfindingStudioElement
} from '../../../../studio-project.mts';
import type {
	EditorSnapshot,
	EditorStore
} from '../../../../editor-core/types';
import {
	getRouteUnavailableGuidance,
	type RouteUnavailableGuidance
} from '../routing/route-readiness';
import {
	routeJourneyToDestination,
	type VisitorRouteJourney
} from '../routing/route';
import type { RouteWorkspaceView } from '../routing/route-workspace';
import {
	createPreviewSession,
	type PreviewSessionController
} from './preview-session';
import { buildVisitorMapItems } from './visitor-map';
import {
	filterVisitorDestinations,
	visitorCategoryOptions,
	visitorFloorOptions
} from './visitor';

interface PreviewWorkspaceOptions {
	element: Accessor<WayfindingStudioElement | undefined>;
	setRouteWorkspaceView: (view: RouteWorkspaceView) => void;
	snapshot: Accessor<EditorSnapshot>;
	store: EditorStore;
}

export interface PreviewWorkspace {
	categories: Accessor<string[]>;
	clearDestination: () => void;
	detailSide: Accessor<'left' | 'right'>;
	floors: Accessor<ReturnType<typeof visitorFloorOptions>>;
	origins: Accessor<Array<{
		floorId: string;
		floorName: string;
		id: string;
		label: string;
	}>>;
	repairRoute: (guidance: RouteUnavailableGuidance) => void;
	routeDestinationId: Accessor<string | undefined>;
	routeJourney: Accessor<VisitorRouteJourney | undefined>;
	routeUnavailableGuidance: Accessor<RouteUnavailableGuidance | undefined>;
	selectDestination: (destination: WayfindingStudioDestination) => void;
	selectDestinationById: (destinationId: string | undefined) => void;
	selectedDestination: Accessor<WayfindingStudioDestination | undefined>;
	session: PreviewSessionController;
	visibleDestinations: Accessor<WayfindingStudioDestination[]>;
}

export const usePreviewWorkspace = (
	options: PreviewWorkspaceOptions
): PreviewWorkspace => {
	const state = createMemo(() => options.snapshot().state);
	const session = createPreviewSession(
		options.snapshot().state.project.defaultLanguage ?? 'en'
	);
	const selectedDestination = createMemo(() => {
		const selection = state().selection;

		if (selection?.kind === 'destination') {
			return state().project.destinations.find((candidate) => candidate.id === selection.id);
		}
		const selected = options.element();
		const destinationId = selected && 'destinationId' in selected
			? selected.destinationId
			: undefined;

		return destinationId
			? state().project.destinations.find((candidate) => candidate.id === destinationId)
			: undefined;
	});
	const floors = createMemo(() =>
		visitorFloorOptions(state().project.floors, state().project.destinations)
	);
	const origins = createMemo(() => state().project.floors.flatMap((floor) =>
		floor.elements
			.filter((element) => element.type === 'origin')
			.map((origin) => ({
				floorId: floor.id,
				floorName: floor.name,
				id: origin.id,
				label: origin.label || origin.screenId || origin.id
			}))
	));
	const categories = createMemo(() =>
		visitorCategoryOptions(state().project.destinations)
	);
	const visibleDestinations = createMemo(() => filterVisitorDestinations(
		state().project.destinations,
		{
			category: session.state().category || undefined,
			floorId: session.state().floorId || undefined,
			language: session.state().language,
			query: session.state().query
		}
	));
	const detailSide = createMemo<'left' | 'right'>(() => {
		const destination = selectedDestination();
		const floorId = destination?.floor ?? state().currentFloorId;
		const floor = state().project.floors.find((candidate) => candidate.id === floorId);

		if (!destination || !floor) return 'left';
		const [item] = buildVisitorMapItems(
			state().project,
			floor.id,
			session.state().language,
			[destination]
		);

		return item && item.anchor.x < floor.width / 2 ? 'right' : 'left';
	});
	const routeDestinationId = createMemo(() =>
		state().workspace === 'preview' ? session.state().destinationId : undefined
	);
	const routeJourney = createMemo(() => routeJourneyToDestination(
		state().project,
		session.state().destinationId,
		session.state().profile,
		session.state().originId
	));
	const routeUnavailableGuidance = createMemo<RouteUnavailableGuidance | undefined>(() => {
		const destinationId = session.state().destinationId;
		const destination = state().project.destinations.find((candidate) =>
			candidate.id === destinationId
		);

		if (!destinationId || destination?.routeable === false || routeJourney()) return undefined;

		return getRouteUnavailableGuidance(state().project, destinationId);
	});

	const clearDestination = (): void => {
		session.setDestinationId(undefined);
		options.store.dispatch({ type: 'selection/clear' });
	};
	const selectDestination = (destination: WayfindingStudioDestination): void => {
		session.setDestinationId(destination.routeable === false ? undefined : destination.id);
		session.setSimulationOpen(false);

		if (destination.floor) {
			options.store.dispatch({ type: 'floor/select', floorId: destination.floor });
		}
		options.store.dispatch({
			type: 'selection/set',
			selection: { id: destination.id, kind: 'destination' }
		});
	};
	const selectDestinationById = (destinationId: string | undefined): void => {
		const destination = state().project.destinations.find((candidate) =>
			candidate.id === destinationId
		);

		if (destination) selectDestination(destination);
		else clearDestination();
	};
	const repairRoute = (guidance: RouteUnavailableGuidance): void => {
		session.setDestinationId(undefined);
		session.setSimulationOpen(false);

		if (guidance.target?.floorId) {
			options.store.dispatch({ type: 'floor/select', floorId: guidance.target.floorId });
		}

		switch (guidance.code) {
			case 'missing-entrance':
				options.store.dispatch({ type: 'workspace/set', workspace: 'map' });

				if (guidance.target?.elementId) {
					options.store.dispatch({
						type: 'selection/set',
						selection: { id: guidance.target.elementId, kind: 'element' }
					});
				}
				options.store.dispatch({ type: 'tool/set', tool: 'door' });
				break;

			case 'missing-origin':
				options.store.dispatch({ type: 'workspace/set', workspace: 'map' });
				options.store.dispatch({ type: 'selection/clear' });
				options.store.dispatch({ type: 'tool/set', tool: 'origin' });
				break;

			case 'unpositioned':
				options.store.dispatch({ type: 'workspace/set', workspace: 'map' });

				if (guidance.target?.destinationId) {
					options.store.dispatch({
						type: 'selection/set',
						selection: { id: guidance.target.destinationId, kind: 'destination' }
					});
				}
				options.store.dispatch({ type: 'tool/set', tool: 'location' });
				break;

			case 'disconnected':
				options.setRouteWorkspaceView('test');
				options.store.dispatch({ type: 'workspace/set', workspace: 'route-edit' });
				options.store.dispatch({ type: 'view/set', viewMode: '2d' });
				options.store.dispatch({ type: 'tool/set', tool: 'pan' });

				if (guidance.target?.destinationId) {
					options.store.dispatch({
						type: 'selection/set',
						selection: { id: guidance.target.destinationId, kind: 'destination' }
					});
				}
				break;
		}
	};

	return {
		categories,
		clearDestination,
		detailSide,
		floors,
		origins,
		repairRoute,
		routeDestinationId,
		routeJourney,
		routeUnavailableGuidance,
		selectDestination,
		selectDestinationById,
		selectedDestination,
		session,
		visibleDestinations
	};
};
