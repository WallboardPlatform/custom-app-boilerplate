import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

const rootDirectory: string = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export default defineConfig({
	optimizeDeps: {
		entries: ['scripts/custom-settings-editor/index.html']
	},
	root: rootDirectory,
	server: {
		open: false,
		port: 5198,
		strictPort: false
	}
});
