import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const openScenario = async (page: Page, scenario: string): Promise<void> => {
	await page.setViewportSize({ width: 480, height: 270 });
	const response = await page.goto(`/preview/widget.html?background=checker&scenario=${scenario}`);

	expect(response?.ok()).toBe(true);
	await page.waitForFunction((): boolean => document.documentElement.dataset.previewReady === 'true');
};

test('selects the first called ticket and bounds the waiting queue', async ({ page }): Promise<void> => {
	await openScenario(page, 'many-waiting');

	await expect(page.locator('.queue-hero__ticket')).toHaveText('A104');
	await expect(page.locator('.queue-row')).toHaveCount(3);
	await expect(page.locator('.queue-row__ticket')).toHaveText(['A105', 'A106', 'A107']);
	await expect(page.locator('.queue-more')).toHaveText('+4 MORE WAITING');
	await expect(page.getByText('A108', { exact: true })).toHaveCount(0);
});

test('keeps unknown states visible with text and symbol cues', async ({ page }): Promise<void> => {
	await openScenario(page, 'unknown-state');

	await expect(page.locator('.queue-hero')).toHaveClass(/queue-hero--idle/);
	const unknownRow = page.locator('.queue-row[data-state="unknown"]');

	await expect(unknownRow).toHaveCount(1);
	await expect(unknownRow.locator('.queue-row__ticket')).toHaveText('Q204');
	await expect(unknownRow.locator('.queue-row__state')).toContainText('?');
	await expect(unknownRow.locator('.queue-row__state')).toContainText('CHECK STATE');
});

test('expands a lone called ticket across the secondary region', async ({ page }): Promise<void> => {
	await openScenario(page, 'one-ticket');

	await expect(page.locator('.queue-next')).toHaveCount(0);
	const heroWidth: number = await page.locator('.queue-hero').evaluate(
		(element: Element): number => element.getBoundingClientRect().width
	);

	expect(heroWidth).toBeGreaterThanOrEqual(478);
});

test('removes secondary content before shrinking an oversized hero', async ({ page }): Promise<void> => {
	await openScenario(page, 'long-labels');

	await expect(page.locator('.queue-next')).toHaveCount(0);
	await expect(page.locator('.queue-hero__note')).toBeHidden();
	await expect(page.locator('.queue-hero__ticket')).toHaveCSS('font-size', /^(3[0-9]|[4-9][0-9])px$/);
});
