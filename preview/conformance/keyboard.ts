import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * Conformance suite for the on-screen keyboard archetype.
 *
 * These assertions constrain behaviour and capability, never appearance. A keyboard may look
 * however the app needs; it may not lose the caret, ignore its disabled state, or produce a
 * query the user did not type. Apps that render their own keyboard rather than using the
 * shipped capability are held to the same bar by calling this suite.
 *
 * Every rule here came from a defect observed in a delivered app, not from first principles.
 */

export interface KeyboardConformanceTarget {
	/** Human name used in test titles. */
	name: string;
	/** Navigates to the app and opens the keyboard, leaving it visible. */
	open: (page: Page) => Promise<void>;
	/** Resolves the keyboard root once open. */
	keyboard: (page: Page) => Locator;
	/** Accessible name of a letter key that types a single character, e.g. "Key v". */
	letterKeyName: string;
	/** Accessible name of the space control, when the keyboard has one. */
	spaceKeyName?: string;
	/** Element that must keep DOM focus while keys are pressed, when the app binds one. */
	focusTarget?: (page: Page) => Locator;
}

const activeElementDescriptor = async (page: Page): Promise<string> => {
	return page.evaluate((): string => {
		const active: Element | null = document.activeElement;

		if (!active || active === document.body) return 'body';

		return `${active.tagName.toLowerCase()}:${active.getAttribute('aria-label') ?? active.className}`;
	});
};

export const registerKeyboardConformance = (target: KeyboardConformanceTarget): void => {
	test.describe(`keyboard conformance: ${target.name}`, (): void => {
		test('every control suppresses the default pointer action that would move focus', async ({ page }): Promise<void> => {
			// Losing focus hides the caret and stops physical typing working alongside the keys.
			// Guarding only the letter keys is the usual half-fix, so this checks every control.
			await target.open(page);

			const controls: Locator = target.keyboard(page).getByRole('button');
			const total: number = await controls.count();

			expect(total).toBeGreaterThan(0);

			for (let index = 0; index < total; index += 1) {
				const control: Locator = controls.nth(index);
				const name: string = (await control.getAttribute('aria-label')) ?? (await control.innerText());
				const suppressed: boolean = await control.evaluate((element: Element): boolean => {
					const pointer: boolean = !element.dispatchEvent(
						new PointerEvent('pointerdown', { bubbles: true, cancelable: true })
					);
					const mouse: boolean = !element.dispatchEvent(
						new MouseEvent('mousedown', { bubbles: true, cancelable: true })
					);

					return pointer && mouse;
				});

				expect(suppressed, `control "${name.trim()}" must suppress pointerdown and mousedown`).toBe(true);
			}
		});

		test('pressing a key does not move focus away from the bound field', async ({ page }): Promise<void> => {
			await target.open(page);

			const focusTarget = target.focusTarget?.(page);

			if (!focusTarget) {
				test.skip(true, 'app does not bind a focusable field to the keyboard');

				return;
			}

			await focusTarget.focus();
			const before: string = await activeElementDescriptor(page);

			await target.keyboard(page).getByRole('button', { name: target.letterKeyName }).click();

			expect(await activeElementDescriptor(page)).toBe(before);
		});

		test('every control is a button that cannot submit a form implicitly', async ({ page }): Promise<void> => {
			await target.open(page);

			const controls: Locator = target.keyboard(page).getByRole('button');
			const total: number = await controls.count();

			for (let index = 0; index < total; index += 1) {
				await expect(controls.nth(index)).toHaveAttribute('type', 'button');
			}
		});

		test('every key carries an accessible name', async ({ page }): Promise<void> => {
			await target.open(page);

			const controls: Locator = target.keyboard(page).getByRole('button');
			const total: number = await controls.count();

			for (let index = 0; index < total; index += 1) {
				const control: Locator = controls.nth(index);
				const label: string = (await control.getAttribute('aria-label')) ?? (await control.innerText());

				expect(label.trim().length, `control ${index} has no accessible name`).toBeGreaterThan(0);
			}
		});

		test('the space control never produces a leading or doubled space', async ({ page }): Promise<void> => {
			// A wide space bar under a finger double-taps easily, and the resulting query matches
			// nothing while looking identical on screen.
			if (!target.spaceKeyName) {
				test.skip(true, 'keyboard has no space control');

				return;
			}

			await target.open(page);

			const keyboard: Locator = target.keyboard(page);
			const space: Locator = keyboard.getByRole('button', { name: target.spaceKeyName, exact: true });

			await space.click();
			await space.click();
			await keyboard.getByRole('button', { name: target.letterKeyName }).click();
			await space.click();
			await space.click();

			const typed: string = await keyboard.evaluate((element: Element): string => {
				return (element.querySelector('[aria-live]')?.textContent ?? '').replace(/ /g, ' ');
			});

			expect(typed.startsWith(' '), `value "${typed}" starts with a space`).toBe(false);
			expect(typed.includes('  '), `value "${typed}" contains a doubled space`).toBe(false);
		});
	});
};
