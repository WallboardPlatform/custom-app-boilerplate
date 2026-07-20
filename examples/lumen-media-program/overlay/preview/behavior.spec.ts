import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

interface PreviewWindow extends Window {
	__wallboardPreview?: {
		destroy: () => Promise<void>;
		platform: { cachedUrls: string[]; sensorEvents: Array<{ event: string; value: unknown }> };
		pushConfiguration: (values: Record<string, unknown>) => void;
		pushExternalCommand: (command: string, parameters?: Array<{ parameter: string; value: unknown }>) => void;
	};
}

const openProgram = async (page: Page, width = 1280, height = 720): Promise<void> => {
	await page.setViewportSize({ width, height });
	const response = await page.goto('/preview/widget.html?background=dark');
	expect(response?.ok()).toBe(true);
	await page.waitForFunction((): boolean => document.documentElement.dataset.previewReady === 'true' || Boolean(document.documentElement.dataset.previewError));
	expect(await page.evaluate((): string | undefined => document.documentElement.dataset.previewError)).toBeUndefined();
};

test('resolves two selected-folder videos and plays them through the real media element', async ({ page }): Promise<void> => {
	await openProgram(page);
	const root = page.locator('.wb-lumen-media-program-root');
	await expect(root).toHaveAttribute('data-source-count', '2');
	expect(await page.evaluate((): string => typeof (window as unknown as { Hls?: unknown }).Hls)).toBe('function');
	await expect.poll(async (): Promise<string | null> => root.getAttribute('data-status'), { timeout: 10000 }).toBe('playing');
	await expect.poll(async (): Promise<number> => page.locator('video').evaluate((video: HTMLVideoElement): number => video.currentTime), { timeout: 10000 }).toBeGreaterThan(0.1);

	const events = await page.evaluate(() => (window as unknown as PreviewWindow).__wallboardPreview?.platform.sensorEvents ?? []);
	expect(events.some((event) => {
		const payload = event as { data?: { event?: { event?: string } } };
		return payload.data?.event?.event === 'video-playback';
	})).toBe(true);
});

test('repeat current video stays on the active item while playlist repeat advances', async ({ page }): Promise<void> => {
	await openProgram(page);
	const preview = (command: string, parameters: Array<{ parameter: string; value: unknown }> = []): Promise<void> => page.evaluate(
		([name, values]) => (window as unknown as PreviewWindow).__wallboardPreview?.pushExternalCommand(name as string, values as Array<{ parameter: string; value: unknown }>),
		[command, parameters] as const
	);
	const root = page.locator('.wb-lumen-media-program-root');
	const title = page.locator('[data-text-role="video-title"]').last();

	await preview('pauseVideo');
	await preview('selectVideo', [{ parameter: 'index', value: 0 }]);
	const firstTitle = await title.textContent();

	await page.evaluate((): void => {
		(window as unknown as PreviewWindow).__wallboardPreview?.pushConfiguration({ repeat: 'item' });
	});
	await expect(root).toHaveAttribute('data-repeat', 'item');
	await page.locator('video').dispatchEvent('ended');
	await expect(title).toHaveText(firstTitle ?? '');
	await preview('pauseVideo');
	await preview('selectVideo', [{ parameter: 'index', value: 0 }]);

	await page.evaluate((): void => {
		(window as unknown as PreviewWindow).__wallboardPreview?.pushConfiguration({ repeat: 'playlist' });
	});
	await expect(root).toHaveAttribute('data-repeat', 'playlist');
	await page.locator('video').dispatchEvent('ended');
	await expect(title).not.toHaveText(firstTitle ?? '');
});

