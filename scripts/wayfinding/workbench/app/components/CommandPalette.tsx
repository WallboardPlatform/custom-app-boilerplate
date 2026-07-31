import { Search, X } from 'lucide-solid';
import {
	createEffect,
	createMemo,
	createSignal,
	For,
	onCleanup,
	onMount,
	Show,
	type JSX
} from 'solid-js';

export interface StudioCommand {
	disabled?: boolean;
	group: string;
	id: string;
	keywords?: string[];
	label: string;
	run: () => void;
	shortcut?: string;
}

interface CommandPaletteProps {
	commands: StudioCommand[];
	onClose: () => void;
}

const normalizedSearchText = (command: StudioCommand): string =>
	[command.label, command.group, ...(command.keywords ?? [])].join(' ').toLocaleLowerCase();

export const CommandPalette = (props: CommandPaletteProps): JSX.Element => {
	const [query, setQuery] = createSignal('');
	const [activeIndex, setActiveIndex] = createSignal(0);
	let input: HTMLInputElement | undefined;

	const visibleCommands = createMemo(() => {
		const needle = query().trim().toLocaleLowerCase();

		return props.commands.filter((command) =>
			!needle || normalizedSearchText(command).includes(needle)
		);
	});
	const runCommand = (command: StudioCommand | undefined): void => {
		if (!command || command.disabled) return;
		command.run();
		props.onClose();
	};
	const onKeyDown = (event: KeyboardEvent): void => {
		if (event.key === 'Escape') {
			event.preventDefault();
			props.onClose();

			return;
		}

		if (event.key === 'ArrowDown') {
			event.preventDefault();
			setActiveIndex((value) => Math.min(value + 1, visibleCommands().length - 1));

			return;
		}

		if (event.key === 'ArrowUp') {
			event.preventDefault();
			setActiveIndex((value) => Math.max(value - 1, 0));

			return;
		}

		if (event.key === 'Enter') {
			event.preventDefault();
			runCommand(visibleCommands()[activeIndex()]);
		}
	};

	createEffect(() => {
		query();
		setActiveIndex(0);
	});
	onMount(() => {
		queueMicrotask(() => input?.focus());
		window.addEventListener('keydown', onKeyDown);
	});
	onCleanup(() => window.removeEventListener('keydown', onKeyDown));

	return (
		<div class="command-palette-backdrop" role="presentation" onMouseDown={(event) => {
			if (event.target === event.currentTarget) props.onClose();
		}}>
			<section class="command-palette" role="dialog" aria-modal="true" aria-label="Commands">
				<header>
					<Search size={19} aria-hidden="true" />
					<input
						ref={input}
						type="search"
						value={query()}
						placeholder="Search commands and tools"
						aria-label="Search commands"
						onInput={(event) => setQuery(event.currentTarget.value)}
					/>
					<kbd>Esc</kbd>
					<button type="button" aria-label="Close commands" onClick={() => props.onClose()}>
						<X size={18} />
					</button>
				</header>
				<div class="command-palette__results" role="listbox">
					<Show
						when={visibleCommands().length > 0}
						fallback={<div class="command-palette__empty">No matching command</div>}
					>
						<For each={visibleCommands()}>{(command, index) => (
							<button
								type="button"
								role="option"
								aria-selected={index() === activeIndex()}
								classList={{ active: index() === activeIndex() }}
								disabled={command.disabled}
								onMouseEnter={() => setActiveIndex(index())}
								onClick={() => runCommand(command)}
							>
								<span>
									<small>{command.group}</small>
									<strong>{command.label}</strong>
								</span>
								<Show when={command.shortcut}><kbd>{command.shortcut}</kbd></Show>
							</button>
						)}</For>
					</Show>
				</div>
				<footer>
					<span><kbd>Up</kbd><kbd>Down</kbd> Navigate</span>
					<span><kbd>Enter</kbd> Run</span>
				</footer>
			</section>
		</div>
	);
};
