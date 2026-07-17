import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

interface PreviewWindow extends Window {
	__wallboardPreview?: {
		platform: {
			datasourceActions: Array<{ action: string; payload: Record<string, unknown> }>;
			sensorEvents: unknown[];
			getDatasource: (id: string) => unknown;
		};
		pushExternalCommand: (command: string) => void;
	};
}

const openScenario = async (page: Page, scenario = 'full-hd'): Promise<void> => {
	const viewport = scenario === 'compact' || scenario === 'empty'
		? { width: 1366, height: 768 }
		: { width: 1920, height: 1080 };

	await page.setViewportSize(viewport);
	const response = await page.goto(`/preview/widget.html?scenario=${scenario}&background=dark`);

	expect(response?.ok()).toBe(true);
	await page.waitForFunction((): boolean => {
		return document.documentElement.dataset.previewReady === 'true' || Boolean(document.documentElement.dataset.previewError);
	});
	expect(await page.evaluate((): string | undefined => document.documentElement.dataset.previewError)).toBeUndefined();
};

const completeQuestionnaire = async (page: Page): Promise<void> => {
	await page.getByRole('button', { name: 'Start safety check' }).click();
	await expect(page.locator('[data-preview-id="factory-safety-root"]')).toHaveAttribute('data-view', 'identity');
	await page.getByLabel('Full name').fill('Jordan Rivera');
	await page.getByLabel('Corporate ID').fill('NM-1042');
	await page.getByRole('button', { name: 'Continue' }).click();

	for (const answer of ['A', 'C', 'B']) {
		await page.getByRole('button', { name: new RegExp(`^${answer} `) }).click();
		await page.getByRole('button', { name: /Next question|Review score/ }).click();
	}

	await expect(page.locator('[data-preview-id="factory-safety-root"]')).toHaveAttribute('data-view', 'summary');
};

test('completes the touch journey and records one result plus one sensor event', async ({ page }): Promise<void> => {
	await openScenario(page);
	await completeQuestionnaire(page);
	await page.getByRole('button', { name: 'Submit result' }).evaluate((button: HTMLButtonElement): void => {
		button.click();
		button.click();
	});
	await expect(page.locator('[data-preview-id="factory-safety-root"]')).toHaveAttribute('data-view', 'complete');
	await expect(page.locator('[data-submit-status="saved"]')).toBeVisible();

	const evidence = await page.evaluate(() => {
		const preview = (window as PreviewWindow).__wallboardPreview;
		return {
			actions: preview?.platform.datasourceActions,
			results: preview?.platform.getDatasource('preview-safety-results'),
			sensorEvents: preview?.platform.sensorEvents
		};
	});

	expect(evidence.actions).toHaveLength(1);
	expect(evidence.actions?.[0]?.action).toBe('insertToInternalDatasourceArray');
	expect(evidence.results).toMatchObject({
		Results: {
			rows: [
				{
					corporateId: 'NM-1042',
					participantName: 'Jordan Rivera',
					score: 3,
					totalQuestions: 3
				}
			]
		}
	});
	expect(evidence.sensorEvents).toHaveLength(1);
	expect(evidence.sensorEvents?.[0]).toMatchObject({
		data: {
			event: {
				event: 'safety-check-completed',
				value: { score: 3, totalQuestions: 3 }
			}
		}
	});
});

test('editor preview never claims that a blocked result was saved', async ({ page }): Promise<void> => {
	await openScenario(page);
	await completeQuestionnaire(page);
	await page.evaluate((): void => {
		(window as Window & { CustomWidgetAPI?: { isDisplayer?: boolean } }).CustomWidgetAPI!.isDisplayer = false;
	});
	await page.getByRole('button', { name: 'Submit result' }).click();

	await expect(page.locator('[data-submit-status="preview"]')).toBeVisible();
	await expect(page.getByText('Results are saved only when this app runs in the displayer.')).toBeVisible();
	const actionCount = await page.evaluate((): number => {
		return (window as PreviewWindow).__wallboardPreview?.platform.datasourceActions.length ?? -1;
	});
	expect(actionCount).toBe(0);
});

test('remote reset clears an abandoned participant session immediately', async ({ page }): Promise<void> => {
	await openScenario(page, 'compact');
	await page.getByRole('button', { name: 'Start safety check' }).click();
	await page.getByLabel('Full name').fill('Abandoned User');
	await page.getByLabel('Corporate ID').fill('TEMP-77');

	await page.evaluate((): void => {
		(window as PreviewWindow).__wallboardPreview?.pushExternalCommand('resetSession');
	});

	await expect(page.locator('[data-preview-id="factory-safety-root"]')).toHaveAttribute('data-view', 'start');
	await page.getByRole('button', { name: 'Start safety check' }).click();
	await expect(page.getByLabel('Full name')).toHaveValue('');
	await expect(page.getByLabel('Corporate ID')).toHaveValue('');
});

test('bound empty question data stays empty instead of silently using packaged samples', async ({ page }): Promise<void> => {
	await openScenario(page, 'empty');
	await expect(page.getByText('No active safety questions are available.')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Start safety check' })).toHaveCount(0);
});

test('long questions and answers remain fully contained on the supported surface', async ({ page }): Promise<void> => {
	await openScenario(page, 'long-question');
	await page.getByRole('button', { name: 'Start safety check' }).click();
	await page.getByLabel('Full name').fill('Morgan Lee');
	await page.getByLabel('Corporate ID').fill('NM-2020');
	await page.getByRole('button', { name: 'Continue' }).click();
	await page.waitForFunction((): boolean => {
		const prompt: HTMLElement | null = document.querySelector('.wb-factory-safety-question-prompt');
		return Boolean(prompt?.style.fontSize);
	});

	const overflowing = await page.locator('[data-preview-id="factory-safety-root"]').evaluate((root): string[] => {
		return Array.from(root.querySelectorAll<HTMLElement>('*'))
			.filter((element): boolean => element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1)
			.map((element): string => JSON.stringify({
				client: [element.clientWidth, element.clientHeight],
				fontSize: window.getComputedStyle(element).fontSize,
				scroll: [element.scrollWidth, element.scrollHeight],
				selector: `${element.tagName.toLowerCase()}.${element.className}`
			}));
	});

	expect(overflowing).toEqual([]);
	await expect(page.getByText(/which preparation protects you/)).toBeVisible();
});
