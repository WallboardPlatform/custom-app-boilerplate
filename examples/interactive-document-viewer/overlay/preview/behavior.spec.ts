import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

interface PreviewWindow extends Window {
	__wallboardPreview?: {
		destroy: () => Promise<void>;
		pushConfiguration: (configValues: Record<string, unknown>) => void;
		pushDatasource: (property: string, value: unknown) => void;
		pushExternalCommand: (command: string) => void;
	};
}

const scenarioSizes: Record<string, { width: number; height: number }> = {
	accessibility: { width: 1920, height: 1080 },
	compact: { width: 800, height: 600 },
	'custom-branding': { width: 1920, height: 1080 },
	'invalid-rows': { width: 1366, height: 768 },
	'keyboard-inline': { width: 1080, height: 1920 },
	'keyboard-scale': { width: 1080, height: 1920 },
	landscape: { width: 1920, height: 1080 },
	'landscape-keyboard': { width: 1920, height: 1080 },
	'live-datasource-update': { width: 1366, height: 768 },
	'long-labels': { width: 1080, height: 1920 },
	portrait: { width: 1080, height: 1920 },
	'portrait-selected': { width: 1080, height: 1920 },
	screensaver: { width: 1080, height: 1920 },
	'screensaver-branding': { width: 1080, height: 1920 },
	square: { width: 768, height: 768 }
};

const openScenario = async (page: Page, scenario = 'landscape', waitForPdf = true): Promise<void> => {
	await page.setViewportSize(scenarioSizes[scenario] ?? scenarioSizes.landscape);
	const response = await page.goto(`/preview/widget.html?scenario=${scenario}&background=light`);

	expect(response?.ok()).toBe(true);
	await page.waitForFunction((): boolean => {
		return (
			document.documentElement.dataset.previewReady === 'true' || Boolean(document.documentElement.dataset.previewError)
		);
	});
	expect(await page.evaluate((): string | undefined => document.documentElement.dataset.previewError)).toBeUndefined();
	await page.waitForSelector('[data-preview-id="interactive-document-viewer-root"]');
	if (waitForPdf)
		await page.waitForSelector('[data-preview-id="interactive-document-viewer-root"][data-pdf-ready="true"]');
};

const pushConfiguration = async (page: Page, configValues: Record<string, unknown>): Promise<void> => {
	await page.evaluate((values): void => {
		const preview = (window as PreviewWindow).__wallboardPreview;

		if (!preview) throw new Error('Preview bridge is unavailable.');
		preview.pushConfiguration(values);
	}, configValues);
};

const pushDatasource = async (page: Page, property: string, value: unknown): Promise<void> => {
	await page.evaluate(
		({ bindingProperty, datasourceValue }): void => {
			const preview = (window as PreviewWindow).__wallboardPreview;

			if (!preview) throw new Error('Preview bridge is unavailable.');
			preview.pushDatasource(bindingProperty, datasourceValue);
		},
		{ bindingProperty: property, datasourceValue: value }
	);
};

interface KeyboardSurfaceMeasurement {
	closeBackground: string;
	closeBorderColor: string;
	closeBoxShadow: string;
	closeOutlineStyle: string;
	controlRadius: string;
	directoryRadius: string;
	keyBackground: string;
	keyBorderColor: string;
	keyRadius: string;
	panelBackground: string;
	panelBorderWidth: string;
	panelBoxShadow: string;
	panelRadius: string;
	searchBackground: string;
	searchColor: string;
	searchFieldRadius: string;
	wrapperBackground: string;
	wrapperBorderWidth: string;
	wrapperBoxShadow: string;
}

const measureKeyboardSurface = async (page: Page): Promise<KeyboardSurfaceMeasurement> => {
	const keyboard = page.getByRole('dialog', { name: 'On-screen keyboard' });

	return keyboard.evaluate((element: HTMLElement): KeyboardSurfaceMeasurement => {
		const panel = element.querySelector<HTMLElement>('[data-preview-id="keyboard-panel"]');
		const close = Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find(
			(button: HTMLButtonElement): boolean => button.textContent?.trim() === 'Close'
		);
		const key = element.querySelector<HTMLButtonElement>('[data-preview-id="keyboard-key"]');
		const submit = element.querySelector<HTMLButtonElement>('[data-preview-id="keyboard-submit"]');
		const directory = document.querySelector<HTMLElement>('aside[aria-label="Document directory"]');
		const physicalSearch = document.querySelector<HTMLInputElement>(
			'input[aria-label="Search the document directory"]'
		)?.parentElement;

		if (!panel || !close || !key || !submit || !directory || !physicalSearch) {
			throw new Error('Keyboard visual measurement target is missing.');
		}

		const keyboardStyle = getComputedStyle(element);
		const panelStyle = getComputedStyle(panel);
		const closeStyle = getComputedStyle(close);
		const keyStyle = getComputedStyle(key);
		const submitStyle = getComputedStyle(submit);
		const directoryStyle = getComputedStyle(directory);
		const physicalSearchStyle = getComputedStyle(physicalSearch);

		return {
			closeBackground: closeStyle.backgroundColor,
			closeBorderColor: closeStyle.borderColor,
			closeBoxShadow: closeStyle.boxShadow,
			closeOutlineStyle: closeStyle.outlineStyle,
			controlRadius: closeStyle.borderTopLeftRadius,
			directoryRadius: directoryStyle.borderTopLeftRadius,
			keyBackground: keyStyle.backgroundColor,
			keyBorderColor: keyStyle.borderColor,
			keyRadius: keyStyle.borderTopLeftRadius,
			panelBackground: panelStyle.backgroundColor,
			panelBorderWidth: panelStyle.borderTopWidth,
			panelBoxShadow: panelStyle.boxShadow,
			panelRadius: panelStyle.borderTopLeftRadius,
			searchBackground: submitStyle.backgroundColor,
			searchColor: submitStyle.color,
			searchFieldRadius: physicalSearchStyle.borderTopLeftRadius,
			wrapperBackground: keyboardStyle.backgroundColor,
			wrapperBorderWidth: keyboardStyle.borderTopWidth,
			wrapperBoxShadow: keyboardStyle.boxShadow
		};
	});
};

