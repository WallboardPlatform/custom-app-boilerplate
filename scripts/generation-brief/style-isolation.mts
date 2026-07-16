import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

const NAMESPACED_TOKEN = /^wb-[a-z0-9]+-[a-z0-9][a-z0-9_-]*$/;
const STYLE_EXTENSIONS = new Set(['.css', '.scss']);
const TSX_EXTENSIONS = new Set(['.jsx', '.tsx']);

const walkFiles = (directory: string): string[] => {
	if (!fs.existsSync(directory)) {
		return [];
	}

	return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry): string[] => {
		const entryPath = path.join(directory, entry.name);

		return entry.isDirectory() ? walkFiles(entryPath) : [entryPath];
	});
};

const splitClassNames = (value: string): string[] => {
	return value.split(/\s+/).map((className) => className.trim()).filter(Boolean);
};

const literalText = (expression: ts.Expression): string[] => {
	if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
		return [expression.text];
	}

	if (ts.isTemplateExpression(expression)) {
		return [expression.head.text, ...expression.templateSpans.map((span) => span.literal.text)];
	}

	if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.PlusToken) {
		return [...literalText(expression.left), ...literalText(expression.right)];
	}

	return [];
};

const jsxGlobalClasses = (filePath: string): string[] => {
	const source = fs.readFileSync(filePath, 'utf8');
	const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
	const classes: string[] = [];

	const visit = (node: ts.Node): void => {
		if (ts.isJsxAttribute(node)) {
			const attributeName = node.name.getText(sourceFile);

			if (attributeName === 'class' || attributeName === 'className') {
				if (node.initializer && ts.isStringLiteral(node.initializer)) {
					classes.push(...splitClassNames(node.initializer.text));
				} else if (node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression) {
					classes.push(...literalText(node.initializer.expression).flatMap(splitClassNames));
				}
			}

			if (
				attributeName === 'classList'
				&& node.initializer
				&& ts.isJsxExpression(node.initializer)
				&& node.initializer.expression
				&& ts.isObjectLiteralExpression(node.initializer.expression)
			) {
				for (const property of node.initializer.expression.properties) {
					if (ts.isPropertyAssignment(property) && property.name) {
						classes.push(property.name.getText(sourceFile).replace(/^['"]|['"]$/g, ''));
					}
				}
			}
		}

		ts.forEachChild(node, visit);
	};

	visit(sourceFile);

	return classes.filter((className) => !className.includes('${'));
};

const failUnscoped = (applicationDirectory: string, filePath: string, kind: string, token: string): never => {
	throw new Error(
		`${path.relative(applicationDirectory, filePath)} uses unscoped ${kind} '${token}'. `
		+ 'v4 apps must use CSS modules or a unique wb-<app-slug>-* namespace.'
	);
};

export const validateStyleIsolation = (applicationDirectory: string): void => {
	const componentDirectory = path.join(applicationDirectory, 'src', 'components', 'wb-app');
	const files = [
		...walkFiles(componentDirectory),
		path.join(applicationDirectory, 'src', 'styles', 'animation.css')
	].filter((filePath) => fs.existsSync(filePath));

	for (const filePath of files) {
		const extension = path.extname(filePath).toLowerCase();

		if (TSX_EXTENSIONS.has(extension)) {
			for (const className of jsxGlobalClasses(filePath)) {
				if (!NAMESPACED_TOKEN.test(className)) {
					failUnscoped(applicationDirectory, filePath, 'global class', className);
				}
			}
		}

		const source = fs.readFileSync(filePath, 'utf8');

		if (STYLE_EXTENSIONS.has(extension)) {
			for (const match of source.matchAll(/:global\(\.([a-zA-Z0-9_-]+)/g)) {
				if (!NAMESPACED_TOKEN.test(match[1])) {
					failUnscoped(applicationDirectory, filePath, ':global class', match[1]);
				}
			}

			for (const match of source.matchAll(/@(?:-webkit-)?keyframes\s+([a-zA-Z0-9_-]+)/g)) {
				if (!NAMESPACED_TOKEN.test(match[1])) {
					failUnscoped(applicationDirectory, filePath, 'keyframe', match[1]);
				}
			}
		}

		const customProperties = new Set<string>();

		for (const match of source.matchAll(/(?:var\(\s*|['"])(--[a-zA-Z0-9_-]+)/g)) {
			customProperties.add(match[1]);
		}

		for (const match of source.matchAll(/(?:^|[;{]\s*)(--[a-zA-Z0-9_-]+)\s*:/gm)) {
			customProperties.add(match[1]);
		}

		for (const customProperty of customProperties) {
			if (!NAMESPACED_TOKEN.test(customProperty.slice(2))) {
				failUnscoped(applicationDirectory, filePath, 'custom property', customProperty);
			}
		}
	}
};
