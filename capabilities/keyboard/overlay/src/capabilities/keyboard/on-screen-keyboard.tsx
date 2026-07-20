import { createMemo, createSignal, For } from 'solid-js';
import type { JSX } from 'solid-js';

import {
	appendKeyboardValue,
	ENGLISH_KEYBOARD_LAYOUT,
	type KeyboardLayout,
	removeLastKeyboardCharacter
} from './keyboard';

import style from './on-screen-keyboard.module.scss';

export interface OnScreenKeyboardProps {
	accentColor?: string;
	backgroundColor?: string;
	borderColor?: string;
	label?: string;
	layouts?: readonly KeyboardLayout[];
	maximumLength?: number;
	onClose: () => void;
	onInput: (value: string) => void;
	onSubmit?: () => void;
	submitLabel?: string;
	textColor?: string;
	value: string;
}

export const OnScreenKeyboard = (props: OnScreenKeyboardProps): JSX.Element => {
	const [layoutIndex, setLayoutIndex] = createSignal(0);
	const [shifted, setShifted] = createSignal(false);
	const layouts = createMemo((): readonly KeyboardLayout[] => props.layouts?.length ? props.layouts : [ENGLISH_KEYBOARD_LAYOUT]);
	const layout = createMemo((): KeyboardLayout => layouts()[Math.min(layoutIndex(), layouts().length - 1)]);
	const rootStyle = createMemo((): JSX.CSSProperties => ({
		'--wb-keyboard-accent': props.accentColor ?? '#42d6b5',
		'--wb-keyboard-background': props.backgroundColor ?? '#121918',
		'--wb-keyboard-border': props.borderColor ?? '#34413e',
		'--wb-keyboard-text': props.textColor ?? '#f5f2e9'
	}));

	const enterKey = (key: string): void => {
		props.onInput(appendKeyboardValue(props.value, shifted() ? key.toLocaleUpperCase() : key, props.maximumLength));

		if (shifted()) {
			setShifted(false);
		}
	};

	return (
		<div class={style.overlay} role="dialog" aria-label={props.label ?? 'On-screen keyboard'} style={rootStyle()}>
			<div class={style.panel}>
				<header>
					<strong>{props.label ?? 'On-screen keyboard'}</strong>
					<div>
						<For each={layouts()}>{(candidate, index): JSX.Element => (
							<button
								type="button"
								aria-pressed={candidate.id === layout().id}
								onClick={(): void => {
									setLayoutIndex(index());
								}}
							>
								{candidate.label}
							</button>
						)}</For>
						<button type="button" onClick={(): void => props.onClose()}>Close</button>
					</div>
				</header>

				<div class={style.value} aria-live="polite">{props.value || ' '}</div>

				<div class={style.keys}>
					<For each={layout().rows}>{(row): JSX.Element => (
						<div class={style.row}>
							<For each={row}>{(key): JSX.Element => (
								<button
									type="button"
									aria-label={`Key ${shifted() ? key.toLocaleUpperCase() : key}`}
									onPointerDown={(event): void => event.preventDefault()}
									onClick={(): void => enterKey(key)}
								>
									{shifted() ? key.toLocaleUpperCase() : key}
								</button>
							)}</For>
						</div>
					)}</For>
				</div>

				<footer>
					<button type="button" aria-pressed={shifted()} onClick={(): void => { setShifted((value): boolean => !value); }}>Shift</button>
					<button type="button" onClick={(): void => props.onInput(appendKeyboardValue(props.value, ' ', props.maximumLength))}>Space</button>
					<button type="button" onClick={(): void => props.onInput(removeLastKeyboardCharacter(props.value))}>Delete</button>
					<button type="button" onClick={(): void => props.onInput('')}>Clear</button>
					<button
						class={style.submit}
						type="button"
						onClick={(): void => {
							props.onSubmit?.();
						}}
					>
						{props.submitLabel ?? 'Done'}
					</button>
				</footer>
			</div>
		</div>
	);
};
