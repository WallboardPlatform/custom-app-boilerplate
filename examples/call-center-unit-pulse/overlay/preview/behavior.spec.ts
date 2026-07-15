import { expect, test } from '@playwright/test';

const openScenario = async (page: import('@playwright/test').Page, scenario?: string): Promise<void> => {
	const query: string = scenario ? `?background=dark&scenario=${scenario}` : '?background=dark';
	const response = await page.goto(`/preview/widget.html${query}`);

	expect(response?.ok()).toBe(true);
	await page.waitForFunction((): boolean => document.documentElement.dataset.previewReady === 'true');
	await page.waitForSelector('.unit-content, .unit-empty');
};

test('keyed datasource excludes configured aggregates and starts alphabetically', async ({ page }): Promise<void> => {
	await openScenario(page);

	await expect(page.locator('.unit-content')).toHaveAttribute('data-unit-name', 'DSTATS');
	await expect(page.locator('body')).not.toContainText('All BGE');
	await expect(page.locator('body')).not.toContainText('TOTAL');
});

test('unit rotation advances after the configured duration', async ({ page }): Promise<void> => {
	await openScenario(page, 'rotation');
	await expect(page.locator('.unit-content')).toHaveAttribute('data-unit-name', 'DSTATS');

	await page.waitForTimeout(3300);

	await expect(page.locator('.unit-content')).toHaveAttribute('data-unit-name', 'EMR');
});

test('malformed keyed rows are skipped without hiding valid units', async ({ page }): Promise<void> => {
	await openScenario(page, 'malformed-records');

	await expect(page.locator('.unit-content')).toHaveAttribute('data-unit-name', 'GAS');
	await expect(page.locator('.unit-gauges article')).toHaveCount(3);
	await expect(page.locator('.unit-metrics article')).toHaveCount(6);
});
