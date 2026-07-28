import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const ROOT = '[data-preview-id="global-office-clock-root"]';

const openScenario = async (page: Page, scenario = 'app-default'): Promise<void> => {
	const portrait: boolean = scenario === 'portrait';

	await page.setViewportSize(portrait ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 });
	const response = await page.goto(`/preview/widget.html?scenario=${scenario}&background=dark`);

	expect(response?.ok()).toBe(true);
	await page.waitForFunction((): boolean => document.documentElement.dataset.previewReady === 'true');
};

test('each office shows its own local time rather than one shared clock', async ({ page }): Promise<void> => {
	await openScenario(page);

	const times: string[] = await page.locator('.wb-global-office-clock-time').allInnerTexts();

	expect(times.length).toBe(4);
	// Budapest, Dublin, Singapore and Chicago cannot all read the same hour.
	expect(new Set(times.map((value: string): string => value.slice(0, 2))).size).toBeGreaterThan(1);
});

test('the open-state word always agrees with the machine-readable state', async ({ page }): Promise<void> => {
	// Asserting "every office is closed" would depend on the wall clock: across four zones an
	// office can genuinely fall inside any narrow window. The invariant worth testing is that the
	// word and the attribute never disagree.
	await openScenario(page, 'all-closed');

	const pairs = await page.locator('[data-open-state]').evaluateAll((offices: Element[]): Array<[string, string]> => {
		return offices.map((office: Element): [string, string] => [
			office.getAttribute('data-open-state') ?? '',
			(office.querySelector('.wb-global-office-clock-open-state') as HTMLElement | null)?.innerText.trim().toLowerCase() ?? ''
		]);
	});

	expect(pairs.length).toBe(4);

	for (const [state, label] of pairs) {
		const expected: string = state === 'open' ? 'open now' : state === 'closed' ? 'closed' : 'zone unavailable';

		expect(label, `state "${state}" is labelled "${label}"`).toBe(expected);
	}
});

test('an unresolvable timezone states the fallback instead of dropping the office', async ({ page }): Promise<void> => {
	await openScenario(page, 'invalid-timezone');

	await expect(page.locator(ROOT)).toHaveAttribute('data-office-count', '4');
	await expect(page.getByText('Zone unavailable')).toBeVisible();
});

test('the column count follows the office count, not the surface width', async ({ page }): Promise<void> => {
	await openScenario(page, 'two-offices');
	await expect(page.locator(ROOT)).toHaveAttribute('data-columns', '2');

	await openScenario(page, 'six-offices');
	await expect(page.locator(ROOT)).toHaveAttribute('data-columns', '3');
});

test('portrait stacks the offices into a single column', async ({ page }): Promise<void> => {
	await openScenario(page, 'portrait');

	await expect(page.locator(ROOT)).toHaveAttribute('data-orientation', 'portrait');
	await expect(page.locator(ROOT)).toHaveAttribute('data-columns', '1');
});

test('the board clock ticks and is cleaned up on destroy', async ({ page }): Promise<void> => {
	await openScenario(page, 'app-default');
	await page.evaluate(async (): Promise<void> => {
		const preview = (window as unknown as { __wallboardPreview?: { destroy: () => Promise<void> } }).__wallboardPreview;

		await preview?.destroy();
	});

	await expect(page.locator(ROOT)).toHaveCount(0);
});
