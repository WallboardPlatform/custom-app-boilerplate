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
	let committedValue = '';
	createEffect(() => {
		const nextValue = props.value;
		committedValue = nextValue;

		if (document.activeElement !== input) input.value = nextValue;
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
				if (event.currentTarget.value !== committedValue) props.onCommit(event.currentTarget.value);
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
	let committedValue = '';
	createEffect(() => {
		const nextValue = props.value;
		committedValue = nextValue;

		if (document.activeElement !== input) input.value = nextValue;
	});

	return (
		<textarea
			ref={input}
			aria-label={props.label}
			placeholder={props.placeholder}
			value={props.value}
			onChange={(event): void => props.onCommit(event.currentTarget.value)}
			onBlur={(event): void => {
				if (event.currentTarget.value !== committedValue) props.onCommit(event.currentTarget.value);
			}}
		/>
	);
};
