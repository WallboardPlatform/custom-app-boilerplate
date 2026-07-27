import type { JSX, ParentProps } from 'solid-js';
import { Show } from 'solid-js';
import type { LucideProps } from 'lucide-solid';
import { Dynamic } from 'solid-js/web';

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

export const Field = (props: ParentProps<{ label: string; hint?: string }>): JSX.Element => (
	<label class="field">
		<span>{props.label}</span>
		{props.children}
		<Show when={props.hint}><small>{props.hint}</small></Show>
	</label>
);

export const EmptyState = (props: { title: string; body: string }): JSX.Element => (
	<div class="empty-state">
		<strong>{props.title}</strong>
		<p>{props.body}</p>
	</div>
);
