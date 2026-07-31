import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { registerKeyboardConformance } from './conformance/keyboard';
import { registerPaginationConformance } from './conformance/pagination';

import {
	categoryRows,
	makeDonorRows,
	nativeCategoryValue,
	nativeDonorValue,
	previewScenarios,
	selectedDonorValue
} from './fixture';
import type { PreviewRow } from './fixture';

interface PreviewWindow extends Window {
	__wallboardPreview?: {
		destroy: () => Promise<void>;
		pushConfiguration: (configValues: Record<string, unknown>) => void;
		pushDatasource: (property: string, value: unknown) => void;
		pushExternalCommand: (
			command: string,
			parameters?: Array<{ parameter: string; value: string | number | boolean }>
		) => void;
	};
	__donorDirectoryLifecycle?: {
		activeClockIntervals: number[];
		activePaginationTimeouts: number[];
		createdResizeObservers: number;
		disconnectedResizeObservers: number;
	};
}

const ROOT_SELECTOR = '[data-preview-id="donor-directory-root"]';

const openScenario = async (page: Page, scenarioId = 'app-default', controlledTime = false): Promise<void> => {
	const scenario = previewScenarios.find((candidate): boolean => candidate.id === scenarioId);

	if (!scenario) {
		throw new Error(`Unknown Donor Directory preview scenario '${scenarioId}'.`);
	}

	if (controlledTime) {
		await page.clock.install({ time: new Date('2031-06-15T14:30:00Z') });
	}

	await page.setViewportSize({
		width: scenario.viewport.width,
		height: scenario.viewport.height
	});
	const query = new URLSearchParams({
		background: scenario.viewport.background ?? 'checker',
		scenario: scenarioId
	});
	const response = await page.goto(`/preview/widget.html?${query.toString()}`);

	expect(response?.ok()).toBe(true);
	await page.waitForFunction((): boolean => {
		return (
			document.documentElement.dataset.previewReady === 'true' || Boolean(document.documentElement.dataset.previewError)
		);
	});
	expect(
		await page.evaluate((): string | undefined => {
			return document.documentElement.dataset.previewError;
		})
	).toBeUndefined();
	await expect(page.locator(ROOT_SELECTOR)).toBeVisible();
};

const pushDatasource = async (page: Page, property: 'donorData' | 'categoryData', value: unknown): Promise<void> => {
	await page.evaluate(
		({ changedProperty, newValue }): void => {
			(window as PreviewWindow).__wallboardPreview?.pushDatasource(changedProperty, newValue);
		},
		{ changedProperty: property, newValue: value }
	);
};

const pushConfiguration = async (page: Page, configValues: Record<string, unknown>): Promise<void> => {
	await page.evaluate((values: Record<string, unknown>): void => {
		(window as PreviewWindow).__wallboardPreview?.pushConfiguration(values);
	}, configValues);
};

const pushExternalCommand = async (
	page: Page,
	command: 'enablePaginationMode' | 'disablePaginationMode' | 'resetExperience',
	durationSeconds?: number
): Promise<void> => {
	await page.evaluate(
		({ commandName, duration }): void => {
			const parameters = duration === undefined ? undefined : [{ parameter: 'durationSeconds', value: duration }];

			(window as PreviewWindow).__wallboardPreview?.pushExternalCommand(commandName, parameters);
		},
		{ commandName: command, duration: durationSeconds }
	);
};

const representativeRow = (name: string, category: string, index: number): PreviewRow => ({
	Name: name,
	Category: category,
	Amount: 12_500 + index,
	Recognition: `Recognition note ${index}`,
	_index: index
});

test('datasource-boundary accepts exactly the native table, selected table, and row-array wrappers', async ({
	page
}): Promise<void> => {
	await openScenario(page);
	const root = page.locator(ROOT_SELECTOR);

	await expect(root).toHaveAttribute('data-donor-status', 'ready');
	await expect(page.getByText('Alina Marlow', { exact: true })).toBeVisible();

	const selectedRows: PreviewRow[] = [representativeRow('Selected Shape Donor', 'Founders Circle', 1)];
	await pushDatasource(page, 'donorData', selectedDonorValue(selectedRows));
	await expect(root).toHaveAttribute('data-donor-status', 'ready');
	await expect(page.getByText('Selected Shape Donor', { exact: true })).toBeVisible();
	await expect(page.locator('[data-preview-id="donor-entry"]')).toHaveCount(1);

	const rowArray: PreviewRow[] = [representativeRow('Row Array Donor', 'Legacy Society', 2)];
	await pushDatasource(page, 'donorData', rowArray);
	await expect(root).toHaveAttribute('data-donor-status', 'ready');
	await expect(page.getByText('Row Array Donor', { exact: true })).toBeVisible();
	await expect(page.getByText('Selected Shape Donor', { exact: true })).toHaveCount(0);

	await pushConfiguration(page, { sortDirection: 'source' });
	await pushDatasource(page, 'donorData', [
		representativeRow('Later Array Position', 'Legacy Society', 20),
		representativeRow('Earlier Source Index', 'Legacy Society', 3)
	]);
	await expect(page.getByText('Earlier Source Index', { exact: true })).toBeVisible();
	await expect(page.locator('.wb-donor-directory-entry-field-1')).toHaveText([
		'Earlier Source Index',
		'Later Array Position'
	]);

	await pushDatasource(page, 'donorData', {
		payload: nativeDonorValue([representativeRow('Nested Wrapper Must Not Render', 'Community Friends', 3)])
	});
	await expect(root).toHaveAttribute('data-donor-status', 'invalid');
	await expect(page.getByText('Nested Wrapper Must Not Render', { exact: true })).toHaveCount(0);
	await expect(page.locator('[data-preview-id="directory-empty"]')).toContainText('not valid');
});

test('datasource-boundary maps three generic entry fields and renders supported complex values safely', async ({
	page
}): Promise<void> => {
	await openScenario(page, 'three-field-entries');
	const root = page.locator(ROOT_SELECTOR);

	await expect(root).toHaveAttribute('data-donor-status', 'ready');
	const alinaEntry = page
		.locator('[data-preview-id="donor-entry"]')
		.filter({
			hasText: 'Alina Marlow'
		})
		.first();
	await expect(alinaEntry.locator('.wb-donor-directory-entry-field-1')).toContainText('Alina Marlow');
	await expect(alinaEntry.locator('.wb-donor-directory-entry-field-2')).toContainText('128000');
	await expect(alinaEntry.locator('.wb-donor-directory-entry-field-3')).toContainText('Founding supporter');
	await expect(page.locator('#wallboard-preview-root')).not.toContainText('[object Object]');

	await pushDatasource(
		page,
		'donorData',
		nativeDonorValue([
			{
				Name: 'Structured Value Donor',
				Category: 'Founders Circle',
				Amount: {
					date: '2031-09-12',
					year: 2031,
					month: 9,
					day: 12
				},
				Recognition: {
					id: 'fictional-recognition',
					name: 'Named recognition value',
					location: ''
				},
				_index: 1
			}
		])
	);
	await expect(page.getByText('2031-09-12', { exact: true })).toBeVisible();
	await expect(page.getByText('Named recognition value', { exact: true })).toBeVisible();
	await expect(page.locator('#wallboard-preview-root')).not.toContainText('[object Object]');
});

