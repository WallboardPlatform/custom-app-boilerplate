import { createEffect, createMemo, createSignal, createUniqueId, onCleanup, onMount, Show } from 'solid-js';
import type { Accessor, JSX } from 'solid-js';
import WbDirectoryIcon from '@components/wb-directory-icon/wb-directory-icon';

import { useDataSources } from '@hooks/system/useDataSources';
import { useExternalCommandListener } from '@hooks/system/useExternalCommandListener';
import { useSettings } from '@hooks/system/useSettings';

import type { DataSources, Settings } from '@interfaces/application.interface';
import type {
	AutoplayAdvance,
	AutoplayFrame,
	CategoryDataState,
	DirectoryCategory,
	DirectoryDataState,
	DonorRecord,
	DonorSearchResult
} from '@interfaces/donor-directory.interface';

import WbCategoryNavigation from '@components/wb-category-navigation/wb-category-navigation';
import type { CategoryNavigationItem } from '@components/wb-category-navigation/wb-category-navigation';
import WbDirectoryHeader from '@components/wb-directory-header/wb-directory-header';
import WbDonorGrid from '@components/wb-donor-grid/wb-donor-grid';
import WbLetterKeyboard from '@components/wb-letter-keyboard/wb-letter-keyboard';
import type { DirectoryDensity, DonorGridItem } from '@components/wb-donor-grid/wb-donor-grid';

import {
	ALL_CATEGORY_KEY,
	advanceAutoplayFrame,
	autoplayFrameAt,
	buildAutoplayFrames,
	buildDirectoryCategories,
	clampDirectoryPageIndex,
	normalizeCategoryData,
	normalizeDonorData,
	rankDonorsForSearch,
	titleCaseSearchQuery
} from '@utils/donor-directory';

import style from '@components/wb-app/wb-app.module.scss';
import backgroundAssetUrl from '../../assets/donor-directory-mint-background.jpg';

type DirectoryLayout = 'landscape' | 'portrait' | 'square';

interface DirectorySize {
	height: number;
	width: number;
}

interface DirectoryDensityMetrics {
	field1Size: number;
	field2Size: number;
	field3Size: number;
	mode: DirectoryDensity;
	rowGap: number;
	rowPadding: number;
}

interface ExternalCommand {
	getCommand: () => string;
	getParameter: (parameterName: string) => string | number | boolean | undefined;
}

const hasOwn = (value: object, key: string): boolean => {
	return Object.prototype.hasOwnProperty.call(value, key);
};

const parseCommandDuration = (value: unknown, fallback: number): number => {
	const numericValue: number =
		typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN;

	return Number.isFinite(numericValue) && numericValue >= 3 && numericValue <= 120
		? Math.round(numericValue)
		: fallback;
};

const cssBackgroundImage = (value: string): string => {
	return value ? `url(${JSON.stringify(value)})` : 'none';
};

const directoryLayout = (size: DirectorySize): DirectoryLayout => {
	if (size.height > size.width * 1.16) {
		return 'portrait';
	}

	if (size.width < size.height * 1.26) {
		return 'square';
	}

	return 'landscape';
};

const effectiveColumnCount = (configuredColumns: number, layout: DirectoryLayout, width: number): number => {
	if (layout === 'portrait') {
		return Math.min(configuredColumns, 3);
	}

	if (layout === 'square') {
		return Math.min(configuredColumns, 2);
	}

	return Math.min(configuredColumns, width < 1180 ? 2 : width < 1540 ? 3 : 4);
};

