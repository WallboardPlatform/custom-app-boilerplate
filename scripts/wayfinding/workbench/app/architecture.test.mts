import assert from 'node:assert/strict';
import {
	existsSync,
	readFileSync,
	readdirSync
} from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const appDirectory = path.dirname(fileURLToPath(import.meta.url));
const workbenchDirectory = path.dirname(appDirectory);

void test('feature workflows own their components instead of leaking into a shared bucket', () => {
	const ownership = {
		assets: ['AssetLibrary.tsx'],
		directory: ['DestinationInspector.tsx', 'DirectorySettings.tsx'],
		map: ['ObjectTree.tsx'],
		preview: ['VisitorDestinationCard.tsx', 'VisitorPanel.tsx'],
		routing: [
			'RouteAuthoringViews.tsx',
			'RouteBuildView.tsx',
			'RouteGraphNavigator.tsx',
			'RouteObjectInspectors.tsx',
			'RoutePanel.tsx'
		]
	};

	for (const [feature, files] of Object.entries(ownership)) {
		for (const file of files) {
			assert.equal(
				existsSync(path.join(appDirectory, 'features', feature, file)),
				true,
				`${feature} must own ${file}`
			);
			assert.equal(
				existsSync(path.join(appDirectory, 'components', file)),
				false,
				`${file} must not return to the shared component bucket`
			);
		}
	}
});

void test('headless canvas controllers do not load UI feature barrels', () => {
	const controllerFiles = readdirSync(path.join(appDirectory, 'canvas'))
		.filter((file) => file.endsWith('.ts') && !file.endsWith('.test.mts'));

	for (const file of controllerFiles) {
		const source = readFileSync(path.join(appDirectory, 'canvas', file), 'utf8');

		assert.doesNotMatch(
			source,
			/from ['"]\.\.\/features\/(?:preview|routing)['"]/u,
			`${file} must import headless feature modules directly`
		);
	}
});

void test('the v1 workbench has one application entry point', () => {
	assert.equal(existsSync(path.join(workbenchDirectory, 'v2')), false);
	assert.match(
		readFileSync(path.join(workbenchDirectory, 'index.html'), 'utf8'),
		/src="\.\/app\/main\.tsx"/u
	);
});
