import {
	ChevronRight,
	Route,
	Search,
	X
} from 'lucide-solid';
import {
	For,
	Show,
	type Accessor,
	type JSX
} from 'solid-js';
import type {
	WayfindingStudioDestination,
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
	destinations: Accessor<WayfindingStudioDestination[]>;
	language: Accessor<string>;
	languages: Accessor<WayfindingStudioLanguage[]>;
	layerVisible: (layerId: 'icon' | 'label') => boolean;
	query: Accessor<string>;
	selected: Accessor<WayfindingStudioDestination | undefined>;
	setLanguage: (value: string) => void;
	setQuery: (value: string) => void;
	store: EditorStore;
}): JSX.Element => (
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
					<span>{translatedName(destination, props.language())}</span>
					<small>{destination.category ?? destination.floor ?? 'Destination'}</small>
					<ChevronRight size={15} />
				</button>
			)}</For>
			<Show when={props.destinations().length === 0}>
				<EmptyState title="No matches" body="Try another name, category, or detail." />
			</Show>
		</div>
		<Show when={props.selected()}>
			<div class="visitor-detail">
				<div class="visitor-detail__header">
					<div>
						<small>{props.selected()!.category ?? 'Destination'}</small>
						<h2>{translatedName(props.selected()!, props.language())}</h2>
					</div>
					<button
						type="button"
						aria-label="Close destination details"
						onClick={() => props.store.dispatch({ type: 'selection/clear' })}
					>
						<X size={17} />
					</button>
				</div>
				<p>{translatedDescription(props.selected()!, props.language())}</p>
				<Show when={props.selected()!.hours}><dl><dt>Hours</dt><dd>{props.selected()!.hours}</dd></dl></Show>
				<Show when={props.selected()!.phone}><dl><dt>Phone</dt><dd>{props.selected()!.phone}</dd></dl></Show>
				<button
					type="button"
					class="button primary full"
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
