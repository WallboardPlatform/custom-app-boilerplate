import {
	createMemo,
	createSignal,
	For,
	Show,
	type Accessor,
	type JSX
} from 'solid-js';
import { X } from 'lucide-solid';

import type {
	EditorSnapshot,
	EditorStore
} from '../../../editor-core/types';
import { Field } from '../ui';
import { updateProject } from './project-edit';

const normalizedCode = (value: string): string =>
	value.trim().toLocaleLowerCase().replaceAll(/[^a-z0-9-]/g, '').slice(0, 12);

export const DirectorySettings = (props: {
	snapshot: Accessor<EditorSnapshot>;
	store: EditorStore;
}): JSX.Element => {
	const [languageCode, setLanguageCode] = createSignal('');
	const [languageLabel, setLanguageLabel] = createSignal('');
	const [category, setCategory] = createSignal('');
	const project = createMemo(() => props.snapshot().state.project);
	const languages = createMemo(() => project().languages ?? [{ code: 'en', label: 'English' }]);
	const categories = createMemo(() => project().categories ?? []);
	const edit = (label: string, update: Parameters<typeof updateProject>[3]): void =>
		updateProject(props.store, props.snapshot(), label, update);
	const addLanguage = (): void => {
		const code = normalizedCode(languageCode());
		const label = languageLabel().trim();

		if (!code || !label || languages().some((item) => item.code === code)) return;
		edit('Add project language', (next): void => {
			next.languages = [...(next.languages ?? []), { code, label }];
		});
		setLanguageCode('');
		setLanguageLabel('');
	};
	const removeLanguage = (code: string): void => {
		if (languages().length <= 1) return;
		edit('Remove project language', (next): void => {
			next.languages = (next.languages ?? []).filter((item) => item.code !== code);

			if (next.defaultLanguage === code) next.defaultLanguage = next.languages[0]?.code ?? 'en';

			for (const destination of next.destinations) {
				if (!destination.translations) continue;
				const translations = { ...destination.translations };
				delete translations[code];
				destination.translations = translations;
			}
		});
	};
	const addCategory = (): void => {
		const nextCategory = category().trim();

		if (!nextCategory || categories().some((item) => item.toLocaleLowerCase() === nextCategory.toLocaleLowerCase())) return;
		edit('Add destination category', (next): void => {
			next.categories = [...(next.categories ?? []), nextCategory].sort((a, b) => a.localeCompare(b));
		});
		setCategory('');
	};

	return (
		<div class="directory-settings">
			<div class="settings-subsection">
				<div class="subsection-heading">
					<strong>Languages</strong>
					<small>Names and descriptions can be translated per destination.</small>
				</div>
				<div class="settings-list">
					<For each={languages()}>{(language) => (
						<div class="settings-row">
							<span class="language-code">{language.code}</span>
							<strong>{language.label}</strong>
							<Show
								when={project().defaultLanguage !== language.code}
								fallback={<span class="status-label">Default</span>}
							>
								<button
									type="button"
									class="text-button"
									onClick={() => edit('Change default language', (next): void => {
										next.defaultLanguage = language.code;
									})}
								>Make default</button>
							</Show>
							<button
								type="button"
								class="text-button danger"
								disabled={languages().length <= 1}
								onClick={() => removeLanguage(language.code)}
							>Remove</button>
						</div>
					)}</For>
				</div>
				<div class="inline-form language-form">
					<Field label="Code">
						<input
							value={languageCode()}
							placeholder="hu"
							onInput={(event) => setLanguageCode(event.currentTarget.value)}
						/>
					</Field>
					<Field label="Language">
						<input
							value={languageLabel()}
							placeholder="Hungarian"
							onInput={(event) => setLanguageLabel(event.currentTarget.value)}
							onKeyDown={(event) => {
								if (event.key === 'Enter') addLanguage();
							}}
						/>
					</Field>
					<button type="button" class="button compact" onClick={addLanguage}>Add</button>
				</div>
			</div>

			<div class="settings-subsection">
				<div class="subsection-heading">
					<strong>Destination categories</strong>
					<small>Reusable filters shared by every destination.</small>
				</div>
				<div class="category-list">
					<For each={categories()}>{(item) => (
						<span class="category-chip">
							{item}
							<button
								type="button"
								aria-label={`Remove ${item}`}
								onClick={() => edit('Remove destination category', (next): void => {
									next.categories = (next.categories ?? []).filter((candidate) => candidate !== item);
								})}
							><X size={13} /></button>
						</span>
					)}</For>
				</div>
				<div class="inline-form category-form">
					<Field label="New category">
						<input
							value={category()}
							placeholder="Guest services"
							onInput={(event) => setCategory(event.currentTarget.value)}
							onKeyDown={(event) => {
								if (event.key === 'Enter') addCategory();
							}}
						/>
					</Field>
					<button type="button" class="button compact" onClick={addCategory}>Add</button>
				</div>
			</div>
		</div>
	);
};
