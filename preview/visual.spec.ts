import fs from 'node:fs';
import path from 'path';

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { appViewport } from './app-viewport';
import previewFixture, { previewScenarios, previewSettingEffects } from './fixture';
import type {
	MinimumContentCoverage,
	PreviewInteractionStep,
	PreviewScenario,
	PreviewSettingEffect,
	PreviewSettingEffectMeasurement
} from './fixture.types';
import {
	findTextInkRisks,
	formatTextInkRisks,
	type TextInkMeasurement,
	type TextInkRisk
} from './text-ink-safety';
import {
	fontFloor,
	type TextRole,
	type ViewingDistance
} from './legibility';

const DEFAULT_VISUAL_SETTLE_MS = 650;

interface VisualPreset {
	name: string;
	width: number;
	height: number;
	background: 'checker' | 'light' | 'dark';
	scenario?: string;
	readySelector?: string;
	settleMs?: number;
	interactionSteps?: PreviewInteractionStep[];
	advanceTimeMs?: number;
	minimumContentCoverage?: MinimumContentCoverage;
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
	textInkMeasurements: TextInkMeasurement[];
}

interface BriefSurface {
	id: string;
	width: number;
	height: number;
	role: 'primary' | 'required' | 'fallback';
	minimumContentCoverage: MinimumContentCoverage;
}

interface DynamicTextPolicy {
	id: string;
	selectors: string[];
	strategy: 'auto-fit' | 'wrap' | 'ellipsis' | 'marquee';
	limits: {
		minimumFontSize?: number;
		maximumLines?: number;
	};
	evidenceScenario: string;
}

interface TextRolePolicy {
	role: TextRole;
	selectors: string[];
}

interface GenerationBriefSummary {
	briefVersion: 3 | 4 | 5 | 6 | 7;
	surfaceStrategy: {
		mode: 'fixed' | 'bounded' | 'adaptive';
	};
	surfaces: BriefSurface[];
	dynamicText: DynamicTextPolicy[];
	presentation?: {
		viewingDistance?: ViewingDistance;
		textRoles?: TextRolePolicy[];
	};
}

const generationBriefPath: string = path.resolve(process.cwd(), 'generation-brief.json');
const generationBrief: GenerationBriefSummary = JSON.parse(
	fs.readFileSync(generationBriefPath, 'utf8')
) as GenerationBriefSummary;

const backgroundForSurface = (surface: BriefSurface): VisualPreset['background'] => {
	if (surface.role === 'primary') {
		return 'checker';
	}

	return surface.height > surface.width ? 'dark' : 'light';
};

const plannedSurfacePresets: VisualPreset[] = generationBrief.surfaces.map((surface: BriefSurface): VisualPreset => ({
	name: surface.id,
	width: surface.width,
	height: surface.height,
	background: backgroundForSurface(surface),
	readySelector: previewFixture.readySelector,
	settleMs: previewFixture.settleMs,
	minimumContentCoverage: surface.minimumContentCoverage
}));

const adaptiveStandardPresets: VisualPreset[] = generationBrief.surfaceStrategy.mode === 'adaptive' ? (
	[
		{ name: 'full-hd', width: 1920, height: 1080, background: 'checker', readySelector: previewFixture.readySelector, settleMs: previewFixture.settleMs },
		{ name: 'wide-low', width: 1536, height: 432, background: 'light', readySelector: previewFixture.readySelector, settleMs: previewFixture.settleMs },
		{ name: 'landscape', width: 960, height: 540, background: 'checker', readySelector: previewFixture.readySelector, settleMs: previewFixture.settleMs },
		{ name: 'portrait', width: 1080, height: 1920, background: 'dark', readySelector: previewFixture.readySelector, settleMs: previewFixture.settleMs },
		{ name: 'square', width: 600, height: 600, background: 'light', readySelector: previewFixture.readySelector, settleMs: previewFixture.settleMs }
	] as VisualPreset[]
).filter((standard: VisualPreset): boolean => {
	return !plannedSurfacePresets.some((planned: VisualPreset): boolean => {
		return planned.width === standard.width && planned.height === standard.height;
	});
}) : [];
const presets: VisualPreset[] = [...plannedSurfacePresets, ...adaptiveStandardPresets];