test('external commands select, pause, seek, play, mute, and set volume', async ({ page }): Promise<void> => {
	await openProgram(page);
	const bridge = (command: string, parameters: Array<{ parameter: string; value: unknown }> = []): Promise<void> => page.evaluate(
		([name, values]) => (window as unknown as PreviewWindow).__wallboardPreview?.pushExternalCommand(name as string, values as Array<{ parameter: string; value: unknown }>),
		[command, parameters] as const
	);

	await bridge('nextVideo');
	await expect(page.locator('.wb-lumen-media-program-root')).toHaveAttribute('data-status', /loading|playing/);
	await expect(page.locator('[data-text-role="video-title"]').last()).toContainText('CITY IN MOTION');
	await bridge('pauseVideo');
	await expect(page.locator('.wb-lumen-media-program-root')).toHaveAttribute('data-status', 'paused');
	await bridge('seekVideo', [{ parameter: 'seconds', value: 0.4 }]);
	await expect.poll(async (): Promise<number> => page.locator('video').evaluate((video: HTMLVideoElement): number => video.currentTime)).toBeGreaterThan(0.3);
	await bridge('setVideoVolume', [{ parameter: 'volume', value: 35 }]);
	await expect.poll(async (): Promise<number> => page.locator('video').evaluate((video: HTMLVideoElement): number => video.volume)).toBeCloseTo(0.35, 2);
	await bridge('playVideo');
	await expect(page.locator('.wb-lumen-media-program-root')).toHaveAttribute('data-status', 'playing');
	await bridge('unmuteVideo');
	await expect.poll(async (): Promise<boolean> => page.locator('video').evaluate((video: HTMLVideoElement): boolean => video.muted)).toBe(false);
	const mediaState = await page.locator('video').evaluate((video: HTMLVideoElement) => ({ muted: video.muted, volume: video.volume }));
	expect(mediaState.muted).toBe(false);
	expect(mediaState.volume).toBeCloseTo(0.35, 2);
});

test('configured URLs use the platform cache path before playback', async ({ page }): Promise<void> => {
	await openProgram(page);
	await page.evaluate((): void => {
		(window as unknown as PreviewWindow).__wallboardPreview?.pushConfiguration({
			playlistJson: JSON.stringify([{ id: 'remote', name: 'Remote reel', url: 'https://cdn.example.test/reel.mp4', poster: 'https://cdn.example.test/reel.jpg' }]),
			sourceMode: 'playlist'
		});
	});
	await expect.poll(async (): Promise<string[]> => page.evaluate(() => (window as unknown as PreviewWindow).__wallboardPreview?.platform.cachedUrls ?? [])).toEqual([
		'https://cdn.example.test/reel.jpg',
		'https://cdn.example.test/reel.mp4'
	]);
});

test('a terminal media error advances to the next playable source', async ({ page }): Promise<void> => {
	await openProgram(page);
	await page.evaluate((): void => {
		const preview = (window as unknown as PreviewWindow).__wallboardPreview;
		const current = preview;
		if (!current) throw new Error('Preview bridge unavailable.');
		current.pushConfiguration({
			advanceOnError: true,
			playlistJson: JSON.stringify([
				{ id: 'broken', name: 'Unavailable opening', url: 'data:video/webm;base64,broken' },
				{ id: 'existing', name: 'Playable fallback', url: document.querySelector('video')?.src }
			]),
			retryCount: 0,
			sourceMode: 'playlist'
		});
	});
	await expect(page.locator('[data-text-role="video-title"]').last()).toContainText('Playable fallback', { timeout: 10000 });
});

test('destroy removes the media element and active playback resources', async ({ page }): Promise<void> => {
	await openProgram(page);
	await page.evaluate(async (): Promise<void> => {
		await (window as unknown as PreviewWindow).__wallboardPreview?.destroy();
	});
	await expect(page.locator('#wallboard-preview-root')).toBeEmpty();
});

test('text fitting remains active when legacy Chromium has no ResizeObserver', async ({ page }): Promise<void> => {
	await page.addInitScript((): void => {
		Object.defineProperty(window, 'ResizeObserver', { configurable: true, value: undefined });
	});
	await openProgram(page, 960, 540);
	await expect(page.locator('.wb-lumen-media-program-root')).toHaveAttribute('data-source-count', '2');
	await page.setViewportSize({ width: 640, height: 360 });
	await expect.poll(async (): Promise<number> => {
		return page.locator('[data-text-role="video-title"]').last().evaluate((element: HTMLElement): number => {
			return Number.parseFloat(window.getComputedStyle(element).fontSize);
		});
	}, { timeout: 3000 }).toBeGreaterThanOrEqual(28);
});
