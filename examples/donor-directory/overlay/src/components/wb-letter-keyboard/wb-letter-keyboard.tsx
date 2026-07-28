import { For } from 'solid-js';
import type { JSX } from 'solid-js';

import { appendKeyboardValue, removeLastKeyboardCharacter } from '../../capabilities/keyboard';

import style from './wb-letter-keyboard.module.scss';

export interface WbLetterKeyboardProps {
	ariaLabel?: string;
	disabled?: boolean;
	maximumLength?: number;
	onInput: (value: string) => void;
	onSearch: () => void;
	value: string;
}

const QWERTY_ROWS: readonly (readonly string[])[] = [
	['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
	['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
	['z', 'x', 'c', 'v', 'b', 'n', 'm']
];

const keepInputFocus = (event: Event): void => {
	event.preventDefault();
};

export default (props: WbLetterKeyboardProps): JSX.Element => {
	const maximumLength = (): number => props.maximumLength ?? 80;
	const enterLetter = (key: string): void => {
		if (props.disabled) return;

		props.onInput(appendKeyboardValue(props.value, key, maximumLength()));
	};
	const enterSpace = (): void => {
		if (props.disabled || props.value.endsWith(' ')) return;

		props.onInput(appendKeyboardValue(props.value, ' ', maximumLength()));
	};
	const backspace = (): void => {
		if (!props.disabled) props.onInput(removeLastKeyboardCharacter(props.value));
	};
	const clear = (): void => {
		if (!props.disabled) props.onInput('');
	};
	const search = (): void => {
		if (!props.disabled) props.onSearch();
	};

	return (
		<section
			class={style['letter-keyboard']}
			data-preview-id="donor-keyboard"
			aria-label={props.ariaLabel ?? 'Search donor keyboard'}
		>
			<For each={QWERTY_ROWS}>
				{(row): JSX.Element => (
					<div class={style['key-row']}>
						<For each={row}>
							{(key): JSX.Element => (
								<button
									class={style.key}
									type="button"
									disabled={props.disabled}
									aria-label={`Key ${key.toLocaleUpperCase()}`}
									onPointerDown={keepInputFocus}
									onMouseDown={keepInputFocus}
									onClick={(): void => enterLetter(key)}
								>
									<span class={`wb-donor-directory-key-label ${style['key-label']}`}>{key.toLocaleUpperCase()}</span>
								</button>
							)}
						</For>
					</div>
				)}
			</For>

			<div
				class={`${style['key-row']} ${style['function-row']}`}
				data-preview-id="keyboard-function-row"
			>
				<button
					class={`${style.key} ${style['function-key']}`}
					type="button"
					disabled={props.disabled}
					onPointerDown={keepInputFocus}
					onMouseDown={keepInputFocus}
					onClick={clear}
				>
					<span class={`wb-donor-directory-key-label ${style['key-label']}`}>CLEAR</span>
				</button>
				<button
					class={`${style.key} ${style['function-key']}`}
					type="button"
					disabled={props.disabled}
					onPointerDown={keepInputFocus}
					onMouseDown={keepInputFocus}
					onClick={backspace}
				>
					<span class={`wb-donor-directory-key-label ${style['key-label']}`}>BACKSPACE</span>
				</button>
				<button
					class={`${style.key} ${style['function-key']} ${style['space-key']}`}
					type="button"
					disabled={props.disabled}
					onPointerDown={keepInputFocus}
					onMouseDown={keepInputFocus}
					onClick={enterSpace}
				>
					<span class={`wb-donor-directory-key-label ${style['key-label']}`}>SPACE</span>
				</button>
				<button
					class={`${style.key} ${style['function-key']} ${style['search-key']}`}
					type="button"
					disabled={props.disabled}
					onPointerDown={keepInputFocus}
					onMouseDown={keepInputFocus}
					onClick={search}
				>
					<span class={`wb-donor-directory-key-label ${style['key-label']}`}>SEARCH</span>
				</button>
			</div>
		</section>
	);
};
