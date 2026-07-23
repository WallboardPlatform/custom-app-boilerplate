import { expect, test } from '@playwright/test';
import type { FrameLocator, Page } from '@playwright/test';

interface PreviewBridge {
	pushConfiguration: (configValues: Record<string, unknown>) => void;
}

interface StoryEditorHost {
	getState: () => Record<string, unknown>;
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

test('structured content updates the mounted scene without a datasource', async ({ page }): Promise<void> => {
	await page.setViewportSize({ width: 1920, height: 1080 });
	await openPreview(page);
	await pushConfiguration(page, {
		customContent: {
			venue: 'HARBOR PROJECT SPACE',
			title: 'FIELD RECORDINGS',
			deck: 'A manual collection edited inside Wallboard',
			stories: [
				{
					id: 'night-signal',
					label: 'NEW COMMISSION',
					title: 'Night signal',
					body: 'A live edit replaces the bundled scene without remounting the app.',
					detail: 'SOUTH HALL',
					tone: 'mint',
					layout: 'statement',
					enabled: true
				}
			]
		}
	});

	await expect(page.locator('.wb-curated-storyline-collection-title')).toHaveText('FIELD RECORDINGS');
	await expect(page.locator('.wb-curated-storyline-title')).toHaveText('Night signal');
	await expect(page.locator('.wb-curated-storyline-body')).toContainText('live edit');
	await expect(page.locator('.wb-curated-storyline-scene')).toHaveAttribute('data-tone', 'mint');
});

test('rotation skips unpublished scenes and advances through the curated order', async ({ page }): Promise<void> => {
	await page.clock.install();
	await page.setViewportSize({ width: 1920, height: 1080 });
	await openPreview(page);
	await pushConfiguration(page, {
		rotationSeconds: 3,
		motionPreset: 'off',
		customContent: {
			venue: 'TEST VENUE',
			title: 'ROTATION PROOF',
			deck: 'Only enabled scenes participate',
			stories: [
				{
					id: 'first',
					label: 'FIRST',
					title: 'First scene',
					body: 'Visible first.',
					detail: 'ONE',
					tone: 'coral',
					layout: 'statement',
					enabled: true
				},
				{
					id: 'hidden',
					label: 'HIDDEN',
					title: 'Never rendered',
					body: 'This scene is unpublished.',
					detail: 'TWO',
					tone: 'cobalt',
					layout: 'quote',
					enabled: false
				},
				{
					id: 'third',
					label: 'THIRD',
					title: 'Third scene',
					body: 'Visible second.',
					detail: 'THREE',
					tone: 'sun',
					layout: 'schedule',
					enabled: true
				}
			]
		}
	});

	await expect(page.locator('.wb-curated-storyline-title')).toHaveText('First scene');
	await page.clock.fastForward(3100);
	await expect(page.locator('.wb-curated-storyline-title')).toHaveText('Third scene');
	await expect(page.locator('.wb-curated-storyline-title')).not.toHaveText('Never rendered');
});

test('the app-specific editor saves nested content and preserves unrelated settings', async ({ page }): Promise<void> => {
	const response = await page.goto('/preview/story-editor-host.html');

	expect(response?.ok()).toBe(true);
	const editor: FrameLocator = page.frameLocator('#story-editor');
	await expect(editor.locator('#status')).toHaveText('All changes saved');
	await editor.locator('#collection-title').fill('A NEW MATERIAL HISTORY');
	await editor.locator('[data-story-id="listening-bench"] [data-action="move-up"]').click();
	await editor.locator('[data-story-id="listening-bench"] [data-field="tone"]').selectOption('mint');
	await editor.locator('#save').click();
	await expect.poll(async (): Promise<unknown> => {
		return page.evaluate((): unknown => {
			const hostWindow = window as Window & { __storyEditorHost?: StoryEditorHost };
			const state = hostWindow.__storyEditorHost?.getState();
			const customContent = state?.customContent as Record<string, unknown> | undefined;

			return customContent?.title;
		});
	}).toBe('A NEW MATERIAL HISTORY');

	const savedState: Record<string, unknown> = await page.evaluate((): Record<string, unknown> => {
		const hostWindow = window as Window & { __storyEditorHost?: StoryEditorHost };

		if (!hostWindow.__storyEditorHost) {
			throw new Error('Story editor host is unavailable.');
		}

		return hostWindow.__storyEditorHost.getState();
	});
	const customContent = savedState.customContent as Record<string, unknown>;
	const stories = customContent.stories as Array<Record<string, unknown>>;

	expect(savedState.themePreset).toBe('dark');
	expect(savedState.rotationSeconds).toBe(9);
	expect(customContent.title).toBe('A NEW MATERIAL HISTORY');
	expect(stories[0].id).toBe('listening-bench');
	expect(stories[0].tone).toBe('mint');
});
