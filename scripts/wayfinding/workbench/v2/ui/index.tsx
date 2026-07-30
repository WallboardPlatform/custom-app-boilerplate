import type { Accessor, JSX, ParentProps } from 'solid-js';
import { For, Show } from 'solid-js';
import type { LucideProps } from 'lucide-solid';
import { Dynamic } from 'solid-js/web';

export { Button } from './Button';
export { PanelResizeHandle } from './PanelResizeHandle';
export { UploadField } from './UploadField';

interface IconButtonProps {
	active?: boolean;
	disabled?: boolean;
	icon: (props: LucideProps) => JSX.Element;
	label: string;
	onClick?: () => void;
}

export const IconButton = (props: IconButtonProps): JSX.Element => {
	return (
		<button
			type="button"
			class="icon-button"
			classList={{ active: props.active }}
			disabled={props.disabled}
			onClick={() => props.onClick?.()}
			aria-label={props.label}
			title={props.label}
		>
			<Dynamic component={props.icon} size={18} strokeWidth={1.8} />
		</button>
	);
};

interface PanelSectionProps extends ParentProps {
	action?: JSX.Element;
	defaultOpen?: boolean;
	eyebrow?: string;
	title: string;
}

export const PanelSection = (props: PanelSectionProps): JSX.Element => (
	<details class="panel-section" open={props.defaultOpen}>
		<summary>
			<span>
				<Show when={props.eyebrow}><small>{props.eyebrow}</small></Show>
				<strong>{props.title}</strong>
			</span>
			{props.action}
		</summary>
		<div class="panel-section__content">{props.children}</div>
	</details>
);

export const Field = (props: ParentProps<{
	composite?: boolean;
	hint?: string;
	label: string;
}>): JSX.Element => (
	<Show
		when={props.composite}
		fallback={(
			<label class="field">
				<span>{props.label}</span>
				{props.children}
				<Show when={props.hint}><small>{props.hint}</small></Show>
			</label>
		)}
	>
		<div class="field" role="group" aria-label={props.label}>
			<span>{props.label}</span>
			{props.children}
			<Show when={props.hint}><small>{props.hint}</small></Show>
		</div>
	</Show>
);

export const EmptyState = (props: { title: string; body: string }): JSX.Element => (
	<div class="empty-state">
		<strong>{props.title}</strong>
		<p>{props.body}</p>
	</div>
);

interface InspectorHeroProps extends ParentProps {
	badge?: string;
	body?: string;
	eyebrow: string;
	icon: (props: LucideProps) => JSX.Element;
	title: string;
}

export const InspectorHero = (props: InspectorHeroProps): JSX.Element => (
	<header class="inspector-hero">
		<div class="inspector-hero__icon" aria-hidden="true">
			<Dynamic component={props.icon} size={20} strokeWidth={1.8} />
		</div>
		<div class="inspector-hero__copy">
			<div class="inspector-hero__eyebrow">
				<span>{props.eyebrow}</span>
				<Show when={props.badge}><small>{props.badge}</small></Show>
			</div>
			<strong>{props.title}</strong>
			<Show when={props.body}><p>{props.body}</p></Show>
			{props.children}
		</div>
	</header>
);

export const InspectorGroup = (props: ParentProps<{
	body?: string;
	title: string;
}>): JSX.Element => (
	<section class="inspector-group">
		<header>
			<strong>{props.title}</strong>
			<Show when={props.body}><p>{props.body}</p></Show>
		</header>
		<div class="inspector-group__content">{props.children}</div>
	</section>
);

export const PropertyPill = (props: {
	label: string;
	tone?: 'default' | 'positive' | 'warning';
}): JSX.Element => (
	<span class={`property-pill ${props.tone ?? 'default'}`}>{props.label}</span>
);

export interface PanelNavOption<T extends string> {
	badge?: string;
	id: T;
	label: string;
}

export const PanelNav = <T extends string>(props: {
	active: Accessor<T>;
	label: string;
	onChange: (value: T) => void;
	options: PanelNavOption<T>[];
}): JSX.Element => (
	<nav class="panel-nav" aria-label={props.label}>
		<For each={props.options}>{(option) => (
			<button
				type="button"
				aria-pressed={props.active() === option.id}
				classList={{ active: props.active() === option.id }}
				onClick={(event) => {
					event.preventDefault();
					props.onChange(option.id);
				}}
			>
				<span>{option.label}</span>
				<Show when={option.badge}><small>{option.badge}</small></Show>
			</button>
		)}</For>
	</nav>
);
