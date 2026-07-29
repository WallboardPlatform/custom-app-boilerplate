import { createEffect, createMemo, createSignal, For, Match, on, onCleanup, onMount, Show, Switch, untrack } from 'solid-js';
import type { Accessor, JSX } from 'solid-js';

import { useDataSources } from '@hooks/system/useDataSources';
import { useSettings } from '@hooks/system/useSettings';

import WbPresenceAvatar from '@components/wb-presence-avatar/wb-presence-avatar';
import WbPresenceCard from '@components/wb-presence-card/wb-presence-card';

import type { DataSources, Settings } from '@interfaces/application.interface';
import type { PresenceLayout, PresencePerson, PresenceZone, StatusChange } from '@interfaces/presence.interface';

import {
	filterPeople,
	formatClockTime,
	formatDate,
	formatDuration,
	formatTickerTime,
	formatWeekday,
	groupIntoZones,
	normalizePresence,
	selectLayout
} from '@utils/presence';

import style from '@components/wb-app/wb-app.module.scss';

import sampleDatasourceJson from '../../../sample-datasource.json';

type BoardState = 'loading' | 'malformed' | 'empty' | 'people';

const TRAVEL_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
const NEIGHBOR_EASING = 'cubic-bezier(0.33, 1, 0.68, 1)';

const samePerson = (left: PresencePerson, right: PresencePerson): boolean => {
	return left.name === right.name &&
		left.dept === right.dept &&
		left.photo === right.photo &&
		left.group === right.group &&
		left.label === right.label &&
		left.rosterIndex === right.rosterIndex;
};

