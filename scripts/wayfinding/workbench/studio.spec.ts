import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

test('authors, refines, and exports a portable semantic project', async ({ page }, testInfo) => {
	const errors: string[] = [];
	page.on('console', (message): void => { if (message.type() === 'error') errors.push(message.text()); });
	page.on('pageerror', (error): void => { errors.push(error.message); });
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'Wayfinding Studio' })).toBeVisible();
	await expect(page.locator('#studio-floor')).toHaveValue('level-0');

	const canvas = page.locator('#stage');
	await page.locator('[data-tool="location"]').click();
	await canvas.click({ position: { x: 230, y: 320 } });
	await canvas.click({ position: { x: 430, y: 320 } });
	await canvas.click({ position: { x: 430, y: 490 } });
	await canvas.click({ position: { x: 230, y: 490 } });
	await page.locator('#semantic-finish').click();
	await expect(page.locator('#semantic-editor h2')).toHaveText('Room / area');
	await page.locator('[data-tool="select"]').click();
	await canvas.dblclick({ position: { x: 330, y: 320 } });

	await canvas.hover({ position: { x: 330, y: 400 } });
	await page.mouse.wheel(0, -120);

	await page.locator('[data-tool="origin"]').click();
	await canvas.click({ position: { x: 160, y: 520 } });
	await expect(page.locator('#route-start option')).toHaveCount(1);
	await expect(page.locator('#route-destination option')).toHaveCount(1);

	await page.locator('#studio-add-floor').click();
	await expect(page.locator('#studio-floor option')).toHaveCount(2);
	await page.locator('#studio-delete-floor').click();
	await expect(page.locator('#studio-floor option')).toHaveCount(1);
	await page.locator('[data-tool="select"]').click();
	await canvas.click({ position: { x: 330, y: 400 } });
	await expect(page.locator('#semantic-editor h2')).toHaveText('Room / area');

	const screenshotPath: string = testInfo.outputPath('authored-studio.png');
	await page.screenshot({ fullPage: true, path: screenshotPath });
	await testInfo.attach('authored-studio', { contentType: 'image/png', path: screenshotPath });

	const downloadPromise = page.waitForEvent('download');
	await page.locator('#studio-export-project').click();
	const download = await downloadPromise;
	const downloadPath: string = await download.path() as string;
	const project = JSON.parse(fs.readFileSync(downloadPath, 'utf8')) as { floors: Array<{ elements: Array<{ geometry?: unknown[]; type: string }> }> };
	expect(project.floors[0].elements.map((element): string => element.type)).toEqual(['location', 'origin']);
	expect(project.floors[0].elements[0].geometry).toHaveLength(5);
	expect(errors).toEqual([]);
});

test('opens the maintained Veszprem highlight project with embedded artwork', async ({ page }, testInfo) => {
	const errors: string[] = [];
	page.on('console', (message): void => { if (message.type() === 'error') errors.push(message.text()); });
	page.on('pageerror', (error): void => { errors.push(error.message); });
	await page.goto('/');
	await page.locator('#studio-project-file').setInputFiles(path.resolve('examples', 'veszprem-wayfinding', 'veszprem-downtown.wbwayfinding'));
	await expect(page.locator('#studio-floor')).toHaveValue('downtown');
	await expect(page.locator('#route-destination option')).toHaveCount(36);
	await expect(page.locator('#studio-validation')).toContainText('RUNTIME EXPORT READY');
	const centerPixel = await page.locator('#stage').evaluate((canvas: HTMLCanvasElement): number[] => {
		const context = canvas.getContext('2d');
		return context ? [...context.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data] : [];
	});
	expect(centerPixel).toHaveLength(4);
	expect(centerPixel.slice(0, 3)).not.toEqual([247, 245, 239]);
	const screenshotPath: string = testInfo.outputPath('veszprem-studio.png');
	await page.screenshot({ fullPage: true, path: screenshotPath });
	await testInfo.attach('veszprem-studio', { contentType: 'image/png', path: screenshotPath });
	expect(errors).toEqual([]);
});

