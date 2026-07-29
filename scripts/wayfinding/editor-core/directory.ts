import type {
	WayfindingStudioLanguage,
	WayfindingStudioProject
} from '../studio-project.mts';

export const normalizeLanguageCode = (value: string): string =>
	value.trim().toLocaleLowerCase().replaceAll(/[^a-z0-9-]/g, '').slice(0, 12);

const normalizeLabel = (value: string): string => value.trim().replaceAll(/\s+/g, ' ');

export const addProjectLanguage = (
	project: WayfindingStudioProject,
	codeValue: string,
	labelValue: string
): boolean => {
	const code = normalizeLanguageCode(codeValue);
	const label = normalizeLabel(labelValue);
	const languages = project.languages ?? [];

	if (!code || !label || languages.some((language): boolean => language.code === code)) return false;

	project.languages = [...languages, { code, label }];

	if (!project.defaultLanguage) project.defaultLanguage = code;

	return true;
};

export const removeProjectLanguage = (
	project: WayfindingStudioProject,
	code: string
): boolean => {
	const languages = project.languages ?? [];

	if (languages.length <= 1 || !languages.some((language): boolean => language.code === code)) return false;

	project.languages = languages.filter((language): boolean => language.code !== code);

	if (project.defaultLanguage === code) project.defaultLanguage = project.languages[0]?.code ?? 'en';

	for (const destination of project.destinations) {
		if (!destination.translations?.[code]) continue;

		const translations = { ...destination.translations };
		delete translations[code];
		destination.translations = translations;
	}

	return true;
};

export const setDefaultProjectLanguage = (
	project: WayfindingStudioProject,
	code: string
): boolean => {
	if (!(project.languages ?? []).some((language): boolean => language.code === code)) return false;

	project.defaultLanguage = code;

	return true;
};

export const addProjectCategory = (
	project: WayfindingStudioProject,
	value: string
): boolean => {
	const category = normalizeLabel(value);
	const categories = project.categories ?? [];

	if (!category || categories.some((candidate): boolean =>
		candidate.toLocaleLowerCase() === category.toLocaleLowerCase()
	)) return false;

	project.categories = [...categories, category].sort((left, right): number => left.localeCompare(right));

	return true;
};

export const renameProjectCategory = (
	project: WayfindingStudioProject,
	currentValue: string,
	nextValue: string
): boolean => {
	const category = normalizeLabel(nextValue);
	const categories = project.categories ?? [];

	if (
		!category
		|| !categories.includes(currentValue)
		|| categories.some((candidate): boolean =>
			candidate !== currentValue
			&& candidate.toLocaleLowerCase() === category.toLocaleLowerCase()
		)
	) return false;

	project.categories = categories
		.map((candidate): string => candidate === currentValue ? category : candidate)
		.sort((left, right): number => left.localeCompare(right));

	for (const destination of project.destinations) {
		if (destination.category === currentValue) destination.category = category;
	}

	return true;
};

export const removeProjectCategory = (
	project: WayfindingStudioProject,
	category: string
): boolean => {
	const categories = project.categories ?? [];

	if (!categories.includes(category)) return false;

	project.categories = categories.filter((candidate): boolean => candidate !== category);

	for (const destination of project.destinations) {
		if (destination.category === category) delete destination.category;
	}

	return true;
};

export const projectLanguages = (project: WayfindingStudioProject): WayfindingStudioLanguage[] =>
	project.languages?.length ? project.languages : [{ code: 'en', label: 'English' }];
