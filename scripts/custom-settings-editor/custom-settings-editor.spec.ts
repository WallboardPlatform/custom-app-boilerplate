import { expect, test } from '@playwright/test';
import type { FrameLocator, Page } from '@playwright/test';

const openEditor = async (page: Page): Promise<FrameLocator> => {
	await page.goto('/scripts/custom-settings-editor/');
	const editor: FrameLocator = page.frameLocator('#custom-editor');
	await expect(editor.locator('#status')).toHaveText('All changes saved');

	return editor;
};

test('loads structured content and resets unsaved changes', async ({ page }, testInfo): Promise<void> => {
	const editor: FrameLocator = await openEditor(page);
	const heading = editor.locator('#collection-title');

	await expect(heading).toHaveValue('Visitor services');
	await expect(editor.locator('.content-section')).toHaveCount(2);
	await page.screenshot({ path: testInfo.outputPath('custom-editor-harness.png'), fullPage: true });
	await heading.fill('Temporary heading');
	await expect(editor.locator('#status')).toHaveText('Unsaved changes');
	await editor.locator('#reset').click();
	await expect(heading).toHaveValue('Visitor services');
	await expect(editor.locator('#status')).toHaveText('All changes saved');
});

test('saves only owned structured content and preserves unrelated settings', async ({ page }): Promise<void> => {
	const editor: FrameLocator = await openEditor(page);

	await editor.locator('#collection-title').fill('Guest information');
	await editor.locator('.content-section').first().locator('[data-field="title"]').fill('Before you arrive');
	await editor.locator('#add-section').click();
	await editor.locator('.content-section').last().locator('[data-field="title"]').fill('Transport');
	await editor.locator('.content-section').last().locator('[data-field="body"]').fill('The last shuttle leaves at 22:15.');
	await editor.locator('#save').click();

	await expect(page.locator('#save-count')).toHaveText('1 save');
	const storedConfig = JSON.parse(await page.locator('#host-state').textContent() ?? '{}');

	expect(storedConfig.themePreset).toBe('dark');
	expect(storedConfig.untouchedSetting).toBe('preserve-me');
	expect(storedConfig.customContent.heading).toBe('Guest information');
	expect(storedConfig.customContent.sections).toHaveLength(3);
	expect(storedConfig.customContent.sections[0].title).toBe('Before you arrive');
	expect(storedConfig.customContent.sections[2].title).toBe('Transport');
	await expect(editor.locator('#status')).toHaveText('All changes saved');
});
