import {
	createEffect,
	createMemo,
	createSignal,
	For,
	onCleanup,
	Show,
	type Accessor,
	type JSX
} from 'solid-js';
import { toDataURL } from 'qrcode';

import { useDataSources } from '@hooks/system/useDataSources';
import { useSettings } from '@hooks/system/useSettings';
import type { DataSources, Settings } from '@interfaces/application.interface';
import type { DestinationLiveStatus, KioskPlace } from '@interfaces/wayfinding-kiosk.interface';
import {
	buildKioskPlaces,
	filterKioskPlaces,
	localizedPlaceDescription,
	localizedPlaceName,
	normalizeDestinationStatuses,
	placeFloorLabel,
	placeImage
} from '@utils/wayfinding-kiosk';
import {
	createWayfindingHandoffUrl,
	WayfindingViewport,
	type WayfindingHarness,
	type WayfindingHarnessSnapshot,
	type WayfindingViewerState,
	type WayfindingViewerTarget
} from '../../capabilities/wayfinding';
import sampleDatasource from '../../../sample-datasource.json';
import venueMapUrl from '../../assets/synthetic-campus.wbmap';
import appProperties from '../../editor-assets/properties.json';

import style from './wb-app.module.scss';

type IconName = 'accessibility' | 'arrow' | 'building' | 'close' | 'layers' | 'map' | 'phone' | 'qr' | 'replay' | 'reset' | 'search' | 'volume' | 'volume-off';

const ICON_PATHS: Record<IconName, JSX.Element> = {
	accessibility: <><circle cx="12" cy="4" r="2"/><path d="M7 9h10M12 6v7m0 0-4 7m4-7 4 7M8.5 13H5"/></>,
	arrow: <path d="m9 18 6-6-6-6"/>,
	building: <><path d="M4 21V5l8-3 8 3v16"/><path d="M9 21v-4h6v4M8 7h.01M12 7h.01M16 7h.01M8 11h.01M12 11h.01M16 11h.01"/></>,
	close: <path d="m6 6 12 12M18 6 6 18"/>,
	layers: <><path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/></>,
	map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15M15 6v15"/></>,
	phone: <><rect x="5" y="2" width="14" height="20" rx="3"/><path d="M10 18h4"/></>,
	qr: <><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM18 14h3v7h-3zM14 19h3v2h-3z"/></>,
	replay: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></>,
	reset: <><path d="M4 7h6V1"/><path d="M20 17h-6v6"/><path d="M5.1 16A8 8 0 0 0 18.5 18M18.9 8A8 8 0 0 0 5.5 6"/></>,
	search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
	volume: <><path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12"/></>,
	'volume-off': <><path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="m16 9 5 5m0-5-5 5"/></>
};

const Icon = (props: { name: IconName; size?: number }): JSX.Element => (
	<svg
		aria-hidden="true"
		class={style.icon}
		fill="none"
		height={props.size ?? 20}
		stroke="currentColor"
		stroke-linecap="round"
		stroke-linejoin="round"
		stroke-width="1.8"
		viewBox="0 0 24 24"
		width={props.size ?? 20}
	>{ICON_PATHS[props.name]}</svg>
);

const targetKey = (target: WayfindingViewerTarget): string => `${target.kind}:${target.id}`;

interface DirectoryViewLevel {
	id: string;
	label: string;
	places: KioskPlace[];
}

interface DirectoryViewGroup {
	building?: KioskPlace;
	id: string;
	label: string;
	levels: DirectoryViewLevel[];
}

