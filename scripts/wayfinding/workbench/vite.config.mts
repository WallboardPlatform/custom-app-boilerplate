import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

const directory: string = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	root: directory,
	server: {
		open: false,
		port: 5180,
		strictPort: false
	}
});
