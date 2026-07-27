import { resolve } from 'path';
import { ConfigEnv, defineConfig, UserConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import viteEslint from 'vite-plugin-eslint';
import stylelint from 'vite-plugin-stylelint';
import solidSvg from 'vite-plugin-solid-svg';

import WBAppPostExecution from './package-tools/plugins/wb-app-post-execution';
import { resolvedPathAliases } from './scripts/path-aliases.mts';

export default defineConfig(({ mode }: ConfigEnv): UserConfig => {
  const isProd: boolean = mode === 'production';

  return {
    // Published wayfinding map packages are opaque archives an app imports statically, the same
    // way it imports an image. Declaring them here lets the bundler emit and rewrite the URL,
    // which keeps components off `new URL(..., import.meta.url)` and keeps the package visible
    // to the visual-review fingerprint.
    assetsInclude: ['**/*.wbmap'],
    plugins: [
      solidPlugin({
        dev: !isProd
      }),
      solidSvg(),
      viteEslint({
        failOnError: false,
        failOnWarning: false,
        exclude: ['node_modules', 'dist', 'src/editor-assets', 'src/**/vendor/**']
      }),
      stylelint({
        emitWarning: false,
        quiet: true,
        quietDeprecationWarnings: true,
        exclude: [
          'node_modules',
          'dist',
          'src/editor-assets',
          'src/**/vendor/**'
        ]
      }),
      WBAppPostExecution(isProd)
    ],
    optimizeDeps: {
      include: ['rxjs'],
      esbuildOptions: {
        tsconfig: 'tsconfig.json'
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
    base: '',
    resolve: {
      // Declared once in tsconfig.json; see scripts/path-aliases.mts.
      alias: resolvedPathAliases(__dirname)
    },
    build: {
      minify: 'terser',
      cssTarget: 'chrome56',
      terserOptions: {
        mangle: {
          reserved: ['$']
        }
      },
      target: 'ES6',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          app: '/src/index.tsx'
        },
        output: {
          format: 'iife',
          dir: 'dist/assets/',
          entryFileNames: 'app.js',
          assetFileNames: (assetInfo) => assetInfo.name?.includes('pdf.worker')
            ? 'pdf.worker.js'
            : 'index.[ext]'
        }
      }
    }
  };
});
