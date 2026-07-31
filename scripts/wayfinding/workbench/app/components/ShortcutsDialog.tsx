import { Compass, Keyboard, X } from 'lucide-solid';
import { createSignal, For, onCleanup, onMount, Show, type JSX } from 'solid-js';

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

const setupSteps = [
	{
		body: 'Open Project to add each floor plan, name the floor, and calibrate its real-world scale.',
		title: 'Prepare the floors'
	},
	{
		body: 'Use Map to place destinations and landmarks. Doors snap to the nearest room boundary and link that room automatically.',
		title: 'Describe the visitor map'
	},
	{
		body: 'In Route edit, define pedestrian space first, generate the network, then inspect only the corrections that need attention.',
		title: 'Build trustworthy guidance'
	},
	{
		body: 'Use Preview as the final-product check: choose an installed screen, open destinations, and verify every journey in 2D and 3D.',
		title: 'Experience it as a visitor'
	},
	{
		body: 'Save the editable project, then Publish map only after the readiness check is clear.',
		title: 'Save and publish'
	}
];

export const ShortcutsDialog = (props: ShortcutsDialogProps): JSX.Element => {
	let closeButton!: HTMLButtonElement;
	const previousFocus: Element | null = document.activeElement;
	const [activeTab, setActiveTab] = createSignal<'guide' | 'shortcuts'>('guide');

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
				<div class="dialog-icon"><Compass size={20} /></div>
				<button
					type="button"
					ref={closeButton}
					class="dialog-close"
					aria-label="Close shortcuts"
					onClick={() => props.onClose()}
				>
					<X size={17} />
				</button>
				<h2 id="shortcuts-title">Wayfinding Studio help</h2>
				<p>Follow the complete authoring path or review the fastest map controls.</p>
				<div class="help-tabs" role="tablist" aria-label="Help topics">
					<button
						type="button"
						role="tab"
						aria-selected={activeTab() === 'guide'}
						aria-controls="guided-setup-panel"
						onClick={() => setActiveTab('guide')}
					>
						<Compass size={15} /> Guided setup
					</button>
					<button
						type="button"
						role="tab"
						aria-selected={activeTab() === 'shortcuts'}
						aria-controls="shortcuts-panel"
						onClick={() => setActiveTab('shortcuts')}
					>
						<Keyboard size={15} /> Controls
					</button>
				</div>
				<Show when={activeTab() === 'guide'} fallback={(
					<div id="shortcuts-panel" class="shortcut-list" role="tabpanel">
						<For each={shortcuts}>{(shortcut) => (
							<div class="shortcut-row">
								<span class="shortcut-keys">
									<For each={shortcut.keys}>{(key) => <kbd>{key}</kbd>}</For>
								</span>
								<span>{shortcut.label}</span>
							</div>
						)}</For>
					</div>
				)}>
					<ol id="guided-setup-panel" class="guided-setup" role="tabpanel">
						<For each={setupSteps}>{(step, index) => (
							<li>
								<span aria-hidden="true">{index() + 1}</span>
								<div>
									<strong>{step.title}</strong>
									<p>{step.body}</p>
								</div>
							</li>
						)}</For>
					</ol>
				</Show>
			</div>
		</div>
	);
};
