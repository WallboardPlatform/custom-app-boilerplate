import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

const pageDurationMs: number = 3000;

const openScenario = async (
	page: Page,
	scenario: string,
	viewport: { width: number; height: number }
): Promise<void> => {
	await page.clock.install({ time: new Date('2026-01-15T12:00:00Z') });
	await page.setViewportSize(viewport);
	const query: URLSearchParams = new URLSearchParams({ background: 'light', scenario });
	const response = await page.goto(`/preview/widget.html?${query.toString()}`);

	expect(response?.ok()).toBe(true);
	await page.waitForFunction((): boolean => {
		return document.documentElement.dataset.previewReady === 'true' || Boolean(document.documentElement.dataset.previewError);
	});

	const previewError: string | undefined = await page.evaluate((): string | undefined => {
		return document.documentElement.dataset.previewError;
	});

	expect(previewError).toBeUndefined();
	await expect(page.locator('.directory-title')).toBeVisible();
	await page.clock.pauseAt(await page.evaluate((): number => Date.now() + 100));
};

test('unsorted rows render in deterministic building and floor order', async ({ page }): Promise<void> => {
	await openScenario(page, 'many-buildings', { width: 1920, height: 1080 });

	const rows: Locator = page.locator('.directory-row');
	const buildings: Locator = page.locator('.directory-building');
	const departments: Locator = page.locator('.directory-department-name');
	const floors: Locator = page.locator('.directory-floor');

	await expect(rows).toHaveCount(6);
	await expect(buildings).toHaveText(['Alder Hall', 'Beacon Library']);
	await expect(departments).toHaveText([
		'Admissions',
		'Financial Aid',
		'Registrar',
		'Student Success',
		'Welcome and Borrowing Desk',
		'Learning Commons'
	]);
	await expect(floors).toHaveText(['Ground', 'Ground', 'Level 1', 'Level 1', 'Ground', 'Level 1']);
});

test('balanced pagination preserves order and fills the final page', async ({ page }): Promise<void> => {
	await openScenario(page, 'final-partial-page', { width: 1366, height: 768 });

	const rows: Locator = page.locator('.directory-row');
	const footer: Locator = page.locator('.directory-footer');

	await expect(rows).toHaveCount(5);
	await expect(footer).toContainText('ROUTE PAGE 1 OF 3');
	await expect(page.locator('.directory-department-name').first()).toHaveText('Admissions');

	await page.clock.fastForward(pageDurationMs);
	await expect(footer).toContainText('ROUTE PAGE 2 OF 3');
	await expect(rows).toHaveCount(5);

	await page.clock.fastForward(pageDurationMs);
	await expect(footer).toContainText('ROUTE PAGE 3 OF 3');
	await expect(rows).toHaveCount(4);
	await expect(page.locator('.directory-department-name')).toHaveText([
		'Biology Teaching Labs',
		'Chemistry Department',
		'Box Office',
		'Riverside Theatre'
	]);

	const layout = await page.evaluate(() => {
		const list: HTMLElement | null = document.querySelector<HTMLElement>('.directory-list');
		const rowElements: HTMLElement[] = Array.from(document.querySelectorAll<HTMLElement>('.directory-row'));

		if (!list || rowElements.length !== 4) {
			throw new Error('Expected four rows on the final directory page.');
		}

		const listRect: DOMRect = list.getBoundingClientRect();
		const rowRects: DOMRect[] = rowElements.map((row: HTMLElement): DOMRect => row.getBoundingClientRect());
		let maximumGap: number = 0;
		let maximumOverlap: number = 0;

		for (let index: number = 1; index < rowRects.length; index += 1) {
			const boundaryDelta: number = rowRects[index].top - rowRects[index - 1].bottom;

			maximumGap = Math.max(maximumGap, boundaryDelta);
			maximumOverlap = Math.max(maximumOverlap, -boundaryDelta);
		}

		return {
			listHeight: listRect.height,
			rowHeights: rowRects.map((rect: DOMRect): number => rect.height),
			topGap: rowRects[0].top - listRect.top,
			bottomGap: listRect.bottom - rowRects[rowRects.length - 1].bottom,
			maximumGap,
			maximumOverlap
		};
	});

	expect(Math.max(...layout.rowHeights) - Math.min(...layout.rowHeights)).toBeLessThanOrEqual(1);
	expect(layout.rowHeights.reduce((total: number, height: number): number => total + height, 0)).toBeCloseTo(
		layout.listHeight,
		1
	);
	expect(Math.abs(layout.topGap)).toBeLessThanOrEqual(1);
	expect(Math.abs(layout.bottomGap)).toBeLessThanOrEqual(1);
	expect(layout.maximumGap).toBeLessThanOrEqual(1);
	expect(layout.maximumOverlap).toBeLessThanOrEqual(0.5);
});

test('portrait rows show complete essential fields at readable sizes', async ({ page }): Promise<void> => {
	await openScenario(page, 'portrait-long-essential-fields', { width: 1080, height: 1920 });

	await expect(page.locator('.directory-row')).toHaveCount(6);

	const fieldLayout = await page.evaluate(() => {
		const inspectFields = (selector: string): Array<{
			fontSize: number;
			lineCount: number;
			overflowX: number;
			overflowY: number;
			textOverflow: string;
			whiteSpace: string;
		}> => Array.from(document.querySelectorAll<HTMLElement>(selector)).map((element: HTMLElement) => {
			const style: CSSStyleDeclaration = window.getComputedStyle(element);
			const range: Range = document.createRange();

			range.selectNodeContents(element);
			const lineTops: number[] = Array.from(range.getClientRects()).map((rect: DOMRect): number => Math.round(rect.top));

			return {
				fontSize: Number.parseFloat(style.fontSize),
				lineCount: new Set(lineTops).size,
				overflowX: element.scrollWidth - element.clientWidth,
				overflowY: element.scrollHeight - element.clientHeight,
				textOverflow: style.textOverflow,
				whiteSpace: style.whiteSpace
			};
		});

		return {
			departments: inspectFields('.directory-department-name'),
			directions: inspectFields('.directory-direction-text'),
			accessibilityNotes: inspectFields('.directory-accessibility-note')
		};
	});

	for (const field of fieldLayout.departments) {
		expect(field.fontSize).toBeGreaterThanOrEqual(20);
		expect(field.overflowX).toBeLessThanOrEqual(1);
		expect(field.overflowY).toBeLessThanOrEqual(1);
		expect(field.textOverflow).not.toBe('ellipsis');
		expect(field.whiteSpace).not.toBe('nowrap');
	}

	for (const field of [...fieldLayout.directions, ...fieldLayout.accessibilityNotes]) {
		expect(field.fontSize).toBeGreaterThanOrEqual(16);
		expect(field.overflowX).toBeLessThanOrEqual(1);
		expect(field.overflowY).toBeLessThanOrEqual(1);
		expect(field.textOverflow).not.toBe('ellipsis');
		expect(field.whiteSpace).not.toBe('nowrap');
	}

	expect(fieldLayout.directions.some((field): boolean => field.lineCount >= 2)).toBe(true);
	expect(fieldLayout.accessibilityNotes.some((field): boolean => field.lineCount >= 2)).toBe(true);
});
