import { chromium, defineConfig } from '@playwright/test';

import {
	resolvePlaywrightBrowser,
	type PlaywrightBrowserResolution
} from '../../../preview/browser-resolution';

const browserResolution: PlaywrightBrowserResolution = resolvePlaywrightBrowser({
	bundledExecutablePath: chromium.executablePath()
});

export default defineConfig({
	preserveOutput: 'always',
	reporter: 'line',
	use: {
		baseURL: 'http://127.0.0.1:5182',
		headless: true,
		screenshot: 'only-on-failure',
		trace: 'retain-on-failure',
		viewport: { width: 1440, height: 960 },
		...(browserResolution.channel ? { channel: browserResolution.channel } : {}),
		...(browserResolution.executablePath
			? { launchOptions: { executablePath: browserResolution.executablePath } }
			: {})
	},
	webServer: {
		command: 'npm run wayfinding:studio -- --port 5182 --strictPort',
		reuseExistingServer: false,
		timeout: 30_000,
		url: 'http://127.0.0.1:5182/v2/'
	},
	testDir: '.',
	testMatch: 'studio-v2.spec.ts',
	timeout: 30_000
});
