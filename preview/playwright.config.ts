import { chromium, defineConfig } from '@playwright/test';

import {
	resolvePlaywrightBrowser,
	type PlaywrightBrowserResolution
} from './browser-resolution';

const previewPort: number = Number.parseInt(process.env.WALLBOARD_PREVIEW_TEST_PORT ?? '4173', 10);

if (!Number.isInteger(previewPort) || previewPort < 1 || previewPort > 65535) {
	throw new Error('WALLBOARD_PREVIEW_TEST_PORT must be a valid TCP port.');
}

const previewBaseUrl: string = `http://127.0.0.1:${previewPort}`;
const browserResolution: PlaywrightBrowserResolution = resolvePlaywrightBrowser({
	bundledExecutablePath: chromium.executablePath()
});

console.log(`Playwright browser source: ${browserResolution.source}${browserResolution.channel ? ` (${browserResolution.channel})` : ''}`);

export default defineConfig({
	testDir: '.',
	testMatch: '*.spec.ts',
	globalSetup: './global-setup.ts',
	fullyParallel: false,
	workers: 1,
	reporter: 'line',
	outputDir: './.playwright',
	use: {
		baseURL: previewBaseUrl,
		headless: true,
		...(browserResolution.channel ? { channel: browserResolution.channel } : {}),
		...(browserResolution.executablePath
			? { launchOptions: { executablePath: browserResolution.executablePath } }
			: {})
	},
	webServer: {
		command: `npm run dev:preview -- --port ${previewPort}`,
		url: `${previewBaseUrl}/preview/widget.html`,
		reuseExistingServer: false,
		timeout: 120000
	}
});