const scenarioPresets: VisualPreset[] = previewScenarios.map((scenario: PreviewScenario): VisualPreset => ({
	name: `scenario-${scenario.id}`,
	width: scenario.viewport.width,
	height: scenario.viewport.height,
	background: scenario.viewport.background ?? 'checker',
	scenario: scenario.id,
	readySelector: scenario.fixture.readySelector ?? previewFixture.readySelector,
	settleMs: scenario.fixture.settleMs ?? previewFixture.settleMs,
	interactionSteps: scenario.interactionSteps,
	advanceTimeMs: scenario.advanceTimeMs,
	minimumContentCoverage: scenario.minimumContentCoverage,
	liveDatasourceUpdate: scenario.liveDatasourceUpdate
}));

const screenshotDirectory: string = path.resolve(process.cwd(), 'preview', 'output');
const coverageMeasurementDirectory: string = path.join(screenshotDirectory, 'coverage-measurements');
const coverageMeasurementMode: boolean = process.env.WALLBOARD_VISUAL_MEASURE_ONLY === 'true';
const previewBaseUrl: string = process.env.WALLBOARD_PREVIEW_TEST_PORT
	? `http://127.0.0.1:${process.env.WALLBOARD_PREVIEW_TEST_PORT}/`
	: 'http://127.0.0.1:4173/';

const readSettingEffectValue = async (
	page: Page,
	effect: PreviewSettingEffect
): Promise<number | string | null> => {
	return page.locator(effect.selector).first().evaluate(
		(element: Element, measurement: PreviewSettingEffectMeasurement): number | string | null => {
			if (measurement.type === 'bounding-box') {
				return element.getBoundingClientRect()[measurement.dimension];
			}

			if (measurement.type === 'computed-style') {
				return window.getComputedStyle(element).getPropertyValue(measurement.property).trim();
			}

			if (measurement.type === 'text-content') {
				return element.textContent?.trim() ?? '';
			}

			return element.getAttribute(measurement.name);
		},
		effect.measurement
	);
};

