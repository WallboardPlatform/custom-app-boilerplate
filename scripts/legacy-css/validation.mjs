import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import * as sass from 'sass';
import { loadConfigFromFile } from 'vite';

const UNSUPPORTED_RULES = [
	{ feature: 'CSS grid', pattern: /\bdisplay\s*:\s*(?:inline-)?grid\b/i },
	{ feature: 'flex/grid gap', pattern: /(?:^|[;{}])\s*(?:row-|column-)?gap\s*:/i },
	{ feature: 'modern sizing function', pattern: /\b(?:clamp|min|max)\s*\(/i },
	{ feature: 'aspect-ratio', pattern: /\baspect-ratio\s*:/i },
	{ feature: 'container query', pattern: /@container\b|\bcontainer-(?:type|name)\s*:/i },
	{ feature: 'backdrop-filter', pattern: /\b(?:-webkit-)?backdrop-filter\s*:/i },
	{ feature: 'color-mix()', pattern: /\bcolor-mix\s*\(/i },
	{ feature: 'modern viewport unit', pattern: /(?:^|[^a-z0-9_-])(?:\d*\.)?\d+(?:dvh|svh|lvh)\b/i }
];

const listStyleFiles = (directory) => {
	if (!fs.existsSync(directory)) {
		return [];
	}

	return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const entryPath = path.join(directory, entry.name);

		if (entry.isDirectory()) {
			return listStyleFiles(entryPath);
		}

		return /\.(css|scss)$/i.test(entry.name) ? [entryPath] : [];
	});
};

const stripComments = (source) => {
	return source
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/^\s*\/\/.*$/gm, '');
};

export const validateLegacyCss = async (rootDirectory) => {
	const failures = [];
	const styleFiles = listStyleFiles(path.join(rootDirectory, 'src'));
	const viteConfigPath = path.join(rootDirectory, 'vite.config.mts');

	if (!fs.existsSync(viteConfigPath)) {
		failures.push('vite.config.mts: missing production CSS target');
	} else {
		try {
			const loadedConfig = await loadConfigFromFile(
				{ command: 'build', mode: 'production' },
				viteConfigPath,
				rootDirectory,
				'silent'
			);

			if (loadedConfig?.config?.build?.cssTarget !== 'chrome56') {
				failures.push('vite.config.mts: build.cssTarget must be chrome56');
			}
		} catch (error) {
			failures.push(`vite.config.mts: could not resolve production config: ${error.message}`);
		}
	}

	for (const filePath of styleFiles) {
		let source;

		try {
			const rawSource = fs.readFileSync(filePath, 'utf8');

			if (path.extname(filePath).toLowerCase() === '.scss') {
				const sharedStylesPath = path.join(rootDirectory, 'src', 'styles', '_index.scss');
				const stylesDirectory = path.dirname(sharedStylesPath);
				const isSharedStyle = path.resolve(filePath).startsWith(`${path.resolve(stylesDirectory)}${path.sep}`);
				const sharedPrelude = fs.existsSync(sharedStylesPath) && !isSharedStyle
					? `@use "${pathToFileURL(sharedStylesPath).href}" as *;\n`
					: '';

				source = sass.compileString(`${sharedPrelude}${rawSource}`, {
					loadPaths: [rootDirectory, path.join(rootDirectory, 'src'), path.dirname(filePath)],
					quietDeps: true,
					style: 'expanded',
					url: pathToFileURL(filePath)
				}).css;
			} else {
				source = rawSource;
			}
		} catch (error) {
			failures.push(`${path.relative(rootDirectory, filePath)}: could not compile stylesheet: ${error.message}`);
			continue;
		}

		source = stripComments(source);

		for (const rule of UNSUPPORTED_RULES) {
			if (rule.pattern.test(source)) {
				failures.push(`${path.relative(rootDirectory, filePath)}: ${rule.feature}`);
			}
		}
	}

	if (failures.length > 0) {
		throw new Error(
			`Legacy CSS validation failed. Replace unsupported Chromium 56-era features:\n  ${failures.join('\n  ')}`
		);
	}

	return { checkedFiles: styleFiles.length };
};
