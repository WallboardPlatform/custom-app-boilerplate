import { expect, test } from '@playwright/test';

const openScenario = async (page: import('@playwright/test').Page, scenario?: string): Promise<void> => {
	const query: string = scenario ? `?background=dark&scenario=${scenario}` : '?background=dark';
	const response = await page.goto(`/preview/widget.html${query}`);

	expect(response?.ok()).toBe(true);
	await page.waitForFunction((): boolean => document.documentElement.dataset.previewReady === 'true');
	await page.waitForSelector('.agent-grid, .agent-empty');
};

test('first page contains eight alphabetically sorted agents', async ({ page }): Promise<void> => {
	await openScenario(page);

	const cards = page.locator('.agent-card');
	await expect(cards).toHaveCount(8);
	await expect(cards.first()).toHaveAttribute('data-agent-name', 'Avery Morgan');
	await expect(cards.last()).toHaveAttribute('data-agent-name', 'Harper Lane');
});

test('known state aliases map to semantic tones', async ({ page }): Promise<void> => {
	await openScenario(page, 'mixed-states');

	await expect(page.locator('[data-agent-tone="ready"]')).toHaveCount(2);
	await expect(page.locator('[data-agent-tone="busy"]')).toHaveCount(2);
	await expect(page.locator('[data-agent-tone="acw"]')).toHaveCount(1);
	await expect(page.locator('[data-agent-tone="away"]')).toHaveCount(2);
	await expect(page.locator('[data-agent-tone="offline"]')).toHaveCount(1);
});

test('pagination advances to an uneven final page without stretching its count', async ({ page }): Promise<void> => {
	await openScenario(page, 'second-page');
	await expect(page.locator('.agent-card')).toHaveCount(8);

	await page.waitForTimeout(3300);

	const cards = page.locator('.agent-card');
	await expect(cards).toHaveCount(5);
	await expect(cards.first()).toHaveAttribute('data-agent-name', 'Indigo Price');
	await expect(page.locator('.wb-app')).toHaveAttribute('data-page-index', '1');
});
