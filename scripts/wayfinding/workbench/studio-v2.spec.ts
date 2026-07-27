import { expect, test, type Page } from '@playwright/test';

import {
	createWayfindingStudioProject,
	type WayfindingStudioProject
} from '../studio-project.mts';

const RECOVERY_KEY = 'wallboard-wayfinding-studio-v2-recovery';

const createTestProject = (): WayfindingStudioProject => {
	const project = createWayfindingStudioProject('studio-v2-test');
	const floor = project.floors[0];
	project.name = 'Northline Test Center';
	project.languages = [
		{ code: 'en', label: 'English' },
		{ code: 'hu', label: 'Magyar' }
	];
	project.categories = ['Dining', 'Services'];
	project.destinations = [{
		category: 'Services',
		description: 'Visitor information and assistance.',
		floor: floor.id,
		id: 'destination-information',
		name: 'Visitor information',
		phone: '+1 555 0100',
		routeable: true,
		translations: {
			hu: {
				description: 'Informacio es segitseg latogatoknak.',
				name: 'Informacio'
			}
		}
	}];
	floor.elements = [
		{
			floorId: floor.id,
			geometry: [
				{ x: 150, y: 160 },
				{ x: 1770, y: 160 },
				{ x: 1770, y: 900 },
				{ x: 150, y: 900 }
			],
			id: 'walkable-main',
			label: 'Main concourse',
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'walkable'
		},
		{
			destinationId: 'destination-information',
			floorId: floor.id,
			geometry: [
				{ x: 1300, y: 220 },
				{ x: 1680, y: 220 },
				{ x: 1680, y: 520 },
				{ x: 1300, y: 520 }
			],
			id: 'location-information',
			label: 'Visitor information',
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'location'
		},
		{
			defaultLanguage: 'en',
			facingDegrees: 0,
			floorId: floor.id,
			id: 'origin-main',
			label: 'You are here',
			point: { x: 320, y: 650 },
			provenance: 'reviewer-authored',
			screenId: 'screen-main',
			status: 'confirmed',
			type: 'origin'
		},
		{
			angle: 90,
			floorId: floor.id,
			id: 'door-information',
			length: 42,
			locationId: 'location-information',
			point: { x: 1300, y: 430 },
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'door'
		}
	];
	project.graph = {
		contractVersion: 2,
		edges: [{
			accessible: true,
			bidirectional: true,
			from: 'route-origin',
			geometry: [
				{ x: 320, y: 650 },
				{ x: 900, y: 650 },
				{ x: 1300, y: 430 }
			],
			id: 'route-main',
			kind: 'walk',
			to: 'route-destination'
		}],
		graphId: 'studio-v2-test-graph',
		nodes: [
			{
				id: 'route-origin',
				kind: 'route',
				levelId: floor.id,
				semanticElementId: 'origin-main',
				x: 320,
				y: 650
			},
			{
				id: 'route-destination',
				kind: 'route',
				levelId: floor.id,
				locationId: 'destination-information',
				semanticElementId: 'door-information',
				x: 1300,
				y: 430
			}
		]
	};

	return project;
};

const openEditor = async (page: Page): Promise<void> => {
	const project = createTestProject();
	await page.addInitScript(({ key, serialized }) => {
		localStorage.setItem(key, serialized);
	}, { key: RECOVERY_KEY, serialized: JSON.stringify(project) });
	await page.goto('/v2/');
	await expect(page.getByText('Northline Test Center')).toBeVisible();
	await expect(page.locator('.map-transform')).toBeVisible();
};

const mapTransform = (page: Page): Promise<string | null> =>
	page.locator('.map-transform').getAttribute('style');

test('keeps the map camera stable across panel, workspace, and undo interactions', async ({ page }) => {
	await openEditor(page);
	const viewport = page.locator('.canvas-viewport');
	const bounds = await viewport.boundingBox();
	expect(bounds).not.toBeNull();
	await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
	await page.mouse.wheel(0, -450);
	const zoomed = await mapTransform(page);

	await page.getByRole('button', { name: 'Close project panel' }).click();
	await expect(page.locator('.left-panel')).toHaveCSS('transform', /matrix/);
	expect(await mapTransform(page)).toBe(zoomed);

	await page.getByRole('button', { name: 'Route edit' }).click();
	expect(await mapTransform(page)).toBe(zoomed);
	await page.getByRole('button', { name: 'Map', exact: true }).click();
	expect(await mapTransform(page)).toBe(zoomed);

	await page.getByLabel('Project name').fill('Northline Edited');
	await page.getByLabel('Project name').blur();
	expect(await mapTransform(page)).toBe(zoomed);
	await page.getByRole('button', { name: /Undo/ }).click();
	expect(await mapTransform(page)).toBe(zoomed);
});

test('visitor preview provides a clean localized directory and route experience', async ({ page }) => {
	await openEditor(page);
	await page.getByRole('button', { name: 'Visitor preview' }).click();
	await expect(page.getByLabel('Visitor map directory')).toBeVisible();
	await expect(page.locator('.route-network-line')).toHaveCount(0);
	await expect(page.locator('.route-overlay .simulated-route')).toHaveCount(0);

	await page.getByLabel('Language').selectOption('hu');
	await expect(page.getByRole('button', { name: /Informacio/ })).toBeVisible();
	await page.getByRole('button', { name: /Informacio/ }).click();
	await expect(page.locator('.visitor-detail')).toContainText('Informacio es segitseg latogatoknak.');
	await page.getByRole('button', { name: /Show directions/ }).click();
	await expect(page.locator('.route-overlay .simulated-route')).toHaveCount(1);

	await page.getByPlaceholder('Search destinations').fill('not present');
	await expect(page.getByText('No matches')).toBeVisible();
});

test('supports keyboard-safe dialogs and mode semantics', async ({ page }) => {
	await openEditor(page);
	await expect(page.getByRole('button', { name: 'Map', exact: true })).toHaveAttribute('aria-pressed', 'true');
	await page.getByRole('button', { name: 'Shortcuts' }).click();
	await expect(page.getByRole('dialog', { name: 'Keyboard and map controls' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Close shortcuts' })).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(page.getByRole('dialog', { name: 'Keyboard and map controls' })).toHaveCount(0);
});

test('keeps the workbench contained at a compact desktop viewport', async ({ page }) => {
	await page.setViewportSize({ width: 1024, height: 720 });
	await openEditor(page);
	const workbench = page.locator('.workbench');
	const stage = page.locator('.stage');
	const appBar = page.locator('.app-bar');
	await expect(workbench).toHaveCSS('overflow', 'hidden');
	const stageBounds = await stage.boundingBox();
	const appBarBounds = await appBar.boundingBox();
	expect(stageBounds).not.toBeNull();
	expect(appBarBounds).not.toBeNull();
	expect(stageBounds!.width).toBeGreaterThan(450);
	expect(appBarBounds!.x + appBarBounds!.width).toBeLessThanOrEqual(1024);
});

test('renders a non-empty 3D scene and keeps it mounted during selection changes', async ({ page }) => {
	await openEditor(page);
	await page.getByRole('button', { name: '3D' }).click();
	const canvas = page.locator('.scene3d-host canvas');
	await expect(canvas).toBeVisible();
	const before = await canvas.screenshot();
	expect(new Set(before).size).toBeGreaterThan(20);
	await page.getByRole('button', { name: 'Visitor preview' }).click();
	await expect(canvas).toBeVisible();
	await page.getByRole('button', { name: /Visitor information/ }).click();
	await expect(canvas).toBeVisible();
});
