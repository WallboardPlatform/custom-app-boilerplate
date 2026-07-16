import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const pageDurationMs: number = 3000;

const openScenario = async (
	page: Page,
	scenario: string,
	viewport: { width: number; height: number }
): Promise<void> => {
	await page.clock.install({ time: new Date('2026-02-12T10:00:00Z') });
	await page.setViewportSize(viewport);
	const query: URLSearchParams = new URLSearchParams({ background: 'dark', scenario });
	const response = await page.goto(`/preview/widget.html?${query.toString()}`);

	expect(response?.ok()).toBe(true);
	await page.waitForFunction((): boolean => {
		return (
			document.documentElement.dataset.previewReady === 'true' || Boolean(document.documentElement.dataset.previewError)
		);
	});

	const previewError: string | undefined = await page.evaluate((): string | undefined => {
		return document.documentElement.dataset.previewError;
	});

	expect(previewError).toBeUndefined();
	await expect(page.locator('.andon-brand__name')).toContainText('NORTHSTAR');
	const pauseTime: number = await page.evaluate((): number => Date.now() + 100);

	await page.clock.pauseAt(pauseTime);
};

test('groups rows in source order and preserves recognized state tones', async ({ page }): Promise<void> => {
	await openScenario(page, 'mixed-line-load', { width: 1080, height: 1920 });

	await expect(page.locator('.line-section')).toHaveCount(4);
	await expect(page.locator('.line-section__name')).toHaveText([
		'LINE A / FINAL ASSEMBLY',
		'LINE B / MODULE BUILD',
		'LINE C / END-OF-LINE',
		'LINE D / PACKOUT'
	]);
	await expect(page.locator('.station-row')).toHaveCount(11);
	await expect(page.locator('.wb-app')).toHaveAttribute('data-summary-tone', 'stopped');
	await expect(page.locator('.station-row[data-state-tone="normal"]')).toHaveCount(8);
	await expect(page.locator('.station-row[data-state-tone="attention"]')).toHaveCount(2);
	await expect(page.locator('.station-row[data-state-tone="stopped"]')).toHaveCount(1);
});

test('preserves shape-and-text fallback for an unknown state', async ({ page }): Promise<void> => {
	await openScenario(page, 'unknown-state', { width: 480, height: 1920 });

	const unknownRow = page.locator('.station-row[data-state-tone="unknown"]');

	await expect(unknownRow).toHaveCount(1);
	await expect(unknownRow.locator('.station-row__state')).toHaveText('UNKNOWN');
	await expect(unknownRow.locator('.state-marker')).toContainText('?');
});

test('rotates complete line groups without splitting them', async ({ page }): Promise<void> => {
	await openScenario(page, 'maximum-content', { width: 1080, height: 1920 });

	const root = page.locator('.wb-app');

	await expect(root).toHaveAttribute('data-page-count', '2');
	await expect(root).toHaveAttribute('data-page-current', '1');
	await expect(page.locator('.line-section')).toHaveCount(3);
	await expect(page.locator('.station-row')).toHaveCount(9);
	await expect(page.locator('.andon-pagination strong')).toHaveText('VIEW 1 OF 2');

	await page.clock.fastForward(pageDurationMs);

	await expect(root).toHaveAttribute('data-page-current', '2');
	await expect(page.locator('.line-section')).toHaveCount(3);
	await expect(page.locator('.station-row')).toHaveCount(9);
	await expect(page.locator('.line-section__name').first()).toHaveText('LINE 4 / ASSEMBLY ZONE');
});

test('marks both sides of an oversized line continuation', async ({ page }): Promise<void> => {
	await openScenario(page, 'final-partial-group', { width: 1080, height: 1920 });

	await expect(page.locator('.station-row')).toHaveCount(11);
	await expect(page.locator('.line-section__identity > span')).toContainText('MORE NEXT');

	await page.clock.fastForward(pageDurationMs);

	await expect(page.locator('.station-row')).toHaveCount(6);
	await expect(page.locator('.line-section__identity > span')).toContainText('CONTINUED');
	await expect(page.locator('.station-row__name').first()).toHaveText('X-12 COMMISSIONING POINT');
});

test('releases the mounted instance and its rotation resources on destroy', async ({ page }): Promise<void> => {
	await openScenario(page, 'maximum-content', { width: 1080, height: 1920 });

	await page.evaluate(async (): Promise<void> => {
		const previewWindow = window as Window & {
			__wallboardPreview?: { destroy: () => Promise<void> };
		};

		if (!previewWindow.__wallboardPreview) {
			throw new Error('Preview destroy bridge is unavailable.');
		}

		await previewWindow.__wallboardPreview.destroy();
	});
	await page.clock.fastForward(pageDurationMs * 2);
	await expect(page.locator('.wb-app')).toHaveCount(0);
});
