import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import WbDirectoryIcon from '@components/wb-directory-icon/wb-directory-icon';

import { useAutoFitText } from '@hooks/system/useAutoFitText';

import style from './wb-donor-grid.module.scss';

export type DirectoryDensity = 'spacious' | 'compact' | 'dense';

export interface DonorGridItem {
	categoryLabel: string;
	field1Text: string;
	field2Text: string;
	field3Text: string;
	key: string;
}

export interface WbDonorGridProps {
	activeDescription: string;
	activeIsAll: boolean;
	activeLabel: string;
	allLabelFontSize: number;
	bestMatchKey: string;
	columns: readonly (readonly DonorGridItem[])[];
	density: DirectoryDensity;
	emptyText: string;
	field1MaximumSize: number;
	field2MaximumSize: number;
	field3MaximumSize: number;
	layout: 'landscape' | 'portrait' | 'square';
	maximumRowHeight: number;
	onNext: () => void;
	onPrevious: () => void;
	pageCount: number;
	pageIndex: number;
	searchActive: boolean;
}

type EntryFieldIndex = 1 | 2 | 3;

interface AutoFitEntryFieldProps {
	density: DirectoryDensity;
	fieldCount: number;
	index: EntryFieldIndex;
	maximumSize: number;
	text: string;
}

const fieldClassName = (index: EntryFieldIndex): string => {
	return `wb-donor-directory-entry-field-${index}`;
};

const AutoFitEntryField = (props: AutoFitEntryFieldProps): JSX.Element => {
	const fitText = useAutoFitText({
		minFontSize: 11,
		maxFontSize: 128,
		widthOnly: false,
		watch: (): string => [props.text, props.density, props.fieldCount, props.maximumSize].join('|')
	});

	return (
		<div class={`${style.field} ${style[`field${props.index}`]}`} data-entry-field={props.index}>
			<span ref={fitText} class={`${style['field-text']} ${fieldClassName(props.index)}`} title={props.text}>
				{props.text}
			</span>
		</div>
	);
};

const visibleFieldCount = (donor: DonorGridItem): number => {
	return 1 + (donor.field2Text ? 1 : 0) + (donor.field3Text ? 1 : 0);
};

export default (props: WbDonorGridProps): JSX.Element => {
	const fitActiveLabel = useAutoFitText({
		minFontSize: 18,
		maxFontSize: 64,
		widthOnly: true,
		watch: (): string => [props.activeLabel, props.activeIsAll, props.allLabelFontSize, props.density].join('|')
	});
	const columnMaximumHeight = (rowCount: number): string => {
		return props.maximumRowHeight > 0 ? `${props.maximumRowHeight * rowCount}px` : 'none';
	};

	return (
		<section
			class={style.directory}
			data-density={props.density}
			data-layout={props.layout}
			data-preview-id="donor-directory"
		>
			<header class={style.heading}>
				<div class={style['heading-copy']}>
					<h2
						ref={fitActiveLabel}
						class={`${style['active-category']} wb-donor-directory-active-category`}
						data-all-category={props.activeIsAll}
						data-preview-id="active-category"
					>
						{props.activeLabel}
					</h2>
					<Show when={props.activeDescription}>
						<p class={`${style.description} wb-donor-directory-active-category-description`}>
							{props.activeDescription}
						</p>
					</Show>
				</div>
				<div class={`${style['page-summary']} wb-donor-directory-meta`} data-preview-id="page-indicator">
					{props.pageCount > 0 ? props.pageIndex + 1 : 0} / {props.pageCount}
				</div>
			</header>

			<div class={style['donor-columns']} data-column-count={props.columns.length} data-preview-id="donor-columns">
				<Show
					when={props.columns.some((column): boolean => column.length > 0)}
					fallback={
						<div class={style.empty} data-preview-id="directory-empty">
							<span class="wb-donor-directory-state-copy">{props.emptyText}</span>
						</div>
					}
				>
					<For each={props.columns}>
						{(column): JSX.Element => (
							<div
								class={style['donor-column']}
								data-preview-id="donor-column"
								data-row-count={column.length}
								style={{
									'max-height': columnMaximumHeight(column.length),
									visibility: props.maximumRowHeight > 0 && column.length === 0 ? 'hidden' : 'visible'
								}}
							>
								<For each={column}>
									{(donor): JSX.Element => {
										const fieldCount: number = visibleFieldCount(donor);

										return (
											<article
												class={style.donor}
												classList={{ [style.highlight]: donor.key === props.bestMatchKey }}
												data-donor-key={donor.key}
												data-field-count={fieldCount}
												data-preview-id="donor-entry"
												data-search-active={props.searchActive}
											>
												<AutoFitEntryField
													index={1}
													text={donor.field1Text}
													density={props.density}
													fieldCount={fieldCount}
													maximumSize={props.field1MaximumSize}
												/>
												<Show when={donor.field2Text}>
													<AutoFitEntryField
														index={2}
														text={donor.field2Text}
														density={props.density}
														fieldCount={fieldCount}
														maximumSize={props.field2MaximumSize}
													/>
												</Show>
												<Show when={donor.field3Text}>
													<AutoFitEntryField
														index={3}
														text={donor.field3Text}
														density={props.density}
														fieldCount={fieldCount}
														maximumSize={props.field3MaximumSize}
													/>
												</Show>
												<Show when={props.searchActive}>
													<span class={`${style.badge} wb-donor-directory-meta`}>{donor.categoryLabel}</span>
												</Show>
											</article>
										);
									}}
								</For>
							</div>
						)}
					</For>
				</Show>
			</div>

			<footer class={style.controls} data-preview-id="directory-controls">
				<button
					type="button"
					disabled={props.pageIndex <= 0 || props.pageCount <= 1}
					aria-label="Previous donor page"
					onClick={(): void => props.onPrevious()}
				>
					<WbDirectoryIcon name="chevron-left" size={24} />
					<span>Previous</span>
				</button>
				<div class={style.progress} aria-hidden="true">
					<span
						style={{
							width: props.pageCount > 0 ? `${((props.pageIndex + 1) / props.pageCount) * 100}%` : '0%'
						}}
					/>
				</div>
				<button
					type="button"
					disabled={props.pageIndex >= props.pageCount - 1 || props.pageCount <= 1}
					aria-label="Next donor page"
					onClick={(): void => props.onNext()}
				>
					<span>Next</span>
					<WbDirectoryIcon name="chevron-right" size={24} />
				</button>
			</footer>
		</section>
	);
};
