import {
	createEffect,
	type JSX
} from 'solid-js';

export const DraftInput = (props: {
	disabled?: boolean;
	label?: string;
	onCommit: (value: string) => void;
	placeholder?: string;
	value: string;
}): JSX.Element => {
	let input!: HTMLInputElement;
	createEffect(() => {
		if (document.activeElement !== input) input.value = props.value;
	});

	return (
		<input
			ref={input}
			aria-label={props.label}
			disabled={props.disabled}
			placeholder={props.placeholder}
			value={props.value}
			onChange={(event): void => props.onCommit(event.currentTarget.value)}
			onBlur={(event): void => {
				if (event.currentTarget.value !== props.value) props.onCommit(event.currentTarget.value);
			}}
		/>
	);
};

export const DraftTextarea = (props: {
	label?: string;
	onCommit: (value: string) => void;
	placeholder?: string;
	value: string;
}): JSX.Element => {
	let input!: HTMLTextAreaElement;
	createEffect(() => {
		if (document.activeElement !== input) input.value = props.value;
	});

	return (
		<textarea
			ref={input}
			aria-label={props.label}
			placeholder={props.placeholder}
			value={props.value}
			onChange={(event): void => props.onCommit(event.currentTarget.value)}
			onBlur={(event): void => {
				if (event.currentTarget.value !== props.value) props.onCommit(event.currentTarget.value);
			}}
		/>
	);
};
