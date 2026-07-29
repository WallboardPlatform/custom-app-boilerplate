import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { chromium } from '@playwright/test';
import type { Browser, Locator, Page } from '@playwright/test';

import {
	assertControlsCannotSubmitImplicitly,
	assertControlsSuppressPointerDefault,
	assertEveryKeyHasAnAccessibleName,
	assertFocusStaysOnBoundField,
	assertSpaceNeverLeadsOrDoubles
} from '../../preview/conformance/keyboard.ts';
import type { KeyboardConformanceTarget } from '../../preview/conformance/keyboard.ts';

/**
 * Proves the keyboard conformance suite can fail.
 *
 * The shared on-screen keyboard shipped with four defects — only letter keys suppressed
 * `pointerdown`, nothing guarded `mousedown`, disabled keys still typed, and space was appended
 * unconditionally — and this suite ran green throughout. They were found by reading the component.
 */

interface KeyboardSpec {
	/** Suppress pointerdown on every control rather than only the letters. */
	suppressPointer: 'all' | 'letters-only' | 'none';
	/** Also guard mousedown, which fires when pointer events are unavailable. */
	suppressMouse: boolean;
	/** Give every control type="button" so it cannot submit an enclosing form. */
	typedButtons: boolean;
	/** Give every control an accessible name. */
	namedKeys: boolean;
	/** Append a space even when the value is empty or already ends with one. */
	naiveSpace: boolean;
	/** Selector the descriptor uses to find the keyboard. */
	selector?: string;
}

let browser: Browser;
let page: Page;

const buildTarget = (spec: KeyboardSpec): KeyboardConformanceTarget => ({
	name: 'synthetic keyboard',
	open: async (): Promise<void> => {
		await page.setContent(
			'<body style="margin:0">'
			+ '<input class="field" />'
			+ '<div class="keyboard">'
			+ '<span aria-live="polite" class="typed"></span>'
			+ `<button class="key letter"${spec.typedButtons ? ' type="button"' : ''}`
			+ `${spec.namedKeys ? ' aria-label="Key v"' : ''}>v</button>`
			+ `<button class="key space"${spec.typedButtons ? ' type="button"' : ''}`
			+ `${spec.namedKeys ? ' aria-label="Space"' : ''}>Space</button>`
			+ '</div>'
			+ '</body>'
		);

		await page.evaluate((options: KeyboardSpec): void => {
			const typed: HTMLElement | null = document.querySelector('.typed');
			const letter: HTMLElement | null = document.querySelector('.letter');
			const space: HTMLElement | null = document.querySelector('.space');
			const guarded: HTMLElement[] = options.suppressPointer === 'all'
				? [letter, space].filter(Boolean) as HTMLElement[]
				: options.suppressPointer === 'letters-only' && letter ? [letter] : [];

			for (const control of guarded) {
				control.addEventListener('pointerdown', (event: Event): void => event.preventDefault());

				if (options.suppressMouse) {
					control.addEventListener('mousedown', (event: Event): void => event.preventDefault());
				}
			}

			letter?.addEventListener('click', (): void => {
				if (typed) typed.textContent = `${typed.textContent ?? ''}v`;
			});

			space?.addEventListener('click', (): void => {
				if (!typed) return;

				const value: string = typed.textContent ?? '';

				// The naive version appends regardless, which double-taps into a query matching nothing.
				typed.textContent = options.naiveSpace || (value !== '' && !value.endsWith(' '))
					? `${value} `
					: value;
			});
		}, spec);
	},
	keyboard: (target: Page): Locator => target.locator(spec.selector ?? '.keyboard'),
	letterKeyName: 'Key v',
	spaceKeyName: 'Space',
	focusTarget: (target: Page): Locator => target.locator('.field')
});

const conforming: KeyboardSpec = {
	suppressPointer: 'all',
	suppressMouse: true,
	typedButtons: true,
	namedKeys: true,
	naiveSpace: false
};

