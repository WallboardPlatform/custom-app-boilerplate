/* eslint-disable no-console */
import fs from 'fs';
import { resolve } from 'path';
import { ConfigEnv, defineConfig, UserConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import viteEslint from 'vite-plugin-eslint';
import stylelint from 'vite-plugin-stylelint';
import solidSvg from 'vite-plugin-solid-svg';

import WBAppPostExecution , { PluginConfig } from './package-tools/plugins/wb-app-post-execution';
import WBAppZipperPlugin from './package-tools/plugins/wb-app-zipper';

// Load optional local build config and always read app metadata.
const configFilePath: string = resolve(__dirname, 'config.json');
const propertiesPath: string = resolve(__dirname, 'src', 'editor-assets', 'properties.json');
let config: PluginConfig = {};
let properties: { name?: string, version?: string } = {};

if (fs.existsSync(configFilePath)) {
  try {
    config = JSON.parse(fs.readFileSync(configFilePath, 'utf-8'));
  } catch (error) {
    process.exit(1);
  }
}

if (fs.existsSync(propertiesPath)) {
  try {
    properties = JSON.parse(fs.readFileSync(propertiesPath, 'utf-8'));
  } catch (error) {
    process.exit(1);
  }
}

export default defineConfig(({ mode }: ConfigEnv): UserConfig => {
  const isProd: boolean = mode === 'production';

  return {
    plugins: [
      solidPlugin({
        dev: !isProd
      }),
      solidSvg(),
      viteEslint({
        failOnError: false,
        failOnWarning: false
      }),
      stylelint({
        emitWarning: false,
        quiet: true,
        quietDeprecationWarnings: true,
        exclude: [
          'node_modules',
          'dist',
          'src/editor-assets'
        ]
      }),
      WBAppPostExecution(config, isProd),
      WBAppZipperPlugin({
        name: properties.name,
        version: properties.version,
        zipOutput: config.zipOutput
      })
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
      alias: {
        '@contexts': resolve(__dirname, './src/contexts'),
        '@services': resolve(__dirname, './src/services'),
        '@components': resolve(__dirname, './src/components'),
        '@interfaces': resolve(__dirname, './src/interfaces'),
        '@hooks': resolve(__dirname, './src/hooks'),
        '@utils': resolve(__dirname, './src/utils'),
      }
    },
    build: {
      minify: 'terser',
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
          assetFileNames: 'index.[ext]'
        }
      }
    }
  };
});