test('number-column currency formatting uses TABLE types, locale grouping, and a literal prefix', async ({
	page
}): Promise<void> => {
	await openScenario(page);
	const typedTable = {
		header: {
			PrimaryNumber: 'number',
			SecondaryNumber: 'number',
			TertiaryNumber: 'number',
			NumericText: 'string',
			Category: 'dropdown'
		},
		rows: [
			{
				PrimaryNumber: 50_000,
				SecondaryNumber: '1250.5',
				TertiaryNumber: -42,
				NumericText: '75000',
				Category: 'Founders Circle',
				_index: 0
			}
		],
		connectors: {}
	};

	await pushConfiguration(page, {
		entryField1Column: 'PrimaryNumber',
		entryField2Column: 'SecondaryNumber',
		entryField3Column: 'TertiaryNumber',
		sortColumn: '',
		formatNumberColumnsAsCurrency: false
	});
	await pushDatasource(page, 'donorData', typedTable);
	await expect(page.locator('[data-preview-id="donor-entry"]')).toHaveCount(1);
	await expect(page.locator('.wb-donor-directory-entry-field-1').first()).toHaveText('50000');
	await expect(page.locator('.wb-donor-directory-entry-field-2').first()).toHaveText('1250.5');
	await expect(page.locator('.wb-donor-directory-entry-field-3').first()).toHaveText('-42');

	await pushConfiguration(page, {
		formatNumberColumnsAsCurrency: true,
		currencySymbol: '$',
		numberLocale: 'en-US'
	});
	await expect(page.locator('.wb-donor-directory-entry-field-1').first()).toHaveText('$50,000');
	await expect(page.locator('.wb-donor-directory-entry-field-2').first()).toHaveText('$1,250.5');
	await expect(page.locator('.wb-donor-directory-entry-field-3').first()).toHaveText('$-42');

	await pushConfiguration(page, {
		currencySymbol: '€',
		numberLocale: 'de-DE'
	});
	await expect(page.locator('.wb-donor-directory-entry-field-1').first()).toHaveText('€50.000');
	await expect(page.locator('.wb-donor-directory-entry-field-2').first()).toHaveText('€1.250,5');

	await pushConfiguration(page, { entryField2Column: 'NumericText' });
	await expect(page.locator('.wb-donor-directory-entry-field-2').first()).toHaveText('75000');

	await pushDatasource(page, 'donorData', typedTable.rows);
	await pushConfiguration(page, { entryField2Column: 'SecondaryNumber' });
	await expect(page.locator('.wb-donor-directory-entry-field-1').first()).toHaveText('50000');
	await expect(page.locator('.wb-donor-directory-entry-field-2').first()).toHaveText('1250.5');
	await expect(page.locator('.wb-donor-directory-entry-field-3').first()).toHaveText('-42');
});

test('donor entry fields use available width, auto-fit complete text, and stay vertically centered', async ({
	page
}): Promise<void> => {
	await openScenario(page, 'single-field-long');
	const longField = page.getByText(
		'Alexandria Penelope Montgomery-Willowbrook and Family Foundation for Community Learning',
		{ exact: true }
	);
	const longEntry = longField.locator('xpath=ancestor::article');
	const singleFieldMetrics = await longField.evaluate(
		(
			element: HTMLElement
		): {
			entryInnerWidth: number;
			fieldCenter: number;
			fieldWidth: number;
			fontSize: number;
			rowCenter: number;
			scrollWidth: number;
		} => {
			const entry = element.closest('article') as HTMLElement;
			const entryBounds = entry.getBoundingClientRect();
			const fieldBounds = element.getBoundingClientRect();
			const style = window.getComputedStyle(entry);

			return {
				entryInnerWidth:
					entryBounds.width - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight),
				fieldCenter: fieldBounds.top + fieldBounds.height / 2,
				fieldWidth: fieldBounds.width,
				fontSize: Number.parseFloat(window.getComputedStyle(element).fontSize),
				rowCenter: entryBounds.top + entryBounds.height / 2,
				scrollWidth: element.scrollWidth
			};
		}
	);

	await expect(longEntry).toHaveAttribute('data-field-count', '1');
	expect(singleFieldMetrics.fieldWidth).toBeGreaterThanOrEqual(singleFieldMetrics.entryInnerWidth * 0.98);
	expect(singleFieldMetrics.scrollWidth).toBeLessThanOrEqual(singleFieldMetrics.fieldWidth + 1);
	expect(singleFieldMetrics.fontSize).toBeLessThan(28);
	expect(Math.abs(singleFieldMetrics.fieldCenter - singleFieldMetrics.rowCenter)).toBeLessThanOrEqual(1.5);

	await openScenario(page, 'three-field-entries');
	const threeFieldEntry = page
		.locator('[data-preview-id="donor-entry"]')
		.filter({
			hasText: 'Alina Marlow'
		})
		.first();
	await expect(threeFieldEntry).toHaveAttribute('data-field-count', '3');
	const centerOffsets = await threeFieldEntry
		.locator('.wb-donor-directory-entry-field-1, .wb-donor-directory-entry-field-2, .wb-donor-directory-entry-field-3')
		.evaluateAll((elements: Element[]): number[] => {
			const entryBounds = (elements[0].closest('article') as HTMLElement).getBoundingClientRect();
			const rowCenter = entryBounds.top + entryBounds.height / 2;

			return elements.map((element: Element): number => {
				const bounds = element.getBoundingClientRect();

				return Math.abs(bounds.top + bounds.height / 2 - rowCenter);
			});
		});
	const overflows = await threeFieldEntry
		.locator('.wb-donor-directory-entry-field-1, .wb-donor-directory-entry-field-2, .wb-donor-directory-entry-field-3')
		.evaluateAll((elements: Element[]): boolean[] => {
			return elements.map((element: Element): boolean => {
				const field = element as HTMLElement;

				return field.scrollWidth > field.clientWidth + 1;
			});
		});

	expect(centerOffsets.every((offset: number): boolean => offset <= 1.5)).toBe(true);
	expect(overflows).toEqual([false, false, false]);
});

test('category-ordering keeps ALL first, honors metadata order, and alphabetizes the fallback', async ({
	page
}): Promise<void> => {
	await openScenario(page, 'category-metadata-order');
	const labels = page.locator('.wb-donor-directory-category-label');

	await expect(labels).toHaveText([
		'All Donors',
		'Heritage Circle',
		'Founding Partners',
		'Community Circle',
		'Leadership Circle'
	]);

	await openScenario(page, 'category-metadata-unbound');
	await expect(page.locator('.wb-donor-directory-category-label')).toHaveText([
		'All Donors',
		'Community Friends',
		'Founders Circle',
		'Leadership Circle',
		'Legacy Society'
	]);
	await expect(page.locator('.wb-donor-directory-category-description')).toHaveCount(0);
});

test('category descriptions can appear on buttons with independent button and heading branding', async ({
	page
}): Promise<void> => {
	await openScenario(page, 'category-metadata-order');
	const buttonDescriptions = page.locator('.wb-donor-directory-category-button-description');

	await expect(buttonDescriptions).toHaveCount(4);
	const foundingButton = page.getByRole('button', { name: /Founding Partners/ });
	const foundingLabel = foundingButton.locator('.wb-donor-directory-category-label');
	const foundingDescription = foundingButton.locator('.wb-donor-directory-category-button-description');
	const [labelBox, descriptionBox] = await Promise.all([
		foundingLabel.boundingBox(),
		foundingDescription.boundingBox()
	]);

	expect(labelBox).not.toBeNull();
	expect(descriptionBox).not.toBeNull();
	expect(descriptionBox!.y).toBeGreaterThanOrEqual(labelBox!.y + labelBox!.height);

	await pushConfiguration(page, { showCategoryButtonDescriptions: false });
	await expect(buttonDescriptions).toHaveCount(0);

	await pushConfiguration(page, {
		showCategoryButtonDescriptions: true,
		themePreset: 'custom',
		categoryButtonDescriptionTextColor: '#7434a4',
		activeCategoryDescriptionTextColor: '#a23b2a',
		categoryButtonDescriptionFont: {
			'font-family': 'Georgia, Times New Roman, serif',
			'font-style': 'italic',
			'font-weight': '600',
			'text-decoration': 'none'
		},
		categoryButtonDescriptionMaxFontSize: 17,
		activeCategoryDescriptionFont: {
			'font-family': 'Courier New, monospace',
			'font-style': 'normal',
			'font-weight': '700',
			'text-decoration': 'underline'
		},
		activeCategoryDescriptionMaxFontSize: 20
	});
	await foundingButton.click();
	const activeDescription = page.locator('.wb-donor-directory-active-category-description');

	await expect(foundingDescription).toHaveCSS('color', 'rgb(116, 52, 164)');
	await expect(foundingDescription).toHaveCSS('font-family', /Georgia/);
	await expect(foundingDescription).toHaveCSS('font-style', 'italic');
	await expect(foundingDescription).toHaveCSS('font-size', '17px');
	await expect(activeDescription).toHaveCSS('color', 'rgb(162, 59, 42)');
	await expect(activeDescription).toHaveCSS('font-family', /Courier New/);
	await expect(activeDescription).toHaveCSS('font-weight', '700');
	await expect(activeDescription).toHaveCSS('text-decoration-line', 'underline');
	await expect(activeDescription).toHaveCSS('font-size', '20px');
});

