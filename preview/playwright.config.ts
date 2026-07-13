import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: '.',
	testMatch: 'visual.spec.ts',
	globalSetup: './global-setup.ts',
	fullyParallel: false,
	workers: 1,
	reporter: 'line',
	outputDir: './.playwright',
	use: {
		baseURL: 'http://127.0.0.1:4173',
		headless: true
	},
	webServer: {
		command: 'npm run dev:preview -- --port 4173',
		url: 'http://127.0.0.1:4173/preview/widget.html',
		reuseExistingServer: !process.env.CI,
		timeout: 120000
	}
});
