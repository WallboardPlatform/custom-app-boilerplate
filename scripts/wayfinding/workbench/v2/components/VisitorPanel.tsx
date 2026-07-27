import {
	BadgeCheck,
	ChevronRight,
	Clock3,
	ExternalLink,
	Globe2,
	MapPin,
	Phone,
	Route,
	Search,
	ShieldCheck,
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
import { EmptyState } from '../ui';

const translatedName = (destination: WayfindingStudioDestination, language: string): string =>
	destination.translations?.[language]?.name ?? destination.name;

const translatedDescription = (destination: WayfindingStudioDestination, language: string): string =>
	destination.translations?.[language]?.description
	?? destination.description
	?? 'No visitor description has been added yet.';

export const VisitorPanel = (props: {
	assets: Accessor<WayfindingStudioAsset[]>;
	destinations: Accessor<WayfindingStudioDestination[]>;
	floors: Accessor<WayfindingStudioFloor[]>;
	language: Accessor<string>;
	languages: Accessor<WayfindingStudioLanguage[]>;
	layerVisible: (layerId: 'icon' | 'label') => boolean;
	query: Accessor<string>;
	selected: Accessor<WayfindingStudioDestination | undefined>;
	setLanguage: (value: string) => void;
	setQuery: (value: string) => void;
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

	return (
	<div class="visitor-panel" aria-label="Visitor map directory">
		<div class="visitor-panel__toolbar">
			<Show when={props.languages().length > 1}>
				<label>
					<span>Language</span>
					<select value={props.language()} onChange={(event) => props.setLanguage(event.currentTarget.value)}>
						<For each={props.languages()}>{(language) => (
							<option value={language.code}>{language.label}</option>
						)}</For>
					</select>
				</label>
			</Show>
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
		</div>
		<div class="visitor-search">
			<Search size={17} />
			<input
				type="search"
				placeholder="Search destinations"
				value={props.query()}
				onInput={(event) => props.setQuery(event.currentTarget.value)}
			/>
		</div>
		<div class="visitor-results">
			<For each={props.destinations()}>{(destination) => (
				<button
					type="button"
					classList={{ active: props.selected()?.id === destination.id }}
					onClick={() => props.store.dispatch({
						type: 'selection/set',
						selection: { id: destination.id, kind: 'destination' }
					})}
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
						<strong>{translatedName(destination, props.language())}</strong>
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
								<h2>{translatedName(props.selected()!, props.language())}</h2>
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
				<p>{translatedDescription(props.selected()!, props.language())}</p>
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
				<button
					type="button"
					class="button primary full"
					disabled={props.selected()!.routeable === false}
					onClick={() => props.store.dispatch({
						type: 'selection/set',
						selection: { id: props.selected()!.id, kind: 'destination' }
					})}
				>
					<Route size={16} /> Show directions
				</button>
			</div>
		</Show>
	</div>
	);
};
