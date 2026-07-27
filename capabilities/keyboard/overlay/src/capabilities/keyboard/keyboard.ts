export type KeyboardLayoutId = 'en' | 'hu';

export interface KeyboardLayout {
	id: string;
	label: string;
	rows: readonly (readonly string[])[];
}

export const ENGLISH_KEYBOARD_LAYOUT: KeyboardLayout = {
	id: 'en',
	label: 'EN',
	rows: [
		['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
		['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
		['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
		['z', 'x', 'c', 'v', 'b', 'n', 'm']
	]
};

export const HUNGARIAN_KEYBOARD_LAYOUT: KeyboardLayout = {
	id: 'hu',
	label: 'HU',
	rows: [
		['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
		['q', 'w', 'e', 'r', 't', 'z', 'u', 'i', 'o', 'p', 'ő', 'ú'],
		['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'é', 'á', 'ű'],
		['í', 'y', 'x', 'c', 'v', 'b', 'n', 'm', 'ö', 'ü', 'ó']
	]
};

const BUILT_IN_LAYOUTS: Record<KeyboardLayoutId, KeyboardLayout> = {
	en: ENGLISH_KEYBOARD_LAYOUT,
	hu: HUNGARIAN_KEYBOARD_LAYOUT
};

export const keyboardLayoutsFor = (ids: readonly KeyboardLayoutId[]): KeyboardLayout[] => {
	const layouts: KeyboardLayout[] = [];

	for (const id of ids) {
		if (!layouts.some((layout): boolean => layout.id === id)) {
			layouts.push(BUILT_IN_LAYOUTS[id]);
		}
	}

	return layouts.length > 0 ? layouts : [ENGLISH_KEYBOARD_LAYOUT];
};

export const appendKeyboardValue = (value: string, key: string, maximumLength = 120): string => {
	if (maximumLength <= 0 || value.length >= maximumLength) {
		return value;
	}

	return `${value}${key}`.slice(0, maximumLength);
};

export const removeLastKeyboardCharacter = (value: string): string => {
	return Array.from(value).slice(0, -1).join('');
};

/**
 * Space is tapped, not typed. A wide space bar under a finger produces double taps easily, and a
 * query with a doubled or leading space matches nothing while looking identical on screen. This
 * collapses both cases instead of leaving every app to guard its own space key.
 */
export const appendKeyboardSpace = (value: string, maximumLength = 120): string => {
	if (value.length === 0 || value.endsWith(' ')) {
		return value;
	}

	return appendKeyboardValue(value, ' ', maximumLength);
};