test('landscape keeps complete categories on the left and scopes the keyboard to the donor table', async ({
	page
}): Promise<void> => {
	await openScenario(page, 'long-content');
	const root = page.locator(ROOT_SELECTOR);
	const navigation = page.locator('[data-preview-id="donor-categories"]');
	const stage = page.locator('[data-preview-id="directory-stage"]');
	const header = page.locator('[data-preview-id="donor-header"]');
	const labels = page.locator('.wb-donor-directory-category-label');
	const labelOverflow = await labels.evaluateAll((elements: Element[]): boolean[] => {
		return elements.map((element: Element): boolean => {
			const label = element as HTMLElement;

			return label.scrollWidth > label.clientWidth + 1 || label.scrollHeight > label.clientHeight + 1;
		});
	});
	const [navigationBox, stageBox, headerBox] = await Promise.all([
		navigation.boundingBox(),
		stage.boundingBox(),
		header.boundingBox()
	]);

	expect(labelOverflow.every((overflow: boolean): boolean => !overflow)).toBe(true);
	const descriptionOverflow = await page
		.locator('.wb-donor-directory-category-button-description, .wb-donor-directory-active-category-description')
		.evaluateAll((elements: Element[]): boolean[] => {
			return elements.map((element: Element): boolean => {
				const description = element as HTMLElement;

				return (
					description.scrollWidth > description.clientWidth + 1 ||
					description.scrollHeight > description.clientHeight + 1
				);
			});
		});

	expect(descriptionOverflow.every((overflow: boolean): boolean => !overflow)).toBe(true);
	expect(navigationBox).not.toBeNull();
	expect(stageBox).not.toBeNull();
	expect(headerBox).not.toBeNull();
	expect(navigationBox!.x + navigationBox!.width).toBeLessThanOrEqual(stageBox!.x + 1);
	expect(stageBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height);

	await page.getByRole('button', { name: 'Open touch keyboard' }).click();
	await expect(root).toHaveAttribute('data-keyboard-open', 'true');
	const keyboard = page.getByRole('dialog', { name: 'Search donor directory keyboard' });
	const keyboardBox = await keyboard.boundingBox();

	expect(keyboardBox).not.toBeNull();
	expect(keyboardBox!.x).toBeGreaterThanOrEqual(stageBox!.x);
	expect(keyboardBox!.x + keyboardBox!.width).toBeLessThanOrEqual(stageBox!.x + stageBox!.width);
	expect(keyboardBox!.y).toBeGreaterThanOrEqual(stageBox!.y);
	expect(keyboardBox!.y + keyboardBox!.height).toBeLessThanOrEqual(stageBox!.y + stageBox!.height);

	await expect(page.getByRole('button', { name: 'Key A' })).toHaveText('A');
	await expect(page.getByRole('button', { name: 'Key Q' })).toHaveText('Q');
	await expect(page.getByRole('button', { name: 'Key 1' })).toHaveCount(0);
});

test('portrait shows every category in balanced wrapped rows with complete equal-width buttons', async ({
	page
}): Promise<void> => {
	await openScenario(page, 'portrait-many-categories');
	const root = page.locator(ROOT_SELECTOR);
	const navigation = page.locator('[data-preview-id="donor-categories"]');
	const buttons = navigation.locator('button');

	await expect(root).toHaveAttribute('data-layout', 'portrait');
	await expect(root).toHaveAttribute('data-effective-columns', '3');
	await expect(navigation).toHaveAttribute('data-portrait-columns', '4');
	await expect(buttons).toHaveCount(10);

	const navigationMetrics = await navigation.evaluate(
		(element: Element): {
			clientHeight: number;
			clientWidth: number;
			scrollHeight: number;
			scrollWidth: number;
		} => {
			const navigationElement = element as HTMLElement;

			return {
				clientHeight: navigationElement.clientHeight,
				clientWidth: navigationElement.clientWidth,
				scrollHeight: navigationElement.scrollHeight,
				scrollWidth: navigationElement.scrollWidth
			};
		}
	);
	const navigationBox = await navigation.boundingBox();
	const buttonBoxes = await buttons.evaluateAll(
		(elements: Element[]): Array<{ bottom: number; height: number; left: number; right: number; top: number; width: number }> =>
			elements.map((element: Element) => {
				const rect = element.getBoundingClientRect();

				return {
					bottom: rect.bottom,
					height: rect.height,
					left: rect.left,
					right: rect.right,
					top: rect.top,
					width: rect.width
				};
			})
	);

	expect(navigationBox).not.toBeNull();
	expect(navigationMetrics.scrollWidth).toBeLessThanOrEqual(navigationMetrics.clientWidth + 1);
	expect(navigationMetrics.scrollHeight).toBeLessThanOrEqual(navigationMetrics.clientHeight + 1);
	expect(
		buttonBoxes.every(
			(box): boolean =>
				box.left >= navigationBox!.x - 1 &&
				box.right <= navigationBox!.x + navigationBox!.width + 1 &&
				box.top >= navigationBox!.y - 1 &&
				box.bottom <= navigationBox!.y + navigationBox!.height + 1
		)
	).toBe(true);

	const widthRange =
		Math.max(...buttonBoxes.map((box): number => box.width)) -
		Math.min(...buttonBoxes.map((box): number => box.width));
	const rows: Array<typeof buttonBoxes> = [];

	for (const box of buttonBoxes) {
		const row = rows.find((candidate): boolean => Math.abs(candidate[0].top - box.top) <= 1);

		if (row) {
			row.push(box);
		} else {
			rows.push([box]);
		}
	}

	expect(widthRange).toBeLessThanOrEqual(1);
	expect(rows.length).toBe(3);
	for (const row of rows) {
		const heightRange =
			Math.max(...row.map((box): number => box.height)) - Math.min(...row.map((box): number => box.height));

		expect(heightRange).toBeLessThanOrEqual(1);
	}

	const allButtonBox = buttonBoxes[0];
	const allButtonRow = rows.find((row): boolean => row.includes(allButtonBox));

	expect(allButtonRow).toBeDefined();
	expect(allButtonRow!.every((box): boolean => Math.abs(box.height - allButtonBox.height) <= 1)).toBe(true);
	const finalRow = rows[rows.length - 1];
	const finalRowCenter = (finalRow[0].left + finalRow[finalRow.length - 1].right) / 2;
	const navigationCenter = navigationBox!.x + navigationBox!.width / 2;

	expect(finalRow.length).toBe(2);
	expect(Math.abs(finalRowCenter - navigationCenter)).toBeLessThanOrEqual(1);

	const copyOverflow = await navigation
		.locator('.wb-donor-directory-category-label, .wb-donor-directory-category-button-description')
		.evaluateAll((elements: Element[]): boolean[] =>
			elements.map((element: Element): boolean => {
				const copy = element as HTMLElement;

				return copy.scrollWidth > copy.clientWidth + 1 || copy.scrollHeight > copy.clientHeight + 1;
			})
		);

	expect(copyOverflow.every((overflow: boolean): boolean => !overflow)).toBe(true);

	await page.setViewportSize({ width: 720, height: 1280 });
	await expect(root).toHaveAttribute('data-layout', 'portrait');
	await expect(navigation).toHaveAttribute('data-portrait-columns', '4');
	const narrowButtonBoxes = await buttons.evaluateAll(
		(elements: Element[]): Array<{ bottom: number; height: number; left: number; right: number; top: number; width: number }> =>
			elements.map((element: Element) => {
				const rect = element.getBoundingClientRect();

				return {
					bottom: rect.bottom,
					height: rect.height,
					left: rect.left,
					right: rect.right,
					top: rect.top,
					width: rect.width
				};
			})
	);
	const narrowRows = narrowButtonBoxes.reduce<Array<typeof narrowButtonBoxes>>(
		(rowsByPosition, box): Array<typeof narrowButtonBoxes> => {
			const row = rowsByPosition.find((candidate): boolean => Math.abs(candidate[0].top - box.top) <= 1);

			if (row) {
				row.push(box);
			} else {
				rowsByPosition.push([box]);
			}

			return rowsByPosition;
		},
		[]
	);

	expect(narrowRows).toHaveLength(5);
	expect(narrowRows.every((row): boolean => row.length === 2)).toBe(true);

	const longToken = 'TransformationalCommunityStewardshipRecognitionCircle';
	await pushDatasource(
		page,
		'categoryData',
		nativeCategoryValue([
			{
				Category: 'Founders Circle',
				Label: longToken,
				Description: `${longToken}LegacySupport`,
				Order: 1,
				_index: 1
			}
		])
	);
	await expect(navigation.locator('.wb-donor-directory-category-label').filter({ hasText: longToken })).toHaveCount(1);
	const narrowContainment = await page.evaluate((): {
		buttonsContained: boolean;
		copyContained: boolean;
		navigationContained: boolean;
		navigationScrolls: boolean;
	} => {
		const frame = document.querySelector('[data-preview-id="donor-directory-frame"]') as HTMLElement;
		const navigationElement = document.querySelector('[data-preview-id="donor-categories"]') as HTMLElement;
		const frameRect = frame.getBoundingClientRect();
		const navigationRect = navigationElement.getBoundingClientRect();
		const categoryButtons = Array.from(navigationElement.querySelectorAll('button'));
		const copyElements = Array.from(
			navigationElement.querySelectorAll(
				'.wb-donor-directory-category-label, .wb-donor-directory-category-button-description'
			)
		) as HTMLElement[];

		return {
			buttonsContained: categoryButtons.every((button: HTMLButtonElement): boolean => {
				const rect = button.getBoundingClientRect();

				return (
					rect.left >= navigationRect.left - 1 &&
					rect.right <= navigationRect.right + 1 &&
					rect.top >= navigationRect.top - 1 &&
					rect.bottom <= navigationRect.bottom + 1
				);
			}),
			copyContained: copyElements.every(
				(copy: HTMLElement): boolean =>
					copy.scrollWidth <= copy.clientWidth + 1 && copy.scrollHeight <= copy.clientHeight + 1
			),
			navigationContained:
				navigationRect.top >= frameRect.top - 1 && navigationRect.bottom <= frameRect.bottom + 1,
			navigationScrolls:
				navigationElement.scrollWidth > navigationElement.clientWidth + 1 ||
				navigationElement.scrollHeight > navigationElement.clientHeight + 1
		};
	});

	expect(narrowContainment).toEqual({
		buttonsContained: true,
		copyContained: true,
		navigationContained: true,
		navigationScrolls: false
	});
});

