import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

interface PreviewWindow extends Window {
	__wallboardPreview?: {
		platform: { sensorEvents: unknown[] };
		pushExternalCommand: (
			command: string,
			parameters?: Array<{ parameter: string; value: string | number | boolean }>
		) => void;
	};
}

const openScenario = async (page: Page, scenario = 'full-hd'): Promise<void> => {
	const sizes: Record<string, { width: number; height: number }> = {
		'auto-scroll': { width: 1366, height: 768 },
		compact: { width: 800, height: 600 },
		'full-hd': { width: 1920, height: 1080 },
		portrait: { width: 1080, height: 1920 },
		'single-page': { width: 1366, height: 768 }
	};
	await page.setViewportSize(sizes[scenario] ?? sizes['full-hd']);
	const response = await page.goto(`/preview/widget.html?scenario=${scenario}&background=dark`);

	expect(response?.ok()).toBe(true);
	await page.waitForFunction((): boolean => {
		return document.documentElement.dataset.previewReady === 'true' || Boolean(document.documentElement.dataset.previewError);
	});
	expect(await page.evaluate((): string | undefined => document.documentElement.dataset.previewError)).toBeUndefined();
	await page.waitForSelector('[data-pdf-ready="true"]');
};

test('loads a folder as two documents while lazily bounding rendered canvases', async ({ page }): Promise<void> => {
	await openScenario(page);
	const root = page.locator('[data-preview-id="pdf-document-workspace-root"]');

	await expect(root).toHaveAttribute('data-source-count', '2');
	await expect(page.locator('[data-pdf-ready="true"]')).toHaveAttribute('data-document-count', '2');
	await expect(page.locator('[data-pdf-ready="true"]')).toHaveAttribute('data-page-count', '6');
	await expect(page.locator('canvas.pdf-canvas').first()).toBeVisible();
	const canvasCount: number = await page.locator('canvas.pdf-canvas').count();

	expect(canvasCount).toBeGreaterThan(0);
	expect(canvasCount).toBeLessThanOrEqual(4);
});

test('document and outline navigation select exact PDF destinations', async ({ page }): Promise<void> => {
	await openScenario(page);
	await page.getByRole('button', { name: /northline shift brief/i }).click();
	await expect(page.locator('[data-preview-id="pdf-document-workspace-root"]')).toHaveAttribute('data-current-document', '2');

	await page.getByRole('tab', { name: 'Outline' }).click();
	await page.getByRole('button', { name: /01 Inspection record/ }).click();
	await expect(page.locator('[data-preview-id="pdf-document-workspace-root"]')).toHaveAttribute('data-current-document', '1');
	await expect(page.locator('[data-preview-id="pdf-document-workspace-root"]')).toHaveAttribute('data-current-document-page', '3');
	await expect(page.locator('input[name="inspector_name"]')).toBeVisible();
});

test('search spans all documents and remote commands can move through results', async ({ page }): Promise<void> => {
	await openScenario(page);
	await page.getByRole('tab', { name: 'Search' }).click();
	await page.getByLabel('Search all documents').click();
	await expect(page.getByRole('dialog', { name: 'Search documents' })).toBeVisible();
	await page.getByRole('button', { name: 'Key h' }).click();
	await expect(page.getByLabel('Search all documents')).toHaveValue('h');
	await page.getByLabel('Search all documents').fill('handover');
	await page.getByRole('dialog', { name: 'Search documents' }).getByRole('button', { name: 'Find' }).click();
	await expect(page.getByText(/matches$/)).not.toHaveText('0 matches');
	await expect(page.locator('.pdf-search-highlight').first()).toBeVisible();

	const root = page.locator('[data-preview-id="pdf-document-workspace-root"]');
	const before: string | null = await root.getAttribute('data-search-index');
	await page.evaluate((): void => {
		(window as PreviewWindow).__wallboardPreview?.pushExternalCommand('nextSearchMatch');
	});
	await expect.poll(async (): Promise<string | null> => {
		return root.getAttribute('data-search-index');
	}).not.toBe(before);
});

test('AcroForm values submit as a structured sensor interaction', async ({ page }): Promise<void> => {
	await openScenario(page);
	await page.getByRole('tab', { name: 'Outline' }).click();
	await page.getByRole('button', { name: /01 Inspection record/ }).click();
	const name = page.locator('input[name="inspector_name"]');

	await expect(name).toBeVisible();
	await name.fill('Morgan Lee');
	await page.locator('input[name="site_area"]').fill('Assembly hall 2');
	await page.locator('select[name="overall_condition"]').selectOption('Ready with actions');
	await page.locator('input[name="routes_clear"]').check();
	await page.getByRole('tab', { name: 'Files' }).click();
	await page.getByRole('button', { name: 'Submit' }).click();
	await expect(page.locator('[data-form-notice]')).toContainText('form fields submitted');

	const events = await page.evaluate((): unknown[] => {
		return (window as PreviewWindow).__wallboardPreview?.platform.sensorEvents ?? [];
	});
	const submission = events.find((entry: unknown): boolean => {
		return JSON.stringify(entry).includes('form-submit');
	});

	expect(submission).toBeTruthy();
	expect(JSON.stringify(submission)).toContain('Morgan Lee');
});

test('parameterized external commands select a page and document', async ({ page }): Promise<void> => {
	await openScenario(page);
	await page.evaluate((): void => {
		(window as PreviewWindow).__wallboardPreview?.pushExternalCommand('setPage', [{ parameter: 'page', value: 4 }]);
	});
	await expect(page.locator('[data-preview-id="pdf-document-workspace-root"]')).toHaveAttribute('data-current-page', '4');

	await page.evaluate((): void => {
		(window as PreviewWindow).__wallboardPreview?.pushExternalCommand('setDocument', [{ parameter: 'document', value: 2 }]);
	});
	await expect(page.locator('[data-preview-id="pdf-document-workspace-root"]')).toHaveAttribute('data-current-document', '2');
});

test('auto-scroll moves a continuous document without user input', async ({ page }): Promise<void> => {
	await openScenario(page, 'auto-scroll');
	const viewport = page.locator('[data-pdf-ready="true"]');
	const before: number = await viewport.evaluate((element: HTMLElement): number => element.scrollTop);

	await page.waitForTimeout(900);
	const after: number = await viewport.evaluate((element: HTMLElement): number => element.scrollTop);

	expect(after).toBeGreaterThan(before + 40);
});

test('zoom controls change scale and remain bounded', async ({ page }): Promise<void> => {
	await openScenario(page, 'single-page');
	await expect(page.getByRole('button', { name: 'Reset zoom' })).toHaveText('100%');
	await page.getByRole('button', { name: 'Zoom in' }).click();
	await expect(page.getByRole('button', { name: 'Reset zoom' })).toHaveText('115%');
	await page.getByRole('button', { name: 'Reset zoom' }).click();
	await expect(page.getByRole('button', { name: 'Reset zoom' })).toHaveText('100%');
});
