import {
	ArrowUpDown,
	BadgeCheck,
	ChevronRight,
	Clock3,
	ExternalLink,
	Footprints,
	Globe2,
	MapPin,
	Phone,
	Route,
	ShieldCheck,
	Wrench,
	X
} from 'lucide-solid';
import {
	For,
	Show,
	type Accessor,
	type JSX
} from 'solid-js';

import type {
	WayfindingStudioAsset,
	WayfindingStudioDestination,
	WayfindingStudioFloor
} from '../../../../studio-project.mts';
import type { EditorStore } from '../../../../editor-core/types';
import type {
	RouteUnavailableGuidance,
	VisitorRouteJourney
} from '../routing';
import {
	translatedDestinationDescription,
	translatedDestinationName
} from './visitor';

export const VisitorDestinationCard = (props: {
	assets: Accessor<WayfindingStudioAsset[]>;
	floors: Accessor<WayfindingStudioFloor[]>;
	language: Accessor<string>;
	onRepairRoute: (guidance: RouteUnavailableGuidance) => void;
	routeDestinationId: Accessor<string | undefined>;
	routeJourney: Accessor<VisitorRouteJourney | undefined>;
	routeUnavailableGuidance: Accessor<RouteUnavailableGuidance | undefined>;
	selected: Accessor<WayfindingStudioDestination | undefined>;
	side: Accessor<'left' | 'right'>;
	setFloorFilter: (floorId: string) => void;
	setRouteDestinationId: (destinationId: string | undefined) => void;
	store: EditorStore;
}): JSX.Element => {
	const asset = (id: string | undefined): WayfindingStudioAsset | undefined =>
		id ? props.assets().find((candidate) => candidate.id === id) : undefined;
	const floorName = (destination: WayfindingStudioDestination): string =>
		props.floors().find((floor) => floor.id === destination.floor)?.name
		?? destination.floor
		?? 'Floor not assigned';
	const photos = (): WayfindingStudioAsset[] =>
		(props.selected()?.photoAssetIds ?? [])
			.map((id) => asset(id))
			.filter((candidate): candidate is WayfindingStudioAsset => candidate?.kind === 'photo');
	const brand = (): WayfindingStudioAsset | undefined =>
		asset(props.selected()?.logoAssetId) ?? asset(props.selected()?.symbolAssetId);
	const visitorStatus = (destination: WayfindingStudioDestination): string => {
		switch (destination.status) {
			case 'closed': return 'Closed';

			case 'temporarily-closed': return 'Temporarily closed';

			case 'coming-soon': return 'Coming soon';

			default: return 'Open';
		}
	};
	const close = (): void => {
		props.setRouteDestinationId(undefined);
		props.store.dispatch({ type: 'selection/clear' });
	};
	const showDirections = (): void => {
		const destination = props.selected();

		if (!destination || destination.routeable === false) return;
		props.setRouteDestinationId(destination.id);
	};
	const journeyMinutes = (): number => Math.max(
		1,
		Math.ceil((props.routeJourney()?.metrics.walkingSeconds ?? 0) / 60)
	);

	return (
		<Show when={props.selected()}>
			{(selected) => (
				<aside
					class="visitor-detail-card"
					classList={{
						'route-active': props.routeDestinationId() === selected().id,
						'visitor-detail-card--right': props.side() === 'right'
					}}
					aria-label={`${translatedDestinationName(selected(), props.language())} details`}
				>
					<div class="visitor-detail">
						<div class="visitor-detail__overview">
							<Show when={photos()[0]}>
								<img class="visitor-detail__hero" src={photos()[0].dataUrl} alt="" />
							</Show>
							<div class="visitor-detail__header">
								<div class="visitor-detail__identity">
									<Show when={brand()}>
										<img src={brand()!.dataUrl} alt="" />
									</Show>
									<div>
										<small>{selected().category ?? 'Destination'}</small>
										<h2>{translatedDestinationName(selected(), props.language())}</h2>
									</div>
								</div>
								<button type="button" aria-label="Close destination details" onClick={close}>
									<X size={17} />
								</button>
							</div>
							<div class="visitor-detail__badges">
								<span class={`status ${selected().status ?? 'open'}`}>
									<BadgeCheck size={14} /> {visitorStatus(selected())}
								</span>
								<span><MapPin size={14} /> {floorName(selected())}</span>
								<Show when={selected().mapNumber}><span>#{selected().mapNumber}</span></Show>
								<Show when={selected().accessible}><span><ShieldCheck size={14} /> Step-free</span></Show>
							</div>
							<p>{translatedDestinationDescription(selected(), props.language())}</p>
							<div class="visitor-detail__facts">
								<Show when={selected().hours}>
									<div><Clock3 size={15} /><span><small>Hours</small>{selected().hours}</span></div>
								</Show>
								<Show when={selected().phone}>
									<a href={`tel:${selected().phone}`}><Phone size={15} /><span><small>Phone</small>{selected().phone}</span></a>
								</Show>
								<Show when={selected().website}>
									<a href={selected().website} target="_blank" rel="noreferrer">
										<Globe2 size={15} /><span><small>Website</small>Open website</span><ExternalLink size={13} />
									</a>
								</Show>
							</div>
							<Show when={photos().length > 1}>
								<div class="visitor-detail__gallery">
									<For each={photos().slice(1)}>{(photo) => <img src={photo.dataUrl} alt="" />}</For>
								</div>
							</Show>
							<Show when={selected().routeable === false}>
								<div class="visitor-detail__notice">Directions are not available for this destination.</div>
							</Show>
						</div>
						<Show
							when={props.routeDestinationId() === selected().id}
							fallback={(
								<button
									type="button"
									class="wb-studio-action primary full"
									disabled={selected().routeable === false}
									onClick={showDirections}
								>
									<Route size={16} /> Show directions
								</button>
							)}
						>
							<div class="visitor-journey">
								<Show
									when={props.routeJourney()}
									fallback={(
										<div class="visitor-route-repair">
											<div class="visitor-detail__notice">
												<strong>{props.routeUnavailableGuidance()?.title ?? 'No connected route is available'}</strong>
												<span>{props.routeUnavailableGuidance()?.message ?? 'No safe route is available from the current location.'}</span>
											</div>
											<Show when={props.routeUnavailableGuidance()}>
												{(guidance) => (
													<button
														type="button"
														class="wb-studio-action primary full"
														onClick={() => props.onRepairRoute(guidance())}
													>
														<Wrench size={16} /> {guidance().actionLabel}
													</button>
												)}
											</Show>
										</div>
									)}
								>
									<Show
										when={props.routeJourney()!.metrics.calibrated}
										fallback={(
											<div class="visitor-detail__notice">
												Distance unavailable - calibrate the map scale for every floor on this route.
											</div>
										)}
									>
										<div class="visitor-journey__summary">
											<span><Footprints size={16} /><strong>{props.routeJourney()!.metrics.distanceMeters} m</strong></span>
											<span><Clock3 size={16} /><strong>{journeyMinutes()} min</strong></span>
										</div>
									</Show>
									<div class="visitor-journey__floors">
										<For each={props.routeJourney()!.segments}>{(segment, index) => {
											const transition = (): VisitorRouteJourney['transitions'][number] | undefined =>
												props.routeJourney()!.transitions.find((candidate) =>
													candidate.fromFloorId === segment.floorId
												);

											return (
												<>
													<button
														type="button"
														class="visitor-journey__floor"
														onClick={() => {
															const destinationId = selected().id;

															props.setFloorFilter(segment.floorId);
															props.store.dispatch({ type: 'floor/select', floorId: segment.floorId });
															props.store.dispatch({
																type: 'selection/set',
																selection: { id: destinationId, kind: 'destination' }
															});
														}}
													>
														<span>{index() + 1}</span>
														<strong>{props.floors().find((floor) => floor.id === segment.floorId)?.name ?? segment.floorId}</strong>
														<ChevronRight size={15} />
													</button>
													<Show when={transition()}>
														<div class="visitor-journey__transition">
															<ArrowUpDown size={15} />
															<span>Take the {transition()!.kind} to {
																props.floors().find((floor) => floor.id === transition()!.toFloorId)?.name
																?? transition()!.toFloorId
															}</span>
														</div>
													</Show>
												</>
											);
										}}</For>
									</div>
									<div class="visitor-journey__instructions" aria-label="Turn-by-turn directions">
										<div class="visitor-journey__instructions-heading">
											<strong>Step-by-step</strong>
											<span>{props.routeJourney()!.instructions.length} steps</span>
										</div>
										<ol>
											<For each={props.routeJourney()!.instructions}>{(instruction, index) => (
												<li class={`instruction-${instruction.kind}`}>
													<span>{index() + 1}</span>
													<div>
														<small>{props.floors().find((floor) => floor.id === instruction.floorId)?.name ?? instruction.floorId}</small>
														<strong>{instruction.text}</strong>
													</div>
												</li>
											)}</For>
										</ol>
									</div>
								</Show>
								<button type="button" class="wb-studio-action full" onClick={() => props.setRouteDestinationId(undefined)}>
									<X size={16} /> Clear directions
								</button>
							</div>
						</Show>
					</div>
				</aside>
			)}
		</Show>
	);
};