interface KeyboardGridMeasurement {
	centerDelta: number;
	contained: boolean;
	horizontalOverflow: number;
	keyGapVariation: number;
	keyWidthVariation: number;
	rowCount: number;
}

interface KeyboardFooterMeasurement {
	contained: boolean;
	edgeDelta: number;
	fillRatio: number;
	footerKeysLeftDelta: number;
	footerKeysWidthDelta: number;
	gapVariation: number;
}

const measureKeyboardGrid = async (page: Page): Promise<KeyboardGridMeasurement> => {
	const keyboard = page.getByRole('dialog', { name: 'On-screen keyboard' });

	return keyboard.evaluate((element: HTMLElement): KeyboardGridMeasurement => {
		const keys = element.querySelector<HTMLElement>('[data-preview-id="keyboard-keys"]');
		const rows = Array.from(element.querySelectorAll<HTMLElement>('[data-preview-id="keyboard-row"]'));

		if (!keys || rows.length === 0) throw new Error('Keyboard grid measurement target is missing.');
		const keysBounds = keys.getBoundingClientRect();
		const widths: number[] = [];
		const gaps: number[] = [];
		let centerDelta = 0;
		let contained = true;

		for (const row of rows) {
			const buttons = Array.from(row.querySelectorAll<HTMLButtonElement>('[data-preview-id="keyboard-key"]'));
			if (buttons.length === 0) throw new Error('Keyboard row has no keys.');
			const bounds = buttons.map((button: HTMLButtonElement): DOMRect => button.getBoundingClientRect());
			const leftInset = bounds[0].left - keysBounds.left;
			const rightInset = keysBounds.right - bounds[bounds.length - 1].right;

			centerDelta = Math.max(centerDelta, Math.abs(leftInset - rightInset));
			contained =
				contained &&
				bounds.every((box: DOMRect): boolean => box.left >= keysBounds.left - 1 && box.right <= keysBounds.right + 1);
			widths.push(...bounds.map((box: DOMRect): number => box.width));
			for (let index = 1; index < bounds.length; index += 1) {
				gaps.push(bounds[index].left - bounds[index - 1].right);
			}
		}

		return {
			centerDelta,
			contained,
			horizontalOverflow: Math.max(0, keys.scrollWidth - keys.clientWidth),
			keyGapVariation: Math.max(...gaps) - Math.min(...gaps),
			keyWidthVariation: Math.max(...widths) - Math.min(...widths),
			rowCount: rows.length
		};
	});
};

const measureKeyboardFooter = async (page: Page): Promise<KeyboardFooterMeasurement> => {
	const keyboard = page.getByRole('dialog', { name: 'On-screen keyboard' });

	return keyboard.evaluate((element: HTMLElement): KeyboardFooterMeasurement => {
		const keys = element.querySelector<HTMLElement>('[data-preview-id="keyboard-keys"]');
		const footer = element.querySelector<HTMLElement>('footer');
		const buttons = footer ? Array.from(footer.querySelectorAll<HTMLButtonElement>('button')) : [];

		if (!keys || !footer || buttons.length === 0) throw new Error('Keyboard footer measurement target is missing.');
		const keysBounds = keys.getBoundingClientRect();
		const footerBounds = footer.getBoundingClientRect();
		const bounds = buttons.map((button: HTMLButtonElement): DOMRect => button.getBoundingClientRect());
		const gaps: number[] = [];

		for (let index = 1; index < bounds.length; index += 1) {
			gaps.push(bounds[index].left - bounds[index - 1].right);
		}

		const first = bounds[0];
		const last = bounds[bounds.length - 1];
		const leftInset = first.left - footerBounds.left;
		const rightInset = footerBounds.right - last.right;

		return {
			contained: bounds.every(
				(box: DOMRect): boolean => box.left >= footerBounds.left - 1 && box.right <= footerBounds.right + 1
			),
			edgeDelta: Math.abs(leftInset - rightInset),
			fillRatio: (last.right - first.left) / footerBounds.width,
			footerKeysLeftDelta: Math.abs(footerBounds.left - keysBounds.left),
			footerKeysWidthDelta: Math.abs(footerBounds.width - keysBounds.width),
			gapVariation: Math.max(...gaps) - Math.min(...gaps)
		};
	});
};