test('directory column limits remain stable in scaled portrait hosts and preserve landscape maximums', async ({
	page
}): Promise<void> => {
	await openScenario(page, 'portrait');
	const root = page.locator(ROOT_SELECTOR);
	const donorColumns = page.locator('[data-preview-id="donor-columns"]');

	await expect(root).toHaveAttribute('data-layout', 'portrait');
	await expect(root).toHaveAttribute('data-effective-columns', '3');
	await expect(donorColumns).toHaveAttribute('data-column-count', '3');

	await page.setViewportSize({ width: 720, height: 1280 });
	await expect(root).toHaveAttribute('data-layout', 'portrait');
	await pushConfiguration(page, { directoryColumns: 2 });
	await expect(root).toHaveAttribute('data-effective-columns', '2');
	await expect(donorColumns).toHaveAttribute('data-column-count', '2');

	await pushConfiguration(page, { directoryColumns: 4 });
	await expect(root).toHaveAttribute('data-effective-columns', '3');
	await expect(donorColumns).toHaveAttribute('data-column-count', '3');

	await openScenario(page, 'app-default');
	await pushConfiguration(page, { directoryColumns: 4 });
	await expect(root).toHaveAttribute('data-layout', 'landscape');
	await expect(root).toHaveAttribute('data-effective-columns', '4');
	await expect(donorColumns).toHaveAttribute('data-column-count', '4');
});

test('landscape pager controls have balanced space above and below their touch targets', async ({
	page
}): Promise<void> => {
	for (const scenarioId of ['app-default', 'compact-landscape', 'density-20']) {
		await openScenario(page, scenarioId);
		const donorColumns = page.locator('[data-preview-id="donor-columns"]');
		const controls = page.locator('[data-preview-id="directory-controls"]');
		const next = page.getByRole('button', { name: 'Next donor page' });
		const [columnsBox, controlsBox, buttonBox] = await Promise.all([
			donorColumns.boundingBox(),
			controls.boundingBox(),
			next.boundingBox()
		]);

		expect(columnsBox).not.toBeNull();
		expect(controlsBox).not.toBeNull();
		expect(buttonBox).not.toBeNull();
		const spaceAbove: number = buttonBox!.y - (columnsBox!.y + columnsBox!.height);
		const spaceBelow: number = controlsBox!.y + controlsBox!.height - (buttonBox!.y + buttonBox!.height);

		expect(spaceAbove).toBeGreaterThanOrEqual(2);
		expect(spaceBelow).toBeGreaterThanOrEqual(2);
		expect(Math.abs(spaceAbove - spaceBelow)).toBeLessThanOrEqual(1.5);
	}
});

test('manual-pagination handles an uneven last page and resets page one on category selection', async ({
	page
}): Promise<void> => {
	await openScenario(page, 'uneven-last-page');
	const previous = page.getByRole('button', { name: 'Previous donor page' });
	const next = page.getByRole('button', { name: 'Next donor page' });

	await expect(page.locator('[data-preview-id="page-indicator"]')).toHaveText('1 / 2');
	await expect(page.locator('[data-preview-id="donor-entry"]')).toHaveCount(24);
	await expect(previous).toBeDisabled();
	await expect(next).toBeEnabled();

	await next.click();
	await expect(page.locator('[data-preview-id="page-indicator"]')).toHaveText('2 / 2');
	await expect(page.locator('[data-preview-id="donor-entry"]')).toHaveCount(1);
	await expect(previous).toBeEnabled();
	await expect(next).toBeDisabled();

	await page.getByRole('button', { name: 'Community Circle' }).click();
	await expect(page.locator(ROOT_SELECTOR)).toHaveAttribute('data-page-index', '0');
	await expect(page.locator('[data-preview-id="page-indicator"]')).toHaveText('1 / 2');

	await openScenario(page, 'app-default');
	await page.getByRole('button', { name: 'Founding Partners' }).click();
	await expect(page.locator('[data-preview-id="page-indicator"]')).toHaveText('1 / 1');
	await expect(page.getByRole('button', { name: 'Previous donor page' })).toBeDisabled();
	await expect(page.getByRole('button', { name: 'Next donor page' })).toBeDisabled();
});

