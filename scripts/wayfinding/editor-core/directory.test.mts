import assert from 'node:assert/strict';
import test from 'node:test';

import { createWayfindingStudioProject } from '../studio-project.mts';
import {
	addProjectCategory,
	addProjectLanguage,
	removeProjectCategory,
	removeProjectLanguage,
	renameProjectCategory,
	setDefaultProjectLanguage
} from './directory.ts';

void test('project language operations keep the default and destination translations consistent', () => {
	const project = createWayfindingStudioProject('directory-test');

	assert.equal(addProjectLanguage(project, ' HU ', ' Hungarian '), true);
	assert.equal(addProjectLanguage(project, 'hu', 'Duplicate'), false);
	assert.equal(setDefaultProjectLanguage(project, 'hu'), true);
	project.destinations.push({
		id: 'destination-1',
		name: 'Lobby',
		translations: { hu: { name: 'Elocsarnok' } }
	});

	assert.equal(removeProjectLanguage(project, 'hu'), true);
	assert.equal(project.defaultLanguage, 'en');
	assert.deepEqual(project.destinations[0]?.translations, {});
	assert.equal(removeProjectLanguage(project, 'en'), false);
});

void test('category rename and removal update every destination reference', () => {
	const project = createWayfindingStudioProject('category-test');
	project.categories = [];
	project.destinations.push(
		{ category: 'Dining', id: 'destination-1', name: 'Cafe' },
		{ category: 'Services', id: 'destination-2', name: 'Desk' }
	);

	assert.equal(addProjectCategory(project, ' Dining '), true);
	assert.equal(addProjectCategory(project, 'dining'), false);
	assert.equal(addProjectCategory(project, 'Services'), true);
	assert.equal(renameProjectCategory(project, 'Dining', 'Food and drink'), true);
	assert.equal(project.destinations[0]?.category, 'Food and drink');
	assert.equal(removeProjectCategory(project, 'Services'), true);
	assert.equal(project.destinations[1]?.category, undefined);
});
