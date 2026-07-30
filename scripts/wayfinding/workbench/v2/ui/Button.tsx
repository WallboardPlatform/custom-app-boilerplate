import type {
	JSX,
	ParentProps
} from 'solid-js';

export interface ButtonProps extends ParentProps {
	ariaLabel?: string;
	class?: string;
	disabled?: boolean;
	full?: boolean;
	onClick?: (event: MouseEvent) => void;
	size?: 'compact' | 'default';
	title?: string;
	tone?: 'danger' | 'default' | 'overlay' | 'primary';
	type?: 'button' | 'submit';
}

export const Button = (props: ButtonProps): JSX.Element => (
	<button
		type={props.type ?? 'button'}
		class={`wb-studio-button ${props.class ?? ''}`}
		classList={{
			'wb-studio-button--compact': props.size === 'compact',
			'wb-studio-button--danger': props.tone === 'danger',
			'wb-studio-button--full': props.full,
			'wb-studio-button--overlay': props.tone === 'overlay',
			'wb-studio-button--primary': props.tone === 'primary'
		}}
		aria-label={props.ariaLabel}
		disabled={props.disabled}
		title={props.title}
		onClick={(event) => props.onClick?.(event)}
	>
		{props.children}
	</button>
);