test('touch-search opens on demand, edits the query, and closes without clearing it', async ({
	page
}): Promise<void> => {
	await openScenario(page);
	const search = page.getByRole('searchbox', { name: 'Search donor names' });
	const root = page.locator(ROOT_SELECTOR);

	await expect(root).toHaveAttribute('data-keyboard-open', 'false');
	await expect(page.getByRole('button', { name: 'Key Q' })).toHaveCount(0);
	await page.getByRole('button', { name: 'Open touch keyboard' }).click();
	await expect(root).toHaveAttribute('data-keyboard-open', 'true');
	await expect(page.getByRole('button', { name: 'Key Q' })).toHaveText('Q');
	await expect(page.getByRole('button', { name: 'Key A' })).toHaveText('A');
	await expect(page.getByRole('button', { name: 'Key 1' })).toHaveCount(0);
	const functionRow = page.locator('[data-preview-id="keyboard-function-row"]');
	await expect(functionRow.locator('button')).toHaveText(['CLEAR', 'BACKSPACE', 'SPACE', 'SEARCH']);
	const [clearBackground, backspaceBackground, spaceBackground, searchBackground] = await functionRow
		.locator('button')
		.evaluateAll((buttons: Element[]): string[] =>
			buttons.map((button: Element): string => window.getComputedStyle(button).backgroundColor)
		);

	expect(clearBackground).toBe(backspaceBackground);
	expect(clearBackground).toBe(spaceBackground);
	expect(searchBackground).toBe('rgb(53, 168, 83)');

	await page.getByRole('button', { name: 'Key A' }).click();
	await page.getByRole('button', { name: 'Key L' }).click();
	await expect(search).toHaveValue('Al');
	await expect(root).toHaveAttribute('data-search-query', 'Al');
	await expect(root).toHaveAttribute('data-selected-category', '__all_donors__');
	await expect(page.getByRole('heading', { name: 'Search results for “Al”' })).toBeVisible();
	await expect(page.locator('[data-preview-id="donor-entry"] [class*="badge"]')).not.toHaveCount(0);
	await expect(page.locator('[data-preview-id="donor-entry"][class*="highlight"]')).toHaveCount(1);

	await page.getByRole('button', { name: 'SPACE', exact: true }).click();
	await page.getByRole('button', { name: 'Key M' }).click();
	await expect(search).toHaveValue('Al M');
	await page.getByRole('button', { name: 'BACKSPACE', exact: true }).click();
	await expect(search).toHaveValue('Al ');
	await page.getByRole('button', { name: 'BACKSPACE', exact: true }).click();
	await expect(search).toHaveValue('Al');
	await page.getByRole('button', { name: 'SEARCH', exact: true }).click();
	await expect(root).toHaveAttribute('data-keyboard-open', 'false');
	await expect(search).toHaveValue('Al');
	await expect(root).toHaveAttribute('data-search-query', 'Al');
	await expect(page.getByRole('button', { name: 'Open touch keyboard' })).toBeVisible();

	await search.click();
	await expect(root).toHaveAttribute('data-keyboard-open', 'true');
	await page.getByRole('button', { name: 'CLEAR', exact: true }).click();
	await expect(search).toHaveValue('');
	await expect(root).toHaveAttribute('data-search-query', '');
	await expect(root).toHaveAttribute('data-keyboard-open', 'true');
});

test('keyboard icon toggle-close clears search and icon highlighting in landscape and portrait', async ({
	page
}): Promise<void> => {
	for (const scenarioId of ['app-default', 'portrait']) {
		await openScenario(page, scenarioId);
		const root = page.locator(ROOT_SELECTOR);
		const searchControl = page.locator('[data-preview-id="search-control"]');
		const keyboardToggle = page.locator('[data-preview-id="keyboard-toggle"]');

		await page.getByRole('button', { name: 'Open touch keyboard' }).click();
		await expect(root).toHaveAttribute('data-keyboard-open', 'true');
		await expect(searchControl).toHaveCSS('border-color', 'rgb(53, 168, 83)');
		await expect(keyboardToggle).toHaveCSS('color', 'rgb(53, 168, 83)');
		await expect(keyboardToggle).toHaveAttribute('aria-pressed', 'true');

		await page.getByRole('button', { name: 'Close touch keyboard' }).click();
		await expect(root).toHaveAttribute('data-keyboard-open', 'false');
		await expect(root).toHaveAttribute('data-search-focused', 'false');
		await expect(keyboardToggle).toHaveAttribute('aria-pressed', 'false');
		await expect(keyboardToggle).not.toBeFocused();
		await expect(searchControl).toHaveCSS('border-color', 'rgb(203, 215, 206)');
		await expect(keyboardToggle).toHaveCSS('border-color', 'rgb(203, 215, 206)');
		await expect(keyboardToggle).toHaveCSS('color', 'rgb(21, 26, 23)');
	}
});

test('background image and overlay controls work in Light, Dark, and Custom with scheme fallbacks', async ({
	page
}): Promise<void> => {
	await openScenario(page);
	const root = page.locator(ROOT_SELECTOR);
	const selectedBackground =
		'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 9%22%3E%3Crect width=%2216%22 height=%229%22 fill=%22%238b6ca8%22/%3E%3C/svg%3E';

	for (const theme of ['light', 'dark', 'custom']) {
		await pushConfiguration(page, {
			themePreset: theme,
			backgroundImage: '',
			backgroundOverlayColor: '#000000',
			backgroundOverlayOpacity: 0
		});
		await expect(root).toHaveAttribute('data-has-background-image', theme === 'dark' ? 'false' : 'true');
		await expect(root).toHaveCSS('background-image', theme === 'dark' ? 'none' : /url/);

		await pushConfiguration(page, {
			backgroundImage: { location: selectedBackground },
			backgroundOverlayColor: '#273d5c',
			backgroundOverlayOpacity: 42
		});
		await expect(root).toHaveAttribute('data-has-background-image', 'true');
		await expect(root).toHaveCSS('background-image', /data:image\/svg\+xml/);
		const overlay = await root.evaluate(
			(element: Element): { backgroundColor: string; opacity: string } => {
				const style = window.getComputedStyle(element, '::before');

				return {
					backgroundColor: style.backgroundColor,
					opacity: style.opacity
				};
			}
		);

		expect(overlay.backgroundColor).toBe('rgb(39, 61, 92)');
		expect(overlay.opacity).toBe('0.42');
	}
});

test('optional maximum row height caps sparse pages without changing full-page density or pagination', async ({
	page
}): Promise<void> => {
	await openScenario(page, 'uneven-last-page');
	const root = page.locator(ROOT_SELECTOR);
	const entries = page.locator('[data-preview-id="donor-entry"]');
	const donorColumns = page.locator('[data-preview-id="donor-column"]');
	const previous = page.getByRole('button', { name: 'Previous donor page' });
	const next = page.getByRole('button', { name: 'Next donor page' });

	await expect(entries).toHaveCount(24);
	await expect(entries.first()).toHaveCSS('max-height', 'none');
	const automaticFullPageHeight = (await entries.first().boundingBox())!.height;

	await next.click();
	await expect(entries).toHaveCount(1);
	const automaticSparseHeight = (await entries.first().boundingBox())!.height;
	const automaticSparseColumnHeight = (await donorColumns.first().boundingBox())!.height;

	expect(automaticSparseHeight).toBeGreaterThan(automaticFullPageHeight + 100);

	await pushConfiguration(page, { maximumRowHeight: 120 });
	await expect(root).toHaveAttribute('data-maximum-row-height', '120');
	await expect(entries.first()).toHaveCSS('max-height', '120px');
	const cappedSparseHeight = (await entries.first().boundingBox())!.height;
	const cappedSparseColumnHeight = (await donorColumns.first().boundingBox())!.height;

	expect(cappedSparseHeight).toBeLessThanOrEqual(120.5);
	expect(cappedSparseHeight).toBeLessThan(automaticSparseHeight - 100);
	expect(cappedSparseColumnHeight).toBeLessThanOrEqual(120.5);
	expect(cappedSparseColumnHeight).toBeLessThan(automaticSparseColumnHeight - 100);
	await expect(donorColumns.nth(1)).toHaveCSS('max-height', '0px');
	await expect(donorColumns.nth(2)).toHaveCSS('max-height', '0px');
	await expect(donorColumns.nth(1)).toHaveCSS('visibility', 'hidden');
	await expect(donorColumns.nth(2)).toHaveCSS('visibility', 'hidden');
	await previous.click();
	await expect(entries).toHaveCount(24);
	await expect(page.locator('[data-preview-id="page-indicator"]')).toHaveText('1 / 2');
	const cappedFullPageHeight = (await entries.first().boundingBox())!.height;
	const cappedFullPageColumnHeight = (await donorColumns.first().boundingBox())!.height;

	expect(Math.abs(cappedFullPageHeight - automaticFullPageHeight)).toBeLessThanOrEqual(1.5);
	expect(cappedFullPageColumnHeight).toBeGreaterThan(120 * 5);
	await expect(next).toBeEnabled();
});