test('keeps specialist controls out of the authoring path and supports reversible deletion', async ({ page }, testInfo) => {
	const errors: string[] = [];
	page.on('console', (message): void => { if (message.type() === 'error') errors.push(message.text()); });
	page.on('pageerror', (error): void => { errors.push(error.message); });
	await page.goto('/');

	await expect(page.locator('[data-tool="select"]')).toHaveClass(/active/u);
	await expect(page.locator('#tool-title')).toHaveText('Select & move');
	await expect(page.locator('#reviewer-id')).not.toBeVisible();
	await expect(page.getByText('Destination details', { exact: true })).not.toBeVisible();
	await page.getByText('Review & delivery', { exact: true }).click();
	await expect(page.getByText('What is this?', { exact: true })).toBeVisible();
	await expect(page.getByText('Destination details', { exact: true })).toBeVisible();
	await expect(page.getByText('The connected route network used for directions.', { exact: true })).toBeVisible();
	const reviewScreenshotPath: string = testInfo.outputPath('review-delivery-panel.png');
	await page.screenshot({ fullPage: true, path: reviewScreenshotPath });
	await testInfo.attach('review-delivery-panel', { contentType: 'image/png', path: reviewScreenshotPath });
	await page.getByText('Review & delivery', { exact: true }).click();

	const canvas = page.locator('#stage');
	await page.locator('[data-tool="location"]').click();
	await canvas.click({ position: { x: 220, y: 280 } });
	await canvas.click({ position: { x: 420, y: 280 } });
	await canvas.click({ position: { x: 420, y: 440 } });
	await canvas.click({ position: { x: 220, y: 440 } });
	await page.locator('#semantic-finish').click();
	await expect(page.locator('#delete-selection')).toBeEnabled();

	await page.locator('[data-tool="select"]').click();
	await page.locator('#delete-selection').click();
	await expect(page.locator('#undo')).toBeEnabled();
	await expect(page.locator('#semantic-editor')).toContainText('Select an authored');

	await page.locator('#undo').click();
	await canvas.click({ position: { x: 320, y: 360 } });
	await expect(page.locator('#semantic-editor h2')).toHaveText('Room / area');
	await expect(page.locator('#redo')).toBeEnabled();

	await page.locator('#redo').click();
	await canvas.click({ position: { x: 320, y: 360 } });
	await expect(page.locator('#semantic-editor')).toContainText('Select an authored');
	expect(errors).toEqual([]);
});

test('edits room and POI descriptions with discoverable keyboard authoring', async ({ page }) => {
	const errors: string[] = [];
	page.on('console', (message): void => { if (message.type() === 'error') errors.push(message.text()); });
	page.on('pageerror', (error): void => { errors.push(error.message); });
	await page.goto('/');

	await page.keyboard.press('?');
	await expect(page.locator('#shortcut-dialog')).toBeVisible();
	await expect(page.locator('#shortcut-dialog')).toContainText('Hold to pan');
	await expect(page.locator('#shortcut-dialog')).toContainText('Save project');
	await page.locator('#shortcut-close').click();

	const canvas = page.locator('#stage');
	await page.keyboard.press('r');
	await expect(page.locator('[data-tool="location"]')).toHaveClass(/active/u);
	await canvas.click({ position: { x: 220, y: 280 } });
	await canvas.click({ position: { x: 420, y: 280 } });
	await canvas.click({ position: { x: 420, y: 440 } });
	await canvas.click({ position: { x: 220, y: 440 } });
	await page.keyboard.press('Enter');
	const selection = page.locator('#semantic-editor');
	await expect(selection.getByRole('heading', { name: 'Room / area' })).toBeVisible();
	await selection.getByLabel('Name', { exact: true }).fill('Visitor services');
	await selection.getByLabel('Description').fill('Maps, tickets, and local assistance for visitors.');
	await selection.getByLabel('Category').fill('Services');

	await selection.getByRole('heading', { name: 'Room / area' }).click();
	await page.keyboard.press('p');
	await canvas.click({ position: { x: 520, y: 360 } });
	await expect(selection.getByRole('heading', { name: 'Point of interest' })).toBeVisible();
	await selection.getByLabel('Name', { exact: true }).fill('Information desk');
	await selection.getByLabel('Description').fill('Staffed help desk near the main entrance.');
	await selection.getByLabel('Category').fill('Information');
	await selection.getByRole('heading', { name: 'Point of interest' }).click();
	await page.keyboard.press('l');
	await canvas.click({ position: { x: 600, y: 300 } });
	await expect(selection.getByRole('heading', { name: 'Text label' })).toBeVisible();
	await selection.getByLabel('Text', { exact: true }).fill('Main entrance');
	await selection.getByLabel('Font family').selectOption('serif');
	await selection.getByLabel('Font size').fill('36');
	await selection.getByLabel('Weight').selectOption('700');
	await selection.getByLabel('Text color').fill('#264653');
	await selection.getByLabel('Alignment').selectOption('middle');
	await selection.getByLabel('Outline color').fill('#ffffff');
	await selection.getByLabel('Outline width').fill('2');

	const downloadPromise = page.waitForEvent('download');
	await page.keyboard.press('Control+s');
	const download = await downloadPromise;
	const downloadPath: string = await download.path() as string;
	const project = JSON.parse(fs.readFileSync(downloadPath, 'utf8')) as { destinations: Array<{ category?: string; description?: string; name: string }>; floors: Array<{ elements: Array<Record<string, unknown>> }> };
	expect(project.destinations).toEqual(expect.arrayContaining([
		expect.objectContaining({ category: 'Services', description: 'Maps, tickets, and local assistance for visitors.', name: 'Visitor services' }),
		expect.objectContaining({ category: 'Information', description: 'Staffed help desk near the main entrance.', name: 'Information desk' })
	]));
	expect(project.floors[0].elements).toEqual(expect.arrayContaining([
		expect.objectContaining({ color: '#264653', fontFamily: 'serif', fontSize: 36, fontWeight: 700, outlineColor: '#ffffff', outlineWidth: 2, text: 'Main entrance', textAnchor: 'middle', type: 'label' })
	]));
	expect(errors).toEqual([]);
});
