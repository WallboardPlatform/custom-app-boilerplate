import path from 'path';

import { expect, test } from '@playwright/test';

import { appViewport } from './app-viewport';
import previewFixture, { previewScenarios } from './fixture';
import type { PreviewScenario } from './fixture';

interface VisualPreset {
	name: string;
	width: number;
	height: number;
	background: 'checker' | 'light' | 'dark';
	scenario?: string;
	readySelector?: string;
	advanceTimeMs?: number;
	minimumContentCoverage?: {
		width: number;
		height: number;
	};
	liveDatasourceUpdate?: {
		property: string;
		value: unknown;
		expectedText: string;
	};
}

interface VisualMetrics {
	rootWidth: number;
	rootHeight: number;
	visibleLeafNodes: number;
	contentWidthCoverage: number;
	contentHeightCoverage: number;
	horizontalOverflow: string[];
	verticalOverflow: string[];
	outsideRoot: string[];
	brokenImages: string[];
}

const presets: VisualPreset[] = [
	{ name: 'app-default', ...appViewport, background: 'checker', readySelector: previewFixture.readySelector },
	{ name: 'full-hd', width: 1920, height: 1080, background: 'checker', readySelector: previewFixture.readySelector },
	{ name: 'wide-low', width: 1536, height: 432, background: 'light', readySelector: previewFixture.readySelector },
	{ name: 'landscape', width: 960, height: 540, background: 'checker', readySelector: previewFixture.readySelector },
	{ name: 'portrait', width: 1080, height: 1920, background: 'dark', readySelector: previewFixture.readySelector },
	{ name: 'square', width: 600, height: 600, background: 'light', readySelector: previewFixture.readySelector }
];

const scenarioPresets: VisualPreset[] = previewScenarios.map(
	(scenario: PreviewScenario): VisualPreset => ({
		name: `scenario-${scenario.id}`,
		width: scenario.viewport.width,
		height: scenario.viewport.height,
		background: scenario.viewport.background ?? 'checker',
		scenario: scenario.id,
		readySelector: scenario.fixture.readySelector ?? previewFixture.readySelector,
		advanceTimeMs: scenario.advanceTimeMs,
		minimumContentCoverage: scenario.minimumContentCoverage,
		liveDatasourceUpdate: scenario.liveDatasourceUpdate
	})
);

const screenshotDirectory: string = path.resolve(process.cwd(), 'preview', 'output');
const previewBaseUrl: string = process.env.WALLBOARD_PREVIEW_TEST_PORT
	? `http://127.0.0.1:${process.env.WALLBOARD_PREVIEW_TEST_PORT}/`
	: 'http://127.0.0.1:4173/';