export default (props: { hostElement: HTMLDivElement }): JSX.Element => {
	const settings: Accessor<Settings> = useSettings();
	const dataSources: Accessor<DataSources> = useDataSources();

	const [displayPeople, setDisplayPeople] = createSignal<PresencePerson[]>([]);
	const [lastChange, setLastChange] = createSignal<StatusChange | undefined>(undefined);
	const [now, setNow] = createSignal<Date>(new Date());
	const [durationTick, setDurationTick] = createSignal<number>(0);
	const [dimensions, setDimensions] = createSignal<{ width: number; height: number }>({ width: 1920, height: 1080 });

	const sinceByKey: Map<string, number> = new Map<string, number>();
	const cardRefs: Map<string, HTMLElement> = new Map<string, HTMLElement>();
	const activeAnimations: Set<Animation> = new Set<Animation>();

	let rootRef: HTMLDivElement | undefined;
	let resizeObserver: ResizeObserver | undefined;
	let clockInterval: number | undefined;
	let tickInterval: number | undefined;

	const reducedMotion: boolean = typeof window.matchMedia === 'function' &&
		window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	const motionEnabled: Accessor<boolean> = createMemo((): boolean => {
		return settings().motionPreset !== 'off' && !reducedMotion;
	});
	const travelEnabled: Accessor<boolean> = createMemo((): boolean => {
		return motionEnabled() && settings().motionPreset === 'expressive';
	});

	const hasBoundDatasource: Accessor<boolean> = createMemo((): boolean => {
		return Object.prototype.hasOwnProperty.call(dataSources(), 'presenceData');
	});
	const rawValue: Accessor<unknown> = createMemo((): unknown => {
		return hasBoundDatasource() ? dataSources().presenceData?.value : sampleDatasourceJson;
	});
	const normalizedPeople: Accessor<PresencePerson[] | undefined> = createMemo((): PresencePerson[] | undefined => {
		return normalizePresence(rawValue());
	});
	const visiblePeople: Accessor<PresencePerson[] | undefined> = createMemo((): PresencePerson[] | undefined => {
		const people: PresencePerson[] | undefined = normalizedPeople();

		if (!people) {
			return undefined;
		}

		return filterPeople(people, settings().memberFilter, settings().requirePhoto);
	});
	const boardState: Accessor<BoardState> = createMemo((): BoardState => {
		if (hasBoundDatasource() && (dataSources().presenceData?.value === undefined || dataSources().presenceData?.value === null)) {
			return 'loading';
		}

		if (visiblePeople() === undefined) {
			return 'malformed';
		}

		return displayPeople().length === 0 ? 'empty' : 'people';
	});
	const layout: Accessor<PresenceLayout> = createMemo((): PresenceLayout => {
		return selectLayout(displayPeople().length);
	});
	const zones: Accessor<PresenceZone[]> = createMemo((): PresenceZone[] => {
		return groupIntoZones(displayPeople(), settings().showOfflineZone);
	});

	const ratioClass: Accessor<string> = createMemo((): string => {
		const ratio: number = dimensions().width / Math.max(dimensions().height, 1);

		if (ratio >= 2.6) {
			return 'wb-presence-wide';
		}

		return ratio <= 0.8 ? 'wb-presence-portrait' : 'wb-presence-landscape';
	});
	const sizeClass: Accessor<string> = createMemo((): string => {
		const minimum: number = Math.min(dimensions().width, dimensions().height);

		if (minimum < 640) {
			return 'wb-presence-small';
		}

		return minimum < 900 ? 'wb-presence-medium' : 'wb-presence-large';
	});
	const rootStyle: Accessor<JSX.CSSProperties> = createMemo((): JSX.CSSProperties => {
		const { width, height } = dimensions();
		const count: number = Math.max(displayPeople().length, 1);
		const heroAvatar: number = Math.round(Math.max(96, Math.min(width * 0.32, height * 0.46, 520)));
		const compactAvatar: number = Math.round(Math.max(72, Math.min((width / count) * 0.52, height * 0.34, 340)));

		return {
			'--wb-presence-bg': settings().backgroundColor,
			'--wb-presence-panel': settings().panelColor,
			'--wb-presence-well': settings().wellColor,
			'--wb-presence-text': settings().textColor,
			'--wb-presence-muted': settings().mutedTextColor,
			'--wb-presence-accent': settings().accentColor,
			'--wb-presence-divider': settings().dividerColor,
			'--wb-presence-hero-avatar': `${heroAvatar}px`,
			'--wb-presence-compact-avatar': `${compactAvatar}px`
		};
	});

	const registerRef = (key: string, element: HTMLElement): void => {
		cardRefs.set(key, element);
	};
	const unregisterRef = (key: string, element: HTMLElement): void => {
		if (cardRefs.get(key) === element) {
			cardRefs.delete(key);
		}
	};

	// Card cell geometry mirrored from wb-app.module.scss tier variables; used to cap
	// each zone at the cards that actually fit and show a "+N" chip for the rest.
	const cardCell = createMemo((): { width: number; height: number } => {
		const dense: boolean = layout() === 'dense';
		const tier: string = sizeClass();
		const avatar: number = tier === 'wb-presence-small'
			? (dense ? 40 : 46)
			: tier === 'wb-presence-medium'
				? (dense ? 48 : 60)
				: (dense ? 56 : 76);
		const cardWidth: number = tier === 'wb-presence-small'
			? (dense ? 112 : 118)
			: tier === 'wb-presence-medium'
				? (dense ? 126 : 142)
				: (dense ? 136 : 158);
		const margin: number = dense ? 6 : tier === 'wb-presence-small' ? 5 : 8;

		return { width: cardWidth + margin * 2, height: avatar + 56 + margin * 2 };
	});
	const [zoneSizes, setZoneSizes] = createSignal<Record<string, { width: number; height: number }>>({});

	let zoneObserver: ResizeObserver | undefined;

	const observeZoneCards = (group: string, element: HTMLElement): void => {
		element.setAttribute('data-zone-cards', group);

		if (!zoneObserver && typeof ResizeObserver === 'function') {
			zoneObserver = new ResizeObserver((entries: ResizeObserverEntry[]): void => {
				const updates: Record<string, { width: number; height: number }> = {};

				for (const entry of entries) {
					const entryGroup: string | null = entry.target.getAttribute('data-zone-cards');

					if (entryGroup) {
						updates[entryGroup] = { width: entry.contentRect.width, height: entry.contentRect.height };
					}
				}

				setZoneSizes((previous: Record<string, { width: number; height: number }>): Record<string, { width: number; height: number }> => ({
					...previous,
					...updates
				}));
			});
		}

		zoneObserver?.observe(element);
	};

	const zoneCapacity = (group: string): number => {
		const size: { width: number; height: number } | undefined = zoneSizes()[group];

		if (!size || size.width === 0 || size.height === 0) {
			return Number.MAX_SAFE_INTEGER;
		}

		const cell: { width: number; height: number } = cardCell();
		const columns: number = Math.max(1, Math.floor((size.width - 16) / cell.width));
		const rows: number = Math.max(1, Math.floor((size.height - 16) / cell.height));

		return columns * rows;
	};

	const visibleZone = (zone: PresenceZone): { people: PresencePerson[]; hidden: number } => {
		const capacity: number = zoneCapacity(zone.group);

		if (zone.people.length <= capacity) {
			return { people: zone.people, hidden: 0 };
		}

		if (capacity <= 1) {
			// A single-cell zone shows one person; the zone count still reports the true total.
			return { people: zone.people.slice(0, 1), hidden: 0 };
		}

		return { people: zone.people.slice(0, capacity - 1), hidden: zone.people.length - (capacity - 1) };
	};

	const trackAnimation = (animation: Animation): void => {
		activeAnimations.add(animation);
		animation.onfinish = (): void => {
			activeAnimations.delete(animation);
		};
		animation.oncancel = (): void => {
			activeAnimations.delete(animation);
		};
	};

	const pulseCard = (key: string): void => {
		const element: HTMLElement | undefined = cardRefs.get(key);
		const ring: Element | null = element ? element.querySelector('.wb-presence-ring-pulse') : null;

		if (!ring || typeof (ring as HTMLElement).animate !== 'function') {
			return;
		}

		trackAnimation((ring as HTMLElement).animate(
			[
				{ transform: 'scale(1)', opacity: '0.9' },
				{ transform: 'scale(1.55)', opacity: '0' }
			],
			{ duration: 900, easing: 'ease-out' }
		));
	};

	let motionFrame: number | undefined;

	const scheduleMotionFrame = (callback: () => void): void => {
		if (motionFrame !== undefined) {
			window.cancelAnimationFrame(motionFrame);
		}

		motionFrame = window.requestAnimationFrame((): void => {
			motionFrame = undefined;
			callback();
		});
	};

	const captureRects = (): Map<string, DOMRect> => {
		const rects: Map<string, DOMRect> = new Map<string, DOMRect>();

		cardRefs.forEach((element: HTMLElement, key: string): void => {
			if (element.isConnected) {
				rects.set(key, element.getBoundingClientRect());
			}
		});

		return rects;
	};

	const animateZoneChanges = (firstRects: Map<string, DOMRect>, movedKeys: Set<string>): void => {
		cardRefs.forEach((element: HTMLElement, key: string): void => {
			const first: DOMRect | undefined = firstRects.get(key);

			if (!first || !element.isConnected || typeof element.animate !== 'function') {
				return;
			}

			const last: DOMRect = element.getBoundingClientRect();
			const deltaX: number = first.left - last.left;
			const deltaY: number = first.top - last.top;

			if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) {
				if (movedKeys.has(key)) {
					pulseCard(key);
				}

				return;
			}

			if (movedKeys.has(key)) {
				element.style.zIndex = '10';

				const travel: Animation = element.animate(
					[
						{ transform: `translate(${deltaX}px, ${deltaY}px) scale(1)` },
						{ transform: `translate(${deltaX / 2}px, ${deltaY / 2}px) scale(1.12)`, offset: 0.5 },
						{ transform: 'translate(0, 0) scale(1)' }
					],
					{ duration: 750, easing: TRAVEL_EASING }
				);

				travel.onfinish = (): void => {
					activeAnimations.delete(travel);
					element.style.zIndex = '';
					pulseCard(key);
				};
				travel.oncancel = (): void => {
					activeAnimations.delete(travel);
					element.style.zIndex = '';
				};
				activeAnimations.add(travel);
			} else {
				trackAnimation(element.animate(
					[
						{ transform: `translate(${deltaX}px, ${deltaY}px)` },
						{ transform: 'translate(0, 0)' }
					],
					{ duration: 480, easing: NEIGHBOR_EASING }
				));
			}
		});
	};

	createEffect(on(visiblePeople, (nextPeople: PresencePerson[] | undefined): void => {
		const next: PresencePerson[] = nextPeople ?? [];
		const previous: PresencePerson[] = untrack(displayPeople);
		const previousByKey: Map<string, PresencePerson> = new Map<string, PresencePerson>();

		for (const person of previous) {
			previousByKey.set(person.key, person);
		}

		const reconciled: PresencePerson[] = next.map((person: PresencePerson): PresencePerson => {
			const existing: PresencePerson | undefined = previousByKey.get(person.key);

			return existing && samePerson(existing, person) ? existing : person;
		});
		const movedKeys: Set<string> = new Set<string>();
		const changedAt: number = Date.now();
		let latestChange: StatusChange | undefined;

		for (const person of reconciled) {
			const existing: PresencePerson | undefined = previousByKey.get(person.key);

			if (existing && existing.group !== person.group) {
				movedKeys.add(person.key);
				sinceByKey.set(person.key, changedAt);
				latestChange = { key: person.key, name: person.name, label: person.label, at: changedAt };
			}
		}

		const nextKeys: Set<string> = new Set<string>(reconciled.map((person: PresencePerson): string => person.key));

		sinceByKey.forEach((_value: number, key: string): void => {
			if (!nextKeys.has(key)) {
				sinceByKey.delete(key);
			}
		});

		if (latestChange) {
			setLastChange(latestChange);
		}

		const previousLayout: PresenceLayout = selectLayout(previous.length);
		const nextLayout: PresenceLayout = selectLayout(reconciled.length);
		const zoneLayouts: boolean = (previousLayout === 'quadrant' || previousLayout === 'dense') &&
			(nextLayout === 'quadrant' || nextLayout === 'dense');

		if (movedKeys.size === 0 || !untrack(motionEnabled)) {
			setDisplayPeople(reconciled);

			return;
		}

		if (!zoneLayouts || !untrack(travelEnabled)) {
			setDisplayPeople(reconciled);
			// Solid flushes DOM after the effect batch; pulse the re-created elements a frame later.
			scheduleMotionFrame((): void => {
				movedKeys.forEach((key: string): void => pulseCard(key));
			});

			return;
		}

		const firstRects: Map<string, DOMRect> = captureRects();

		setDisplayPeople(reconciled);
		scheduleMotionFrame((): void => {
			animateZoneChanges(firstRects, movedKeys);
		});
	}));

	const statusText = (person: PresencePerson): string => {
		durationTick();

		const since: number | undefined = sinceByKey.get(person.key);

		return since ? `${person.label} · ${formatDuration(Date.now() - since)}` : person.label;
	};
	const featureDuration = (person: PresencePerson): string | undefined => {
		durationTick();

		const since: number | undefined = sinceByKey.get(person.key);

		return since ? `for ${formatDuration(Date.now() - since)}` : undefined;
	};

	onMount((): void => {
		if (rootRef && typeof ResizeObserver === 'function') {
			resizeObserver = new ResizeObserver((entries: ResizeObserverEntry[]): void => {
				const entry: ResizeObserverEntry | undefined = entries[0];

				if (entry) {
					setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
				}
			});
			resizeObserver.observe(rootRef);
		}

		if (rootRef) {
			setDimensions({ width: rootRef.clientWidth || 1920, height: rootRef.clientHeight || 1080 });
		}

		clockInterval = window.setInterval((): void => {
			setNow(new Date());
		}, 1000);
		tickInterval = window.setInterval((): void => {
			setDurationTick((value: number): number => value + 1);
		}, 15000);
	});

	onCleanup((): void => {
		resizeObserver?.disconnect();
		zoneObserver?.disconnect();

		if (motionFrame !== undefined) {
			window.cancelAnimationFrame(motionFrame);
		}

		if (clockInterval !== undefined) {
			window.clearInterval(clockInterval);
		}

		if (tickInterval !== undefined) {
			window.clearInterval(tickInterval);
		}

		activeAnimations.forEach((animation: Animation): void => animation.cancel());
		activeAnimations.clear();
		cardRefs.clear();
	});

	return (
		<div
			class={`wb-presence-app ${style['wb-app']} ${ratioClass()} ${sizeClass()}`}
			classList={{ 'wb-presence-narrow': dimensions().width < 900 }}
			data-preview-id="presence-root"
			data-host-ready={Boolean(props.hostElement)}
			data-layout={layout()}
			data-state={boardState()}
			data-motion={settings().motionPreset}
			data-theme={settings().themePreset}
			data-header={String(settings().showHeader)}
			data-ticker={String(settings().showTicker)}
			data-zones={String(zones().length)}
			data-people-count={String(displayPeople().length)}
			style={rootStyle()}
			ref={rootRef}
		>
			<Show when={settings().showHeader}>
				<header class="wb-presence-header">
					<div class="wb-presence-title-block">
						<h1 class="wb-presence-board-title">Team Presence</h1>
						<span class="wb-presence-scope" title={settings().scopeTitle}>/ {settings().scopeTitle}</span>
					</div>
					<div class="wb-presence-header-right">
						<span class="wb-presence-live"><i /><b>Live</b></span>
						<div class="wb-presence-date-block">
							<span class="wb-presence-weekday">{formatWeekday(now())}</span>
							<span class="wb-presence-date">{formatDate(now())}</span>
						</div>
						<span class="wb-presence-clock-time">{formatClockTime(now())}</span>
					</div>
				</header>
			</Show>

			<main class="wb-presence-body">
				<Switch>
					<Match when={boardState() === 'loading'}>
						<div class="wb-presence-empty" data-reason="loading">
							<span class="wb-presence-empty-kicker">Team Presence</span>
							<strong class="wb-presence-empty-title">Waiting for presence data…</strong>
						</div>
					</Match>
					<Match when={boardState() === 'malformed'}>
						<div class="wb-presence-empty" data-reason="malformed">
							<span class="wb-presence-empty-kicker">Team Presence</span>
							<strong class="wb-presence-empty-title">Presence data unavailable</strong>
							<p class="wb-presence-empty-hint">The bound datasource did not provide a users list.</p>
						</div>
					</Match>
					<Match when={boardState() === 'empty'}>
						<div class="wb-presence-empty" data-reason="empty">
							<span class="wb-presence-empty-kicker">Team Presence</span>
							<strong class="wb-presence-empty-title">No one to show</strong>
							<p class="wb-presence-empty-hint">Adjust the member filter or bind the presence datasource.</p>
						</div>
					</Match>
					<Match when={layout() === 'hero'}>
						<For each={displayPeople()}>
							{(person: PresencePerson): JSX.Element => (
								<section
									class="wb-presence-hero"
									data-group={person.group}
									data-person={person.key}
									ref={(element: HTMLElement): void => registerRef(person.key, element)}
								>
									<div class="wb-presence-feature-glow" />
									<WbPresenceAvatar person={person} feature={true} />
									<h2 class="wb-presence-hero-name" title={person.name}>{person.name}</h2>
									<p class="wb-presence-hero-status">{person.label}</p>
									<Show when={featureDuration(person)}>
										<p class="wb-presence-feature-for">{featureDuration(person)}</p>
									</Show>
								</section>
							)}
						</For>
					</Match>
					<Match when={layout() === 'compact'}>
						<div class="wb-presence-compact">
							<For each={displayPeople()}>
								{(person: PresencePerson): JSX.Element => (
									<section
										class="wb-presence-compact-panel"
										data-group={person.group}
										data-person={person.key}
										ref={(element: HTMLElement): void => registerRef(person.key, element)}
									>
										<div class="wb-presence-feature-glow" />
										<WbPresenceAvatar person={person} feature={true} />
										<h2 class="wb-presence-compact-name" title={person.name}>{person.name}</h2>
										<p class="wb-presence-compact-status">{person.label}</p>
										<Show when={featureDuration(person)}>
											<p class="wb-presence-feature-for">{featureDuration(person)}</p>
										</Show>
									</section>
								)}
							</For>
						</div>
					</Match>
					<Match when={boardState() === 'people'}>
						<div class="wb-presence-zones">
							<For each={zones()}>
								{(zone: PresenceZone): JSX.Element => (
									<section class="wb-presence-zone" data-zone={zone.group}>
										<header class="wb-presence-zone-header">
											<i class="wb-presence-zone-swatch" />
											<h2 class="wb-presence-zone-title">{zone.title}</h2>
											<span class="wb-presence-zone-count">{zone.people.length}</span>
										</header>
										<Show
											when={zone.people.length > 0}
											fallback={<div class="wb-presence-zone-empty">{zone.emptyLabel}</div>}
										>
											<div
												class="wb-presence-zone-cards"
												ref={(element: HTMLElement): void => observeZoneCards(zone.group, element)}
											>
												<For each={visibleZone(zone).people}>
													{(person: PresencePerson): JSX.Element => (
														<WbPresenceCard
															person={person}
															statusText={statusText}
															registerRef={registerRef}
															unregisterRef={unregisterRef}
														/>
													)}
												</For>
												<Show when={visibleZone(zone).hidden > 0}>
													<div class="wb-presence-more">
														<span class="wb-presence-more-disc">+{visibleZone(zone).hidden}</span>
														<span class="wb-presence-more-label">more</span>
													</div>
												</Show>
											</div>
										</Show>
									</section>
								)}
							</For>
						</div>
					</Match>
				</Switch>
			</main>

			<Show when={settings().showTicker}>
				<footer class="wb-presence-ticker">
					<span class="wb-presence-ticker-label">Last change</span>
					<Show
						when={lastChange()}
						fallback={<span class="wb-presence-ticker-text">Waiting for first status change…</span>}
					>
						{(change: Accessor<StatusChange>): JSX.Element => (
							<span class="wb-presence-ticker-text">
								<strong>{change().name}</strong> → {change().label} · {formatTickerTime(new Date(change().at))}
							</span>
						)}
					</Show>
				</footer>
			</Show>
		</div>
	);
};
