import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

const directory: string = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	plugins: [solid()],
	root: directory,
	server: {
		open: false,
		port: 5180,
		strictPort: false
	}
});