const directoryDensityMetrics = (
	entriesPerColumn: number,
	surfaceHeight: number,
	settings: Settings
): DirectoryDensityMetrics => {
	const entries: number = Math.max(1, Math.min(20, entriesPerColumn));
	const mode: DirectoryDensity = surfaceHeight < 680 || entries > 12 ? 'dense' : entries <= 6 ? 'spacious' : 'compact';
	const densityScale: number =
		entries <= 6 ? 1 : entries <= 12 ? 1 - ((entries - 6) / 6) * 0.25 : 0.75 - ((entries - 12) / 8) * 0.12;
	const surfaceScale: number = surfaceHeight < 560 ? 0.68 : surfaceHeight < 680 ? 0.72 : surfaceHeight < 760 ? 0.84 : 1;
	const scale: number = densityScale * surfaceScale;
	const baseRowPadding: number = entries <= 6 ? 10 : entries <= 12 ? 9 - (entries - 6) : 3 - (entries - 12) * 0.125;
	const rowPadding: number =
		surfaceHeight < 560
			? Math.min(baseRowPadding, 1)
			: surfaceHeight < 680
				? Math.min(baseRowPadding, 2)
				: surfaceHeight < 760
					? Math.min(baseRowPadding, 5)
					: baseRowPadding;
	const rowGap: number = surfaceHeight < 560 ? 1 : surfaceHeight < 680 ? 2 : entries <= 6 ? 8 : entries <= 12 ? 5 : 2;

	return {
		mode,
		field1Size: Math.max(18, Math.round(settings.entryField1MaxFontSize * scale)),
		field2Size: Math.max(14, Math.round(settings.entryField2MaxFontSize * scale)),
		field3Size: Math.max(11, Math.round(settings.entryField3MaxFontSize * scale)),
		rowPadding: Math.max(surfaceHeight < 560 ? 1 : 2, Math.round(rowPadding)),
		rowGap
	};
};

function splitIntoColumns<T>(items: readonly T[], columnCount: number, entriesPerColumn: number): T[][] {
	const activeColumnCount: number = Math.min(columnCount, Math.max(1, items.length));
	const minimumColumnSize: number = Math.floor(items.length / activeColumnCount);
	const largerColumnCount: number = items.length % activeColumnCount;
	let offset = 0;

	return Array.from({ length: columnCount }, (_value: unknown, columnIndex: number): T[] => {
		if (columnIndex >= activeColumnCount) {
			return [];
		}

		const columnSize: number = Math.min(
			entriesPerColumn,
			minimumColumnSize + (columnIndex < largerColumnCount ? 1 : 0)
		);
		const columnItems: T[] = items.slice(offset, offset + columnSize);

		offset += columnSize;

		return columnItems;
	});
}

const formatClock = (now: Date, settings: Settings): { dateText: string; timeText: string } => {
	const timeZone: string | undefined = settings.timeZone || undefined;
	let dateText = '';
	let timeText = '';

	try {
		if (settings.dateFormat !== 'none') {
			const dateOptions: Intl.DateTimeFormatOptions =
				settings.dateFormat === 'short'
					? {
							weekday: 'short',
							month: 'short',
							day: 'numeric',
							timeZone
						}
					: {
							weekday: 'long',
							month: 'long',
							day: 'numeric',
							year: 'numeric',
							timeZone
						};

			dateText = new Intl.DateTimeFormat(settings.numberLocale, dateOptions).format(now);
		}

		if (settings.timeFormat !== 'none') {
			timeText = new Intl.DateTimeFormat(settings.numberLocale, {
				hour: 'numeric',
				minute: '2-digit',
				hour12: settings.timeFormat === '12-hour',
				timeZone
			}).format(now);
		}
	} catch {
		dateText = settings.dateFormat === 'none' ? '' : now.toLocaleDateString();
		timeText = settings.timeFormat === 'none' ? '' : now.toLocaleTimeString();
	}

	return { dateText, timeText };
};

const stateMessage = (state: DirectoryDataState, settings: Settings): string => {
	if (state.status === 'unbound') {
		return 'Connect the donorData property to the intended internal donor TABLE.';
	}

	if (state.status === 'invalid') {
		return `The donor datasource or field mapping is not valid (${state.issue || 'unknown issue'}).`;
	}

	return settings.emptyStateText;
};