test('keyboard uses a transparent stage, subtle panel shadow, and dismisses on outside touch', async ({
	page
}): Promise<void> => {
	await openScenario(page);
	const root = page.locator(ROOT_SELECTOR);
	const searchControl = page.getByRole('searchbox', { name: 'Search donor names' }).locator('..');
	const toggle = page.getByRole('button', { name: 'Open touch keyboard' });

	await toggle.click();
	const overlay = page.locator('[data-preview-id="keyboard-overlay"]');
	const panel = page.locator('[data-keyboard-panel]');

	await expect(root).toHaveAttribute('data-keyboard-open', 'true');
	await expect(overlay).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
	await expect(panel).not.toHaveCSS('box-shadow', 'none');
	await expect(searchControl).toHaveCSS('border-color', 'rgb(53, 168, 83)');
	await expect(page.getByRole('button', { name: 'Close touch keyboard' })).toHaveCSS(
		'border-color',
		'rgb(53, 168, 83)'
	);

	await page.getByRole('button', { name: 'Key A' }).click();
	await expect(root).toHaveAttribute('data-keyboard-open', 'true');
	await overlay.click({ position: { x: 16, y: 16 } });
	await expect(root).toHaveAttribute('data-keyboard-open', 'false');
	await expect(searchControl).toHaveCSS('border-color', 'rgb(203, 215, 206)');
	await expect(page.getByRole('button', { name: 'Open touch keyboard' })).toHaveCSS(
		'border-color',
		'rgb(203, 215, 206)'
	);
});

test('title font size is configurable while long titles still auto-fit without clipping', async ({
	page
}): Promise<void> => {
	await openScenario(page);
	const title = page.locator('.wb-donor-directory-title');
	const initialSize = Number.parseFloat(
		await title.evaluate((element: Element): string => {
			return window.getComputedStyle(element).fontSize;
		})
	);

	await pushConfiguration(page, { titleFontSize: 64 });
	await expect
		.poll(async (): Promise<number> => {
			return Number.parseFloat(
				await title.evaluate((element: Element): string => {
					return window.getComputedStyle(element).fontSize;
				})
			);
		})
		.toBeGreaterThanOrEqual(initialSize + 8);

	await pushConfiguration(page, {
		title: 'The Generations of Discovery and Community Partnership Donor Directory',
		titleFontSize: 72
	});
	const fitMetrics = await title.evaluate(
		(
			element: HTMLElement
		): {
			clientHeight: number;
			clientWidth: number;
			scrollHeight: number;
			scrollWidth: number;
		} => ({
			clientHeight: element.clientHeight,
			clientWidth: element.clientWidth,
			scrollHeight: element.scrollHeight,
			scrollWidth: element.scrollWidth
		})
	);

	expect(fitMetrics.scrollWidth).toBeLessThanOrEqual(fitMetrics.clientWidth + 1);
	expect(fitMetrics.scrollHeight).toBeLessThanOrEqual(fitMetrics.clientHeight + 1);
});

test('light active category and pager affordances use kiosk-appropriate styling', async ({ page }): Promise<void> => {
	await openScenario(page);
	const activeCategory = page.locator('[data-category-key="__all_donors__"]');
	await expect(activeCategory).toHaveCSS('background-color', 'rgb(204, 239, 213)');
	await expect(activeCategory).toHaveCSS('color', 'rgb(21, 59, 43)');

	const arrows = page.locator('[aria-label="Previous donor page"] svg, [aria-label="Next donor page"] svg');
	const sizes = await arrows.evaluateAll((elements: Element[]): number[] => {
		return elements.map((element: Element): number => element.getBoundingClientRect().width);
	});

	expect(sizes).toEqual([24, 24]);
});

test('density-scaling honors one through twenty entries and reduces type and row padding monotonically', async ({
	page
}): Promise<void> => {
	await openScenario(page, 'three-field-entries');
	const root = page.locator(ROOT_SELECTOR);
	const field = page.locator('.wb-donor-directory-entry-field-1').first();
	const entry = page.locator('[data-preview-id="donor-entry"]').first();

	const measure = async (): Promise<{ fontSize: number; paddingTop: number }> => ({
		fontSize: Number.parseFloat(
			await field.evaluate((element: Element): string => {
				return window.getComputedStyle(element).fontSize;
			})
		),
		paddingTop: Number.parseFloat(
			await entry.evaluate((element: Element): string => {
				return window.getComputedStyle(element).paddingTop;
			})
		)
	});

	await pushConfiguration(page, { entriesPerColumn: 1 });
	await expect(root).toHaveAttribute('data-effective-entries', '1');
	await expect(root).toHaveAttribute('data-density', 'spacious');
	const one = await measure();

	await pushConfiguration(page, { entriesPerColumn: 12 });
	await expect(root).toHaveAttribute('data-effective-entries', '12');
	await expect(root).toHaveAttribute('data-density', 'compact');
	const twelve = await measure();

	await pushConfiguration(page, { entriesPerColumn: 20 });
	await expect(root).toHaveAttribute('data-effective-entries', '20');
	await expect(root).toHaveAttribute('data-density', 'dense');
	const twenty = await measure();

	expect(twelve.fontSize).toBeLessThanOrEqual(one.fontSize);
	expect(twenty.fontSize).toBeLessThanOrEqual(twelve.fontSize);
	expect(twelve.paddingTop).toBeLessThanOrEqual(one.paddingTop);
	expect(twenty.paddingTop).toBeLessThanOrEqual(twelve.paddingTop);
	expect(twenty.fontSize).toBeGreaterThanOrEqual(11);
});

test('physical-search shares case and diacritic normalization with touch search', async ({ page }): Promise<void> => {
	await openScenario(page);
	const search = page.getByRole('searchbox', { name: 'Search donor names' });

	await search.fill('elo');
	await expect(search).toHaveValue('Elo');
	await expect(page.getByText('Élodie Fern', { exact: true })).toBeVisible();
	await expect(page.getByText('Eloise Grove', { exact: true })).toBeVisible();
	await expect(page.locator('[data-preview-id="donor-entry"]')).toHaveCount(2);

	await search.fill('vale');
	await expect(search).toHaveValue('Vale');
	await expect(page.getByText('Alexandra Vale', { exact: true })).toBeVisible();
	await expect(page.getByText('Morgan Vale', { exact: true })).toBeVisible();
});

test('autoplay-command applies duration, visits real-category pages in order, and holds at the configured end', async ({
	page
}): Promise<void> => {
	await openScenario(page, 'app-default', true);
	const root = page.locator(ROOT_SELECTOR);

	await pushConfiguration(page, {
		directoryColumns: 1,
		entriesPerColumn: 2,
		autoplayIntervalSeconds: 7,
		stopAtEnd: false
	});
	await page.clock.fastForward(150);
	await expect(page.locator('[data-column-count]')).toHaveAttribute('data-column-count', '1');

	await pushExternalCommand(page, 'enablePaginationMode', 2);
	await page.clock.fastForward(150);
	await expect(root).toHaveAttribute('data-autoplay-duration', '7');
	await expect(root).toHaveAttribute('data-autoplay-frame', '0');

	await pushExternalCommand(page, 'enablePaginationMode', 3);
	await page.clock.fastForward(150);
	await expect(root).toHaveAttribute('data-autoplay', 'true');
	await expect(root).toHaveAttribute('data-autoplay-duration', '3');
	await expect(root).toHaveAttribute('data-autoplay-frame', '0');
	await expect(root).toHaveAttribute('data-selected-category', 'legacy society');
	await expect(page.locator('[data-preview-id="page-indicator"]')).toHaveText('1 / 3');

	await page.clock.fastForward(3_000);
	await expect(root).toHaveAttribute('data-autoplay-frame', '1');
	await expect(page.locator('[data-preview-id="page-indicator"]')).toHaveText('2 / 3');

	await page.clock.fastForward(6_000);
	await expect(root).toHaveAttribute('data-autoplay-frame', '3');
	await expect(root).toHaveAttribute('data-selected-category', 'founders circle');
	await expect(page.locator('[data-preview-id="page-indicator"]')).toHaveText('1 / 3');

	await pushConfiguration(page, { stopAtEnd: true });
	await page.clock.fastForward(150);
	await pushExternalCommand(page, 'enablePaginationMode', 3);
	await page.clock.fastForward(150);
	for (let expectedFrame = 1; expectedFrame <= 11; expectedFrame += 1) {
		await page.clock.fastForward(3_000);
		await expect(root).toHaveAttribute('data-autoplay-frame', String(expectedFrame));
	}
	await expect(root).toHaveAttribute('data-autoplay-frame', '11');
	await expect(root).toHaveAttribute('data-selected-category', 'leadership circle');
	await expect(page.locator('[data-preview-id="page-indicator"]')).toHaveText('3 / 3');
	await page.clock.fastForward(3_000);
	await expect(root).toHaveAttribute('data-autoplay-frame', '11');
});

