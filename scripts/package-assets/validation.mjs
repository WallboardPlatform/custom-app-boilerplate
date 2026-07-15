import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

import { readPngDimensions } from '../png-validation.mjs';

const REQUIRED_BUILD_FILES = [
	'assets/app.js',
	'assets/app-chrome-49.js',
	'editor-assets/config.json',
	'editor-assets/icon.png',
	'editor-assets/placeholder.png'
];
const IMAGE_EXTENSION_PATTERN = /\.(?:png|jpe?g|gif|webp|svg)(?:[?#].*)?$/i;

const normalizePath = (value) => value.split(path.sep).join('/');

const collectStringValues = (value) => {
	if (typeof value === 'string') {
		return [value];
	}

	if (Array.isArray(value)) {
		return value.flatMap(collectStringValues);
	}

	if (value && typeof value === 'object') {
		return Object.values(value).flatMap(collectStringValues);
	}

	return [];
};

const listFiles = (directory) => {
	if (!fs.existsSync(directory)) {
		return [];
	}

	return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const entryPath = path.join(directory, entry.name);

		return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
	});
};

const getStringValue = (node) => {
	return ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node) ? node.text : undefined;
};

const isRuntimeRelativeMediaUrl = (value) => {
	return IMAGE_EXTENSION_PATTERN.test(value) && !/^(?:[a-z]+:|\/|data:)/i.test(value);
};

const collectUnsafeSourceAssetUrls = (rootDirectory) => {
	const sourceDirectory = path.join(rootDirectory, 'src');
	const failures = [];

	for (const filePath of listFiles(sourceDirectory).filter((candidate) => /\.(ts|tsx)$/i.test(candidate))) {
		const source = fs.readFileSync(filePath, 'utf8');
		const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
		const localMediaVariables = new Set();
		const fileFailures = new Set();

		const collectVariables = (node) => {
			if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
				const value = getStringValue(node.initializer);

				if (value && isRuntimeRelativeMediaUrl(value)) {
					localMediaVariables.add(node.name.text);
				}
			}

			ts.forEachChild(node, collectVariables);
		};
		collectVariables(sourceFile);

		const inspectNode = (node) => {
			if (
				ts.isNewExpression(node)
				&& ts.isIdentifier(node.expression)
				&& node.expression.text === 'URL'
				&& node.arguments?.length === 2
			) {
				const mediaUrl = getStringValue(node.arguments[0]);
				const baseExpression = node.arguments[1].getText(sourceFile);

				if (mediaUrl && isRuntimeRelativeMediaUrl(mediaUrl) && baseExpression === 'import.meta.url') {
					fileFailures.add('uses new URL(..., import.meta.url)');
				}
			}

			if (ts.isJsxAttribute(node) && ['poster', 'src'].includes(node.name.getText(sourceFile))) {
				let mediaUrl;

				if (node.initializer && ts.isStringLiteral(node.initializer)) {
					mediaUrl = node.initializer.text;
				} else if (node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression) {
					mediaUrl = getStringValue(node.initializer.expression);

					if (ts.isIdentifier(node.initializer.expression) && localMediaVariables.has(node.initializer.expression.text)) {
						mediaUrl = 'variable.png';
					}
				}

				if (mediaUrl && isRuntimeRelativeMediaUrl(mediaUrl)) {
					fileFailures.add('uses a runtime-relative JSX media URL');
				}
			}

			ts.forEachChild(node, inspectNode);
		};
		inspectNode(sourceFile);

		for (const message of fileFailures) {
			failures.push(`${normalizePath(path.relative(rootDirectory, filePath))}: ${message}`);
		}
	}

	return failures;
};