export default (props: { hostElement: HTMLDivElement }): JSX.Element => {
	const settings: Accessor<Settings> = useSettings();
	const dataSources = useDataSources() as Accessor<DataSources>;
	const searchInputId: string = createUniqueId();
	const [size, setSize] = createSignal<DirectorySize>({ width: 1920, height: 1080 });
	const [now, setNow] = createSignal(new Date());
	const [selectedCategoryKey, setSelectedCategoryKey] = createSignal(ALL_CATEGORY_KEY);
	const [pageIndex, setPageIndex] = createSignal(0);
	const [searchQuery, setSearchQuery] = createSignal('');
	const [searchFocused, setSearchFocused] = createSignal(false);
	const [keyboardOpen, setKeyboardOpen] = createSignal(false);
	const [autoplayActive, setAutoplayActive] = createSignal(false);
	const [autoplayDurationSeconds, setAutoplayDurationSeconds] = createSignal(8);
	const [autoplayFrameIndex, setAutoplayFrameIndex] = createSignal(0);
	const [autoplayGeneration, setAutoplayGeneration] = createSignal(0);
	let autoplayTimer: number | undefined;
	let autoplayGenerationToken = 0;
	let autoplayFrameStructure = '';
	let searchInputRef: HTMLInputElement | undefined;

	const donorBound = createMemo((): boolean => hasOwn(dataSources(), 'donorData'));
	const categoryBound = createMemo((): boolean => hasOwn(dataSources(), 'categoryData'));
	const donorState = createMemo((): DirectoryDataState =>
		normalizeDonorData(donorBound() ? dataSources().donorData?.value : undefined, {
			donorTableName: settings().donorTableName,
			categoryColumn: settings().categoryColumn,
			entryField1Column: settings().entryField1Column,
			entryField2Column: settings().entryField2Column,
			entryField3Column: settings().entryField3Column,
			sortColumn: settings().sortColumn,
			sortDirection: settings().sortDirection,
			numberLocale: settings().numberLocale,
			formatNumberColumnsAsCurrency: settings().formatNumberColumnsAsCurrency,
			currencySymbol: settings().currencySymbol
		})
	);
	const categoryState = createMemo((): CategoryDataState =>
		normalizeCategoryData(categoryBound() ? dataSources().categoryData?.value : undefined, {
			categoryTableName: settings().categoryTableName,
			categoryKeyColumn: settings().categoryKeyColumn,
			categoryLabelColumn: settings().categoryLabelColumn,
			categoryDescriptionColumn: settings().categoryDescriptionColumn,
			categoryOrderColumn: settings().categoryOrderColumn,
			numberLocale: settings().numberLocale
		})
	);
	const categories = createMemo((): DirectoryCategory[] =>
		buildDirectoryCategories(
			donorState().records,
			categoryState().status === 'ready' ? categoryState().metadata : [],
			settings().allLabel,
			settings().numberLocale
		)
	);
	const layout = createMemo((): DirectoryLayout => directoryLayout(size()));
	const columns = createMemo((): number => effectiveColumnCount(settings().directoryColumns, layout(), size().width));
	const keyboardAvailable = createMemo((): boolean => settings().showKeyboard);
	const entriesPerColumn = createMemo((): number => settings().entriesPerColumn);
	const backgroundImage = createMemo((): string => {
		if (settings().backgroundImage) {
			return settings().backgroundImage;
		}

		return settings().themePreset === 'dark' ? '' : backgroundAssetUrl;
	});
	const densityMetrics = createMemo((): DirectoryDensityMetrics =>
		directoryDensityMetrics(entriesPerColumn(), size().height, settings())
	);
	const searchActive = createMemo((): boolean => searchQuery().trim() !== '');
	const searchResults = createMemo((): DonorSearchResult[] => rankDonorsForSearch(donorState().records, searchQuery()));
	const activeCategory = createMemo((): DirectoryCategory => {
		const category: DirectoryCategory | undefined = categories().find(
			(candidate: DirectoryCategory): boolean => candidate.key === selectedCategoryKey()
		);

		return category || categories()[0];
	});
	const visibleDonors = createMemo((): DonorRecord[] => {
		return searchActive()
			? searchResults().map((result: DonorSearchResult): DonorRecord => result.donor)
			: activeCategory().donors;
	});
	const pageCapacity = createMemo((): number => columns() * entriesPerColumn());
	const pageCount = createMemo((): number => {
		return visibleDonors().length === 0 ? 0 : Math.ceil(visibleDonors().length / pageCapacity());
	});
	const pageDonors = createMemo((): DonorRecord[] => {
		const index: number = clampDirectoryPageIndex(pageIndex(), pageCount());
		const start: number = index * pageCapacity();

		return visibleDonors().slice(start, start + pageCapacity());
	});
	const categoryLabelByKey = createMemo((): Record<string, string> => {
		const labels: Record<string, string> = Object.create(null) as Record<string, string>;

		for (const category of categories()) {
			labels[category.key] = category.label;
		}

		return labels;
	});
	const donorGridItems = createMemo((): DonorGridItem[] =>
		pageDonors().map((donor: DonorRecord): DonorGridItem => ({
			key: donor.id,
			categoryLabel: categoryLabelByKey()[donor.categoryKey] || donor.category,
			field1Text: donor.field1Text,
			field2Text: donor.field2Text,
			field3Text: donor.field3Text
		}))
	);
	const donorColumns = createMemo((): DonorGridItem[][] =>
		splitIntoColumns(donorGridItems(), columns(), entriesPerColumn())
	);
	const navigationItems = createMemo((): CategoryNavigationItem[] =>
		categories().map((category: DirectoryCategory): CategoryNavigationItem => ({
			key: category.key,
			label: category.label,
			description: category.description,
			count: category.donorCount
		}))
	);
	const bestMatchKey = createMemo((): string => {
		const bestMatch: DonorSearchResult | undefined = searchResults().find(
			(result: DonorSearchResult): boolean => result.isBestMatch
		);

		return bestMatch ? bestMatch.donor.id : '';
	});
	const autoplayFrames = createMemo((): AutoplayFrame[] =>
		buildAutoplayFrames(categories(), columns(), entriesPerColumn())
	);
	const clock = createMemo((): { dateText: string; timeText: string } => {
		return formatClock(now(), settings());
	});
	const emptyText = createMemo((): string => {
		if (donorState().status !== 'ready') {
			return stateMessage(donorState(), settings());
		}

		return searchActive() ? settings().noResultsText : settings().emptyStateText;
	});
	const activeHeading = createMemo((): { description: string; label: string } => {
		if (!searchActive()) {
			return {
				label: activeCategory().label,
				description: activeCategory().description
			};
		}

		return {
			label: `Search results for “${searchQuery().trim()}”`,
			description: `${visibleDonors().length} matching donor${visibleDonors().length === 1 ? '' : 's'} across all categories`
		};
	});
	const themeStyle = createMemo((): JSX.CSSProperties => ({
		'--wb-donor-directory-background': settings().backgroundColor,
		'--wb-donor-directory-header-background': settings().headerBackgroundColor,
		'--wb-donor-directory-header-text': settings().headerTextColor,
		'--wb-donor-directory-panel': settings().panelColor,
		'--wb-donor-directory-primary-text': settings().primaryTextColor,
		'--wb-donor-directory-secondary-text': settings().secondaryTextColor,
		'--wb-donor-directory-entry-field-1-text': settings().entryField1TextColor,
		'--wb-donor-directory-entry-field-2-text': settings().entryField2TextColor,
		'--wb-donor-directory-entry-field-3-text': settings().entryField3TextColor,
		'--wb-donor-directory-category-button-description-text': settings().categoryButtonDescriptionTextColor,
		'--wb-donor-directory-active-category-description-text': settings().activeCategoryDescriptionTextColor,
		'--wb-donor-directory-category-button': settings().categoryButtonColor,
		'--wb-donor-directory-category-button-text': settings().categoryButtonTextColor,
		'--wb-donor-directory-category-active': settings().categoryActiveColor,
		'--wb-donor-directory-category-active-text': settings().categoryActiveTextColor,
		'--wb-donor-directory-card': settings().donorCardColor,
		'--wb-donor-directory-card-border': settings().donorCardBorderColor,
		'--wb-donor-directory-search-background': settings().searchBackgroundColor,
		'--wb-donor-directory-search-text': settings().searchTextColor,
		'--wb-donor-directory-search-border': settings().searchBorderColor,
		'--wb-donor-directory-accent': settings().accentColor,
		'--wb-donor-directory-accent-text': settings().accentTextColor,
		'--wb-donor-directory-keyboard-key': settings().keyboardKeyColor,
		'--wb-donor-directory-keyboard-text': settings().keyboardKeyTextColor,
		'--wb-donor-directory-keyboard-background': settings().keyboardBackgroundColor,
		'--wb-donor-directory-rule': settings().donorCardBorderColor,
		'--wb-donor-directory-background-image': cssBackgroundImage(backgroundImage()),
		'--wb-donor-directory-background-overlay': settings().backgroundOverlayColor,
		'--wb-donor-directory-background-overlay-opacity': String(settings().backgroundOverlayOpacity / 100),
		'--wb-donor-directory-display-font': settings().displayFont.family,
		'--wb-donor-directory-display-font-style': settings().displayFont.style,
		'--wb-donor-directory-display-font-weight': settings().displayFont.weight,
		'--wb-donor-directory-display-text-decoration': settings().displayFont.decoration,
		'--wb-donor-directory-title-size': `${settings().titleFontSize}px`,
		'--wb-donor-directory-interface-font': settings().interfaceFont.family,
		'--wb-donor-directory-interface-font-style': settings().interfaceFont.style,
		'--wb-donor-directory-interface-font-weight': settings().interfaceFont.weight,
		'--wb-donor-directory-interface-text-decoration': settings().interfaceFont.decoration,
		'--wb-donor-directory-category-font': settings().categoryFont.family,
		'--wb-donor-directory-category-font-style': settings().categoryFont.style,
		'--wb-donor-directory-category-font-weight': settings().categoryFont.weight,
		'--wb-donor-directory-category-text-decoration': settings().categoryFont.decoration,
		'--wb-donor-directory-category-max-font-size': `${settings().categoryMaxFontSize}px`,
		'--wb-donor-directory-category-button-description-font': settings().categoryButtonDescriptionFont.family,
		'--wb-donor-directory-category-button-description-font-style': settings().categoryButtonDescriptionFont.style,
		'--wb-donor-directory-category-button-description-font-weight': settings().categoryButtonDescriptionFont.weight,
		'--wb-donor-directory-category-button-description-text-decoration':
			settings().categoryButtonDescriptionFont.decoration,
		'--wb-donor-directory-category-button-description-size': `${settings().categoryButtonDescriptionMaxFontSize}px`,
		'--wb-donor-directory-active-category-description-font': settings().activeCategoryDescriptionFont.family,
		'--wb-donor-directory-active-category-description-font-style': settings().activeCategoryDescriptionFont.style,
		'--wb-donor-directory-active-category-description-font-weight': settings().activeCategoryDescriptionFont.weight,
		'--wb-donor-directory-active-category-description-text-decoration':
			settings().activeCategoryDescriptionFont.decoration,
		'--wb-donor-directory-active-category-description-size': `${settings().activeCategoryDescriptionMaxFontSize}px`,
		'--wb-donor-directory-all-label-font-size': `${settings().allLabelFontSize}px`,
		'--wb-donor-directory-entry-field-1-font': settings().entryField1Font.family,
		'--wb-donor-directory-entry-field-1-font-style': settings().entryField1Font.style,
		'--wb-donor-directory-entry-field-1-font-weight': settings().entryField1Font.weight,
		'--wb-donor-directory-entry-field-1-text-decoration': settings().entryField1Font.decoration,
		'--wb-donor-directory-entry-field-1-size': `${densityMetrics().field1Size}px`,
		'--wb-donor-directory-entry-field-2-font': settings().entryField2Font.family,
		'--wb-donor-directory-entry-field-2-font-style': settings().entryField2Font.style,
		'--wb-donor-directory-entry-field-2-font-weight': settings().entryField2Font.weight,
		'--wb-donor-directory-entry-field-2-text-decoration': settings().entryField2Font.decoration,
		'--wb-donor-directory-entry-field-2-size': `${densityMetrics().field2Size}px`,
		'--wb-donor-directory-entry-field-3-font': settings().entryField3Font.family,
		'--wb-donor-directory-entry-field-3-font-style': settings().entryField3Font.style,
		'--wb-donor-directory-entry-field-3-font-weight': settings().entryField3Font.weight,
		'--wb-donor-directory-entry-field-3-text-decoration': settings().entryField3Font.decoration,
		'--wb-donor-directory-entry-field-3-size': `${densityMetrics().field3Size}px`,
		'--wb-donor-directory-row-padding': `${densityMetrics().rowPadding}px`,
		'--wb-donor-directory-row-gap': `${densityMetrics().rowGap}px`,
		'--wb-donor-directory-row-max-height':
			settings().maximumRowHeight > 0 ? `${settings().maximumRowHeight}px` : 'none',
		'--wb-donor-directory-radius': `${settings().cornerRadius}px`,
		'--wb-donor-directory-radius-small': `${Math.max(0, settings().cornerRadius * 0.72)}px`
	}));

	const clearAutoplayTimer = (): void => {
		if (autoplayTimer !== undefined) {
			window.clearTimeout(autoplayTimer);
			autoplayTimer = undefined;
		}
	};
	const stopAutoplay = (): void => {
		clearAutoplayTimer();
		autoplayGenerationToken += 1;
		setAutoplayActive(false);
	};
	const openKeyboard = (): void => {
		if (keyboardAvailable()) {
			setKeyboardOpen(true);
		}
	};
	const closeKeyboard = (): void => {
		setKeyboardOpen(false);
		setSearchFocused(false);
		searchInputRef?.blur();
	};
	const toggleKeyboard = (button?: HTMLButtonElement): void => {
		if (!keyboardAvailable()) {
			return;
		}

		if (keyboardOpen()) {
			closeKeyboard();
			button?.blur();
		} else {
			setKeyboardOpen(true);
			searchInputRef?.focus();
		}
	};
	const selectCategory = (key: string): void => {
		stopAutoplay();
		closeKeyboard();
		setSearchQuery('');
		setSelectedCategoryKey(key);
		setPageIndex(0);
	};
	const resetExperience = (): void => {
		stopAutoplay();
		closeKeyboard();
		setSearchQuery('');
		setSelectedCategoryKey(ALL_CATEGORY_KEY);
		setPageIndex(0);
		setAutoplayFrameIndex(0);
		setAutoplayDurationSeconds(settings().autoplayIntervalSeconds);
	};
	const updateSearch = (value: string): void => {
		stopAutoplay();
		setSelectedCategoryKey(ALL_CATEGORY_KEY);
		setPageIndex(0);
		setSearchQuery(titleCaseSearchQuery(value).slice(0, 80));
	};
	const showPreviousPage = (): void => {
		stopAutoplay();
		setPageIndex((current: number): number => Math.max(0, current - 1));
	};
	const showNextPage = (): void => {
		stopAutoplay();
		setPageIndex((current: number): number => Math.min(Math.max(0, pageCount() - 1), current + 1));
	};
	const startAutoplay = (durationValue: unknown): void => {
		const frames: AutoplayFrame[] = autoplayFrames();

		clearAutoplayTimer();

		if (frames.length === 0) {
			setAutoplayActive(false);

			return;
		}

		setSearchQuery('');
		closeKeyboard();
		setAutoplayDurationSeconds(parseCommandDuration(durationValue, settings().autoplayIntervalSeconds));
		setAutoplayFrameIndex(0);
		autoplayGenerationToken += 1;
		setAutoplayGeneration(autoplayGenerationToken);
		setAutoplayActive(true);
	};
	const handleRootClick = (event: MouseEvent): void => {
		if (autoplayActive()) {
			stopAutoplay();
		}

		if (!keyboardOpen()) {
			return;
		}

		const target: EventTarget | null = event.target;

		if (
			target instanceof Element &&
			(target.closest('[data-keyboard-panel]') || target.closest('[data-search-region]'))
		) {
			return;
		}

		closeKeyboard();
	};

	createEffect((): void => {
		if (!keyboardAvailable() && keyboardOpen()) {
			closeKeyboard();
		}
	});

	createEffect((): void => {
		const availableCategories: DirectoryCategory[] = categories();
		const selectedExists: boolean = availableCategories.some(
			(category: DirectoryCategory): boolean => category.key === selectedCategoryKey()
		);

		if (!selectedExists) {
			setSelectedCategoryKey(ALL_CATEGORY_KEY);
			setPageIndex(0);
		}
	});

	createEffect((): void => {
		const clampedIndex: number = clampDirectoryPageIndex(pageIndex(), pageCount());

		if (clampedIndex !== pageIndex()) {
			setPageIndex(clampedIndex);
		}
	});

	createEffect((): void => {
		const frames: AutoplayFrame[] = autoplayFrames();
		const nextStructure: string = JSON.stringify(
			frames.map((frame: AutoplayFrame): [string, number] => [frame.categoryKey, frame.pageIndex])
		);
		const structureChanged: boolean = nextStructure !== autoplayFrameStructure;

		autoplayFrameStructure = nextStructure;

		if (!autoplayActive()) {
			return;
		}

		let nextFrameIndex: number = clampDirectoryPageIndex(autoplayFrameIndex(), frames.length);

		if (structureChanged && frames.length > 0) {
			const selectedKey: string = selectedCategoryKey();
			const selectedPageIndex: number = pageIndex();
			const exactFrameIndex: number = frames.findIndex(
				(frame: AutoplayFrame): boolean => frame.categoryKey === selectedKey && frame.pageIndex === selectedPageIndex
			);

			if (exactFrameIndex >= 0) {
				nextFrameIndex = exactFrameIndex;
			} else {
				const sameCategoryFrames: AutoplayFrame[] = frames.filter(
					(frame: AutoplayFrame): boolean => frame.categoryKey === selectedKey
				);

				if (sameCategoryFrames.length > 0) {
					const clampedPageIndex: number = clampDirectoryPageIndex(selectedPageIndex, sameCategoryFrames.length);
					const sameCategoryFrameIndex: number = frames.findIndex(
						(frame: AutoplayFrame): boolean => frame.categoryKey === selectedKey && frame.pageIndex === clampedPageIndex
					);

					nextFrameIndex = sameCategoryFrameIndex >= 0 ? sameCategoryFrameIndex : 0;
				} else {
					nextFrameIndex = 0;
				}
			}

			if (nextFrameIndex !== autoplayFrameIndex()) {
				setAutoplayFrameIndex(nextFrameIndex);

				return;
			}
		}

		const frame: AutoplayFrame | null = autoplayFrameAt(frames, nextFrameIndex);

		if (!frame) {
			stopAutoplay();

			return;
		}

		setSelectedCategoryKey(frame.categoryKey);
		setPageIndex(frame.pageIndex);
	});

	createEffect((): void => {
		clearAutoplayTimer();
		const generation: number = autoplayGeneration();

		if (!autoplayActive()) {
			return;
		}

		const frames: AutoplayFrame[] = autoplayFrames();
		const currentFrameIndex: number = clampDirectoryPageIndex(autoplayFrameIndex(), frames.length);

		if (frames.length === 0 || (settings().stopAtEnd && currentFrameIndex >= frames.length - 1)) {
			return;
		}

		autoplayTimer = window.setTimeout((): void => {
			if (generation !== autoplayGenerationToken) {
				return;
			}

			const advance: AutoplayAdvance = advanceAutoplayFrame(currentFrameIndex, frames.length, settings().stopAtEnd);

			setAutoplayFrameIndex(advance.frameIndex);
		}, autoplayDurationSeconds() * 1000);
	});

	useExternalCommandListener((command: ExternalCommand): void => {
		if (command.getCommand() === 'enablePaginationMode') {
			startAutoplay(command.getParameter('durationSeconds'));
		}

		if (command.getCommand() === 'disablePaginationMode') {
			resetExperience();
		}

		if (command.getCommand() === 'resetExperience') {
			resetExperience();
		}
	});

	onMount((): void => {
		const updateSize = (): void => {
			const bounds: DOMRect = props.hostElement.getBoundingClientRect();

			setSize({
				width: Math.max(1, Math.round(bounds.width)),
				height: Math.max(1, Math.round(bounds.height))
			});
		};
		const updateClock = (): void => {
			setNow(new Date());
		};
		const clockTimer: number = window.setInterval(updateClock, 30_000);
		const ResizeObserverConstructor: typeof ResizeObserver | undefined = window.ResizeObserver;
		const resizeObserver: ResizeObserver | undefined = ResizeObserverConstructor
			? new ResizeObserverConstructor(updateSize)
			: undefined;

		updateSize();
		resizeObserver?.observe(props.hostElement);
		window.addEventListener('resize', updateSize);

		onCleanup((): void => {
			window.clearInterval(clockTimer);
			resizeObserver?.disconnect();
			window.removeEventListener('resize', updateSize);
		});
	});

	onCleanup(clearAutoplayTimer);

	return (
		<div
			class={style['wb-app']}
			data-preview-id="donor-directory-root"
			data-host-ready={Boolean(props.hostElement)}
			data-layout={layout()}
			data-theme={settings().themePreset}
			data-has-background-image={Boolean(backgroundImage())}
			data-maximum-row-height={settings().maximumRowHeight}
			data-motion={settings().motionPreset}
			data-autoplay={autoplayActive()}
			data-autoplay-interval={settings().autoplayIntervalSeconds}
			data-autoplay-duration={autoplayDurationSeconds()}
			data-autoplay-frame={autoplayFrameIndex()}
			data-touch-keyboard-enabled={keyboardAvailable()}
			data-keyboard-open={keyboardOpen()}
			data-search-focused={searchFocused()}
			data-show-category-button-descriptions={settings().showCategoryButtonDescriptions}
			data-density={densityMetrics().mode}
			data-effective-columns={columns()}
			data-effective-entries={entriesPerColumn()}
			data-selected-category={searchActive() ? ALL_CATEGORY_KEY : selectedCategoryKey()}
			data-page-index={clampDirectoryPageIndex(pageIndex(), pageCount())}
			data-search-query={searchQuery()}
			data-donor-status={donorState().status}
			data-category-status={categoryState().status}
			onClick={handleRootClick}
			style={themeStyle()}
		>
			<div class={style.frame} data-preview-id="donor-directory-frame">
				<WbDirectoryHeader
					dateText={clock().dateText}
					layout={layout()}
					timeText={clock().timeText}
					title={settings().title}
					subtitle={settings().subtitle}
					titleFontSize={settings().titleFontSize}
					logoUrl={settings().logo}
					logoScale={settings().logoScale}
				/>

				<div class={style.body} data-layout={layout()}>
					<WbCategoryNavigation
						items={navigationItems()}
						layout={layout()}
						selectedKey={searchActive() ? ALL_CATEGORY_KEY : selectedCategoryKey()}
						showDescriptions={settings().showCategoryButtonDescriptions}
						onSelect={selectCategory}
					/>

					<main class={style.main} data-preview-id="directory-main">
						<div class={style.search} data-search-region>
							<div
								class={style['search-control']}
								data-preview-id="search-control"
								onClick={(): void => {
									openKeyboard();
									searchInputRef?.focus();
								}}
							>
								<span class={style['search-icon']} data-preview-id="search-icon" aria-hidden="true">
									<WbDirectoryIcon name="search" size={23} />
								</span>
								<input
									ref={(element: HTMLInputElement): void => {
										searchInputRef = element;
									}}
									id={searchInputId}
									type="search"
									inputMode={keyboardAvailable() ? 'none' : 'search'}
									maxLength={80}
									value={searchQuery()}
									placeholder={settings().searchPlaceholder}
									aria-label={settings().searchPlaceholder}
									autocomplete="off"
									autocapitalize="words"
									spellcheck={false}
									onFocus={(): void => {
										setSearchFocused(true);
										openKeyboard();
									}}
									onBlur={(): void => {
										setSearchFocused(false);
									}}
									onClick={openKeyboard}
									onInput={(event: InputEvent & { currentTarget: HTMLInputElement }): void => {
										updateSearch(event.currentTarget.value);
									}}
								/>
								<Show when={searchQuery()}>
									<button
										class={style['clear-search']}
										type="button"
										aria-label="Clear donor search"
										onClick={(): void => updateSearch('')}
									>
										<WbDirectoryIcon name="close" size={19} />
									</button>
								</Show>
							</div>

							<Show when={keyboardAvailable()}>
								<button
									class={style['keyboard-toggle']}
									data-preview-id="keyboard-toggle"
									type="button"
									aria-label={keyboardOpen() ? 'Close touch keyboard' : 'Open touch keyboard'}
									aria-pressed={keyboardOpen()}
									onClick={(event: MouseEvent & { currentTarget: HTMLButtonElement }): void =>
										toggleKeyboard(event.currentTarget)
									}
								>
									<WbDirectoryIcon name="keyboard" size={25} />
								</button>
							</Show>
						</div>

						<div class={style['directory-stage']} data-preview-id="directory-stage">
							<WbDonorGrid
								activeLabel={activeHeading().label}
								activeDescription={activeHeading().description}
								activeIsAll={!searchActive() && activeCategory().key === ALL_CATEGORY_KEY}
								allLabelFontSize={settings().allLabelFontSize}
								layout={layout()}
								bestMatchKey={bestMatchKey()}
								columns={donorColumns()}
								density={densityMetrics().mode}
								emptyText={emptyText()}
								field1MaximumSize={densityMetrics().field1Size}
								field2MaximumSize={densityMetrics().field2Size}
								field3MaximumSize={densityMetrics().field3Size}
								maximumRowHeight={settings().maximumRowHeight}
								pageCount={pageCount()}
								pageIndex={clampDirectoryPageIndex(pageIndex(), pageCount())}
								searchActive={searchActive()}
								onPrevious={showPreviousPage}
								onNext={showNextPage}
							/>

							<Show when={keyboardAvailable() && keyboardOpen()}>
								<div class={style['keyboard-overlay']} data-preview-id="keyboard-overlay">
									<div
										class={style['keyboard-panel']}
										data-keyboard-panel
										data-preview-id="keyboard-panel"
										role="dialog"
										aria-label="Search donor directory keyboard"
									>
										<WbLetterKeyboard
											value={searchQuery()}
											maximumLength={80}
											onInput={updateSearch}
											onSearch={closeKeyboard}
										/>
									</div>
								</div>
							</Show>
						</div>
					</main>
				</div>
			</div>

			<Show when={autoplayActive()}>
				<div class={`${style['autoplay-status']} wb-donor-directory-meta`} aria-live="polite">
					AUTOPLAY
				</div>
			</Show>
		</div>
	);
};