for (const preset of [...presets, ...scenarioPresets]) {
	test(`${preset.name} ${preset.width}x${preset.height}`, async ({ page }): Promise<void> => {
		const runtimeErrors: string[] = [];
		const failedLocalRequests: string[] = [];

		page.on('pageerror', (error: Error): void => {
			runtimeErrors.push(error.message);
		});
		page.on('console', (message): void => {
			if (message.type() === 'error') {
				runtimeErrors.push(message.text());
			}
		});
		page.on('requestfailed', (request): void => {
			if (request.url().startsWith(previewBaseUrl)) {
				failedLocalRequests.push(`${request.method()} ${request.url()}`);
			}
		});
		page.on('response', (response): void => {
			if (response.url().startsWith(previewBaseUrl) && response.status() >= 400) {
				failedLocalRequests.push(`${response.status()} ${response.url()}`);
			}
		});

		await page.setViewportSize({ width: preset.width, height: preset.height });

		const query: URLSearchParams = new URLSearchParams({ background: preset.background });

		if (preset.scenario) {
			query.set('scenario', preset.scenario);
		}

		const response = await page.goto(`/preview/widget.html?${query.toString()}`);

		expect(response?.ok()).toBe(true);
		await page.waitForFunction((): boolean => {
			return (
				document.documentElement.dataset.previewReady === 'true' ||
				Boolean(document.documentElement.dataset.previewError)
			);
		});

		if (preset.advanceTimeMs) {
			await page.waitForTimeout(preset.advanceTimeMs);
		}

		if (preset.liveDatasourceUpdate) {
			await page.evaluate(
				(update): void => {
					const previewWindow = window as Window & {
						__wallboardPreview?: {
							pushDatasource: (property: string, value: unknown) => void;
						};
					};

					if (!previewWindow.__wallboardPreview) {
						throw new Error('Preview datasource update bridge is unavailable.');
					}

					previewWindow.__wallboardPreview.pushDatasource(update.property, update.value);
				},
				preset.liveDatasourceUpdate
			);
			await page.waitForTimeout(250);
			await expect(page.getByText(preset.liveDatasourceUpdate.expectedText, { exact: true })).toBeVisible();
		}

		const previewError: string | undefined = await page.evaluate((): string | undefined => {
			return document.documentElement.dataset.previewError;
		});

		const metrics: VisualMetrics = await page.evaluate((): VisualMetrics => {
			const root: HTMLElement | null = document.getElementById('wallboard-preview-root');

			if (!root) {
				throw new Error('Preview root was not found.');
			}

			const rootRect: DOMRect = root.getBoundingClientRect();
			const elements: HTMLElement[] = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))];
			const horizontalOverflow: string[] = [];
			const verticalOverflow: string[] = [];
			const outsideRoot: string[] = [];
			const brokenImages: string[] = [];
			const leafRects: DOMRect[] = [];

			const describeElement = (element: HTMLElement): string => {
				const id: string = element.id ? `#${element.id}` : '';
				const classes: string = Array.from(element.classList)
					.slice(0, 2)
					.map((className: string): string => `.${className}`)
					.join('');

				return `${element.tagName.toLowerCase()}${id}${classes}`;
			};

			for (const element of elements) {
				const style: CSSStyleDeclaration = window.getComputedStyle(element);
				const rect: DOMRect = element.getBoundingClientRect();
				const isVisible: boolean =
					style.display !== 'none' &&
					style.visibility !== 'hidden' &&
					Number(style.opacity) !== 0 &&
					rect.width > 0 &&
					rect.height > 0;

				if (!isVisible || element.closest('[data-preview-allow-overflow]')) {
					continue;
				}

				if (element instanceof HTMLImageElement && (!element.complete || element.naturalWidth === 0)) {
					brokenImages.push(describeElement(element));
				}

				if (element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 1) {
					horizontalOverflow.push(describeElement(element));
				}

				if (
					element.childElementCount > 0 &&
					element.clientHeight > 0 &&
					['auto', 'clip', 'hidden', 'scroll'].includes(style.overflowY) &&
					element.scrollHeight > element.clientHeight + 1
				) {
					verticalOverflow.push(describeElement(element));
				}

				if (
					element !== root &&
					(
						rect.left < rootRect.left - 1 ||
						rect.right > rootRect.right + 1 ||
						rect.top < rootRect.top - 1 ||
						rect.bottom > rootRect.bottom + 1
					)
				) {
					outsideRoot.push(describeElement(element));
				}

				const tagName: string = element.tagName.toLowerCase();
				const isVisualLeaf: boolean =
					element.childElementCount === 0 || ['canvas', 'img', 'svg', 'video'].includes(tagName);

				if (isVisualLeaf) {
					leafRects.push(rect);
				}
			}

			const contentBounds = leafRects.reduce(
				(bounds, rect: DOMRect) => {
					return {
						left: Math.min(bounds.left, Math.max(rootRect.left, rect.left)),
						top: Math.min(bounds.top, Math.max(rootRect.top, rect.top)),
						right: Math.max(bounds.right, Math.min(rootRect.right, rect.right)),
						bottom: Math.max(bounds.bottom, Math.min(rootRect.bottom, rect.bottom))
					};
				},
				{
					left: rootRect.right,
					top: rootRect.bottom,
					right: rootRect.left,
					bottom: rootRect.top
				}
			);

			const contentWidth: number = Math.max(0, contentBounds.right - contentBounds.left);
			const contentHeight: number = Math.max(0, contentBounds.bottom - contentBounds.top);

			return {
				rootWidth: rootRect.width,
				rootHeight: rootRect.height,
				visibleLeafNodes: leafRects.length,
				contentWidthCoverage: Math.round((contentWidth / rootRect.width) * 100),
				contentHeightCoverage: Math.round((contentHeight / rootRect.height) * 100),
				horizontalOverflow: [...new Set(horizontalOverflow)],
				verticalOverflow: [...new Set(verticalOverflow)],
				outsideRoot: [...new Set(outsideRoot)],
				brokenImages: [...new Set(brokenImages)]
			};
		});

		if (preset.readySelector) {
			await page.waitForFunction((selector: string): boolean => {
				const element: HTMLElement | null = document.querySelector<HTMLElement>(selector);

				return Boolean(element?.textContent?.trim());
			}, preset.readySelector);
		}

		await page.screenshot({
			path: path.join(screenshotDirectory, `${preset.name}-${preset.width}x${preset.height}.png`),
			fullPage: false
		});

		console.log(
			`${preset.name}: content coverage ${metrics.contentWidthCoverage}% x ${metrics.contentHeightCoverage}%`
		);

		expect(previewError).toBeUndefined();
		expect(runtimeErrors).toEqual([]);
		expect(failedLocalRequests).toEqual([]);
		expect(metrics.rootWidth).toBe(preset.width);
		expect(metrics.rootHeight).toBe(preset.height);
		expect(metrics.visibleLeafNodes).toBeGreaterThan(0);
		expect(metrics.horizontalOverflow).toEqual([]);
		expect(metrics.verticalOverflow).toEqual([]);
		expect(metrics.outsideRoot).toEqual([]);
		expect(metrics.brokenImages).toEqual([]);

		if (preset.minimumContentCoverage) {
			expect(metrics.contentWidthCoverage).toBeGreaterThanOrEqual(preset.minimumContentCoverage.width);
			expect(metrics.contentHeightCoverage).toBeGreaterThanOrEqual(preset.minimumContentCoverage.height);
		}
	});
}

test('preview shell uses the configured app viewport', async ({ page }): Promise<void> => {
	await page.setViewportSize({ width: 1440, height: 900 });
	const response = await page.goto('/preview/');

	expect(response?.ok()).toBe(true);
	await expect(page.locator('#viewport-preset')).toHaveValue('app-default');
	await expect(page.locator('#viewport-width')).toHaveValue(appViewport.width.toString());
	await expect(page.locator('#viewport-height')).toHaveValue(appViewport.height.toString());
	await expect(page.locator('#widget-frame')).toHaveCSS('width', `${appViewport.width}px`);
	await expect(page.locator('#widget-frame')).toHaveCSS('height', `${appViewport.height}px`);
});