const readHostStyleFingerprint = async (page: Page): Promise<unknown[]> => {
	return page.evaluate((): unknown[] => {
		const mount = document.getElementById('wallboard-preview-root');

		if (!mount) {
			throw new Error('Preview root was not found.');
		}

		return Array.from(mount.querySelectorAll<HTMLElement>('.wallboard-application, .wallboard-application *'))
			.filter((element): boolean => {
				const style = window.getComputedStyle(element);
				const rect = element.getBoundingClientRect();

				return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
			})
			.map((element, index): unknown => {
				const style = window.getComputedStyle(element);
				const rect = element.getBoundingClientRect();
				const round = (value: number): number => Math.round(value * 100) / 100;

				return {
					index,
					tag: element.tagName,
					classes: element.className,
					rect: [round(rect.left), round(rect.top), round(rect.width), round(rect.height)],
					style: [
						style.display,
						style.position,
						style.boxSizing,
						style.marginTop,
						style.marginRight,
						style.marginBottom,
						style.marginLeft,
						style.paddingTop,
						style.paddingRight,
						style.paddingBottom,
						style.paddingLeft,
						style.color,
						style.backgroundColor,
						style.fontSize,
						style.lineHeight,
						style.textAlign,
						style.overflowX,
						style.overflowY
					]
				};
			});
	});
};

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

		for (const step of preset.interactionSteps ?? []) {
			if (step.type === 'click') {
				await page.getByRole(step.role, { name: step.name }).click();
			} else {
				await page.getByLabel(step.label).fill(step.value);
			}
		}

		if (preset.advanceTimeMs) {
			await page.waitForTimeout(preset.advanceTimeMs);
		} else if (preset.settleMs || preset.interactionSteps?.length) {
			await page.waitForTimeout(preset.settleMs ?? DEFAULT_VISUAL_SETTLE_MS);
		}

		if (preset.liveDatasourceUpdate) {
			await page.evaluate((update): void => {
				const previewWindow = window as Window & {
					__wallboardPreview?: {
						destroy: () => Promise<void>;
						pushDatasource: (property: string, value: unknown) => void;
					};
				};

				if (!previewWindow.__wallboardPreview) {
					throw new Error('Preview datasource update bridge is unavailable.');
				}

				previewWindow.__wallboardPreview.pushDatasource(update.property, update.value);
			}, preset.liveDatasourceUpdate);
			await page.waitForTimeout(250);
			await expect(page.getByText(preset.liveDatasourceUpdate.expectedText, { exact: true })).toBeVisible();
		}

		if (preset.readySelector) {
			await page.waitForFunction((selector: string): boolean => {
				const element: HTMLElement | null = document.querySelector<HTMLElement>(selector);

				return Boolean(element?.textContent?.trim() || element?.tagName.toLowerCase() === 'img');
			}, preset.readySelector);
		}

		const dynamicTextPolicies: DynamicTextPolicy[] = generationBrief.dynamicText.filter(
			(policy: DynamicTextPolicy): boolean => policy.evidenceScenario === preset.scenario
		);

		for (const policy of dynamicTextPolicies) {
			for (const selector of policy.selectors) {
				const elements = page.locator(selector);

				expect(
					await elements.count(),
					`dynamicText '${policy.id}' selector '${selector}' must render in scenario '${preset.scenario}'.`
				).toBeGreaterThan(0);

				const violations = await elements.evaluateAll((matches: Element[], dynamicPolicy: DynamicTextPolicy): string[] => {
					return matches.flatMap((element: Element, index: number): string[] => {
						const htmlElement = element as HTMLElement;
						const bounds = htmlElement.getBoundingClientRect();

						if (bounds.width <= 0 || bounds.height <= 0) {
							return [];
						}

						const computedStyle = window.getComputedStyle(htmlElement);
						const fontSize = Number.parseFloat(computedStyle.fontSize) || 0;
						const parsedLineHeight = Number.parseFloat(computedStyle.lineHeight);
						const lineHeight = Number.isFinite(parsedLineHeight) ? parsedLineHeight : fontSize * 1.2;
						const horizontalOverflow = htmlElement.scrollWidth > htmlElement.clientWidth + 1;
						const verticalOverflow = htmlElement.scrollHeight > htmlElement.clientHeight + 1;
						const clipsOverflow = computedStyle.overflowX === 'hidden' || computedStyle.overflowX === 'clip';
						const belowMinimum = dynamicPolicy.limits.minimumFontSize !== undefined
							&& fontSize + 0.1 < dynamicPolicy.limits.minimumFontSize;
						const issues: string[] = [];

						if (belowMinimum) {
							issues.push(`font ${fontSize}px is below ${dynamicPolicy.limits.minimumFontSize}px`);
						}

						if (dynamicPolicy.strategy === 'auto-fit' && (horizontalOverflow || verticalOverflow)) {
							issues.push('auto-fit content still overflows');
						}

						if (dynamicPolicy.strategy === 'wrap') {
							if (horizontalOverflow) {
								issues.push('wrapped content overflows horizontally');
							}

							if (dynamicPolicy.limits.maximumLines !== undefined) {
								const verticalPadding = Number.parseFloat(computedStyle.paddingTop)
									+ Number.parseFloat(computedStyle.paddingBottom);
								const maximumHeight = lineHeight * dynamicPolicy.limits.maximumLines + verticalPadding + 2;

								if (bounds.height > maximumHeight) {
									issues.push(`wrap box ${bounds.height}px exceeds ${dynamicPolicy.limits.maximumLines} lines`);
								}

								if (verticalOverflow && !clipsOverflow) {
									issues.push('wrapped overflow is not bounded');
								}
							}
						}

						if (dynamicPolicy.strategy === 'ellipsis') {
							if (dynamicPolicy.limits.maximumLines === 1) {
								if (computedStyle.whiteSpace !== 'nowrap') {
									issues.push('single-line ellipsis does not use nowrap');
								}

								if (computedStyle.textOverflow !== 'ellipsis' || !clipsOverflow) {
									issues.push('single-line ellipsis is not visibly bounded');
								}
							}
						}

						if (dynamicPolicy.strategy === 'marquee' && computedStyle.whiteSpace !== 'nowrap') {
							issues.push('marquee content is allowed to wrap');
						}

						return issues.length > 0
							? [`match ${index + 1}: ${issues.join(', ')}; ${fontSize}px, ${htmlElement.scrollWidth}x${htmlElement.scrollHeight} scroll area in ${htmlElement.clientWidth}x${htmlElement.clientHeight}`]
							: [];
					});
				}, policy);

				expect(
					violations,
					`dynamicText '${policy.id}' ${policy.strategy} policy failed for '${selector}':\n${violations.join('\n')}`
				).toEqual([]);
			}
		}

		if (generationBrief.briefVersion >= 6) {
			const distance = generationBrief.presentation!.viewingDistance!;
			let visibleRoleTextCount = 0;

			for (const policy of generationBrief.presentation!.textRoles!) {
				const selector = policy.selectors.join(', ');
				const floor = fontFloor(distance, policy.role);
				const result = await page.locator(selector).evaluateAll((matches: Element[], input: {
					floor: number;
					role: TextRole;
				}): { visibleCount: number; violations: string[] } => {
					const visible = matches.filter((element: Element): boolean => {
						const bounds = element.getBoundingClientRect();
						const style = window.getComputedStyle(element);

						return bounds.width > 0
							&& bounds.height > 0
							&& style.display !== 'none'
							&& style.visibility !== 'hidden';
					});

					return {
						visibleCount: visible.length,
						violations: visible.flatMap((element: Element, index: number): string[] => {
							const fontSize = Number.parseFloat(window.getComputedStyle(element).fontSize) || 0;
							const text = element.textContent?.trim().replace(/\s+/g, ' ') ?? '';

							return fontSize + 0.1 < input.floor
								? [`${input.role} match ${index + 1} '${text.slice(0, 80)}' renders at ${fontSize}px below ${input.floor}px`]
								: [];
						})
					};
				}, { floor, role: policy.role });

				visibleRoleTextCount += result.visibleCount;
				expect(
					result.violations,
					`v6+ ${distance} ${policy.role} text must stay at or above ${floor}px:\n${result.violations.join('\n')}`
				).toEqual([]);
			}

			expect(
				visibleRoleTextCount,
				`v6+ declared text roles must match visible content at '${preset.name}'.`
			).toBeGreaterThan(0);
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
			const elements: HTMLElement[] = Array.from(root.querySelectorAll<HTMLElement>('*'));
			const horizontalOverflow: string[] = [];
			const verticalOverflow: string[] = [];
			const outsideRoot: string[] = [];
			const brokenImages: string[] = [];
			const leafRects: DOMRect[] = [];
			const textInkMeasurements: TextInkMeasurement[] = [];
			const canvas: HTMLCanvasElement = document.createElement('canvas');
			const canvasContext: CanvasRenderingContext2D | null = canvas.getContext('2d');

			const describeElement = (element: HTMLElement): string => {
				const id: string = element.id ? `#${element.id}` : '';
				const classes: string = Array.from(element.classList)
					.slice(0, 2)
					.map((className: string): string => `.${className}`)
					.join('');

				return `${element.tagName.toLowerCase()}${id}${classes}`;
			};

			const renderedText = (text: string, transform: string): string => {
				if (transform === 'uppercase') {
					return text.toUpperCase();
				}

				if (transform === 'lowercase') {
					return text.toLowerCase();
				}

				if (transform === 'capitalize') {
					return text.replace(/\b\S/g, (character: string): string => character.toUpperCase());
				}

				return text;
			};
			const clipsVerticalOverflow = (style: CSSStyleDeclaration): boolean => {
				return ['clip', 'hidden'].includes(style.overflowY)
					&& !['contents', 'inline'].includes(style.display);
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

				if (!isVisible) {
					continue;
				}

				const allowsOffCanvasContent: boolean = Boolean(element.closest('[data-preview-allow-overflow]'));
				const clipsTextWithEllipsis: boolean =
					element.childElementCount === 0 &&
					style.textOverflow === 'ellipsis' &&
					['clip', 'hidden'].includes(style.overflowX);

				if (element instanceof HTMLImageElement && (!element.complete || element.naturalWidth === 0)) {
					brokenImages.push(describeElement(element));
				}

				if (
					!allowsOffCanvasContent &&
					!clipsTextWithEllipsis &&
					element.clientWidth > 0 &&
					element.scrollWidth > element.clientWidth + 1
				) {
					horizontalOverflow.push(describeElement(element));
				}

				if (
					!allowsOffCanvasContent &&
					element.childElementCount > 0 &&
					element.clientHeight > 0 &&
					['auto', 'clip', 'hidden', 'scroll'].includes(style.overflowY) &&
					element.scrollHeight > element.clientHeight + 1
				) {
					verticalOverflow.push(describeElement(element));
				}

				if (
					!allowsOffCanvasContent &&
					element !== root &&
					(rect.left < rootRect.left - 1 ||
						rect.right > rootRect.right + 1 ||
						rect.top < rootRect.top - 1 ||
						rect.bottom > rootRect.bottom + 1)
				) {
					outsideRoot.push(describeElement(element));
				}

				const tagName: string = element.tagName.toLowerCase();
				const hasPaintedText: boolean = element.childElementCount === 0 && Boolean(element.textContent?.trim());
				const hasBackgroundImage: boolean = style.backgroundImage !== 'none';
				const isVisualLeaf: boolean =
					hasPaintedText || hasBackgroundImage || ['canvas', 'img', 'svg', 'video'].includes(tagName);

				if (isVisualLeaf) {
					leafRects.push(rect);
				}

				const text: string = element.textContent?.trim() ?? '';
				const lineHeight: number = Number.parseFloat(style.lineHeight);

				if (
					canvasContext
					&& element.childElementCount === 0
					&& text
					&& clipsVerticalOverflow(style)
					&& Number.isFinite(lineHeight)
				) {
					let visibleTop: number = rect.top;
					let visibleBottom: number = rect.bottom;
					let clippingAncestor: HTMLElement | null = element;

					while (clippingAncestor && clippingAncestor !== root.parentElement) {
						const ancestorStyle: CSSStyleDeclaration = window.getComputedStyle(clippingAncestor);

						if (clipsVerticalOverflow(ancestorStyle)) {
							const ancestorRect: DOMRect = clippingAncestor.getBoundingClientRect();

							visibleTop = Math.max(visibleTop, ancestorRect.top);
							visibleBottom = Math.min(visibleBottom, ancestorRect.bottom);
						}

						clippingAncestor = clippingAncestor.parentElement;
					}

					const intentionallyClippedByOverflowRegion: boolean =
						allowsOffCanvasContent &&
						(visibleTop > rect.top + 0.5 || visibleBottom < rect.bottom - 0.5);

					if (intentionallyClippedByOverflowRegion) {
						continue;
					}

					const range: Range = document.createRange();
					range.selectNodeContents(element);
					const lineTops: Set<number> = new Set(
						Array.from(range.getClientRects())
							.filter((lineRect: DOMRect): boolean => lineRect.width > 0 && lineRect.height > 0)
							.map((lineRect: DOMRect): number => Math.round(lineRect.top * 2) / 2)
					);
					const measuredText: string = renderedText(text, style.textTransform);
					canvasContext.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
					const textMetrics: TextMetrics = canvasContext.measureText(measuredText);

					textInkMeasurements.push({
						selector: describeElement(element),
						text: measuredText.length > 80 ? `${measuredText.slice(0, 77)}...` : measuredText,
						overflowY: style.overflowY,
						fontSize: Number.parseFloat(style.fontSize),
						lineHeight,
						boxHeight: rect.height,
						layoutHeight: element.offsetHeight || undefined,
						visibleHeight: Math.max(0, visibleBottom - visibleTop),
						borderTop: Number.parseFloat(style.borderTopWidth) || 0,
						borderBottom: Number.parseFloat(style.borderBottomWidth) || 0,
						paddingBottom: Number.parseFloat(style.paddingBottom) || 0,
						lineCount: Math.max(1, lineTops.size),
						actualAscent: textMetrics.actualBoundingBoxAscent,
						actualDescent: textMetrics.actualBoundingBoxDescent
					});
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
				brokenImages: [...new Set(brokenImages)],
				textInkMeasurements
			};
		});
		const textInkRisks: TextInkRisk[] = findTextInkRisks(metrics.textInkMeasurements);

		const safePresetName: string = preset.name.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'surface';

		if (coverageMeasurementMode) {
			fs.mkdirSync(coverageMeasurementDirectory, { recursive: true });
			fs.writeFileSync(
				path.join(coverageMeasurementDirectory, `${safePresetName}-${preset.width}x${preset.height}.json`),
				`${JSON.stringify({
					id: preset.name,
					kind: preset.scenario ? 'scenario' : 'surface',
					width: preset.width,
					height: preset.height,
					measured: {
						width: metrics.contentWidthCoverage,
						height: metrics.contentHeightCoverage
					}
				}, null, '\t')}\n`,
				'utf8'
			);
		}

		const captureCandidates: Buffer[] = [];
		for (let captureIndex = 0; captureIndex < 2; captureIndex += 1) {
			await page.evaluate(async (): Promise<void> => {
				const root: HTMLElement | null = document.getElementById('wallboard-preview-root');

				if (!root) {
					throw new Error('Preview root is unavailable before screenshot capture.');
				}

				const previousDisplay: string = root.style.display;
				root.style.display = 'none';
				void root.offsetHeight;
				root.style.display = previousDisplay;
				void root.offsetHeight;
				const repaintStyle: HTMLStyleElement = document.createElement('style');
				repaintStyle.textContent = '#wallboard-preview-root * { color: transparent !important; }';
				document.head.append(repaintStyle);
				void root.offsetHeight;
				await new Promise<void>((resolve): void => {
					window.requestAnimationFrame((): void => resolve());
				});
				repaintStyle.remove();
				void root.offsetHeight;
				await new Promise<void>((resolve): void => {
					window.requestAnimationFrame((): void => {
						window.requestAnimationFrame((): void => resolve());
					});
				});
			});
			await page.waitForTimeout(500);
			captureCandidates.push(await page.locator('#wallboard-preview-root').screenshot({ animations: 'disabled' }));
		}
		const stableCapture: Buffer = captureCandidates.reduce((largest, candidate): Buffer => {
			return candidate.byteLength > largest.byteLength ? candidate : largest;
		});
		fs.writeFileSync(
			path.join(screenshotDirectory, `${safePresetName}-${preset.width}x${preset.height}.png`),
			stableCapture
		);

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
		expect(textInkRisks, `Vertically clipped text ink:\n${formatTextInkRisks(textInkRisks)}`).toEqual([]);

		if (preset.minimumContentCoverage && !coverageMeasurementMode) {
			expect(metrics.contentWidthCoverage).toBeGreaterThanOrEqual(preset.minimumContentCoverage.width);
			expect(metrics.contentHeightCoverage).toBeGreaterThanOrEqual(preset.minimumContentCoverage.height);
		}
	});
}