const rejects = async (run: () => Promise<void>): Promise<boolean> => {
	try {
		await run();

		return false;
	} catch {
		return true;
	}
};

void describe('keyboard conformance gate', (): void => {
	before(async (): Promise<void> => {
		browser = await chromium.launch();
		page = await browser.newPage();
	});

	after(async (): Promise<void> => {
		await browser?.close();
	});

	void it('accepts a keyboard that guards focus, types and space correctly', async (): Promise<void> => {
		const target: KeyboardConformanceTarget = buildTarget(conforming);

		await assertControlsSuppressPointerDefault(target, page);
		await assertFocusStaysOnBoundField(target, page);
		await assertControlsCannotSubmitImplicitly(target, page);
		await assertEveryKeyHasAnAccessibleName(target, page);
		await assertSpaceNeverLeadsOrDoubles(target, page);
	});

	void it('rejects the half-fix that guards only the letter keys', async (): Promise<void> => {
		// One of the four real defects: space and control keys stole focus while letters did not.
		const target: KeyboardConformanceTarget = buildTarget({ ...conforming, suppressPointer: 'letters-only' });

		assert.ok(
			await rejects((): Promise<void> => assertControlsSuppressPointerDefault(target, page)),
			'guarding only the letters must fail'
		);
	});

	void it('rejects a keyboard that guards pointerdown but not mousedown', async (): Promise<void> => {
		const target: KeyboardConformanceTarget = buildTarget({ ...conforming, suppressMouse: false });

		assert.ok(
			await rejects((): Promise<void> => assertControlsSuppressPointerDefault(target, page)),
			'an unguarded mousedown must fail'
		);
	});

	void it('rejects controls that can submit an enclosing form', async (): Promise<void> => {
		const target: KeyboardConformanceTarget = buildTarget({ ...conforming, typedButtons: false });

		assert.ok(
			await rejects((): Promise<void> => assertControlsCannotSubmitImplicitly(target, page)),
			'a control without type="button" must fail'
		);
	});

	void it('rejects a key with no accessible name', async (): Promise<void> => {
		// An icon-only control: visible text would itself be an accessible name, so the defect only
		// exists where a key is drawn rather than written.
		const target: KeyboardConformanceTarget = buildTarget(conforming);

		await target.open(page);
		await page.evaluate((): void => {
			const key: HTMLElement | null = document.querySelector('.letter');

			key?.removeAttribute('aria-label');
			if (key) key.innerHTML = '<svg width="12" height="12" aria-hidden="true"></svg>';
		});

		assert.ok(
			await rejects((): Promise<void> => {
				return assertEveryKeyHasAnAccessibleName(
					{ ...target, open: (): Promise<void> => Promise.resolve() },
					page
				);
			}),
			'an icon-only control with no label must fail'
		);
	});

	void it('rejects a space control that leads or doubles', async (): Promise<void> => {
		// The fourth real defect: space appended unconditionally, so a double-tap produced a query
		// that looks identical on screen and matches nothing.
		const target: KeyboardConformanceTarget = buildTarget({ ...conforming, naiveSpace: true });

		assert.ok(
			await rejects((): Promise<void> => assertSpaceNeverLeadsOrDoubles(target, page)),
			'a leading or doubled space must fail'
		);
	});

	void it('rejects a selector that matches no keyboard at all', async (): Promise<void> => {
		// The vacuous pass: a per-control loop over nothing verifies nothing and reports success.
		const target: KeyboardConformanceTarget = buildTarget({ ...conforming, selector: '.no-such-keyboard' });

		assert.ok(
			await rejects((): Promise<void> => assertControlsCannotSubmitImplicitly(target, page)),
			'an empty control set must fail the button-type assertion'
		);
		assert.ok(
			await rejects((): Promise<void> => assertEveryKeyHasAnAccessibleName(target, page)),
			'an empty control set must fail the accessible-name assertion'
		);
	});
});