const colorWithAlpha = (color: string, alpha: number, fallback: string): string => {
	const match = color.trim().match(/^#([0-9a-f]{6})$/i);

	if (!match) return fallback;
	const value = Number.parseInt(match[1], 16);

	return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
};

export default (props: { hostElement: HTMLDivElement }): JSX.Element => {
	let appRoot!: HTMLDivElement;
	const settings: Accessor<Settings> = useSettings();
	const dataSources = useDataSources() as Accessor<DataSources>;
	const [harness, setHarness] = createSignal<WayfindingHarness>();
	const [places, setPlaces] = createSignal<KioskPlace[]>([]);
	const [directoryGroups, setDirectoryGroups] = createSignal<NonNullable<WayfindingHarnessSnapshot['catalog']>['directory']>([]);
	const [selected, setSelected] = createSignal<KioskPlace>();
	const [query, setQuery] = createSignal('');
	const [kind, setKind] = createSignal<'all' | 'building' | 'destination'>('all');
	const [language, setLanguage] = createSignal('en');
	const [profile, setProfile] = createSignal<'standard' | 'step-free'>('standard');
	const [viewDimension, setViewDimension] = createSignal<'2d' | '3d'>('2d');
	const [viewerMode, setViewerMode] = createSignal<WayfindingViewerState['mode']>('site');
	const [journeyActive, setJourneyActive] = createSignal(false);
	const [muted, setMuted] = createSignal(false);
	const [loading, setLoading] = createSignal(true);
	const [error, setError] = createSignal<string>();
	const [notice, setNotice] = createSignal<string>();
	const [viewerState, setViewerState] = createSignal<WayfindingViewerState>();
	const [handoffOpen, setHandoffOpen] = createSignal(false);
	const [handoffQr, setHandoffQr] = createSignal<string>();
	const [handoffError, setHandoffError] = createSignal<string>();
	const [mapProjectName, setMapProjectName] = createSignal('Wayfinding');
	const [assets, setAssets] = createSignal<NonNullable<WayfindingHarnessSnapshot['catalog']>['assets']>([]);
	const [levels, setLevels] = createSignal<NonNullable<WayfindingHarnessSnapshot['catalog']>['levels']>([]);
	let noticeTimer: number | undefined;
	const showNotice = (message: string): void => {
		setNotice(message);

		if (noticeTimer !== undefined) window.clearTimeout(noticeTimer);
		noticeTimer = window.setTimeout(() => setNotice(undefined), 5_000);
	};
	const clearNotice = (): void => {
		setNotice(undefined);

		if (noticeTimer !== undefined) {
			window.clearTimeout(noticeTimer);
			noticeTimer = undefined;
		}
	};
	const themeStyle = createMemo((): JSX.CSSProperties => ({
		'--wb-wayfinding-kiosk-accent': settings().accentColor,
		'--wb-wayfinding-kiosk-background': settings().backgroundColor,
		'--wb-wayfinding-kiosk-muted': settings().mutedColor,
		'--wb-wayfinding-kiosk-panel': settings().panelColor,
		'--wb-wayfinding-kiosk-text': settings().textColor,
		'--wb-wayfinding-kiosk-border': colorWithAlpha(settings().textColor, 0.11, 'rgba(255,255,255,0.11)'),
		'--wb-wayfinding-kiosk-soft': colorWithAlpha(settings().textColor, 0.06, 'rgba(255,255,255,0.06)'),
		'--wb-wayfinding-kiosk-accent-soft': colorWithAlpha(settings().accentColor, 0.11, 'rgba(103,224,196,0.11)'),
		'--wb-wayfinding-kiosk-accent-border': colorWithAlpha(settings().accentColor, 0.26, 'rgba(103,224,196,0.26)'),
		'--wb-wayfinding-kiosk-accent-shadow': colorWithAlpha(settings().accentColor, 0.2, 'rgba(103,224,196,0.2)')
	}));
	createEffect((): void => {
		const nextTheme = themeStyle();

		for (const [property, value] of Object.entries(nextTheme)) {
			appRoot.style.setProperty(property, String(value));
		}
	});
	const datasourceBound = createMemo(() => dataSources().destinationData !== undefined);
	const statuses = createMemo((): Map<string, DestinationLiveStatus> => normalizeDestinationStatuses(
		datasourceBound() ? dataSources().destinationData?.value : sampleDatasource
	));
	const filteredPlaces = createMemo(() => filterKioskPlaces(places(), query(), language(), kind()));
	const visibleDirectory = createMemo((): DirectoryViewGroup[] => {
		const placeByKey = new Map(places().map((place): [string, KioskPlace] => [targetKey(place.target), place]));
		const matches = (place: KioskPlace): boolean => filterKioskPlaces(
			[place],
			query(),
			language(),
			kind()
		).length > 0;

		return directoryGroups().flatMap((group): DirectoryViewGroup[] => {
			const building = group.building
				? placeByKey.get(targetKey({ id: group.building.id, kind: 'building' }))
				: undefined;
			const buildingMatches = building ? matches(building) : false;
			const levels = group.levels.map((level): DirectoryViewLevel => ({
				id: level.id,
				label: level.label,
				places: level.destinations.flatMap((destination): KioskPlace[] => {
					const place = placeByKey.get(targetKey({ id: destination.id, kind: 'destination' }));

					return place && (buildingMatches || matches(place)) ? [place] : [];
				})
			})).filter((level) => level.places.length > 0);

			return buildingMatches || levels.length > 0
				? [{ building: buildingMatches || kind() === 'all' ? building : undefined, id: group.id, label: group.label, levels }]
				: [];
		});
	});
	const selectedStatus = createMemo(() => {
		const place = selected();

		return place ? statuses().get(place.entity.id) : undefined;
	});
	const selectedImage = createMemo(() => {
		const place = selected();

		return place ? placeImage(place, assets()) : undefined;
	});
	const handoffUrl = createMemo((): string | undefined => {
		const place = selected();

		if (!place) return undefined;

		return createWayfindingHandoffUrl(settings().mobileAppUrl, {
			appId: appProperties.name,
			appVersion: appProperties.version,
			datasourceId: dataSources().destinationData?.id ?? undefined,
			language: language(),
			mapPath: 'assets/index.wbmap',
			originId: viewerState()?.originId ?? harness()?.catalog?.origins[0]?.id,
			profile: profile(),
			server: window.location.origin,
			target: place.target,
			version: 1
		});
	});
	let qrGeneration = 0;
	createEffect((): void => {
		const open = handoffOpen();
		const url = handoffUrl();

		if (!open || !url) {
			setHandoffQr(undefined);
			setHandoffError(undefined);

			return;
		}
		qrGeneration += 1;
		const generation = qrGeneration;
		setHandoffQr(undefined);
		setHandoffError(undefined);
		void toDataURL(url, {
			color: { dark: '#07110f', light: '#ffffff' },
			errorCorrectionLevel: 'M',
			margin: 2,
			width: 320
		}).then((value) => {
			if (generation === qrGeneration) setHandoffQr(value);
		}).catch(() => {
			if (generation === qrGeneration) setHandoffError('The mobile handoff code could not be created.');
		});
	});
	const guidanceAvailable = createMemo(() =>
		viewerMode() !== 'site' && Boolean(harness()?.guidanceText));
	const findPlace = (target: WayfindingViewerTarget): KioskPlace | undefined =>
		places().find((place) => targetKey(place.target) === targetKey(target));
	const selectPlace = (place: KioskPlace, previewRoute = true): void => {
		const currentHarness = harness();

		if (journeyActive()) currentHarness?.reset();
		clearNotice();
		setSelected(place);
		setJourneyActive(false);

		if (previewRoute) currentHarness?.previewRoute(place.target);
	};
	const startJourney = (): void => {
		const currentHarness = harness();

		if (!selected() || !currentHarness) return;
		const started = currentHarness.startJourney({ speak: !muted() });

		if (started) setJourneyActive(true);
	};
	const endJourney = (): void => {
		const currentHarness = harness();
		const place = selected();

		currentHarness?.reset();

		// Leaving the 3D journey returns to the already selected route preview.
		// Keeping the shell selection while resetting the harness to an empty site
		// made the next Start action claim that no destination was selected.
		if (place) currentHarness?.previewRoute(place.target);

		setJourneyActive(false);
	};
	const toggleMuted = (): void => {
		const next = !muted();

		setMuted(next);

		if (next) harness()?.stopGuidance();
		else if (journeyActive()) harness()?.speakGuidance();
	};
	const onHarnessSnapshot = (snapshot: WayfindingHarnessSnapshot): void => {
		setLoading(snapshot.status === 'idle' || snapshot.status === 'loading');
		setError(snapshot.error);

		if (snapshot.notice) showNotice(snapshot.notice);
		else clearNotice();

		if (snapshot.catalog) {
			setPlaces(buildKioskPlaces(snapshot.catalog.buildings, snapshot.catalog.destinations));
			setDirectoryGroups(snapshot.catalog.directory);
			setAssets(snapshot.catalog.assets);
			setLevels(snapshot.catalog.levels);
			setMapProjectName(snapshot.catalog.projectName);
		}

		if (snapshot.viewerState) {
			setViewerState(snapshot.viewerState);
			setJourneyActive(snapshot.viewerState.mode === 'journey');
			setViewerMode(snapshot.viewerState.mode);
			setViewDimension(snapshot.viewerState.dimension);
			setLanguage(snapshot.viewerState.language);
		}
	};
	const onHarnessSelection = (target: WayfindingViewerTarget | undefined): void => {
		if (!target) return;
		const place = findPlace(target);

		if (place) selectPlace(place, false);
	};
	onCleanup((): void => {
		qrGeneration += 1;

		if (noticeTimer !== undefined) window.clearTimeout(noticeTimer);
	});

	return (
		<div
			ref={appRoot}
			class={style['wb-app']}
			data-preview-id="wayfinding-kiosk-root"
			data-host-ready={Boolean(props.hostElement)}
			data-journey-active={journeyActive()}
			data-viewer-mode={viewerMode()}
			data-viewer-dimension={viewDimension()}
			data-selected-target={selected() ? targetKey(selected()!.target) : ''}
			data-spoken-guidance-ready={guidanceAvailable()}
			data-viewer-ready={!loading() && !error()}
			data-wayfinding-stage
		>
			<aside class={`${style.directory} wb-wayfinding-kiosk-directory`} data-wayfinding-overlay="left" aria-label="Destination directory">
				<header class={style.brand}>
					<div class={style['brand-mark']}><Icon name="map" size={24} /></div>
					<div>
						<small>INTERACTIVE DIRECTORY</small>
						<strong class="wb-wayfinding-kiosk-venue-name">{settings().venueName}</strong>
					</div>
				</header>
				<div class={style['directory-heading']}>
					<small>WELCOME</small>
					<h1 class="wb-wayfinding-kiosk-welcome">{settings().welcomeMessage}</h1>
				</div>
				<label class={style.search}>
					<Icon name="search" />
					<input
						aria-label="Search destinations"
						placeholder="Search rooms and services"
						value={query()}
						onInput={(event) => setQuery(event.currentTarget.value)}
					/>
					<Show when={query()}>
						<button type="button" aria-label="Clear search" onClick={() => setQuery('')}><Icon name="close" size={17} /></button>
					</Show>
				</label>
				<div class={style.filters} role="group" aria-label="Directory filters">
					<button type="button" class={kind() === 'all' ? style.active : undefined} onClick={() => setKind('all')}>All</button>
					<button type="button" class={kind() === 'building' ? style.active : undefined} onClick={() => setKind('building')}>Buildings</button>
					<button type="button" class={kind() === 'destination' ? style.active : undefined} onClick={() => setKind('destination')}>Places</button>
				</div>
				<div class={style.results} data-preview-allow-overflow aria-live="polite">
					<div class={style['results-meta']}><span>{filteredPlaces().length} destinations</span><small>{datasourceBound() ? 'Live status' : 'Sample status'}</small></div>
					<For each={visibleDirectory()} fallback={<div class={style.empty}>No places match this search.</div>}>
						{(group) => <section class={style['directory-group']}>
							<div class={style['directory-group-heading']}>
								<span>{group.label}</span>
								<small>{group.levels.reduce((total, level) => total + level.places.length, 0)} places</small>
							</div>
							<Show when={group.building}>{(building) => <button type="button" class={`${style['place-row']} ${style['building-row']}`} onClick={() => selectPlace(building())}>
								<span class={style['place-icon']}><Icon name="building" size={19} /></span>
								<span class={style['place-copy']}><strong>{localizedPlaceName(building(), language())}</strong><small>Building overview</small></span>
								<Icon name="arrow" size={18} />
							</button>}</Show>
							<For each={group.levels}>{(level) => <div class={style['directory-level']}>
								<div class={style['directory-level-heading']}><span />{level.label}</div>
								<For each={level.places}>{(place) => {
									const status = (): DestinationLiveStatus | undefined => statuses().get(place.entity.id);
									const active = (): boolean => selected()?.entity.id === place.entity.id && selected()?.kind === place.kind;

									return <button type="button" class={`${style['place-row']} ${style['destination-row']} ${active() ? style.selected : ''} ${status()?.available === false ? style.unavailable : ''}`} onClick={() => selectPlace(place)}>
										<span class={style['place-icon']}><Icon name="map" size={18} /></span>
										<span class={style['place-copy']}><strong class="wb-wayfinding-kiosk-place-name">{localizedPlaceName(place, language())}</strong><small>{level.label}</small></span>
										<Show when={status()?.status}><span class={style['status-dot']} title={status()?.status} /></Show>
										<Icon name="arrow" size={18} />
									</button>;
								}}</For>
							</div>}</For>
						</section>}
					</For>
				</div>
			</aside>

			<main class={`wb-wayfinding-kiosk-stage ${style['map-stage']}`} aria-label="Interactive wayfinding map">
				<div class={style['map-header']} data-wayfinding-overlay="top">
					<div><small>{journeyActive() ? 'COMPLETE ROUTE' : viewerMode() === 'route' && viewDimension() === '2d' ? 'ANIMATED ROUTE PREVIEW' : viewDimension() === '2d' ? '2D CAMPUS MAP' : '3D CAMPUS OVERVIEW'}</small><strong>{selected() ? localizedPlaceName(selected()!, language()) : mapProjectName()}</strong></div>
					<div class={style['map-header-badge']}><span /> Live wayfinding</div>
				</div>
				<WayfindingViewport
					class={`${style['viewer-host']} wb-wayfinding-kiosk-scene`}
					onHarness={setHarness}
					options={{
						dimension: '2d',
						language: language(),
						onSelection: onHarnessSelection,
						onSnapshot: onHarnessSnapshot,
						profile: profile(),
						resolveTargetAvailability: (target) => {
							const status = target.kind === 'destination' ? statuses().get(target.id) : undefined;

							return status?.available === false
								? { available: false, message: status.note ?? 'This destination is currently unavailable.' }
								: { available: true };
						}
					}}
					source={venueMapUrl}
				/>
				<Show when={loading()}><div class={style.loader}><span /><strong>Preparing the map</strong><small>Loading authored geometry and presentation</small></div></Show>
				<Show when={error()}>{(message) => <div class={style.error} role="alert"><strong>Map unavailable</strong><span>{message()}</span></div>}</Show>
				<div class={`${style['map-controls']} wb-wayfinding-kiosk-toolbar`} data-wayfinding-overlay="bottom">
					<Show when={journeyActive()} fallback={(
						<>
							<button
								type="button"
								aria-pressed={viewDimension() === '2d'}
								class={viewDimension() === '2d' ? style.active : undefined}
								onClick={() => harness()?.setDimension('2d')}
							><Icon name="map" /><span>2D</span></button>
							<button
								type="button"
								aria-pressed={viewDimension() === '3d'}
								class={viewDimension() === '3d' ? style.active : undefined}
								onClick={() => harness()?.setDimension('3d')}
							><Icon name="layers" /><span>3D</span></button>
							<button type="button" onClick={() => harness()?.resetCamera()}><Icon name="reset" /><span>Reset view</span></button>
						</>
					)}>
						<button type="button" onClick={endJourney}><Icon name="close" /><span>End route</span></button>
						<button type="button" onClick={() => harness()?.replay({ speak: !muted() })}><Icon name="replay" /><span>Replay</span></button>
					</Show>
					<button type="button" class={profile() === 'step-free' ? style.active : undefined} onClick={() => {
						const next = profile() === 'standard' ? 'step-free' : 'standard';
						setProfile(next);
						harness()?.setProfile(next);
					}}><Icon name="accessibility" /><span>Step-free</span></button>
					<button type="button" class={muted() ? style.active : undefined} onClick={toggleMuted}><Icon name={muted() ? 'volume-off' : 'volume'} /><span>{muted() ? 'Muted' : 'Audio'}</span></button>
					<Show when={selected()}><button type="button" onClick={() => setHandoffOpen(true)}><Icon name="phone" /><span>Take route</span></button></Show>
				</div>
				<Show when={notice()}>{(message) => <div class={style.notice} role="status">{message()}</div>}</Show>
			</main>

			<aside class={`${style.detail} wb-wayfinding-kiosk-detail`} data-wayfinding-overlay="right" aria-label="Destination details">
				<Show when={selected()} fallback={(
					<div class={style['detail-empty']}>
						<div class={style['detail-illustration']}><Icon name="layers" size={36} /></div>
						<small>EXPLORE THE CAMPUS</small>
						<h2>Select a destination</h2>
						<p>Choose a place from the directory or tap a building directly on the map.</p>
						<div class={style['origin-card']}>
							<span class={style['origin-pulse']} />
							<div><small>YOU ARE HERE</small><strong>{harness()?.catalog?.origins[0]?.label ?? 'Campus information kiosk'}</strong></div>
						</div>
					</div>
				)}>{(placeAccessor) => {
					const place = (): KioskPlace => placeAccessor();

					return <div class={style['detail-content']}>
						<div class={`${style['detail-media']} ${!selectedImage() ? style['detail-media--placeholder'] : ''}`}>
							<Show when={selectedImage()} fallback={<Icon name={place().kind === 'building' ? 'building' : 'map'} size={46} />}>
								{(source) => <img alt="" src={source()} />}
							</Show>
							<span>{placeFloorLabel(place(), levels())}</span>
						</div>
						<div class={style['detail-title']}>
							<small>{place().kind === 'building' ? 'BUILDING' : 'DESTINATION'}</small>
							<h2 class="wb-wayfinding-kiosk-detail-name">{localizedPlaceName(place(), language())}</h2>
						</div>
						<Show when={selectedStatus()}>{(status) => <div class={`${style['live-card']} ${!status().available ? style.closed : ''}`}>
							<div><span /><strong class="wb-wayfinding-kiosk-status">{status().status ?? (status().available ? 'Available' : 'Unavailable')}</strong></div>
							<Show when={status().waitMinutes !== undefined && status().waitMinutes! > 0}><b>{status().waitMinutes} min</b></Show>
							<Show when={status().note}><small class="wb-wayfinding-kiosk-status-note">{status().note}</small></Show>
						</div>}</Show>
						<p class={`${style.description} wb-wayfinding-kiosk-description`}>{localizedPlaceDescription(place(), language())}</p>
						<div class={style['route-summary']}>
							<span><Icon name="layers" /><small>Route view</small><strong>2D preview · Full 3D</strong></span>
							<span><Icon name="volume" /><small>Guidance</small><strong>{guidanceAvailable() ? 'Ready' : harness()?.guidanceSupported ? 'If authored' : 'Text only'}</strong></span>
						</div>
						<Show when={journeyActive()} fallback={(
							<div class={style['destination-actions']}>
								<button type="button" class={style['primary-action']} disabled={selectedStatus()?.available === false} onClick={startJourney}>
									<span><Icon name="map" /><strong>Start 3D route</strong><small>Full journey with camera and spoken guidance</small></span><Icon name="arrow" />
								</button>
								<button type="button" class={style['handoff-action']} onClick={() => setHandoffOpen(true)}>
									<Icon name="phone" /><span><strong>Take it with you</strong><small>Continue on your phone</small></span><Icon name="qr" />
								</button>
							</div>
						)}>
							<div class={style['journey-actions']}>
								<button type="button" class={style['primary-action']} onClick={() => harness()?.replay({ speak: !muted() })}><span><Icon name="replay" /><strong>Replay route</strong><small>Camera and spoken guidance</small></span><Icon name="arrow" /></button>
								<button type="button" class={style['secondary-action']} onClick={endJourney}>Back to campus</button>
							</div>
						</Show>
					</div>;
				}}</Show>
				<footer class={style['detail-footer']}>
					<label>
						<span>Language</span>
						<select value={language()} onChange={(event) => {
							setLanguage(event.currentTarget.value);
							harness()?.setLanguage(event.currentTarget.value);
						}}>
							<For each={harness()?.catalog?.languages ?? [{ code: 'en', label: 'English' }]}>{(item) => <option value={item.code}>{item.label}</option>}</For>
						</select>
					</label>
					<span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
				</footer>
			</aside>

			<Show when={handoffOpen()}>
				<div class={style['handoff-backdrop']} data-wayfinding-overlay="ignore" role="presentation" onClick={() => setHandoffOpen(false)}>
					<section class={style['handoff-dialog']} data-handoff-url={handoffUrl()} role="dialog" aria-modal="true" aria-labelledby="wayfinding-handoff-title" onClick={(event) => event.stopPropagation()}>
						<button type="button" class={style['handoff-close']} aria-label="Close mobile handoff" onClick={() => setHandoffOpen(false)}><Icon name="close" /></button>
						<div class={style['handoff-copy']}>
							<span class={style['handoff-kicker']}><Icon name="phone" /> CONTINUE ON YOUR PHONE</span>
							<h2 id="wayfinding-handoff-title">Take your route with you</h2>
							<p>Scan once to open this destination, route profile and kiosk starting point on your phone.</p>
							<div><small>DESTINATION</small><strong>{selected() ? localizedPlaceName(selected()!, language()) : ''}</strong></div>
						</div>
						<div class={style['handoff-code']}>
							<Show when={handoffQr()} fallback={<div class={style['handoff-loading']}><span /><small>{handoffError() ?? 'Preparing secure handoff'}</small></div>}>
								{(source) => <img src={source()} alt="QR code to continue this wayfinding route on a phone" />}
							</Show>
							<small>Open camera. Point. Continue.</small>
						</div>
					</section>
				</div>
			</Show>
		</div>
	);
};
