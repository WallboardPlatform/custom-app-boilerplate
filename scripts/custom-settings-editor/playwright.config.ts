import { defineConfig } from '@playwright/test';

const port: number = Number(process.env.WALLBOARD_CUSTOM_EDITOR_PORT ?? 5198);
const baseURL: string = `http://127.0.0.1:${port}`;

export default defineConfig({
	preserveOutput: 'always',
	use: {
		baseURL,
		headless: true,
		viewport: { width: 1440, height: 1000 }
	},
	webServer: {
		command: `npm run custom-editor:preview -- --port ${port} --strictPort`,
		reuseExistingServer: false,
		timeout: 30_000,
		url: `${baseURL}/scripts/custom-settings-editor/`
	},
	testDir: '.',
	testMatch: 'custom-settings-editor.spec.ts',
	timeout: 30_000
});