test('binds the Documents table and renders only the selected PDF', async ({ page }): Promise<void> => {
	await openScenario(page);
	const root = page.locator('[data-preview-id="interactive-document-viewer-root"]');

	await expect(root).toHaveAttribute('data-bound', 'true');
	await expect(root).toHaveAttribute('data-document-count', '6');
	await expect(page.locator('[data-pdf-ready="true"]').last()).toHaveAttribute('data-document-count', '1');
	await expect(page.locator('canvas.pdf-canvas').first()).toBeVisible();
});

test('custom logo and optional header copy replace the default brand treatment', async ({ page }): Promise<void> => {
	await openScenario(page, 'custom-branding');
	const root = page.locator('[data-preview-id="interactive-document-viewer-root"]');
	const header = page.locator('header').first();

	await expect(root).toHaveAttribute('data-logo-source', 'custom');
	await expect(root).toHaveAttribute('data-header-copy', 'true');
	await expect(header.locator('img')).toHaveAttribute('src', /icon\.png/);
	await expect(page.getByText('Rivermark information center', { exact: true })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Community records' })).toBeVisible();
	await expect(page.locator('[data-preview-id="document-icon"] img').first()).toHaveAttribute('src', /icon\.png/);

	await pushConfiguration(page, {
		logoFile: { filePath: '/src/editor-assets/icon.png' },
		showEyebrow: false,
		showAppTitle: false,
		showDirectoryIcon: false
	});
	await expect(root).toHaveAttribute('data-header-copy', 'false');
	await expect(root).toHaveAttribute('data-logo-source', 'custom');
	await expect(page.getByText('Rivermark information center', { exact: true })).toHaveCount(0);
	await expect(page.getByRole('heading', { name: 'Community records' })).toHaveCount(0);
	await expect(page.locator('[data-preview-id="document-icon"]')).toHaveCount(0);
});

test('default header and accessibility controls stay intentionally minimal', async ({ page }): Promise<void> => {
	await openScenario(page);
	const root = page.locator('[data-preview-id="interactive-document-viewer-root"]');

	await expect(root).toHaveAttribute('data-header-copy', 'false');
	await expect(root).toHaveAttribute('data-logo-source', 'default');
	await expect(page.getByRole('heading')).toHaveCount(0);
	await expect(page.getByRole('img', { name: 'Community Documents' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Toggle accessible reach mode' })).toHaveCount(0);
});

test('category buttons derive from the configured column and filter the directory', async ({ page }): Promise<void> => {
	await openScenario(page);
	await page.getByRole('button', { name: /Public Notices 1/ }).click();

	await expect(page.getByText('1 result', { exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: /Public Notice: Harbor Avenue Lane Closure/ })).toBeVisible();
	await expect(page.getByRole('button', { name: /Budget Report:/ })).toHaveCount(0);
});

test('all datasource categories wrap into visible buttons without a hidden horizontal rail', async ({
	page
}): Promise<void> => {
	await openScenario(page, 'portrait-selected', false);
	const navigation = page.getByRole('navigation', { name: 'Document categories' });
	const categoryButtons = navigation.getByRole('button');

	await expect(categoryButtons).toHaveCount(13);
	await expect(page.getByRole('button', { name: /Forms & Applications 1/ })).toBeVisible();
	const geometry = await navigation.evaluate(
		(
			element: HTMLElement
		): {
			allContained: boolean;
			overflowX: string;
			overflowY: string;
			scrollHeight: number;
			scrollWidth: number;
			clientHeight: number;
			clientWidth: number;
		} => {
			const bounds = element.getBoundingClientRect();
			const buttons = Array.from(element.querySelectorAll('button'));
			const allContained = buttons.every((button: HTMLButtonElement): boolean => {
				const rect = button.getBoundingClientRect();

				return (
					rect.left >= bounds.left - 1 &&
					rect.right <= bounds.right + 1 &&
					rect.top >= bounds.top - 1 &&
					rect.bottom <= bounds.bottom + 1
				);
			});
			const style = getComputedStyle(element);

			return {
				allContained,
				overflowX: style.overflowX,
				overflowY: style.overflowY,
				scrollHeight: element.scrollHeight,
				scrollWidth: element.scrollWidth,
				clientHeight: element.clientHeight,
				clientWidth: element.clientWidth
			};
		}
	);

	expect(geometry.allContained).toBe(true);
	expect(['auto', 'scroll']).not.toContain(geometry.overflowX);
	expect(['auto', 'scroll']).not.toContain(geometry.overflowY);
	expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
	expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.clientHeight + 1);

	await page.getByRole('button', { name: /Forms & Applications 1/ }).click();
	await expect(page.getByText('1 result', { exact: true })).toBeVisible();
});

test('selected and unselected document icon regions share rounded left corners', async ({ page }): Promise<void> => {
	await openScenario(page);
	const rows = page.locator('[data-preview-id="document-row"]');
	const selected = rows.filter({ has: page.locator('[data-preview-id="document-icon"]') }).first();
	const unselected = rows.nth(1);

	await expect(selected).toHaveAttribute('data-selected', 'true');
	await expect(unselected).toHaveAttribute('data-selected', 'false');
	for (const row of [selected, unselected]) {
		const styles = await row.evaluate((element: HTMLElement): { iconRadius: string; overflow: string } => {
			const icon = element.querySelector<HTMLElement>('[data-preview-id="document-icon"]');

			return {
				iconRadius: icon ? getComputedStyle(icon).borderTopLeftRadius : '',
				overflow: getComputedStyle(element).overflow
			};
		});

		expect(styles.iconRadius).not.toBe('0px');
		expect(styles.overflow).toBe('hidden');
	}
});

test('selecting a row updates the active document and its PDF', async ({ page }): Promise<void> => {
	await openScenario(page);
	await page.getByRole('button', { name: /Meeting Minutes: Community Services Session/ }).click();

	await expect(page.getByText('Meeting Minutes: Community Services Session', { exact: true })).toHaveCount(2);
	await expect(page.locator('[data-preview-id="interactive-document-viewer-root"]')).toHaveAttribute(
		'data-pdf-ready',
		'true'
	);
	await expect(page.locator('[data-pdf-ready="true"]').last()).toHaveAttribute('data-document-count', '1');
});

test('portrait All documents opens the exact first-selected PDF on initial and returning visits', async ({
	page
}): Promise<void> => {
	await openScenario(page, 'portrait', false);
	const root = page.locator('[data-preview-id="interactive-document-viewer-root"]');
	const meetingMinutes = page.getByRole('button', { name: /Meeting Minutes: Community Services Session/ });

	await expect(page.getByRole('button', { name: /All documents 6/ })).toHaveAttribute('aria-pressed', 'true');
	await meetingMinutes.click();
	await expect(root).toHaveAttribute('data-selected-document-id', 'sample-pdf-minutes');
	await expect(root).toHaveAttribute('data-active-pdf-id', 'sample-pdf-minutes');
	await expect(root).toHaveAttribute('data-pdf-ready', 'true');
	await expect(
		page
			.getByRole('region', { name: 'PDF document viewer' })
			.getByText('Meeting Minutes: Community Services Session', { exact: true })
	).toBeVisible();

	await page.getByRole('button', { name: /Budgets & Finance 1/ }).click();
	await page.getByRole('button', { name: /Budget Report: Fiscal Year 2027 Proposal/ }).click();
	await expect(root).toHaveAttribute('data-selected-document-id', 'sample-pdf-budget');
	await expect(root).toHaveAttribute('data-active-pdf-id', 'sample-pdf-budget');
	await expect(root).toHaveAttribute('data-pdf-ready', 'true');
	await expect(
		page
			.getByRole('region', { name: 'PDF document viewer' })
			.getByText('Budget Report: Fiscal Year 2027 Proposal', { exact: true })
	).toBeVisible();

	await page.getByRole('button', { name: /All documents 6/ }).click();
	await expect(root).toHaveAttribute('data-portrait-reader-open', 'false');
	await meetingMinutes.click();
	await expect(root).toHaveAttribute('data-selected-document-id', 'sample-pdf-minutes');
	await expect(root).toHaveAttribute('data-active-pdf-id', 'sample-pdf-minutes');
	await expect(root).toHaveAttribute('data-pdf-ready', 'true');
	await expect(
		page
			.getByRole('region', { name: 'PDF document viewer' })
			.getByText('Meeting Minutes: Community Services Session', { exact: true })
	).toBeVisible();
});

test('physical search filters titles and metadata', async ({ page }): Promise<void> => {
	await openScenario(page);
	const search = page.getByLabel('Search the document directory');

	await search.fill('permit');
	await expect(page.getByText('1 result', { exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: /Permit Guide:/ })).toBeVisible();

	await page.getByRole('button', { name: 'Clear search' }).click();
	await expect(page.getByText('6 results', { exact: true })).toBeVisible();
});




test('portrait keyboard remains a full-width page dock below the directory workspace', async ({
	page
}): Promise<void> => {
	await openScenario(page, 'portrait', false);
	const root = page.locator('[data-preview-id="interactive-document-viewer-root"]');
	await page.getByRole('button', { name: 'Open on-screen keyboard' }).click();

	const keyboard = page.getByRole('dialog', { name: 'On-screen keyboard' });
	const searchButton = keyboard.getByRole('button', { name: 'Search', exact: true });
	await expect(keyboard).toBeVisible();
	await expect(keyboard).toHaveAttribute('data-placement', 'page');
	await expect(root).toHaveAttribute('data-keyboard-placement', 'page');
	await expect(searchButton).toHaveCSS('background-color', 'rgb(10, 45, 111)');
	await expect(searchButton).toHaveCSS('color', 'rgb(255, 255, 255)');

	const keyboardBounds = await keyboard.boundingBox();
	const workspaceBounds = await page.locator('main').boundingBox();
	const rootBounds = await root.boundingBox();
	expect(keyboardBounds).not.toBeNull();
	expect(workspaceBounds).not.toBeNull();
	expect(rootBounds).not.toBeNull();
	if (keyboardBounds && workspaceBounds && rootBounds) {
		expect(keyboardBounds.y).toBeGreaterThanOrEqual(workspaceBounds.y + workspaceBounds.height - 1);
		expect(keyboardBounds.x).toBeLessThanOrEqual(rootBounds.x + 1);
		expect(keyboardBounds.x + keyboardBounds.width).toBeGreaterThanOrEqual(rootBounds.x + rootBounds.width - 1);
	}
});






test('reader page and zoom controls stay focused on the essential kiosk actions', async ({ page }): Promise<void> => {
	await openScenario(page);
	const pageReadout = page.locator('[data-text-role="page-readout"]');

	await expect(pageReadout).toContainText('1');
	await page.getByRole('button', { name: 'Next page' }).click();
	await expect(pageReadout).toContainText('2');
	await expect(page.getByLabel('Zoom 100 percent')).toBeVisible();
	await page.getByRole('button', { name: 'Zoom in' }).click();
	await expect(page.getByLabel('Zoom 120 percent')).toBeVisible();
	await page.getByRole('button', { name: 'Zoom out' }).click();
	await expect(page.getByLabel('Zoom 100 percent')).toBeVisible();
	await expect(page.getByRole('button', { name: /Scroll PDF/ })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Reset zoom' })).toHaveCount(0);
});

test('portrait zoom controls share one height and keep their separator unobstructed', async ({
	page
}): Promise<void> => {
	await openScenario(page, 'portrait', false);
	const root = page.locator('[data-preview-id="interactive-document-viewer-root"]');
	await page.locator('[data-preview-id="document-row"]').first().click();
	await expect(root).toHaveAttribute('data-portrait-reader-open', 'true');
	await expect(root).toHaveAttribute('data-pdf-ready', 'true');

	const separator = page.locator('[data-preview-id="zoom-control-separator"]');
	const zoomOut = page.getByRole('button', { name: 'Zoom out' });
	const zoomReadout = page.locator('[data-preview-id="zoom-readout"]');
	const zoomIn = page.getByRole('button', { name: 'Zoom in' });
	await expect(separator).toBeVisible();
	await expect(separator).toHaveCSS('display', 'block');

	const separatorBounds = await separator.boundingBox();
	const zoomOutBounds = await zoomOut.boundingBox();
	const zoomReadoutBounds = await zoomReadout.boundingBox();
	const zoomInBounds = await zoomIn.boundingBox();
	expect(separatorBounds).not.toBeNull();
	expect(zoomOutBounds).not.toBeNull();
	expect(zoomReadoutBounds).not.toBeNull();
	expect(zoomInBounds).not.toBeNull();
	if (separatorBounds && zoomOutBounds && zoomReadoutBounds && zoomInBounds) {
		expect(Math.abs(zoomReadoutBounds.height - zoomOutBounds.height)).toBeLessThanOrEqual(1);
		expect(Math.abs(zoomReadoutBounds.height - zoomInBounds.height)).toBeLessThanOrEqual(1);
		expect(separatorBounds.width).toBeLessThanOrEqual(2);
		expect(separatorBounds.height).toBeLessThan(zoomOutBounds.height);
		expect(separatorBounds.x + separatorBounds.width).toBeLessThanOrEqual(zoomOutBounds.x - 4);
		expect(
			Math.abs(separatorBounds.y + separatorBounds.height / 2 - (zoomOutBounds.y + zoomOutBounds.height / 2))
		).toBeLessThanOrEqual(1);
	}
});

test('accessible reach mode changes reach and sizing without replacing the configured theme', async ({
	page
}): Promise<void> => {
	await openScenario(page, 'accessibility');
	const root = page.locator('[data-preview-id="interactive-document-viewer-root"]');
	const button = page.getByRole('button', { name: 'Toggle accessible reach mode' });
	const visualFingerprint = async (): Promise<Record<string, string>> =>
		page.evaluate((): Record<string, string> => {
			const rootElement = document.querySelector<HTMLElement>('[data-preview-id="interactive-document-viewer-root"]');
			const header = document.querySelector<HTMLElement>('header');
			const categories = document.querySelector<HTMLElement>('nav[aria-label="Document categories"]');
			const row = document.querySelector<HTMLElement>('[data-preview-id="document-row"]');
			const controls = document.querySelector<HTMLElement>('nav[aria-label="PDF navigation"]');

			if (!rootElement || !header || !categories || !row || !controls)
				throw new Error('Theme fingerprint target is missing.');
			const rootStyle = getComputedStyle(rootElement);

			return {
				button: rootStyle.getPropertyValue('--wb-interactive-document-viewer-button').trim(),
				primary: rootStyle.getPropertyValue('--wb-interactive-document-viewer-primary').trim(),
				headerBackground: getComputedStyle(header).backgroundColor,
				categoryBackground: getComputedStyle(categories).backgroundColor,
				rowBackground: getComputedStyle(row).backgroundColor,
				rowBorderColor: getComputedStyle(row).borderTopColor,
				controlsBackground: getComputedStyle(controls).backgroundColor,
				controlsBorderColor: getComputedStyle(controls).borderTopColor
			};
		});
	const before = await visualFingerprint();

	await button.click();
	await expect(root).toHaveAttribute('data-accessibility', 'true');
	await expect(button).toHaveAttribute('aria-pressed', 'true');
	await button.evaluate((element: HTMLButtonElement): void => element.blur());
	expect(await visualFingerprint()).toEqual(before);
	const readerBounds = await page.getByRole('region', { name: 'PDF document viewer' }).boundingBox();
	const directoryBounds = await page.getByRole('complementary', { name: 'Document directory' }).boundingBox();
	expect(readerBounds).not.toBeNull();
	expect(directoryBounds).not.toBeNull();
	expect(directoryBounds?.y ?? 0).toBeGreaterThan(readerBounds?.y ?? 0);

	await pushConfiguration(page, { showAccessibilityButton: false });
	await expect(root).toHaveAttribute('data-accessibility', 'false');
	await expect(page.getByRole('button', { name: 'Toggle accessible reach mode' })).toHaveCount(0);
});

test('invalid PDF rows remain visible but cannot be opened', async ({ page }): Promise<void> => {
	await openScenario(page, 'invalid-rows');
	const unavailable = page.getByRole('button', { name: /Accessible Route Maintenance Update/ });

	await expect(unavailable).toBeVisible();
	await expect(unavailable).toBeDisabled();
	await expect(page.getByRole('button', { name: /Greenway Access Study/ })).toBeEnabled();
});

test('optional scheduling hides future and expired documents while retaining unscheduled rows', async ({
	page
}): Promise<void> => {
	await page.clock.install({ time: new Date('2030-07-21T12:00:00Z') });
	await openScenario(page, 'landscape', false);
	const root = page.locator('[data-preview-id="interactive-document-viewer-root"]');
	const scheduleCell = (from: string, fromTime: string, to: string, toTime: string): Record<string, unknown> => ({
		intervals: [
			{
				affectedDays: {
					monday: true,
					tuesday: true,
					wednesday: true,
					thursday: true,
					friday: true,
					saturday: true,
					sunday: true
				},
				affectedHours: {
					allDay: true,
					allowPartialStartingSegment: false,
					allowPartialEndingSegment: false,
					allowDayOfWeekOverflow: false
				},
				from,
				fromTime,
				to,
				toTime,
				isExcluded: false
			}
		]
	});
	const pdf = (id: string): Record<string, string> => ({
		id,
		name: `${id}.pdf`,
		location: '/preview/pdf-assets/northline-shift-brief.pdf'
	});
	const scheduledRows = [
		{
			Name: 'Unscheduled document',
			Date: '2030-07-21',
			PDF: pdf('unscheduled'),
			Category: 'General records',
			'Release Schedule': null
		},
		{
			Name: 'Active scheduled document',
			Date: '2030-07-21',
			PDF: pdf('active'),
			Category: 'Active records',
			'Release Schedule': scheduleCell('2030-07-19', '00:00', '2030-07-23', '23:59')
		},
		{
			Name: 'Future scheduled document',
			Date: '2030-07-26',
			PDF: pdf('future'),
			Category: 'Future records',
			'Release Schedule': scheduleCell('2030-07-26', '00:00', '2030-07-30', '23:59')
		},
		{
			Name: 'Recently expired document',
			Date: '2030-07-20',
			PDF: pdf('recently-expired'),
			Category: 'Archived records',
			'Release Schedule': scheduleCell('2030-07-10', '00:00', '2030-07-20', '10:00')
		},
		{
			Name: 'Old expired document',
			Date: '2030-07-10',
			PDF: pdf('old-expired'),
			Category: 'Archived records',
			'Release Schedule': scheduleCell('2030-07-01', '00:00', '2030-07-10', '10:00')
		}
	];
	const scheduledDatasource = {
		Documents: {
			header: {
				Name: 'string',
				Date: 'date',
				PDF: 'filePicker',
				Category: 'dropdown',
				'Release Schedule': 'scheduling'
			},
			rows: scheduledRows,
			connectors: {}
		}
	};

	await pushConfiguration(page, { scheduleColumn: 'Release Schedule', scheduleRetentionDays: 0 });
	await pushDatasource(page, 'documentsData', scheduledDatasource);
	await expect(root).toHaveAttribute('data-schedule-column', 'Release Schedule');
	await expect(root).toHaveAttribute('data-expired-document-retention-days', '0');
	await expect(root).toHaveAttribute('data-document-count', '2');
	await expect(page.getByText('2 results', { exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: /Unscheduled document/ })).toBeVisible();
	await expect(page.getByRole('button', { name: /Active scheduled document/ })).toBeVisible();
	await expect(page.getByRole('button', { name: /Future scheduled document/ })).toHaveCount(0);
	await expect(page.getByRole('button', { name: /Recently expired document/ })).toHaveCount(0);
	await expect(page.getByRole('button', { name: /Future records/ })).toHaveCount(0);
	await expect(page.getByRole('button', { name: /Archived records/ })).toHaveCount(0);

	await pushConfiguration(page, { scheduleRetentionDays: 2 });
	await expect(root).toHaveAttribute('data-expired-document-retention-days', '2');
	await expect(root).toHaveAttribute('data-document-count', '3');
	await expect(page.getByRole('button', { name: /Recently expired document/ })).toBeVisible();
	await expect(page.getByRole('button', { name: /Old expired document/ })).toHaveCount(0);
	await expect(page.getByRole('button', { name: /Archived records 1/ })).toBeVisible();

	await pushConfiguration(page, { scheduleColumn: '' });
	await expect(root).toHaveAttribute('data-schedule-column', '');
	await expect(root).toHaveAttribute('data-document-count', '5');
	await expect(page.getByRole('button', { name: /Future scheduled document/ })).toBeVisible();
	await expect(page.getByRole('button', { name: /Old expired document/ })).toBeVisible();

	await pushConfiguration(page, { scheduleColumn: 'Release Schedule', scheduleRetentionDays: 0 });
	await pushDatasource(page, 'documentsData', {
		Documents: {
			...scheduledDatasource.Documents,
			header: { ...scheduledDatasource.Documents.header, 'Release Schedule': 'string' }
		}
	});
	await expect(root).toHaveAttribute('data-document-count', '5');

	const expiringTimes = await page.evaluate((): { from: string; fromTime: string; to: string; toTime: string } => {
		const start = new Date(Date.now() - 60_000);
		const end = new Date(Date.now() + 30_000);
		const dateText = (value: Date): string =>
			[
				value.getFullYear(),
				String(value.getMonth() + 1).padStart(2, '0'),
				String(value.getDate()).padStart(2, '0')
			].join('-');
		const timeText = (value: Date): string =>
			[
				String(value.getHours()).padStart(2, '0'),
				String(value.getMinutes()).padStart(2, '0'),
				String(value.getSeconds()).padStart(2, '0')
			].join(':');

		return {
			from: dateText(start),
			fromTime: timeText(start),
			to: dateText(end),
			toTime: timeText(end)
		};
	});
	await pushDatasource(page, 'documentsData', {
		Documents: {
			header: scheduledDatasource.Documents.header,
			rows: [
				{
					Name: 'Document expiring now',
					Date: expiringTimes.to,
					PDF: pdf('expiring-now'),
					Category: 'Timed records',
					'Release Schedule': scheduleCell(
						expiringTimes.from,
						expiringTimes.fromTime,
						expiringTimes.to,
						expiringTimes.toTime
					)
				},
				{
					Name: 'Always available document',
					Date: '2030-07-21',
					PDF: pdf('always-available'),
					Category: 'General records',
					'Release Schedule': null
				}
			],
			connectors: {}
		}
	});
	const expiringRow = page.getByRole('button', { name: /Document expiring now/ });
	await expect(root).toHaveAttribute('data-document-count', '2');
	await expiringRow.click();
	await expect(expiringRow).toHaveAttribute('data-selected', 'true');
	await page.clock.fastForward(31_000);
	await expect(root).toHaveAttribute('data-document-count', '1');
	await expect(expiringRow).toHaveCount(0);
	await expect(page.getByRole('button', { name: /Always available document/ })).toHaveAttribute(
		'data-selected',
		'true'
	);
});

test('portrait starts with the directory and reveals the reader above the still-visible list after selection', async ({
	page
}): Promise<void> => {
	await openScenario(page, 'portrait-selected', false);
	const root = page.locator('[data-preview-id="interactive-document-viewer-root"]');
	const rows = page.locator('[data-preview-id="document-row"]');

	await expect(root).toHaveAttribute('data-portrait-reader-open', 'false');
	await expect(page.getByRole('region', { name: 'PDF document viewer' })).toHaveCount(0);
	await expect(page.locator('[data-preview-id="document-row"][data-selected="true"]')).toHaveCount(0);
	await rows.first().click();
	await expect(root).toHaveAttribute('data-portrait-reader-open', 'true');
	await expect(root).toHaveAttribute('data-pdf-ready', 'true');
	const readerBounds = await page.getByRole('region', { name: 'PDF document viewer' }).boundingBox();
	const directoryBounds = await page.getByRole('complementary', { name: 'Document directory' }).boundingBox();
	expect(readerBounds).not.toBeNull();
	expect(directoryBounds).not.toBeNull();
	expect(readerBounds?.y ?? 0).toBeLessThan(directoryBounds?.y ?? 0);

	await page.getByRole('button', { name: /Public Notices 1/ }).click();
	await expect(root).toHaveAttribute('data-portrait-reader-open', 'false');
	await expect(page.getByRole('region', { name: 'PDF document viewer' })).toHaveCount(0);
});

test('idle timeout shows a full-screen prompt and touch resets the kiosk session', async ({ page }): Promise<void> => {
	await page.clock.install();
	await openScenario(page, 'screensaver', false);
	const root = page.locator('[data-preview-id="interactive-document-viewer-root"]');
	await page.locator('[data-preview-id="document-row"]').first().click();
	await expect(root).toHaveAttribute('data-portrait-reader-open', 'true');
	await page.clock.fastForward(15_100);

	await expect(root).toHaveAttribute('data-screensaver', 'true');
	await expect(root).toHaveAttribute('data-screensaver-logo', 'none');
	await expect(page.getByRole('button', { name: /Touch anywhere to explore community documents/ })).toBeVisible();
	await expect(page.locator('[data-preview-id="screensaver-subtext"]')).toHaveText(
		'Tap or press any key to begin'
	);
	await expect(page.locator('[data-preview-id="screensaver-logo"]')).toHaveCount(0);
	await page.getByRole('button', { name: /Touch anywhere to explore community documents/ }).click();
	await expect(root).toHaveAttribute('data-screensaver', 'false');
	await expect(root).toHaveAttribute('data-portrait-reader-open', 'false');
	await expect(page.getByRole('region', { name: 'PDF document viewer' })).toHaveCount(0);
});

test('screensaver uses an independent logo and the configured overlay color', async ({ page }): Promise<void> => {
	await page.clock.install();
	await openScenario(page, 'screensaver-branding', false);
	const root = page.locator('[data-preview-id="interactive-document-viewer-root"]');
	await page.clock.fastForward(15_100);

	await expect(root).toHaveAttribute('data-screensaver', 'true');
	await expect(root).toHaveAttribute('data-screensaver-logo', 'custom');
	await expect(root).toHaveAttribute('data-screensaver-overlay-color', '#7b2457');
	await expect(page.locator('[data-preview-id="screensaver-subtext"]')).toHaveText(
		'Touch the screen or use the keyboard to continue'
	);
	const overlayVariable = await root.evaluate((element: HTMLElement): string =>
		getComputedStyle(element).getPropertyValue('--wb-interactive-document-viewer-screensaver-overlay').trim()
	);
	expect(overlayVariable).toBe('#7b2457');

	const background = page.locator('[data-preview-id="screensaver-background"]');
	const screensaver = page.locator('[data-preview-id="screensaver"]');
	const logo = page.locator('[data-preview-id="screensaver-logo"]');
	const overlay = page.locator('[data-preview-id="screensaver-overlay"]');
	const content = page.locator('[data-preview-id="screensaver-content"]');
	await expect(background).toHaveAttribute('src', /placeholder\.png/);
	await expect(logo).toHaveAttribute('src', /icon\.png/);
	await expect(logo).toBeVisible();
	await expect(overlay).toHaveCSS('background-color', 'rgb(123, 36, 87)');
	await expect(overlay).toHaveCSS('opacity', '0.7');

	const assertTopAnchoredLogo = async (): Promise<void> => {
		const screensaverBounds = await screensaver.boundingBox();
		const logoBounds = await logo.boundingBox();
		const messageBounds = await content.locator('strong').boundingBox();
		expect(screensaverBounds).not.toBeNull();
		expect(logoBounds).not.toBeNull();
		expect(messageBounds).not.toBeNull();
		if (screensaverBounds && logoBounds && messageBounds) {
			const topInset = logoBounds.y - screensaverBounds.y;
			const horizontalCenterDelta = Math.abs(
				logoBounds.x + logoBounds.width / 2 - (screensaverBounds.x + screensaverBounds.width / 2)
			);

			expect(topInset).toBeGreaterThanOrEqual(28);
			expect(topInset).toBeLessThanOrEqual(Math.min(96, screensaverBounds.height * 0.08));
			expect(logoBounds.y + logoBounds.height).toBeLessThanOrEqual(
				screensaverBounds.y + screensaverBounds.height * 0.25
			);
			expect(logoBounds.y + logoBounds.height).toBeLessThan(messageBounds.y);
			expect(horizontalCenterDelta).toBeLessThanOrEqual(2);
		}
	};

	await expect(root).toHaveAttribute('data-surface', 'portrait');
	await assertTopAnchoredLogo();
	await page.setViewportSize({ width: 1920, height: 1080 });
	await expect(root).toHaveAttribute('data-surface', 'landscape');
	await assertTopAnchoredLogo();
});

test('live datasource changes add new categories and records without remounting', async ({ page }): Promise<void> => {
	await openScenario(page, 'live-datasource-update');
	await page.evaluate((): void => {
		const current = (window as PreviewWindow).__wallboardPreview;
		if (!current) throw new Error('Preview bridge is unavailable.');
		current.pushDatasource('documentsData', {
			Documents: {
				header: { Name: 'string', Date: 'date', PDF: 'filePicker', Category: 'dropdown' },
				rows: [
					{
						Name: 'Election Notice: 2027 Early Voting Locations',
						Date: '2027-09-14',
						PDF: {
							id: 'election',
							name: 'early-voting.pdf',
							location: '/preview/pdf-assets/northline-shift-brief.pdf'
						},
						Category: 'Elections & Governance'
					}
				],
				connectors: {}
			}
		});
	});

	await expect(page.getByRole('button', { name: /Elections & Governance 1/ })).toBeVisible();
	await expect(page.getByRole('button', { name: /Election Notice: 2027 Early Voting Locations/ })).toBeVisible();
	await expect(page.locator('[data-preview-id="interactive-document-viewer-root"]')).toHaveAttribute(
		'data-document-count',
		'1'
	);
});

test('teardown releases the mounted app cleanly', async ({ page }): Promise<void> => {
	await openScenario(page);
	await page.evaluate(async (): Promise<void> => {
		await (window as PreviewWindow).__wallboardPreview?.destroy();
	});
	await expect(page.locator('[data-preview-id="interactive-document-viewer-root"]')).toHaveCount(0);
});