export const validatePackageAssets = (rootDirectory) => {
	const distDirectory = path.join(rootDirectory, 'dist');
	const propertiesPath = path.join(rootDirectory, 'src', 'editor-assets', 'properties.json');

	if (!fs.existsSync(propertiesPath)) {
		throw new Error(`Package metadata was not found: ${propertiesPath}`);
	}

	const properties = JSON.parse(fs.readFileSync(propertiesPath, 'utf8'));
	const sourceEditorAssets = path.dirname(propertiesPath);
	const editorAssetReferences = collectStringValues(properties).map((value) => normalizePath(value));
	const unusedEditorAssetDirectories = fs.readdirSync(sourceEditorAssets, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.filter((entry) => {
			const referenceFragment = `/editor-assets/${entry.name}/`;

			return !editorAssetReferences.some((reference) => reference.includes(referenceFragment));
		})
		.map((entry) => `src/editor-assets/${entry.name}`);
	const resourceList = Array.isArray(properties.resourceList) ? properties.resourceList : [];
	const localResources = resourceList.filter(
		(resource) => typeof resource === 'string' && !/^[a-z]+:\/\//i.test(resource)
	);
	const resourceSet = new Set(localResources);
	const emittedAssets = listFiles(path.join(distDirectory, 'assets')).map((filePath) => {
		return normalizePath(path.relative(distDirectory, filePath));
	});
	const missingRequiredFiles = REQUIRED_BUILD_FILES.filter((relativePath) => {
		return !fs.existsSync(path.join(distDirectory, relativePath));
	});
	const missingFromResourceList = emittedAssets.filter((relativePath) => !resourceSet.has(relativePath));
	const missingOnDisk = localResources.filter((relativePath) => {
		return !fs.existsSync(path.join(distDirectory, relativePath));
	});
	const duplicateResources = [...new Set(localResources.filter((resource, index) => {
		return localResources.indexOf(resource) !== index;
	}))];
	const unsafeResourcePaths = localResources.filter((resource) => {
		return path.isAbsolute(resource) || normalizePath(resource).split('/').includes('..');
	});
	const unsafeSourceAssetUrls = collectUnsafeSourceAssetUrls(rootDirectory);
	const invalidPngs = [];

	for (const relativePath of ['editor-assets/icon.png', 'editor-assets/placeholder.png']) {
		const filePath = path.join(distDirectory, relativePath);

		if (!fs.existsSync(filePath)) {
			continue;
		}

		try {
			readPngDimensions(filePath);
		} catch (error) {
			invalidPngs.push(`${relativePath}: ${error.message}`);
		}
	}

	const failures = [];

	if (missingRequiredFiles.length > 0) {
		failures.push(`Required build files are missing:\n  ${missingRequiredFiles.join('\n  ')}`);
	}

	if (missingFromResourceList.length > 0) {
		failures.push(
			`Built runtime assets are missing from properties.json resourceList:\n  ${missingFromResourceList.join('\n  ')}`
		);
	}

	if (missingOnDisk.length > 0) {
		failures.push(`resourceList entries do not exist in dist:\n  ${missingOnDisk.join('\n  ')}`);
	}

	if (duplicateResources.length > 0) {
		failures.push(`properties.json resourceList contains duplicates:\n  ${duplicateResources.join('\n  ')}`);
	}

	if (unsafeResourcePaths.length > 0) {
		failures.push(`properties.json resourceList contains unsafe local paths:\n  ${unsafeResourcePaths.join('\n  ')}`);
	}

	if (unsafeSourceAssetUrls.length > 0) {
		failures.push(
			`Local media must use static imports so the displayer receives bundle-resolved URLs:\n  ${unsafeSourceAssetUrls.join('\n  ')}`
		);
	}

	if (invalidPngs.length > 0) {
		failures.push(`Editor images are invalid:\n  ${invalidPngs.join('\n  ')}`);
	}

	if (unusedEditorAssetDirectories.length > 0) {
		failures.push(
			`Editor-asset directories must be referenced by properties.json or removed:\n  ${unusedEditorAssetDirectories.join('\n  ')}`
		);
	}

	if (failures.length > 0) {
		throw new Error(`Package asset validation failed.\n\n${failures.join('\n\n')}`);
	}

	return { runtimeAssetCount: emittedAssets.length };
};
