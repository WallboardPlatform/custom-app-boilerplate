import type { DonorRecord, DonorSearchResult } from '@interfaces/donor-directory.interface';

import { normalizeSearchText } from '@utils/donor-data';

export const titleCaseSearchQuery = (value: unknown): string => {
	if (typeof value !== 'string') {
		return '';
	}

	const collapsedWhitespace: string = value.replace(/\s+/g, ' ').replace(/^\s+/, '');
	let titleCased: string = '';
	let startsWord = true;

	for (let index: number = 0; index < collapsedWhitespace.length; index += 1) {
		const character: string = collapsedWhitespace.charAt(index);

		if (character === ' ') {
			if (titleCased && titleCased.charAt(titleCased.length - 1) !== ' ') {
				titleCased += ' ';
			}

			startsWord = true;

			continue;
		}

		titleCased += startsWord ? character.toLocaleUpperCase() : character.toLocaleLowerCase();
		startsWord = false;
	}

	return titleCased;
};

export const rankDonorsForSearch = (donors: readonly DonorRecord[], queryValue: unknown): DonorSearchResult[] => {
	const query: string = normalizeSearchText(queryValue);

	if (!query) {
		return [];
	}

	const prefixMatches: DonorSearchResult[] = [];
	const substringMatches: DonorSearchResult[] = [];

	for (let donorIndex: number = 0; donorIndex < donors.length; donorIndex += 1) {
		const donor: DonorRecord = donors[donorIndex];
		const normalizedIdentity: string = normalizeSearchText(donor.field1Text);
		const matchIndex: number = normalizedIdentity.indexOf(query);

		if (matchIndex < 0) {
			continue;
		}

		const result: DonorSearchResult = {
			donor,
			match: matchIndex === 0 ? 'prefix' : 'substring',
			matchIndex,
			isBestMatch: false
		};

		if (matchIndex === 0) {
			prefixMatches.push(result);
		} else {
			substringMatches.push(result);
		}
	}

	const results: DonorSearchResult[] = prefixMatches.concat(substringMatches);

	if (results.length > 0) {
		results[0] = {
			...results[0],
			isBestMatch: true
		};
	}

	return results;
};

export const searchDonors = (donors: readonly DonorRecord[], queryValue: unknown): DonorRecord[] => {
	const query: string = normalizeSearchText(queryValue);

	if (!query) {
		return donors.slice();
	}

	return rankDonorsForSearch(donors, query).map((result: DonorSearchResult): DonorRecord => result.donor);
};
