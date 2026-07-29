import { expect, test } from '@playwright/test';

import type { Page } from '@playwright/test';

interface PreviewWindow extends Window {
	__wallboardPreview?: {
		destroy: () => Promise<void>;
		pushConfiguration: (configValues: Record<string, unknown>) => void;
		pushDatasource: (property: string, value: unknown) => void;
	};
}

const PHOTO = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' fill='%232E4B5E'/><circle cx='32' cy='25' r='11' fill='%23E8D5B5'/><path d='M10 64c2-15 11-21 22-21s20 6 22 21z' fill='%23E8D5B5'/></svg>";

const testUser = (
	name: string,
	localPart: string,
	availability: string,
	activity: string
): Record<string, unknown> => ({
	id: `00000000-0000-4000-a000-${localPart.replace(/[^a-z0-9]/g, '').padStart(12, '0')}`,
	displayName: name,
	givenName: name.split(' ')[0],
	surname: name.split(' ')[1],
	mail: `${localPart}@example.com`,
	userPrincipalName: `${localPart}@example.com`,
	jobTitle: 'Team Member',
	department: 'Company',
	profilePicture: PHOTO,
	availability,
	activity
});

const smallRoster = (firstAvailability = 'Available', firstActivity = 'Available'): { users: Record<string, unknown>[] } => ({
	users: [
		testUser('Anna Sample', 'anna.sample', firstAvailability, firstActivity),
		testUser('Ben Sample', 'ben.sample', 'Busy', 'InAMeeting'),
		testUser('Cora Sample', 'cora.sample', 'Away', 'Away'),
		testUser('Dave Sample', 'dave.sample', 'Offline', 'OffWork'),
		testUser('Elsa Sample', 'elsa.sample', 'Available', 'Available')
	]
});

const openScenario = async (page: Page, scenario?: string): Promise<void> => {
	const query: string = scenario ? `?background=dark&scenario=${scenario}` : '?background=dark';
	const response = await page.goto(`/preview/widget.html${query}`);

	expect(response?.ok()).toBe(true);
	await page.waitForFunction((): boolean => document.documentElement.dataset.previewReady === 'true');
	await page.waitForSelector('.wb-presence-app');
};

const pushDatasource = async (page: Page, value: unknown): Promise<void> => {
	await page.evaluate((payload: unknown): void => {
		(window as PreviewWindow).__wallboardPreview?.pushDatasource('presenceData', payload);
	}, value);
};

const pushConfiguration = async (page: Page, configValues: Record<string, unknown>): Promise<void> => {
	await page.evaluate((payload: Record<string, unknown>): void => {
		(window as PreviewWindow).__wallboardPreview?.pushConfiguration(payload);
	}, configValues);
};

test('layout mode follows the visible people count', async ({ page }): Promise<void> => {
	await openScenario(page);
	await expect(page.locator('.wb-presence-app')).toHaveAttribute('data-layout', 'quadrant');

	await openScenario(page, 'dense-wall');
	await expect(page.locator('.wb-presence-app')).toHaveAttribute('data-layout', 'dense');

	await openScenario(page, 'compact-trio');
	await expect(page.locator('.wb-presence-app')).toHaveAttribute('data-layout', 'compact');
	await expect(page.locator('.wb-presence-compact-panel')).toHaveCount(3);

	await openScenario(page, 'hero-door-card');
	await expect(page.locator('.wb-presence-app')).toHaveAttribute('data-layout', 'hero');
	await expect(page.locator('.wb-presence-hero')).toHaveCount(1);
});

test('normalization skips service accounts and duplicates and humanizes labels', async ({ page }): Promise<void> => {
	await page.setViewportSize({ width: 1920, height: 1080 });
	await openScenario(page);

	// 15 roster records carry offline-safe photos; shared mailboxes and the duplicate key are skipped.
	await expect(page.locator('.wb-presence-app')).toHaveAttribute('data-people-count', '15');
	await expect(page.locator('[data-person="frontdesk"]')).toHaveCount(0);
	await expect(page.locator('[data-person="ava.winter"]')).toHaveCount(1);

	await expect(page.locator('[data-person="theo.marsh"] .wb-presence-card-status')).toHaveText('In a meeting');
	await expect(page.locator('[data-person="ronan.blake"] .wb-presence-card-status')).toHaveText('Presenting');

	// Unrecognized availability lands in the offline zone.
	await expect(page.locator('[data-zone="offline"] [data-person="uma.csik"]')).toHaveCount(1);
});

