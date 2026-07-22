import { defineConfig } from '@playwright/test';

export default defineConfig({
	preserveOutput: 'always',
	use: { baseURL: 'http://127.0.0.1:5180', headless: true, viewport: { width: 1440, height: 1000 } },
	webServer: {
		command: 'npm run wayfinding:studio -- --port 5180 --strictPort',
		reuseExistingServer: true,
		timeout: 30_000,
		url: 'http://127.0.0.1:5180'
	},
	testDir: '.',
	testMatch: 'studio.spec.ts',
	timeout: 30_000
});
