import {
	ChevronRight,
	MapPin,
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
	VisitorRouteProfile
} from '../route';
import { EmptyState } from '../ui';
import { translatedDestinationName } from '../visitor';

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
	onClearDestination: () => void;
	onSelectDestination: (destination: WayfindingStudioDestination) => void;
	query: Accessor<string>;
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
	const searchDestinations = (query: string): void => {
		props.setQuery(query);

		if (!props.selected()) return;
		props.onClearDestination();
	};

	return (
	<div
		class="visitor-panel"
		classList={{
			'simulation-open': props.simulationOpen()
		}}
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
				onInput={(event) => searchDestinations(event.currentTarget.value)}
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
					onClick={() => props.onSelectDestination(destination)}
				>
					<span class="visitor-result__mark">
						<Show
							when={asset(destination.symbolAssetId) ?? asset(destination.logoAssetId)}
							fallback={<MapPin size={16} />}
						>
							<img
								class="visitor-result__logo"
								src={(asset(destination.symbolAssetId) ?? asset(destination.logoAssetId))!.dataUrl}
								alt=""
							/>
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
	</div>
	);
};