test('member filter matches prefixes and full addresses case-insensitively', async ({ page }): Promise<void> => {
	await openScenario(page);

	await pushConfiguration(page, { memberFilter: 'AVA.WINTER, Theo.Marsh@Example.com' });
	await expect(page.locator('.wb-presence-app')).toHaveAttribute('data-people-count', '2');
	await expect(page.locator('[data-person="ava.winter"]')).toHaveCount(1);
	await expect(page.locator('[data-person="theo.marsh"]')).toHaveCount(1);

	await pushConfiguration(page, { memberFilter: '', requirePhoto: false });
	await expect(page.locator('.wb-presence-app')).toHaveAttribute('data-people-count', '19');
});

test('a status change moves the card, stamps the duration, and animates when expressive', async ({ page }): Promise<void> => {
	await openScenario(page);
	await pushDatasource(page, smallRoster());

	await expect(page.locator('[data-zone="available"] [data-person="anna.sample"]')).toHaveCount(1);
	await expect(page.locator('[data-person="anna.sample"] .wb-presence-card-status')).toHaveText('Available');

	await pushDatasource(page, smallRoster('Busy', 'InAMeeting'));

	await expect(page.locator('[data-zone="busy"] [data-person="anna.sample"]')).toHaveCount(1);
	await expect(page.locator('[data-person="anna.sample"] .wb-presence-card-status')).toHaveText('In a meeting · just now');
	await expect(page.locator('.wb-presence-ticker-text')).toContainText('Anna Sample');

	const animationCount: number = await page.evaluate((): number => {
		const card: Element | null = document.querySelector('[data-person="anna.sample"]');

		return card && 'getAnimations' in card ? (card as HTMLElement).getAnimations().length : -1;
	});

	expect(animationCount).toBeGreaterThan(0);
});

test('motion off updates instantly without running animations', async ({ page }): Promise<void> => {
	await openScenario(page);
	await pushConfiguration(page, { motionPreset: 'off' });
	await pushDatasource(page, smallRoster());
	await expect(page.locator('[data-zone="available"] [data-person="anna.sample"]')).toHaveCount(1);

	await pushDatasource(page, smallRoster('Away', 'BeRightBack'));

	await expect(page.locator('[data-zone="away"] [data-person="anna.sample"]')).toHaveCount(1);
	await expect(page.locator('[data-person="anna.sample"] .wb-presence-card-status')).toHaveText('Be right back · just now');

	const animationCount: number = await page.evaluate((): number => {
		return typeof document.getAnimations === 'function' ? document.getAnimations().length : -1;
	});

	expect(animationCount).toBe(0);
});

test('a crowded zone caps its cards and shows a +N overflow chip', async ({ page }): Promise<void> => {
	await page.setViewportSize({ width: 700, height: 500 });
	await openScenario(page);

	const users: Record<string, unknown>[] = [];

	for (let index = 0; index < 24; index += 1) {
		users.push(testUser(`Crowd Person${index}`, `crowd.person${index}`, 'Available', 'Available'));
	}

	await pushDatasource(page, { users });

	await expect(page.locator('.wb-presence-more')).toHaveCount(1);
	await expect(page.locator('[data-zone="available"] .wb-presence-zone-count')).toHaveText('24');

	const contained: boolean = await page.evaluate((): boolean => {
		const cards: Element | null = document.querySelector('[data-zone="available"] .wb-presence-zone-cards');

		return Boolean(cards) && (cards as HTMLElement).scrollHeight <= (cards as HTMLElement).clientHeight;
	});

	expect(contained).toBe(true);
});

test('destroy tears the widget down and cancels animations', async ({ page }): Promise<void> => {
	await openScenario(page);
	await pushDatasource(page, smallRoster());
	await pushDatasource(page, smallRoster('Busy', 'InAMeeting'));

	await page.evaluate(async (): Promise<void> => {
		await (window as PreviewWindow).__wallboardPreview?.destroy();
	});

	await expect(page.locator('.wb-presence-app')).toHaveCount(0);

	const animationCount: number = await page.evaluate((): number => {
		return typeof document.getAnimations === 'function' ? document.getAnimations().length : -1;
	});

	expect(animationCount).toBe(0);
});