test('autoplay-stop-and-touch restores manual state and honors the touch that stops autoplay', async ({
	page
}): Promise<void> => {
	await openScenario(page, 'app-default', true);
	const root = page.locator(ROOT_SELECTOR);

	await pushConfiguration(page, { directoryColumns: 1, entriesPerColumn: 2 });
	await page.clock.fastForward(150);
	await pushExternalCommand(page, 'enablePaginationMode', 3);
	await page.clock.fastForward(150);
	await page.clock.fastForward(3_000);
	await expect(root).toHaveAttribute('data-autoplay-frame', '1');

	await page.getByRole('button', { name: 'Founding Partners' }).click();
	await expect(root).toHaveAttribute('data-autoplay', 'false');
	await expect(root).toHaveAttribute('data-selected-category', 'founders circle');
	await expect(root).toHaveAttribute('data-page-index', '0');

	await pushExternalCommand(page, 'enablePaginationMode', 3);
	await page.clock.fastForward(150);
	await page.clock.fastForward(3_000);
	await pushExternalCommand(page, 'disablePaginationMode');
	await page.clock.fastForward(150);
	await expect(root).toHaveAttribute('data-autoplay', 'false');
	await expect(root).toHaveAttribute('data-selected-category', '__all_donors__');
	await expect(root).toHaveAttribute('data-page-index', '0');
	await expect(root).toHaveAttribute('data-search-query', '');
	await expect(page.locator('[data-preview-id="active-category"]')).toHaveText('All Donors');
});

test('reset action clears search, keyboard, paging, selection, and autoplay state', async ({ page }): Promise<void> => {
	await openScenario(page, 'app-default', true);
	const root = page.locator(ROOT_SELECTOR);

	await pushConfiguration(page, {
		directoryColumns: 1,
		entriesPerColumn: 2,
		autoplayIntervalSeconds: 9
	});
	await page.clock.fastForward(150);
	await pushExternalCommand(page, 'enablePaginationMode', 3);
	await page.clock.fastForward(3_150);
	await expect(root).toHaveAttribute('data-autoplay-frame', '1');

	await pushExternalCommand(page, 'resetExperience');
	await page.clock.fastForward(150);
	await expect(root).toHaveAttribute('data-autoplay', 'false');
	await expect(root).toHaveAttribute('data-autoplay-frame', '0');
	await expect(root).toHaveAttribute('data-autoplay-duration', '9');
	await expect(root).toHaveAttribute('data-selected-category', '__all_donors__');
	await expect(root).toHaveAttribute('data-page-index', '0');

	const search = page.getByRole('searchbox', { name: 'Search donor names' });
	await search.click();
	await search.fill('A');
	await page.getByRole('button', { name: 'Close touch keyboard' }).click();
	await page.getByRole('button', { name: 'Next donor page' }).click();
	await search.click();
	await expect(root).toHaveAttribute('data-keyboard-open', 'true');
	await expect(root).toHaveAttribute('data-search-query', 'A');
	await expect(root).toHaveAttribute('data-page-index', '1');

	await pushExternalCommand(page, 'resetExperience');
	await page.clock.fastForward(150);
	await expect(search).toHaveValue('');
	await expect(root).toHaveAttribute('data-keyboard-open', 'false');
	await expect(root).toHaveAttribute('data-search-query', '');
	await expect(root).toHaveAttribute('data-selected-category', '__all_donors__');
	await expect(root).toHaveAttribute('data-page-index', '0');
	await expect(page.locator('[data-preview-id="active-category"]')).toHaveText('All Donors');
});

test('motion-independent-cadence keeps one timer across repeated enable commands', async ({ page }): Promise<void> => {
	await openScenario(page, 'app-default', true);
	const root = page.locator(ROOT_SELECTOR);

	await pushConfiguration(page, {
		directoryColumns: 1,
		entriesPerColumn: 2,
		motionPreset: 'off'
	});
	await page.clock.fastForward(150);
	await expect(root).toHaveAttribute('data-motion', 'off');

	await pushExternalCommand(page, 'enablePaginationMode', 3);
	await page.clock.fastForward(50);
	await pushExternalCommand(page, 'enablePaginationMode', 3);
	await page.clock.fastForward(150);
	await expect(root).toHaveAttribute('data-autoplay-frame', '0');

	await page.clock.fastForward(3_000);
	await expect(root).toHaveAttribute('data-autoplay-frame', '1');
	await expect(root).toHaveAttribute('data-page-index', '1');

	await page.clock.fastForward(3_000);
	await expect(root).toHaveAttribute('data-autoplay-frame', '2');
});

test('live-update-reconciliation preserves valid keys, clamps pages, and falls back when a category disappears', async ({
	page
}): Promise<void> => {
	await openScenario(page);
	const root = page.locator(ROOT_SELECTOR);

	await pushConfiguration(page, { directoryColumns: 1, entriesPerColumn: 2 });
	await expect(page.locator('[data-column-count]')).toHaveAttribute('data-column-count', '1');
	await page.getByRole('button', { name: 'Founding Partners' }).click();
	await page.getByRole('button', { name: 'Next donor page' }).click();
	await page.getByRole('button', { name: 'Next donor page' }).click();
	await expect(root).toHaveAttribute('data-selected-category', 'founders circle');
	await expect(root).toHaveAttribute('data-page-index', '2');

	const updatedMetadata: PreviewRow[] = categoryRows.map((row: PreviewRow): PreviewRow =>
		row.Category === 'Founders Circle'
			? {
					...row,
					Label: 'Founders Renewed',
					Description: 'Fresh metadata while the stable category key remains selected.',
					Order: 1
				}
			: { ...row }
	);
	await pushDatasource(page, 'categoryData', nativeCategoryValue(updatedMetadata));
	await expect(root).toHaveAttribute('data-selected-category', 'founders circle');
	await expect(root).toHaveAttribute('data-page-index', '2');
	await expect(page.locator('[data-preview-id="active-category"]')).toHaveText('Founders Renewed');
	await expect(
		page.getByText('Fresh metadata while the stable category key remains selected.', { exact: true })
	).toBeVisible();

	const reducedRows: PreviewRow[] = [
		representativeRow('Founders Remaining Donor', 'Founders Circle', 1),
		representativeRow('Community Remaining Donor', 'Community Friends', 2)
	];
	await pushDatasource(page, 'donorData', nativeDonorValue(reducedRows));
	await expect(root).toHaveAttribute('data-selected-category', 'founders circle');
	await expect(root).toHaveAttribute('data-page-index', '0');
	await expect(page.getByText('Founders Remaining Donor', { exact: true })).toBeVisible();

	await pushDatasource(
		page,
		'donorData',
		nativeDonorValue([representativeRow('Only Community Donor', 'Community Friends', 3)])
	);
	await expect(root).toHaveAttribute('data-selected-category', '__all_donors__');
	await expect(root).toHaveAttribute('data-page-index', '0');
	await expect(page.locator('[data-preview-id="active-category"]')).toHaveText('All Donors');

	const query = page.getByRole('searchbox', { name: 'Search donor names' });
	await query.fill('Aero');
	await expect(page.locator('[data-preview-id="directory-empty"]')).toBeVisible();
	await pushDatasource(page, 'donorData', nativeDonorValue([representativeRow('Aero Bloom', 'Community Friends', 4)]));
	await expect(query).toHaveValue('Aero');
	await expect(page.getByText('Aero Bloom', { exact: true })).toBeVisible();
});

