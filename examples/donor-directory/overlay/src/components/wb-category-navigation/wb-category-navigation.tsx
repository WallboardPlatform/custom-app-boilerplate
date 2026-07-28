import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';

import style from './wb-category-navigation.module.scss';

export interface CategoryNavigationItem {
	count: number;
	description: string;
	key: string;
	label: string;
}

export interface WbCategoryNavigationProps {
	items: readonly CategoryNavigationItem[];
	layout: 'landscape' | 'portrait' | 'square';
	onSelect: (key: string) => void;
	selectedKey: string;
	showDescriptions: boolean;
}

const portraitColumnCount = (itemCount: number): number => {
	if (itemCount <= 1) return 1;

	if (itemCount <= 4) return itemCount;

	if (itemCount === 5 || itemCount === 6 || itemCount === 9) return 3;

	return 4;
};

export default (props: WbCategoryNavigationProps): JSX.Element => {
	return (
		<nav
			class={style.navigation}
			data-layout={props.layout}
			data-portrait-columns={props.layout === 'portrait' ? portraitColumnCount(props.items.length) : undefined}
			data-preview-id="donor-categories"
			data-preview-allow-overflow={props.layout === 'portrait' ? undefined : true}
			aria-label="Donor categories"
		>
			<For each={props.items}>
				{(item): JSX.Element => (
					<button
						class={style.category}
						classList={{ [style.active]: item.key === props.selectedKey }}
						type="button"
						aria-pressed={item.key === props.selectedKey}
						aria-label={item.description ? `${item.label}. ${item.description}` : item.label}
						title={item.description || undefined}
						data-category-key={item.key}
						onClick={(): void => props.onSelect(item.key)}
					>
						<span class={style.copy}>
							<span class={`${style.label} wb-donor-directory-category-label`}>{item.label}</span>
							<Show when={props.showDescriptions && item.description}>
								<span class={`${style.description} wb-donor-directory-category-button-description`}>
									{item.description}
								</span>
							</Show>
						</span>
						<span class={`${style.count} wb-donor-directory-meta`}>{item.count}</span>
					</button>
				)}
			</For>
		</nav>
	);
};