if (generationBrief.briefVersion === 4) {
	test('representative editor host styles do not change the app', async ({ page }): Promise<void> => {
		const primarySurface = generationBrief.surfaces.find((surface) => surface.role === 'primary') as BriefSurface;

		await page.setViewportSize({ width: primarySurface.width, height: primarySurface.height });
		const response = await page.goto('/preview/widget.html?background=checker');

		expect(response?.ok()).toBe(true);
		await page.waitForFunction((): boolean => document.documentElement.dataset.previewReady === 'true');
		const baseline = await readHostStyleFingerprint(page);

		await page.addStyleTag({
			content: `
				.wallboard-application .wb-app,
				.wallboard-application .app,
				.wallboard-application .widget,
				.wallboard-application .content,
				.wallboard-application .header,
				.wallboard-application .title,
				.wallboard-application .card,
				.wallboard-application .row,
				.wallboard-application .column {
					display: inline;
					margin: 13px;
					padding: 9px;
					color: rgb(255, 0, 255);
					background-color: rgb(0, 255, 0);
				}
			`
		});

		expect(await readHostStyleFingerprint(page)).toEqual(baseline);
	});
}

for (const effect of previewSettingEffects) {
	test(`setting effect ${effect.id}`, async ({ page }): Promise<void> => {
		const scenario: PreviewScenario | undefined = effect.scenario
			? previewScenarios.find((candidate: PreviewScenario): boolean => candidate.id === effect.scenario)
			: undefined;
		const primarySurface: BriefSurface = generationBrief.surfaces.find(
			(surface: BriefSurface): boolean => surface.role === 'primary'
		) as BriefSurface;
		const viewport = scenario?.viewport ?? {
			width: primarySurface.width,
			height: primarySurface.height,
			background: 'checker' as const
		};
		const query: URLSearchParams = new URLSearchParams({ background: viewport.background ?? 'checker' });

		if (effect.scenario) {
			query.set('scenario', effect.scenario);
		}

		await page.setViewportSize({ width: viewport.width, height: viewport.height });
		const response = await page.goto(`/preview/widget.html?${query.toString()}`);

		expect(response?.ok()).toBe(true);
		await page.waitForFunction((): boolean => {
			return document.documentElement.dataset.previewReady === 'true';
		});
		await page.locator(effect.selector).first().waitFor({ state: 'visible' });
		await page.locator(effect.selector).first().evaluate(async (element: Element): Promise<void> => {
			if (element instanceof HTMLImageElement && !element.complete) {
				await new Promise<void>((resolve): void => {
					element.addEventListener('load', (): void => resolve(), { once: true });
					element.addEventListener('error', (): void => resolve(), { once: true });
				});
			}
		});

		const baselineValue: number | string | null = await readSettingEffectValue(page, effect);

		await page.evaluate(({ property, changedValue }): void => {
			const previewWindow = window as Window & {
				__wallboardPreview?: {
					pushConfiguration: (configValues: Record<string, unknown>) => void;
				};
			};

			if (!previewWindow.__wallboardPreview) {
				throw new Error('Preview configuration update bridge is unavailable.');
			}

			previewWindow.__wallboardPreview.pushConfiguration({ [property]: changedValue });
		}, effect);

		if (effect.expectation.type === 'change') {
			await expect.poll(async (): Promise<boolean> => {
				return (await readSettingEffectValue(page, effect)) !== baselineValue;
			}).toBe(true);
		} else {
			const baselineNumber: number = Number.parseFloat(String(baselineValue));
			const minimumDelta: number = effect.expectation.minimumDelta ?? 1;

			expect(Number.isFinite(baselineNumber)).toBe(true);

			if (effect.expectation.type === 'increase') {
				await expect.poll(async (): Promise<number> => {
					return Number.parseFloat(String(await readSettingEffectValue(page, effect)));
				}).toBeGreaterThanOrEqual(baselineNumber + minimumDelta);
			} else {
				await expect.poll(async (): Promise<number> => {
					return Number.parseFloat(String(await readSettingEffectValue(page, effect)));
				}).toBeLessThanOrEqual(baselineNumber - minimumDelta);
			}
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

test('preview bridge destroys the mounted widget', async ({ page }): Promise<void> => {
	const response = await page.goto('/preview/widget.html?background=checker');

	expect(response?.ok()).toBe(true);
	await page.waitForFunction((): boolean => document.documentElement.dataset.previewReady === 'true');
	await page.evaluate(async (): Promise<void> => {
		const previewWindow = window as Window & {
			__wallboardPreview?: { destroy: () => Promise<void> };
		};

		if (!previewWindow.__wallboardPreview) {
			throw new Error('Preview lifecycle bridge is unavailable.');
		}

		await previewWindow.__wallboardPreview.destroy();
	});
	await expect(page.locator('#wallboard-preview-root')).toBeEmpty();
});
