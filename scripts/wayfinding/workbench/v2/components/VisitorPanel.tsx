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
	Search,
	ShieldCheck,
	SlidersHorizontal,
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
	WayfindingStudioFloor,
	WayfindingStudioLanguage
} from '../../../studio-project.mts';
import type {
	EditorLayerId,
	EditorStore
} from '../../../editor-core/types';
import type {
	VisitorRouteJourney,
	VisitorRouteProfile
} from '../route';
import { EmptyState } from '../ui';
import {
	translatedDestinationDescription,
	translatedDestinationName
} from '../visitor';

export const VisitorPanel = (props: {
	assets: Accessor<WayfindingStudioAsset[]>;
	categories: Accessor<string[]>;
	category: Accessor<string>;
	destinations: Accessor<WayfindingStudioDestination[]>;
	floorFilter: Accessor<string>;
	floors: Accessor<WayfindingStudioFloor[]>;
	language: Accessor<string>;
	languages: Accessor<WayfindingStudioLanguage[]>;
	layerVisible: (layerId: 'icon' | 'label') => boolean;
	query: Accessor<string>;
	routeDestinationId: Accessor<string | undefined>;
	routeJourney: Accessor<VisitorRouteJourney | undefined>;
	routeOriginId: Accessor<string | undefined>;
	routeOrigins: Accessor<Array<{
		floorId: string;
		floorName: string;
		id: string;
		label: string;
	}>>;
	routeProfile: Accessor<VisitorRouteProfile>;
	selected: Accessor<WayfindingStudioDestination | undefined>;
	setShowRouteNetwork: (visible: boolean) => void;
	setSimulationOpen: (open: boolean) => void;
	setCategory: (value: string) => void;
	setFloorFilter: (value: string) => void;
	setLanguage: (value: string) => void;
	setQuery: (value: string) => void;
	setRouteDestinationId: (value: string | undefined) => void;
	setRouteOriginId: (value: string | undefined) => void;
	setRouteProfile: (value: VisitorRouteProfile) => void;
	showRouteNetwork: Accessor<boolean>;
	simulationOpen: Accessor<boolean>;
	store: EditorStore;
}): JSX.Element => {
	const floorName = (destination: WayfindingStudioDestination): string =>
		props.floors().find((floor) => floor.id === destination.floor)?.name
		?? destination.floor
		?? 'Floor not assigned';
	const asset = (id: string | undefined): WayfindingStudioAsset | undefined =>
		id ? props.assets().find((candidate) => candidate.id === id) : undefined;
	const selectedPhotos = (): WayfindingStudioAsset[] =>
		(props.selected()?.photoAssetIds ?? [])
			.map((id) => asset(id))
			.filter((candidate): candidate is WayfindingStudioAsset => candidate?.kind === 'photo');
	const selectedLogo = (): WayfindingStudioAsset | undefined => asset(props.selected()?.logoAssetId);
	const visitorStatus = (destination: WayfindingStudioDestination): string => {
		switch (destination.status) {
			case 'closed': return 'Closed';

			case 'temporarily-closed': return 'Temporarily closed';

			case 'coming-soon': return 'Coming soon';
		default: return 'Open';
		}
	};
	const inspectDestination = (destination: WayfindingStudioDestination): void => {
		props.setRouteDestinationId(destination.routeable === false ? undefined : destination.id);

		if (destination.floor) {
			props.store.dispatch({ type: 'floor/select', floorId: destination.floor });
		}
		props.store.dispatch({
			type: 'selection/set',
			selection: { id: destination.id, kind: 'destination' }
		});
	};
	const showDirections = (destination: WayfindingStudioDestination): void => {
		const store = props.store;
		inspectDestination(destination);
		props.setRouteDestinationId(destination.id);
		const firstFloorId = props.routeJourney()?.segments[0]?.floorId;

		queueMicrotask(() => {
			if (firstFloorId) store.dispatch({ type: 'floor/select', floorId: firstFloorId });
			store.dispatch({
				type: 'selection/set',
				selection: { id: destination.id, kind: 'destination' }
			});
		});
	};
	const journeyMinutes = (): number => Math.max(
		1,
		Math.ceil((props.routeJourney()?.metrics.walkingSeconds ?? 0) / 60)
	);

	return (
	<div
		class="visitor-panel"
		classList={{ 'has-selection': Boolean(props.selected()) }}
		aria-label="Visitor map directory"
	>
		<header class="visitor-panel__header">
			<div class="visitor-panel__title">
				<span>Interactive directory</span>
				<strong>Explore the map</strong>
			</div>
			<div class="visitor-panel__header-actions">
				<button
					type="button"
					classList={{ active: props.simulationOpen() }}
					aria-expanded={props.simulationOpen()}
					aria-controls="preview-simulation-drawer"
					onClick={() => props.setSimulationOpen(!props.simulationOpen())}
				>
					<SlidersHorizontal size={16} />
					<span>Simulation</span>
				</button>
			</div>
		</header>
		<div class="visitor-search">
			<Search size={17} />
			<input
				type="search"
				aria-label="Search destinations"
				placeholder="Search destinations"
				value={props.query()}
				onInput={(event) => props.setQuery(event.currentTarget.value)}
			/>
		</div>
		<Show when={props.simulationOpen()}>
			<div class="visitor-filter-sheet" id="preview-simulation-drawer">
				<div class="visitor-filter-sheet__heading">
					<div>
						<small>Preview controls</small>
						<strong>Simulation</strong>
					</div>
					<button
						type="button"
						aria-label="Close simulation controls"
						onClick={() => props.setSimulationOpen(false)}
					>
						<X size={16} />
					</button>
				</div>
				<div class="visitor-panel__toolbar">
					<Show when={props.languages().length > 1}>
						<label>
							<span>Language</span>
							<select
								aria-label="Preview language"
								value={props.language()}
								onChange={(event) => props.setLanguage(event.currentTarget.value)}
							>
								<For each={props.languages()}>{(language) => (
									<option value={language.code}>{language.label}</option>
								)}</For>
							</select>
						</label>
					</Show>
					<label>
						<span>Floor</span>
						<select
							aria-label="Visible floor"
							value={props.floorFilter()}
							onChange={(event) => props.setFloorFilter(event.currentTarget.value)}
						>
							<option value="">All floors</option>
							<For each={props.floors()}>{(floor) => (
								<option value={floor.id}>{floor.name}</option>
							)}</For>
						</select>
					</label>
					<label>
						<span>Category</span>
						<select
							value={props.category()}
							onChange={(event) => props.setCategory(event.currentTarget.value)}
						>
							<option value="">All categories</option>
							<For each={props.categories()}>{(category) => (
								<option value={category}>{category}</option>
							)}</For>
						</select>
					</label>
				</div>
				<div class="visitor-panel__options">
					<label class="visitor-origin-picker visitor-control">
						<span>Starting point</span>
						<select
							aria-label="Starting point"
							value={props.routeOriginId() ?? ''}
							onChange={(event) => props.setRouteOriginId(event.currentTarget.value || undefined)}
						>
							<option value="">Choose a screen</option>
							<For each={props.routeOrigins()}>{(origin) => (
								<option value={origin.id}>{origin.label} - {origin.floorName}</option>
							)}</For>
						</select>
					</label>
					<div class="visitor-option-group">
						<span class="visitor-option-group__label">Route</span>
						<div class="visitor-route-profile" role="group" aria-label="Route preference">
							<button
								type="button"
								classList={{ active: props.routeProfile() === 'standard' }}
								aria-pressed={props.routeProfile() === 'standard'}
								onClick={() => props.setRouteProfile('standard')}
							>
								Standard
							</button>
							<button
								type="button"
								classList={{ active: props.routeProfile() === 'step-free' }}
								aria-pressed={props.routeProfile() === 'step-free'}
								onClick={() => props.setRouteProfile('step-free')}
							>
								<ShieldCheck size={13} /> Step-free
							</button>
						</div>
					</div>
					<div class="visitor-option-group">
						<span class="visitor-option-group__label">Map details</span>
						<div class="visitor-layer-toggles">
							<For each={[
								{ id: 'icon' as const, label: 'Symbols' },
								{ id: 'label' as const, label: 'Labels' }
							]}>{(layer) => (
								<label class="visitor-layer-toggle">
									<input
										type="checkbox"
										checked={props.layerVisible(layer.id)}
										onChange={(event) => props.store.dispatch({
											type: 'layer/set',
											layerId: layer.id as EditorLayerId,
											visible: event.currentTarget.checked
										})}
									/>
									{layer.label}
								</label>
							)}</For>
							<label class="visitor-layer-toggle">
								<input
									type="checkbox"
									checked={props.showRouteNetwork()}
									onChange={(event) => props.setShowRouteNetwork(event.currentTarget.checked)}
								/>
								Route network
							</label>
						</div>
					</div>
				</div>
			</div>
		</Show>
		<div class="visitor-results__summary">
			<strong>{props.destinations().length}</strong>
			<span>{props.destinations().length === 1 ? 'destination' : 'destinations'}</span>
		</div>
		<div class="visitor-results">
			<For each={props.destinations()}>{(destination) => (
				<button
					type="button"
					aria-label={`Open ${translatedDestinationName(destination, props.language())} in the directory`}
					classList={{ active: props.selected()?.id === destination.id }}
					onClick={() => inspectDestination(destination)}
				>
					<span class="visitor-result__mark">
						<Show
							when={asset(destination.logoAssetId)}
							fallback={<MapPin size={16} />}
						>
							<img class="visitor-result__logo" src={asset(destination.logoAssetId)!.dataUrl} alt="" />
						</Show>
					</span>
					<span class="visitor-result__copy">
						<strong>{translatedDestinationName(destination, props.language())}</strong>
						<small>{destination.category ?? 'Destination'} / {floorName(destination)}</small>
					</span>
					<ChevronRight size={15} />
				</button>
			)}</For>
			<Show when={props.destinations().length === 0}>
				<EmptyState title="No matches" body="Try another name, category, or detail." />
			</Show>
		</div>
		<Show when={props.selected()}>
			<div class="visitor-detail">
				<Show when={selectedPhotos()[0]}>
					<img class="visitor-detail__hero" src={selectedPhotos()[0].dataUrl} alt="" />
				</Show>
				<div class="visitor-detail__header">
					<div>
						<div class="visitor-detail__identity">
							<Show when={selectedLogo()}>
								<img src={selectedLogo()!.dataUrl} alt="" />
							</Show>
							<div>
								<small>{props.selected()!.category ?? 'Destination'}</small>
								<h2>{translatedDestinationName(props.selected()!, props.language())}</h2>
							</div>
						</div>
					</div>
					<button
						type="button"
						aria-label="Close destination details"
						onClick={() => props.store.dispatch({ type: 'selection/clear' })}
					>
						<X size={17} />
					</button>
				</div>
				<div class="visitor-detail__badges">
					<span class={`status ${props.selected()!.status ?? 'open'}`}><BadgeCheck size={14} /> {visitorStatus(props.selected()!)}</span>
					<span><MapPin size={14} /> {floorName(props.selected()!)}</span>
					<Show when={props.selected()!.mapNumber}><span>#{props.selected()!.mapNumber}</span></Show>
					<Show when={props.selected()!.accessible}><span><ShieldCheck size={14} /> Step-free</span></Show>
				</div>
				<p>{translatedDestinationDescription(props.selected()!, props.language())}</p>
				<div class="visitor-detail__facts">
					<Show when={props.selected()!.hours}><div><Clock3 size={15} /><span><small>Hours</small>{props.selected()!.hours}</span></div></Show>
					<Show when={props.selected()!.phone}><a href={`tel:${props.selected()!.phone}`}><Phone size={15} /><span><small>Phone</small>{props.selected()!.phone}</span></a></Show>
					<Show when={props.selected()!.website}><a href={props.selected()!.website} target="_blank" rel="noreferrer"><Globe2 size={15} /><span><small>Website</small>Open website</span><ExternalLink size={13} /></a></Show>
				</div>
				<Show when={selectedPhotos().length > 1}>
					<div class="visitor-detail__gallery">
						<For each={selectedPhotos().slice(1)}>{(photo) => <img src={photo.dataUrl} alt="" />}</For>
					</div>
				</Show>
				<Show when={props.selected()!.routeable === false}>
					<div class="visitor-detail__notice">Directions are not available for this destination.</div>
				</Show>
				<Show
					when={props.routeDestinationId() === props.selected()!.id}
					fallback={(
						<button
							type="button"
							class="wb-studio-action primary full"
							disabled={props.selected()!.routeable === false}
							onClick={() => showDirections(props.selected()!)}
						>
							<Route size={16} /> Show directions
						</button>
					)}
				>
					<div class="visitor-journey">
						<Show
							when={props.routeJourney()}
							fallback={<div class="visitor-detail__notice">No connected route is available from the current location.</div>}
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
													props.setFloorFilter(segment.floorId);
													props.store.dispatch({ type: 'floor/select', floorId: segment.floorId });
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
												<small>{
													props.floors().find((floor) => floor.id === instruction.floorId)?.name
													?? instruction.floorId
												}</small>
												<strong>{instruction.text}</strong>
											</div>
										</li>
									)}</For>
								</ol>
							</div>
						</Show>
						<button
							type="button"
							class="wb-studio-action full"
							onClick={() => props.setRouteDestinationId(undefined)}
						>
							<X size={16} /> Clear directions
						</button>
					</div>
				</Show>
			</div>
		</Show>
	</div>
	);
};