test('instance-cleanup releases pagination, clock, observer, and command resources on destroy', async ({
	page
}): Promise<void> => {
	await page.addInitScript((): void => {
		const lifecycleWindow = window as PreviewWindow;
		const nativeSetTimeout: typeof window.setTimeout = window.setTimeout.bind(window);
		const nativeClearTimeout: typeof window.clearTimeout = window.clearTimeout.bind(window);
		const nativeSetInterval: typeof window.setInterval = window.setInterval.bind(window);
		const nativeClearInterval: typeof window.clearInterval = window.clearInterval.bind(window);
		const NativeResizeObserver: typeof ResizeObserver | undefined = window.ResizeObserver;
		const paginationTimeouts: number[] = [];
		const clockIntervals: number[] = [];
		const diagnostics = {
			activeClockIntervals: clockIntervals,
			activePaginationTimeouts: paginationTimeouts,
			createdResizeObservers: 0,
			disconnectedResizeObservers: 0
		};

		lifecycleWindow.__donorDirectoryLifecycle = diagnostics;
		window.setTimeout = ((handler: TimerHandler, timeout?: number, ...arguments_: unknown[]): number => {
			const delay: number = Number(timeout) || 0;
			let id = 0;
			const wrappedHandler = (): void => {
				const index: number = paginationTimeouts.indexOf(id);

				if (index >= 0) paginationTimeouts.splice(index, 1);
				if (typeof handler === 'function') handler(...arguments_);
			};

			id = nativeSetTimeout(wrappedHandler, delay);
			if (delay === 3_000) paginationTimeouts.push(id);

			return id;
		}) as typeof window.setTimeout;
		window.clearTimeout = ((id: number | undefined): void => {
			const index: number = id === undefined ? -1 : paginationTimeouts.indexOf(id);

			if (index >= 0) paginationTimeouts.splice(index, 1);
			nativeClearTimeout(id);
		}) as typeof window.clearTimeout;
		window.setInterval = ((handler: TimerHandler, timeout?: number, ...arguments_: unknown[]): number => {
			const delay: number = Number(timeout) || 0;
			const id: number = nativeSetInterval(handler, delay, ...arguments_);

			if (delay === 30_000) clockIntervals.push(id);

			return id;
		}) as typeof window.setInterval;
		window.clearInterval = ((id: number | undefined): void => {
			const index: number = id === undefined ? -1 : clockIntervals.indexOf(id);

			if (index >= 0) clockIntervals.splice(index, 1);
			nativeClearInterval(id);
		}) as typeof window.clearInterval;

		if (NativeResizeObserver) {
			const ResizeObserverConstructor: typeof ResizeObserver = NativeResizeObserver;

			window.ResizeObserver = class TrackedResizeObserver implements ResizeObserver {
				private readonly delegate: ResizeObserver;

				constructor(callback: ResizeObserverCallback) {
					this.delegate = new ResizeObserverConstructor(callback);
					diagnostics.createdResizeObservers += 1;
				}

				disconnect(): void {
					this.delegate.disconnect();
					diagnostics.disconnectedResizeObservers += 1;
				}

				observe(target: Element, options?: ResizeObserverOptions): void {
					this.delegate.observe(target, options);
				}

				unobserve(target: Element): void {
					this.delegate.unobserve(target);
				}
			};
		}
	});

	await openScenario(page);
	await pushExternalCommand(page, 'enablePaginationMode', 3);
	await page.waitForTimeout(180);
	const beforeDestroy = await page.evaluate(() => {
		const diagnostics = (window as PreviewWindow).__donorDirectoryLifecycle;

		return {
			clockIntervals: diagnostics?.activeClockIntervals.length ?? 0,
			paginationTimeouts: diagnostics?.activePaginationTimeouts.length ?? 0,
			createdResizeObservers: diagnostics?.createdResizeObservers ?? 0,
			disconnectedResizeObservers: diagnostics?.disconnectedResizeObservers ?? 0
		};
	});

	expect(beforeDestroy.clockIntervals).toBeGreaterThanOrEqual(1);
	expect(beforeDestroy.paginationTimeouts).toBe(1);
	expect(beforeDestroy.createdResizeObservers).toBeGreaterThanOrEqual(1);
	expect(beforeDestroy.disconnectedResizeObservers).toBeLessThan(beforeDestroy.createdResizeObservers);

	await page.evaluate(async (): Promise<void> => {
		await (window as PreviewWindow).__wallboardPreview?.destroy();
	});
	const afterDestroy = await page.evaluate(() => {
		const diagnostics = (window as PreviewWindow).__donorDirectoryLifecycle;

		return {
			clockIntervals: diagnostics?.activeClockIntervals.length ?? 0,
			paginationTimeouts: diagnostics?.activePaginationTimeouts.length ?? 0,
			createdResizeObservers: diagnostics?.createdResizeObservers ?? 0,
			disconnectedResizeObservers: diagnostics?.disconnectedResizeObservers ?? 0
		};
	});

	expect(afterDestroy.clockIntervals).toBeLessThan(beforeDestroy.clockIntervals);
	expect(afterDestroy.paginationTimeouts).toBe(0);
	expect(afterDestroy.disconnectedResizeObservers).toBe(afterDestroy.createdResizeObservers);

	await pushExternalCommand(page, 'enablePaginationMode', 3);
	await page.waitForTimeout(180);
	const afterCompletedCommand = await page.evaluate(() => {
		const diagnostics = (window as PreviewWindow).__donorDirectoryLifecycle;

		return diagnostics?.activePaginationTimeouts.length ?? 0;
	});

	expect(afterCompletedCommand).toBe(0);
});

/*
 * The donor wall carries its own letter keyboard rather than the shared component, so without this
 * registration the conformance suite never reaches it. Two of the three keyboards in the portfolio
 * were unchecked for exactly that reason: the suite protects wherever it is registered, and nothing
 * required it to be.
 */
registerKeyboardConformance({
	name: 'Donor directory search',
	open: async (page: Page): Promise<void> => {
		await openScenario(page);
		await page.getByRole('button', { name: 'Open touch keyboard' }).click();
		await expect(page.locator('[data-preview-id="donor-keyboard"]')).toBeVisible();
	},
	keyboard: (page: Page): Locator => page.locator('[data-preview-id="donor-keyboard"]'),
	letterKeyName: 'Key V',
	spaceKeyName: 'SPACE',
	focusTarget: (page: Page): Locator => page.getByRole('searchbox').first()
});


const readPageIndex = async (page: Page): Promise<number> => {
	const value: string | null = await page
		.locator('[data-preview-id="donor-directory-root"]')
		.getAttribute('data-page-index');

	return Number.parseInt(value ?? '0', 10);
};

const stepPage = async (page: Page, control: 'Next donor page' | 'Previous donor page'): Promise<void> => {
	const before: number = await readPageIndex(page);

	await page.getByRole('button', { name: control }).click();
	await page.waitForFunction((previous: number): boolean => {
		const root: Element | null = document.querySelector('[data-preview-id="donor-directory-root"]');

		return Number.parseInt(root?.getAttribute('data-page-index') ?? '0', 10) !== previous;
	}, before);
};

/*
 * Registered on uneven-last-page rather than the default, which fits on a single page: a one-page
 * pager satisfies every assertion here without exercising any of them.
 *
 * Identity is the rendered donor name compared against the names the fixture supplied, so the
 * expectation comes from outside the app. Comparing the app's own keys against themselves would
 * confirm only that paging is self-consistent, which is exactly what a dropped record already is.
 */
registerPaginationConformance({
	name: 'Donor directory pages',
	traversal: 'manual',
	open: async (page: Page): Promise<void> => {
		await openScenario(page, 'uneven-last-page');
	},
	advance: (page: Page): Promise<void> => stepPage(page, 'Next donor page'),
	retreat: (page: Page): Promise<void> => stepPage(page, 'Previous donor page'),
	pageCount: async (page: Page): Promise<number> => {
		const value: string | null = await page
			.locator('[data-preview-id="donor-directory-root"]')
			.getAttribute('data-page-count');

		return Number.parseInt(value ?? '0', 10);
	},
	pageIndex: readPageIndex,
	visibleKeys: async (page: Page): Promise<string[]> => {
		return page.locator('[data-preview-id="donor-entry"]').evaluateAll((entries: Element[]): string[] => {
			return entries.map((entry: Element): string => {
				return (entry.querySelector('[data-entry-field="1"]')?.textContent ?? '').trim();
			});
		});
	},
	expectedKeys: async (): Promise<string[]> => {
		return makeDonorRows(25, ['Community Friends']).map((row): string => String(row.Name));
	}
});
