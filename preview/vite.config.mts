import { resolve } from 'path';

import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import solidSvg from 'vite-plugin-solid-svg';

const repositoryRoot: string = resolve(__dirname, '..');

export default defineConfig({
	root: repositoryRoot,
	// Keep in step with the production config: an app that statically imports a published
	// wayfinding map must resolve it in the preview too, or the visual suite cannot render it.
	assetsInclude: ['**/*.wbmap'],
	plugins: [
		solidPlugin({ dev: true }),
		solidSvg()
	],
	optimizeDeps: {
		include: ['rxjs'],
		esbuildOptions: {
			tsconfig: resolve(repositoryRoot, 'tsconfig.json')
		}
	},
	css: {
		preprocessorOptions: {
			scss: {
				additionalData: '@use "/src/styles/_index" as *;',
				quietDeps: true
			}
		}
	},
	resolve: {
		alias: {
			'@contexts': resolve(repositoryRoot, 'src/contexts'),
			'@services': resolve(repositoryRoot, 'src/services'),
			'@components': resolve(repositoryRoot, 'src/components'),
			'@interfaces': resolve(repositoryRoot, 'src/interfaces'),
			'@hooks': resolve(repositoryRoot, 'src/hooks'),
			'@utils': resolve(repositoryRoot, 'src/utils')
		}
	},
	server: {
		strictPort: true
	}
});
