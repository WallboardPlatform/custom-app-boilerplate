import { Keyboard, X } from 'lucide-solid';
import { For, onCleanup, onMount, type JSX } from 'solid-js';

interface ShortcutsDialogProps {
	onClose: () => void;
}

const shortcuts = [
	{ keys: ['Ctrl', 'S'], label: 'Save project' },
	{ keys: ['Ctrl', 'Shift', 'S'], label: 'Save project as a new file' },
	{ keys: ['Ctrl', 'Z'], label: 'Undo map edit' },
	{ keys: ['Ctrl', 'Shift', 'Z'], label: 'Redo map edit' },
	{ keys: ['Mouse wheel'], label: 'Zoom the 2D map' },
	{ keys: ['Space', 'Drag'], label: 'Pan the 2D map' },
	{ keys: ['Shift'], label: 'Constrain new geometry to 45 degrees or rotation to 15 degrees' },
	{ keys: ['Arrow keys'], label: 'Nudge the selected map object by one unit' },
	{ keys: ['Shift', 'Arrow keys'], label: 'Nudge the selected map object by ten units' },
	{ keys: ['Enter'], label: 'Finish an area or route' },
	{ keys: ['Esc'], label: 'Cancel the active tool or drawing' }
];

export const ShortcutsDialog = (props: ShortcutsDialogProps): JSX.Element => {
	let closeButton!: HTMLButtonElement;
	const previousFocus: Element | null = document.activeElement;

	onMount(() => {
		const keydown = (event: KeyboardEvent): void => {
			if (event.key !== 'Escape') return;
			event.preventDefault();
			props.onClose();
		};
		window.addEventListener('keydown', keydown);
		closeButton.focus();
		onCleanup(() => {
			window.removeEventListener('keydown', keydown);

			if (previousFocus instanceof HTMLElement) previousFocus.focus();
		});
	});

	return (
		<div class="modal-backdrop" role="presentation" onClick={() => props.onClose()}>
			<div
				class="dialog shortcuts-dialog"
				role="dialog"
				aria-modal="true"
				aria-labelledby="shortcuts-title"
				onClick={(event) => event.stopPropagation()}
			>
				<div class="dialog-icon"><Keyboard size={20} /></div>
				<button
					type="button"
					ref={closeButton}
					class="dialog-close"
					aria-label="Close shortcuts"
					onClick={() => props.onClose()}
				>
					<X size={17} />
				</button>
				<h2 id="shortcuts-title">Keyboard and map controls</h2>
				<p>Keep your hands on the map while editing.</p>
				<div class="shortcut-list">
					<For each={shortcuts}>{(shortcut) => (
						<div class="shortcut-row">
							<span class="shortcut-keys">
								<For each={shortcut.keys}>{(key) => <kbd>{key}</kbd>}</For>
							</span>
							<span>{shortcut.label}</span>
						</div>
					)}</For>
				</div>
			</div>
		</div>
	);
};
