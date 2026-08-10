import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

interface SpokenGuidanceRecord {
	lang: string;
	text: string;
}

interface WayfindingPreviewWindow extends Window {
	__spokenGuidance?: SpokenGuidanceRecord[];
	__speechCancelCount?: number;
	__wallboardPreview?: {
		pushDatasource: (property: string, value: unknown) => void;
	};
}

test.setTimeout(120_000);

const installSpeechSpy = async (page: Page): Promise<void> => {
	await page.addInitScript((): void => {
		const previewWindow = window as WayfindingPreviewWindow;
		const spoken: SpokenGuidanceRecord[] = [];

		previewWindow.__spokenGuidance = spoken;
		previewWindow.__speechCancelCount = 0;
		window.speechSynthesis.speak = (utterance: SpeechSynthesisUtterance): void => {
			spoken.push({ lang: utterance.lang, text: utterance.text });
		};
		window.speechSynthesis.cancel = (): void => {
			previewWindow.__speechCancelCount = (previewWindow.__speechCancelCount ?? 0) + 1;
		};
	});
};

const openKiosk = async (page: Page): Promise<void> => {
	await page.setViewportSize({ width: 1920, height: 1080 });
	const response = await page.goto('/preview/widget.html?background=dark');

	expect(response?.ok()).toBe(true);
	await page.waitForFunction((): boolean => document.documentElement.dataset.previewReady === 'true');
	await expect(page.locator('[data-preview-id="wayfinding-kiosk-root"]')).toHaveAttribute('data-viewer-ready', 'true', { timeout: 120_000 });
};

test.beforeEach(async ({ page }): Promise<void> => {
	await installSpeechSpy(page);
	await openKiosk(page);
});

test('shows the complete exploded route without manual step navigation', async ({ page }): Promise<void> => {
	await page.getByRole('button', { name: /Reception Ground floor Open/ }).click();
	await page.getByRole('button', { name: /Show route/ }).click();

	const root = page.locator('[data-preview-id="wayfinding-kiosk-root"]');
	const scene = page.locator('.wb-wayfinding-kiosk-scene');

	await expect(root).toHaveAttribute('data-journey-active', 'true');
	await expect(scene).toHaveAttribute('data-wayfinding-viewer-mode', 'journey');
	await expect(scene).toHaveAttribute('data-overview-mode', 'exploded-3d');
	await expect.poll(async (): Promise<number> => Number(await scene.getAttribute('data-exploded-route-segment-count'))).toBeGreaterThan(0);
	await expect(page.getByRole('button', { name: /Next|Previous|Atlas/i })).toHaveCount(0);
});

test('finishes the route reveal and arrives in the destination camera orbit', async ({ page }): Promise<void> => {
	await page.getByRole('button', { name: /Reception Ground floor Open/ }).click();
	await page.getByRole('button', { name: /Show route/ }).click();
	const scene = page.locator('.wb-wayfinding-kiosk-scene');

	await expect.poll(
		async (): Promise<string | null> => scene.getAttribute('data-exploded-route-reveal-progress'),
		{ timeout: 55_000 }
	).toBe('1.000');
	await expect(scene).toHaveAttribute('data-exploded-journey-camera-phase', 'destination-orbit');
});

test('speaks authored guidance on visitor-triggered route start and replay', async ({ page }): Promise<void> => {
	await page.getByRole('button', { name: /Main building Building/ }).click();
	await page.getByRole('button', { name: /Show route/ }).click();
	const root = page.locator('[data-preview-id="wayfinding-kiosk-root"]');

	await expect(root).toHaveAttribute('data-spoken-guidance-ready', 'true');
	await expect.poll(async (): Promise<number> => page.evaluate((): number => {
		return (window as WayfindingPreviewWindow).__spokenGuidance?.length ?? 0;
	})).toBe(1);

	await page.getByRole('button', { name: /Replay route/ }).click();
	await expect.poll(async (): Promise<number> => page.evaluate((): number => {
		return (window as WayfindingPreviewWindow).__spokenGuidance?.length ?? 0;
	})).toBe(2);

	const spoken = await page.evaluate((): SpokenGuidanceRecord[] => {
		return (window as WayfindingPreviewWindow).__spokenGuidance ?? [];
	});

	expect(spoken.every((item): boolean => item.lang.toLowerCase().startsWith('en'))).toBe(true);
	expect(spoken.every((item): boolean => item.text.trim().length > 0)).toBe(true);
});

test('applies live datasource availability without rebuilding the map', async ({ page }): Promise<void> => {
	const scene = page.locator('.wb-wayfinding-kiosk-scene');
	const initialBuilds = await scene.getAttribute('data-scene-builds');

	await page.evaluate((): void => {
		(window as WayfindingPreviewWindow).__wallboardPreview?.pushDatasource('destinationData', {
			DestinationStatus: {
				rows: [{
					destinationId: 'destination-msd82hxs-y',
					available: false,
					status: 'Temporarily closed',
					waitMinutes: 0,
					note: 'Visitor assistance has moved to the east lobby.'
				}]
			}
		});
	});

	await page.getByRole('button', { name: /Reception Ground floor Temporarily closed/ }).click();
	await expect(page.getByText('Temporarily closed', { exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: /Show route/ })).toBeDisabled();
	await expect(scene).toHaveAttribute('data-scene-builds', initialBuilds ?? '1');
});

test('audio control cancels active speech without ending the journey', async ({ page }): Promise<void> => {
	await page.getByRole('button', { name: /Main building Building/ }).click();
	await page.getByRole('button', { name: /Show route/ }).click();
	await page.getByRole('button', { name: 'Audio', exact: true }).click();

	await expect(page.getByRole('button', { name: 'Muted', exact: true })).toBeVisible();
	await expect(page.locator('[data-preview-id="wayfinding-kiosk-root"]')).toHaveAttribute('data-journey-active', 'true');
	await expect.poll(async (): Promise<number> => page.evaluate((): number => {
		return (window as WayfindingPreviewWindow).__speechCancelCount ?? 0;
	})).toBeGreaterThan(0);
});
