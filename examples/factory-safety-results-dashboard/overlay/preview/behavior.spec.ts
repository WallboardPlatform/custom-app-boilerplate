import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

interface PreviewWindow extends Window {
	__wallboardPreview?: {
		pushDatasource: (property: string, value: unknown) => void;
	};
}

const openScenario = async (page: Page, scenario = 'full-hd'): Promise<void> => {
	const compact: boolean = scenario !== 'full-hd' && scenario !== 'corporate-ids';
	await page.setViewportSize(compact ? { width: 1366, height: 768 } : { width: 1920, height: 1080 });
	const response = await page.goto(`/preview/widget.html?scenario=${scenario}&background=dark`);

	expect(response?.ok()).toBe(true);
	await page.waitForFunction((): boolean => document.documentElement.dataset.previewReady === 'true');
};

test('derives completion and pass metrics from retained result rows', async ({ page }): Promise<void> => {
	await openScenario(page);
	await expect(page.locator('[data-metric="completion-count"]')).toHaveText('12');
	await expect(page.locator('[data-metric="pass-rate"]')).toHaveText('58%');
	await expect(page.getByText('Avery Morgan')).toBeVisible();
});

test('bound empty results remain empty instead of restoring sample records', async ({ page }): Promise<void> => {
	await openScenario(page, 'empty');
	await expect(page.getByText('No completed safety checks yet.')).toBeVisible();
	await expect(page.locator('[data-metric="completion-count"]')).toHaveCount(0);
});

test('live datasource updates recompute dashboard statistics', async ({ page }): Promise<void> => {
	await openScenario(page, 'row-array');
	await expect(page.locator('[data-metric="completion-count"]')).toHaveText('4');

	await page.evaluate((): void => {
		(window as PreviewWindow).__wallboardPreview?.pushDatasource('resultsData', {
			Results: {
				rows: [
					{ submissionId: 'live-1', participantName: 'Updated Operator', corporateId: 'NM-2001', score: 3, totalQuestions: 3, completedAt: '2026-07-17T13:00:00Z', answersJson: '[]' }
				]
			}
		});
	});

	await expect(page.locator('[data-metric="completion-count"]')).toHaveText('1');
	await expect(page.getByText('Updated Operator')).toBeVisible();
});
