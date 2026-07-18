import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show, untrack } from 'solid-js';
import type { Accessor, JSX } from 'solid-js';

import { useDataSources } from '@hooks/system/useDataSources';
import { useAutoFitText } from '@hooks/system/useAutoFitText';
import { useSettings } from '@hooks/system/useSettings';

import type { DataSources, Settings } from '@interfaces/application.interface';

import { resolveMotion } from '@utils/motion';
import { createRotationController } from '@utils/rotation';
import { createTransitionController, type TransitionState } from '@utils/transition';

import style from '@components/wb-app/wb-app.module.scss';

import sampleDatasource from '../../../sample-datasource.json';

interface MenuItem {
	name: string;
	description: string;
	price: string;
	badge: string;
	featured: boolean;
	itemOrder: number;
}

interface MenuRow extends MenuItem {
	section: string;
	sectionOrder: number;
}

interface MenuSection {
	number: string;
	title: string;
	items: MenuItem[];
	continuation: boolean;
}

const ITEMS_PER_SECTION = 3;
const SECTIONS_PER_PAGE = 4;

const isRecord = (value: unknown): value is Record<string, unknown> => {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const parseValue = (value: unknown): unknown => {
	if (typeof value !== 'string') {
		return value;
	}

	try {
		return JSON.parse(value) as unknown;
	} catch {
		return value;
	}
};

const asUnknownArray = (value: unknown): unknown[] | undefined => {
	return Array.isArray(value) ? value.map((item: unknown): unknown => item) : undefined;
};

const extractRows = (rawValue: unknown): unknown[] | undefined => {
	const value: unknown = parseValue(rawValue);
	const directRows: unknown[] | undefined = asUnknownArray(value);

	if (directRows) {
		return directRows;
	}

	if (!isRecord(value)) {
		return undefined;
	}

	const selectedTableRows: unknown[] | undefined = asUnknownArray(value.rows);

	if (selectedTableRows) {
		return selectedTableRows;
	}

	const tableValue: unknown = parseValue(value.MenuItems);
	const tableRows: unknown[] | undefined = asUnknownArray(tableValue);

	if (tableRows) {
		return tableRows;
	}

	if (isRecord(tableValue)) {
		return asUnknownArray(tableValue.rows);
	}

	return undefined;
};

const toText = (value: unknown): string => {
	return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
};

const toOrder = (value: unknown, fallback: number): number => {
	const numberValue: number = Number(value);

	return Number.isFinite(numberValue) ? numberValue : fallback;
};

const toBoolean = (value: unknown, fallback: boolean): boolean => {
	if (value === undefined || value === null || value === '') {
		return fallback;
	}

	return value !== false && value !== 0 && value !== 'false';
};

const normalizeRows = (rows: unknown[]): MenuRow[] => {
	return rows
		.map((rawRow: unknown, index: number): MenuRow | undefined => {
			if (!isRecord(rawRow)) {
				return undefined;
			}

			const section: string = toText(rawRow.section);
			const name: string = toText(rawRow.name);

			if (!section || !name || !toBoolean(rawRow.available, true)) {
				return undefined;
			}

			return {
				section,
				sectionOrder: toOrder(rawRow.sectionOrder, index + 1),
				itemOrder: toOrder(rawRow.itemOrder, index + 1),
				name,
				description: toText(rawRow.description),
				price: toText(rawRow.price),
				badge: toText(rawRow.badge),
				featured: toBoolean(rawRow.featured, false)
			};
		})
		.filter((row: MenuRow | undefined): row is MenuRow => Boolean(row));
};

function chunk<T>(items: T[], size: number): T[][] {
	const chunks: T[][] = [];

	for (let index = 0; index < items.length; index += size) {
		chunks.push(items.slice(index, index + size));
	}

	return chunks;
}

const formatSectionNumber = (index: number): string => {
	return index < 9 ? `0${index + 1}` : String(index + 1);
};

const createSections = (rows: MenuRow[]): MenuSection[] => {
	const grouped: Map<string, { title: string; order: number; items: MenuItem[] }> = new Map();

	for (const row of rows) {
		const group = grouped.get(row.section) ?? {
			title: row.section,
			order: row.sectionOrder,
			items: []
		};

		group.order = Math.min(group.order, row.sectionOrder);
		group.items.push({
			name: row.name,
			description: row.description,
			price: row.price,
			badge: row.badge,
			featured: row.featured,
			itemOrder: row.itemOrder
		});
		grouped.set(row.section, group);
	}

	const groups = Array.from(grouped.values()).sort((left, right): number => left.order - right.order);
	const sections: MenuSection[] = [];

	groups.forEach((group, sectionIndex): void => {
		const sortedItems = group.items.sort((left, right): number => left.itemOrder - right.itemOrder);

		chunk(sortedItems, ITEMS_PER_SECTION).forEach((items, chunkIndex): void => {
			sections.push({
				number: formatSectionNumber(sectionIndex),
				title: group.title,
				items,
				continuation: chunkIndex > 0
			});
		});
	});

	return sections;
};

const MenuCategory = (props: { section: MenuSection }): JSX.Element => (
	<section class="wb-restaurant-menu-category">
		<header>
			<span>{props.section.number}</span>
			<h2>{props.section.title}</h2>
			<Show when={props.section.continuation}><small>continued</small></Show>
		</header>
		<div class="wb-restaurant-menu-category__items">
			<For each={props.section.items}>
				{(item: MenuItem): JSX.Element => (
					<div class="wb-restaurant-menu-item" classList={{ 'wb-restaurant-menu-item--featured': item.featured }}>
						<div class="wb-restaurant-menu-item__line">
							<strong>{item.name}</strong>
							<Show when={item.badge}><span class="wb-restaurant-menu-item__badge">{item.badge}</span></Show>
							<i />
							<b>{item.price}</b>
						</div>
						<p>{item.description}</p>
					</div>
				)}
			</For>
		</div>
	</section>
);

const getClock = (): { day: string; time: string } => {
	const now: Date = new Date();

	return {
		day: new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(now),
		time: new Intl.DateTimeFormat('en-US', {
			hour: '2-digit',
			minute: '2-digit',
			hour12: false
		}).format(now)
	};
};

export default (props: { hostElement: HTMLDivElement }): JSX.Element => {
	let transitionInitialized = false;
	const dataSources: Accessor<DataSources> = useDataSources();
	const settings: Accessor<Settings> = useSettings();
	const fitRestaurantName = useAutoFitText({
		minFontSize: 18,
		maxFontSize: 50,
		widthOnly: true,
		watch: (): string => settings().restaurantName
	});
	const [clock, setClock] = createSignal<{ day: string; time: string }>(getClock());
	const [pageIndex, setPageIndex] = createSignal<number>(0);
	const [transitionState, setTransitionState] = createSignal<TransitionState>({
		currentKey: 'initial',
		previousKey: null,
		transitioning: false
	});
	const rotation = createRotationController((_key: string, index: number): void => {
		setPageIndex(index);
	});
	const transition = createTransitionController('initial', setTransitionState);
	const rawData: Accessor<unknown> = createMemo((): unknown => dataSources().menuData?.value);
	const hasBoundDatasource: Accessor<boolean> = createMemo((): boolean => {
		return Object.prototype.hasOwnProperty.call(dataSources(), 'menuData');
	});
	const rows: Accessor<MenuRow[]> = createMemo((): MenuRow[] => {
		const sourceRows = hasBoundDatasource() ? extractRows(rawData()) ?? [] : extractRows(sampleDatasource) ?? [];

		return normalizeRows(sourceRows);
	});
	const pages: Accessor<MenuSection[][]> = createMemo((): MenuSection[][] => {
		return chunk(createSections(rows()), SECTIONS_PER_PAGE);
	});
	const pageKeys: Accessor<string[]> = createMemo((): string[] => pages().map((page: MenuSection[], index: number): string => {
		const first: MenuSection | undefined = page[0];

		return first ? `${first.number}|${first.title}` : `page-${index}`;
	}));
	const pageCount: Accessor<number> = createMemo((): number => Math.max(pages().length, 1));
	const currentSections: Accessor<MenuSection[]> = createMemo((): MenuSection[] => {
		return pages()[pageIndex() % pageCount()] ?? [];
	});
	const sectionRows: Accessor<MenuSection[][]> = createMemo((): MenuSection[][] => {
		return chunk(currentSections(), 2);
	});
	const themeStyle: Accessor<JSX.CSSProperties> = createMemo((): JSX.CSSProperties => ({
		'--wb-restaurant-menu-background': settings().backgroundColor,
		'--wb-restaurant-menu-header-background': settings().headerBackgroundColor,
		'--wb-restaurant-menu-header-text': settings().headerTextColor,
		'--wb-restaurant-menu-story-background': settings().storyBackgroundColor,
		'--wb-restaurant-menu-story-text': settings().storyTextColor,
		'--wb-restaurant-menu-primary': settings().primaryTextColor,
		'--wb-restaurant-menu-secondary': settings().secondaryTextColor,
		'--wb-restaurant-menu-accent': settings().accentColor,
		'--wb-restaurant-menu-accent-text': settings().accentTextColor,
		'--wb-restaurant-menu-line': settings().lineColor,
		'--wb-restaurant-menu-featured': settings().featuredColor,
		'--wb-restaurant-menu-motion-duration': `${resolveMotion(settings().motionPreset).durationMs}ms`,
		'--wb-restaurant-menu-motion-distance': `${resolveMotion(settings().motionPreset).distancePx}px`,
		'--wb-restaurant-menu-motion-easing': resolveMotion(settings().motionPreset).easing
	}));

	onMount((): void => {
		const intervalId: number = window.setInterval((): void => {
			setClock(getClock());
		}, 30000);

		onCleanup((): void => window.clearInterval(intervalId));
	});

	createEffect((): void => {
		const keys: string[] = pageKeys();

		rotation.sync(keys, untrack((): string | undefined => keys[pageIndex()]), settings().pageDurationSeconds * 1000);
	});

	createEffect((): void => {
		const keys: string[] = pageKeys();
		const key: string = keys[pageIndex()] ?? 'empty';
		const motion = resolveMotion(settings().motionPreset);

		transition.select(key, {
			enabled: transitionInitialized && motion.enabled,
			durationMs: motion.durationMs
		});
		transitionInitialized = true;
	});

	onCleanup((): void => rotation.destroy());
	onCleanup((): void => transition.destroy());

	return (
		<div
			class={`wb-restaurant-menu-root ${style['wb-app']}`}
			data-host-ready={Boolean(props.hostElement)}
			data-motion-preset={settings().motionPreset}
			data-transitioning={String(transitionState().transitioning)}
			style={themeStyle()}
		>
			<header class="wb-restaurant-menu-header">
				<div class="wb-restaurant-menu-brand">
					<span>{settings().restaurantName.charAt(0)}</span>
					<div><small>{settings().restaurantLabel}</small><h1 ref={fitRestaurantName}>{settings().restaurantName}</h1></div>
				</div>
				<div class="wb-restaurant-menu-edition">
					<strong>{settings().editionTitle}</strong>
					<span>{settings().editionSubtitle}</span>
					<Show when={pageCount() > 1}><em>{pageIndex() + 1} / {pageCount()}</em></Show>
				</div>
				<time>
					<span>{clock().day}</span>
					<strong>{clock().time}</strong>
				</time>
			</header>

			<main>
				<aside class="wb-restaurant-menu-story">
					<div>
						<span>{settings().storyEyebrow}</span>
						<h2>{settings().storyTitle}</h2>
						<p>{settings().storyDescription}</p>
					</div>
					<section>
						<small>{settings().courseLabel}</small>
						<strong>{settings().courseName}</strong>
						<b>{settings().coursePrice}</b>
					</section>
					<footer>
						<span>{settings().closingText}</span>
						<span>{settings().allergenText}</span>
					</footer>
				</aside>

				<div class="wb-restaurant-menu-board">
					<Show when={currentSections().length > 0} fallback={<div class="wb-restaurant-menu-empty">{settings().emptyStateText}</div>}>
						<For each={sectionRows()}>
							{(row: MenuSection[]): JSX.Element => (
								<div class="wb-restaurant-menu-board__row" classList={{ 'wb-restaurant-menu-board__row--single': row.length === 1 }}>
									<For each={row}>{(section: MenuSection): JSX.Element => <MenuCategory section={section} />}</For>
								</div>
							)}
						</For>
					</Show>
				</div>
			</main>
		</div>
	);
};
