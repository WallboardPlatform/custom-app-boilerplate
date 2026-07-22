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
	await expect(page.locator('#semantic-editor h2')).toContainText('LOCATION');
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
	await expect(page.locator('#semantic-editor h2')).toContainText('LOCATION');

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
