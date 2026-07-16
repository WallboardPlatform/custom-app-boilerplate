import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

interface PreviewBridge {
	pushConfiguration: (configValues: Record<string, unknown>) => void;
}

const openPreview = async (page: Page): Promise<void> => {
	const response = await page.goto('/preview/widget.html?background=checker');

	expect(response?.ok()).toBe(true);
	await page.waitForFunction((): boolean => document.documentElement.dataset.previewReady === 'true');
};

const pushConfiguration = async (page: Page, configValues: Record<string, unknown>): Promise<void> => {
	await page.evaluate((values: Record<string, unknown>): void => {
		const previewWindow = window as Window & { __wallboardPreview?: PreviewBridge };

		if (!previewWindow.__wallboardPreview) {
			throw new Error('Preview configuration bridge is unavailable.');
		}

		previewWindow.__wallboardPreview.pushConfiguration(values);
	}, configValues);
};

test('runtime content and visibility settings update the mounted poster', async ({ page }): Promise<void> => {
	await page.setViewportSize({ width: 1920, height: 1080 });
	await openPreview(page);
	await pushConfiguration(page, {
		exhibitionTitle: 'COLOR IN BALANCE',
		showSubtitle: false
	});

	await expect(page.locator('.museum-title')).toHaveText('COLOR IN BALANCE');
	await expect(page.locator('.museum-subtitle')).toHaveAttribute('data-visible', 'false');
	await expect(page.locator('.museum-subtitle-fit')).toBeHidden();
});

test('runtime theme and transparency settings resolve the complete poster palette', async ({ page }): Promise<void> => {
	await page.setViewportSize({ width: 1920, height: 1080 });
	await openPreview(page);
	const leftField = page.locator('.museum-left-field');
	const baselineColor: string = await leftField.evaluate((element: Element): string => {
		return window.getComputedStyle(element).backgroundColor;
	});

	await pushConfiguration(page, {
		themePreset: 'dark',
		transparentBackground: true
	});

	await expect(page.locator('.wb-app')).toHaveAttribute('data-theme', 'dark');
	await expect(page.locator('.wb-app')).toHaveAttribute('data-transparent-background', 'true');
	await expect(page.locator('.wb-app')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
	await expect.poll(async (): Promise<string> => {
		return leftField.evaluate((element: Element): string => window.getComputedStyle(element).backgroundColor);
	}).not.toBe(baselineColor);
});
