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
import {
	addProjectCategory,
	addProjectLanguage,
	projectLanguages,
	removeProjectCategory,
	removeProjectLanguage,
	renameProjectCategory,
	setDefaultProjectLanguage
} from '../../../editor-core/directory';
import type { WayfindingStudioProject } from '../../../studio-project.mts';
import { Field } from '../ui';
import { updateProject } from './project-edit';

export const DirectorySettings = (props: {
	snapshot: Accessor<EditorSnapshot>;
	store: EditorStore;
}): JSX.Element => {
	const [languageCode, setLanguageCode] = createSignal('');
	const [languageLabel, setLanguageLabel] = createSignal('');
	const [category, setCategory] = createSignal('');
	const [editingCategory, setEditingCategory] = createSignal<string>();
	const [categoryDraft, setCategoryDraft] = createSignal('');
	const project = createMemo(() => props.snapshot().state.project);
	const languages = createMemo(() => projectLanguages(project()));
	const categories = createMemo(() => project().categories ?? []);
	const edit = (label: string, update: Parameters<typeof updateProject>[3]): void =>
		updateProject(props.store, props.snapshot(), label, update);
	const editWhenChanged = (
		label: string,
		update: (project: WayfindingStudioProject) => boolean
	): boolean => {
		const next = structuredClone(project());

		if (!update(next)) return false;

		props.store.dispatch({ type: 'project/replace', project: next, label });

		return true;
	};
	const addLanguage = (): void => {
		const code = languageCode();
		const label = languageLabel();

		if (!editWhenChanged('Add project language', (next) =>
			addProjectLanguage(next, code, label)
		)) return;
		setLanguageCode('');
		setLanguageLabel('');
	};
	const removeLanguage = (code: string): void => {
		editWhenChanged('Remove project language', (next) => removeProjectLanguage(next, code));
	};
	const addCategory = (): void => {
		const nextCategory = category();

		if (!editWhenChanged('Add destination category', (next) =>
			addProjectCategory(next, nextCategory)
		)) return;
		setCategory('');
	};
	const startCategoryRename = (item: string): void => {
		setEditingCategory(item);
		setCategoryDraft(item);
	};
	const commitCategoryRename = (): void => {
		const current = editingCategory();
		const draft = categoryDraft();

		if (!current) return;

		if (!editWhenChanged('Rename destination category', (next) =>
			renameProjectCategory(next, current, draft)
		)) return;

		setEditingCategory(undefined);
		setCategoryDraft('');
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
									setDefaultProjectLanguage(next, language.code);
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
						<Show
							when={editingCategory() === item}
							fallback={(
								<span class="category-chip">
									<button
										type="button"
										class="category-chip-label"
										aria-label={`Rename ${item}`}
										onClick={() => startCategoryRename(item)}
									>{item}</button>
									<button
										type="button"
										aria-label={`Remove ${item}`}
										onClick={() => editWhenChanged(
											'Remove destination category',
											(next) => removeProjectCategory(next, item)
										)}
									><X size={13} /></button>
								</span>
							)}
						>
							<div class="category-edit-row">
								<input
									aria-label={`Rename ${item}`}
									value={categoryDraft()}
									onInput={(event) => setCategoryDraft(event.currentTarget.value)}
									onKeyDown={(event) => {
										if (event.key === 'Enter') commitCategoryRename();

										if (event.key === 'Escape') setEditingCategory(undefined);
									}}
								/>
								<button type="button" class="button compact" onClick={commitCategoryRename}>Save</button>
							</div>
						</Show>
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
