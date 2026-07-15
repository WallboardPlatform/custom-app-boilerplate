import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';

import { resolvePlaywrightBrowser } from '../../preview/browser-resolution.ts';

const missingPath = (): boolean => false;

void describe('Playwright browser resolution', (): void => {
	void it('prefers an explicit executable path', (): void => {
		const executablePath: string = path.resolve('browser', 'chrome.exe');
		const result = resolvePlaywrightBrowser({
			bundledExecutablePath: '',
			environment: { WALLBOARD_PLAYWRIGHT_EXECUTABLE_PATH: executablePath },
			pathExists: (candidatePath: string): boolean => candidatePath === executablePath,
			platform: 'win32'
		});

		assert.deepEqual(result, { source: 'explicit-executable', executablePath });
	});

	void it('accepts a supported explicit browser channel', (): void => {
		const result = resolvePlaywrightBrowser({
			bundledExecutablePath: '',
			environment: { WALLBOARD_PLAYWRIGHT_CHANNEL: 'msedge' },
			pathExists: missingPath,
			platform: 'win32'
		});

		assert.deepEqual(result, { source: 'explicit-channel', channel: 'msedge' });
	});

	void it('uses the Playwright browser cache when available', (): void => {
		const result = resolvePlaywrightBrowser({
			bundledExecutablePath: '/playwright/chromium',
			environment: {},
			pathExists: (candidatePath: string): boolean => candidatePath === '/playwright/chromium',
			platform: 'linux'
		});

		assert.deepEqual(result, { source: 'playwright-cache' });
	});

	void it('falls back to an installed branded browser', (): void => {
		const result = resolvePlaywrightBrowser({
			bundledExecutablePath: '/missing/chromium',
			environment: {},
			pathExists: (candidatePath: string): boolean => candidatePath === '/usr/bin/google-chrome-stable',
			platform: 'linux'
		});

		assert.deepEqual(result, { source: 'system-channel', channel: 'chrome' });
	});

	void it('rejects conflicting explicit configuration', (): void => {
		assert.throws((): void => {
			resolvePlaywrightBrowser({
				bundledExecutablePath: '',
				environment: {
					WALLBOARD_PLAYWRIGHT_CHANNEL: 'chrome',
					WALLBOARD_PLAYWRIGHT_EXECUTABLE_PATH: '/browser/chrome'
				},
				pathExists: missingPath,
				platform: 'linux'
			});
		}, /either WALLBOARD_PLAYWRIGHT_EXECUTABLE_PATH or WALLBOARD_PLAYWRIGHT_CHANNEL/);
	});

	void it('fails with actionable instructions when no browser is available', (): void => {
		assert.throws((): void => {
			resolvePlaywrightBrowser({
				bundledExecutablePath: '/missing/chromium',
				environment: {},
				pathExists: missingPath,
				platform: 'linux'
			});
		}, /deliver:unverified/);
	});
});
