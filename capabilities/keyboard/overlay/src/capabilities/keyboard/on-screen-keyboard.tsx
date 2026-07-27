import { createMemo, createSignal, For } from 'solid-js';
import type { JSX } from 'solid-js';

import {
	appendKeyboardSpace,
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
	/** Blocks every action, not just the appearance of the keys. */
	disabled?: boolean;
	label?: string;
	labels?: Partial<OnScreenKeyboardLabels>;
	layouts?: readonly KeyboardLayout[];
	maximumLength?: number;
	onClose: () => void;
	onInput: (value: string) => void;
	onSubmit?: () => void;
	submitLabel?: string;
	textColor?: string;
	value: string;
}

export interface OnScreenKeyboardLabels {
	clear: string;
	close: string;
	delete: string;
	shift: string;
	space: string;
}

/**
 * Pressing a key must never move focus off the field the keyboard is typing into: losing it
 * hides the caret and breaks physical typing alongside the touch keys. Both events are needed —
 * `pointerdown` covers touch and modern mice, `mousedown` covers the compatibility event that
 * legacy players still emit — and every control needs it, not only the letters. Only the letter
 * keys were guarded before, so space, delete, clear, shift and close each stole focus.
 */
const retainFieldFocus = {
	onPointerDown: (event: Event): void => event.preventDefault(),
	onMouseDown: (event: Event): void => event.preventDefault()
};

const DEFAULT_LABELS: OnScreenKeyboardLabels = {
	clear: 'Clear',
	close: 'Close',
	delete: 'Delete',
	shift: 'Shift',
	space: 'Space'
};

export const OnScreenKeyboard = (props: OnScreenKeyboardProps): JSX.Element => {
	const [layoutIndex, setLayoutIndex] = createSignal(0);
	const [shifted, setShifted] = createSignal(false);
	const layouts = createMemo((): readonly KeyboardLayout[] => props.layouts?.length ? props.layouts : [ENGLISH_KEYBOARD_LAYOUT]);
	const layout = createMemo((): KeyboardLayout => layouts()[Math.min(layoutIndex(), layouts().length - 1)]);
	const labels = createMemo((): OnScreenKeyboardLabels => ({ ...DEFAULT_LABELS, ...props.labels }));
	const rootStyle = createMemo((): JSX.CSSProperties => ({
		'--wb-keyboard-accent': props.accentColor ?? '#42d6b5',
		'--wb-keyboard-background': props.backgroundColor ?? '#121918',
		'--wb-keyboard-border': props.borderColor ?? '#34413e',
		'--wb-keyboard-text': props.textColor ?? '#f5f2e9'
	}));

	const enterKey = (key: string): void => {
		if (props.disabled) return;

		props.onInput(appendKeyboardValue(props.value, shifted() ? key.toLocaleUpperCase() : key, props.maximumLength));

		if (shifted()) {
			setShifted(false);
		}
	};
	/** Guards every action, so a disabled keyboard cannot be driven by a stray synthetic click. */
	const act = (action: () => void): (() => void) => {
		return (): void => {
			if (!props.disabled) action();
		};
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
								disabled={props.disabled}
								aria-pressed={candidate.id === layout().id}
								{...retainFieldFocus}
								onClick={act((): void => {
									setLayoutIndex(index());
								})}
							>
								{candidate.label}
							</button>
						)}</For>
						<button type="button" disabled={props.disabled} {...retainFieldFocus} onClick={act((): void => props.onClose())}>{labels().close}</button>
					</div>
				</header>

				<div class={style.value} aria-live="polite">{props.value || ' '}</div>

				<div class={style.keys}>
					<For each={layout().rows}>{(row): JSX.Element => (
						<div class={style.row}>
							<For each={row}>{(key): JSX.Element => (
								<button
									type="button"
									disabled={props.disabled}
									aria-label={`Key ${shifted() ? key.toLocaleUpperCase() : key}`}
									{...retainFieldFocus}
									onClick={(): void => enterKey(key)}
								>
									{shifted() ? key.toLocaleUpperCase() : key}
								</button>
							)}</For>
						</div>
					)}</For>
				</div>

				<footer>
					<button type="button" disabled={props.disabled} aria-pressed={shifted()} {...retainFieldFocus} onClick={act((): void => { setShifted((value): boolean => !value); })}>{labels().shift}</button>
					<button type="button" disabled={props.disabled} {...retainFieldFocus} onClick={act((): void => props.onInput(appendKeyboardSpace(props.value, props.maximumLength)))}>{labels().space}</button>
					<button type="button" disabled={props.disabled} {...retainFieldFocus} onClick={act((): void => props.onInput(removeLastKeyboardCharacter(props.value)))}>{labels().delete}</button>
					<button type="button" disabled={props.disabled} {...retainFieldFocus} onClick={act((): void => props.onInput(''))}>{labels().clear}</button>
					<button
						class={style.submit}
						type="button"
						disabled={props.disabled}
						{...retainFieldFocus}
						onClick={act((): void => {
							props.onSubmit?.();
						})}
					>
						{props.submitLabel ?? 'Done'}
					</button>
				</footer>
			</div>
		</div>
	);
};
