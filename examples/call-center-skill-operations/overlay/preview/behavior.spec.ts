import { expect, test } from '@playwright/test';

const openScenario = async (page: import('@playwright/test').Page, scenario?: string): Promise<void> => {
	const query: string = scenario ? `?background=dark&scenario=${scenario}` : '?background=dark';
	const response = await page.goto(`/preview/widget.html${query}`);

	expect(response?.ok()).toBe(true);
	await page.waitForFunction((): boolean => document.documentElement.dataset.previewReady === 'true');
	await page.waitForSelector('.skill-content, .skill-empty');
};

test('per-agent rows aggregate into the first alphabetical skill and exclude the sentinel', async ({
	page
}): Promise<void> => {
	await openScenario(page);

	await expect(page.locator('.skill-content')).toHaveAttribute('data-skill-name', 'Account Services');
	await expect(page.locator('.skill-roster__grid article')).toHaveCount(3);
	await expect(page.locator('body')).not.toContainText('_unique_agent');
	await expect(page.locator('body')).not.toContainText('_skill');
});

test('skill rotation advances alphabetically after the configured duration', async ({ page }): Promise<void> => {
	await openScenario(page, 'rotation');
	await expect(page.locator('.skill-content')).toHaveAttribute('data-skill-name', 'Account Services');

	await page.waitForTimeout(3300);

	await expect(page.locator('.skill-content')).toHaveAttribute('data-skill-name', 'Customer Care');
});

test('dense rosters respect the cap and disclose remaining agents', async ({ page }): Promise<void> => {
	await openScenario(page, 'dense-roster');

	await expect(page.locator('.skill-roster__grid article')).toHaveCount(12);
	await expect(page.locator('.skill-roster header b')).toContainText('+ 6 more agents');
});

test('placeholder-only payload renders the operational empty state', async ({ page }): Promise<void> => {
	await openScenario(page, 'empty-sentinel');

	await expect(page.locator('.skill-empty')).toContainText('No active skill records are currently available.');
	await expect(page.locator('.skill-content')).toHaveCount(0);
});

test('compact light theme keeps the skill and roster surfaces coordinated', async ({ page }): Promise<void> => {
	await openScenario(page, 'compact-light-theme');

	const skillName = page.locator('.skill-identity h2');
	const rosterRow = page.locator('.skill-roster__grid article').first();

	await expect(skillName).toHaveText('Account Services');
	await expect(skillName).toHaveCSS('overflow-y', 'visible');
	await expect(rosterRow).toHaveCSS('background-color', 'rgb(255, 255, 255)');
	await expect(rosterRow).toHaveCSS('color', 'rgb(24, 53, 73)');
});
