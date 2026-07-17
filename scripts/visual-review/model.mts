import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const VISUAL_REVIEW_CRITERIA = [
	'promptFidelity',
	'referenceFidelity',
	'visualSpecificity',
	'distanceReadability',
	'themeContrast',
	'dynamicTextSafety',
	'surfaceComposition',
	'assetAndThemeQuality',
	'exampleSameness'
] as const;

export type VisualReviewCriterionId = typeof VISUAL_REVIEW_CRITERIA[number];
export type VisualReviewStatus = 'pending' | 'pass' | 'not-applicable';

export interface VisualReviewCriterion {
	id: VisualReviewCriterionId;
	status: VisualReviewStatus;
	notes: string;
}

export interface VisualReviewScreenshot {
	file: string;
	status: 'pending' | 'pass';
	notes: string;
}

export interface VisualReview {
	reviewVersion: 1;
	sourceHash: string;
	reviewedAt: string | null;
	reviewer: string;
	criteria: VisualReviewCriterion[];
	screenshots: VisualReviewScreenshot[];
	unresolvedFindings: string[];
}

const normalizeRelativePath = (value: string): string => value.split(path.sep).join('/');

const IMPORT_PATTERNS: RegExp[] = [
	/(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g,
	/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
	/@(?:import|use|forward)\s+['"]([^'"]+)['"]/g,
	/url\(\s*['"]?([^'")]+)['"]?\s*\)/g
];
const SOURCE_EXTENSIONS: string[] = [
	'.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs', '.css', '.scss', '.sass', '.json',
	'.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.woff', '.woff2', '.ttf'
];
const TEXT_SOURCE_EXTENSIONS = new Set([
	'.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs', '.css', '.scss', '.sass', '.json', '.svg'
]);
const SOURCE_ALIASES: Readonly<Record<string, string>> = {
	'@components': 'src/components',
	'@contexts': 'src/contexts',
	'@hooks': 'src/hooks',
	'@interfaces': 'src/interfaces',
	'@services': 'src/services',
	'@utils': 'src/utils'
};

const collectFiles = (directory: string): string[] => {
	if (!fs.existsSync(directory)) {
		return [];
	}

	const files: string[] = [];

	const visit = (currentDirectory: string): void => {
		for (const entry of fs.readdirSync(currentDirectory, { withFileTypes: true })) {
			const entryPath: string = path.join(currentDirectory, entry.name);

			if (entry.isDirectory()) {
				visit(entryPath);
			} else if (entry.isFile()) {
				files.push(entryPath);
			}
		}
	};

	visit(directory);

	return files;
};

const isInsideProject = (projectDirectory: string, filePath: string): boolean => {
	const relativePath: string = path.relative(projectDirectory, filePath);

	return relativePath !== '' && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
};

const localImportBase = (
	projectDirectory: string,
	importerPath: string,
	specifier: string
): string | undefined => {
	if (specifier.startsWith('.')) {
		return path.resolve(path.dirname(importerPath), specifier);
	}

	if (specifier.startsWith('/src/')) {
		return path.resolve(projectDirectory, specifier.slice(1));
	}

	for (const [alias, target] of Object.entries(SOURCE_ALIASES)) {
		if (specifier === alias || specifier.startsWith(`${alias}/`)) {
			return path.resolve(projectDirectory, target, specifier.slice(alias.length + 1));
		}
	}

	return undefined;
};

const resolveLocalImport = (
	projectDirectory: string,
	importerPath: string,
	specifier: string
): string | undefined => {
	const importBase: string | undefined = localImportBase(projectDirectory, importerPath, specifier);

	if (!importBase || !isInsideProject(projectDirectory, importBase)) {
		return undefined;
	}

	const candidates: string[] = [importBase];
	const extension: string = path.extname(importBase);

	if (!extension) {
		for (const candidateExtension of SOURCE_EXTENSIONS) {
			candidates.push(`${importBase}${candidateExtension}`);
			candidates.push(path.join(path.dirname(importBase), `_${path.basename(importBase)}${candidateExtension}`));
			candidates.push(path.join(importBase, `index${candidateExtension}`));
		}
	}

	return candidates.find((candidate: string): boolean => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
};

const collectImportSpecifiers = (filePath: string): string[] => {
	const extension: string = path.extname(filePath).toLowerCase();

	if (!['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs', '.css', '.scss', '.sass'].includes(extension)) {
		return [];
	}

	const source: string = fs.readFileSync(filePath, 'utf8');
	const specifiers: string[] = [];

	for (const pattern of IMPORT_PATTERNS) {
		pattern.lastIndex = 0;
		let match: RegExpExecArray | null = pattern.exec(source);

		while (match) {
			if (match[1] && !match[1].startsWith('data:')) {
				specifiers.push(match[1]);
			}

			match = pattern.exec(source);
		}
	}

	return specifiers;
};

const collectReachableFiles = (projectDirectory: string, seeds: readonly string[]): string[] => {
	const visited = new Set<string>();
	const pending: string[] = seeds.filter((seed: string): boolean => fs.existsSync(seed));

	while (pending.length > 0) {
		const filePath: string = path.resolve(pending.pop() as string);

		if (visited.has(filePath) || !isInsideProject(projectDirectory, filePath)) {
			continue;
		}

		visited.add(filePath);

		for (const specifier of collectImportSpecifiers(filePath)) {
			const dependency: string | undefined = resolveLocalImport(projectDirectory, filePath, specifier);

			if (dependency && !visited.has(dependency)) {
				pending.push(dependency);
			}
		}

		if (filePath.endsWith('.scss')) {
			pending.push(path.join(projectDirectory, 'src', 'styles', '_index.scss'));
		}
	}

	return [...visited];
};

export const collectVisualReviewSourceFiles = (projectDirectory: string): string[] => {
	const previewDirectory: string = path.join(projectDirectory, 'preview');
	const seeds: string[] = [
		path.join(projectDirectory, 'src', 'index.tsx'),
		path.join(previewDirectory, 'fixture.ts')
	];

	if (fs.existsSync(previewDirectory)) {
		for (const previewFile of fs.readdirSync(previewDirectory, { withFileTypes: true })) {
			if (previewFile.isFile() && previewFile.name.endsWith('.spec.ts') && previewFile.name !== 'visual.spec.ts') {
				seeds.push(path.join(previewDirectory, previewFile.name));
			}
		}
	}

	const files: string[] = collectReachableFiles(projectDirectory, seeds);
	files.push(
		...collectFiles(path.join(projectDirectory, 'src', 'editor-assets')).filter(
			(filePath) =>
				!['datasource-contract.json', 'datasource-template.json'].includes(path.basename(filePath))
		)
	);

	for (const rootFile of ['generation-brief.json', 'datasource-contract.json', 'sample-datasource.json']) {
		const filePath: string = path.join(projectDirectory, rootFile);

		if (fs.existsSync(filePath)) {
			files.push(filePath);
		}
	}

	const datasourceContractPath: string = path.join(projectDirectory, 'datasource-contract.json');

	if (fs.existsSync(datasourceContractPath)) {
		const contract: Record<string, unknown> = JSON.parse(fs.readFileSync(datasourceContractPath, 'utf8')) as Record<string, unknown>;
		const bindings: unknown[] = Array.isArray(contract.bindings)
			? contract.bindings
			: [{ source: contract.source }];

		for (const binding of bindings) {
			if (!binding || typeof binding !== 'object' || Array.isArray(binding)) {
				continue;
			}

			const source: unknown = (binding as Record<string, unknown>).source;
			const sampleData: unknown = source && typeof source === 'object' && !Array.isArray(source)
				? (source as Record<string, unknown>).sampleData
				: undefined;

			if (typeof sampleData !== 'string' || sampleData.trim() === '') {
				continue;
			}

			const samplePath: string = path.resolve(projectDirectory, sampleData);

			if (samplePath.startsWith(`${projectDirectory}${path.sep}`) && fs.existsSync(samplePath)) {
				files.push(samplePath);
			}
		}
	}

	return [...new Set(files)].sort((left: string, right: string): number => left.localeCompare(right));
};

export const createVisualReviewSourceHash = (projectDirectory: string): string => {
	const hash = crypto.createHash('sha256');

	for (const filePath of collectVisualReviewSourceFiles(projectDirectory)) {
		hash.update(normalizeRelativePath(path.relative(projectDirectory, filePath)));
		hash.update('\0');
		const contents: Buffer = fs.readFileSync(filePath);
		const normalizedContents: Buffer | string = TEXT_SOURCE_EXTENSIONS.has(path.extname(filePath).toLowerCase())
			? contents.toString('utf8').replace(/\r\n?/g, '\n')
			: contents;

		hash.update(normalizedContents);
		hash.update('\0');
	}

	return hash.digest('hex');
};

export const collectScreenshotFiles = (projectDirectory: string): string[] => {
	const outputDirectory: string = path.join(projectDirectory, 'preview', 'output');

	if (!fs.existsSync(outputDirectory)) {
		return [];
	}

	return fs.readdirSync(outputDirectory, { withFileTypes: true })
		.filter((entry: fs.Dirent): boolean => entry.isFile() && entry.name.endsWith('.png'))
		.map((entry: fs.Dirent): string => entry.name)
		.sort((left: string, right: string): number => left.localeCompare(right));
};

export const createPendingVisualReview = (
	projectDirectory: string,
	previous?: VisualReview
): VisualReview => {
	const sourceHash: string = createVisualReviewSourceHash(projectDirectory);
	const preserve: boolean = previous?.sourceHash === sourceHash;
	const previousCriteria = new Map(previous?.criteria.map((criterion) => [criterion.id, criterion]) ?? []);
	const previousScreenshots = new Map(previous?.screenshots.map((screenshot) => [screenshot.file, screenshot]) ?? []);

	return {
		reviewVersion: 1,
		sourceHash,
		reviewedAt: preserve ? previous?.reviewedAt ?? null : null,
		reviewer: preserve ? previous?.reviewer ?? '' : '',
		criteria: VISUAL_REVIEW_CRITERIA.map((id: VisualReviewCriterionId): VisualReviewCriterion => {
			return preserve && previousCriteria.has(id)
				? previousCriteria.get(id) as VisualReviewCriterion
				: { id, status: 'pending', notes: '' };
		}),
		screenshots: collectScreenshotFiles(projectDirectory).map((file: string): VisualReviewScreenshot => {
			return preserve && previousScreenshots.has(file)
				? previousScreenshots.get(file) as VisualReviewScreenshot
				: { file, status: 'pending', notes: '' };
		}),
		unresolvedFindings: preserve ? previous?.unresolvedFindings ?? [] : []
	};
};
