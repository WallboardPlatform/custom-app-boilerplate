import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import archiver from 'archiver';

const EXCLUDED_DIRECTORY_NAMES: ReadonlySet<string> = new Set([
	'.cache',
	'.git',
	'.history',
	'.idea',
	'.playwright',
	'.tmp',
	'.vite',
	'.vitest',
	'build',
	'coverage',
	'dist',
	'logs',
	'node_modules',
	'out',
	'output'
]);
const EXCLUDED_ROOT_DIRECTORY_NAMES: ReadonlySet<string> = new Set(['templates']);
const EXCLUDED_FILE_NAMES: ReadonlySet<string> = new Set([
	'.netrc',
	'.npmrc',
	'.pypirc',
	'credentials.json',
	'id_ed25519',
	'id_rsa',
	'service-account-key.json',
	'service-account.json'
]);
const EXCLUDED_ROOT_FILES: ReadonlySet<string> = new Set(['config.json']);
const EXCLUDED_FILE_EXTENSIONS: ReadonlySet<string> = new Set([
	'.7z',
	'.bz2',
	'.gz',
	'.jks',
	'.key',
	'.keystore',
	'.log',
	'.p12',
	'.pem',
	'.pfx',
	'.ppk',
	'.rar',
	'.tar',
	'.tgz',
	'.xz',
	'.zip'
]);

export interface GitProvenance {
	commit: string | null;
	workingTreeClean: boolean | null;
}

export interface SourceArchiveResult {
	fileCount: number;
	sha256: string;
}

const normalizeRelativePath = (relativePath: string): string => {
	return relativePath.split(path.sep).join('/').replace(/^\.\//, '');
};

const isInside = (parentDirectory: string, candidatePath: string): boolean => {
	const relativePath: string = path.relative(parentDirectory, candidatePath);

	return relativePath !== '' && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
};

export const shouldExcludeSourcePath = (
	relativePath: string,
	excludedDirectory?: string
): boolean => {
	const normalizedPath: string = normalizeRelativePath(relativePath);
	const lowerPath: string = normalizedPath.toLowerCase();
	const segments: string[] = lowerPath.split('/');
	const fileName: string = segments[segments.length - 1] ?? '';

	if (excludedDirectory) {
		const normalizedExcludedDirectory: string = normalizeRelativePath(excludedDirectory).toLowerCase();

		if (
			normalizedExcludedDirectory !== ''
			&& (lowerPath === normalizedExcludedDirectory || lowerPath.startsWith(`${normalizedExcludedDirectory}/`))
		) {
			return true;
		}
	}

	if (segments.some((segment: string): boolean => EXCLUDED_DIRECTORY_NAMES.has(segment))) {
		return true;
	}

	if (EXCLUDED_ROOT_DIRECTORY_NAMES.has(segments[0] ?? '')) {
		return true;
	}

	if (EXCLUDED_FILE_NAMES.has(fileName)) {
		return true;
	}

	if (segments.length === 1 && EXCLUDED_ROOT_FILES.has(fileName)) {
		return true;
	}

	if (fileName === '.env' || fileName.startsWith('.env.')) {
		return true;
	}

	if (fileName.includes('.local.') || fileName.endsWith('.local')) {
		return true;
	}

	return EXCLUDED_FILE_EXTENSIONS.has(path.extname(fileName));
};

export const collectSourceFiles = (
	projectDirectory: string,
	excludedOutputDirectory?: string
): string[] => {
	const sourceFiles: string[] = [];
	const excludedDirectory: string | undefined = excludedOutputDirectory && isInside(projectDirectory, excludedOutputDirectory)
		? path.relative(projectDirectory, excludedOutputDirectory)
		: undefined;

	const visit = (directory: string): void => {
		for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
			const absolutePath: string = path.join(directory, entry.name);
			const relativePath: string = path.relative(projectDirectory, absolutePath);

			if (shouldExcludeSourcePath(relativePath, excludedDirectory)) {
				continue;
			}

			if (entry.isSymbolicLink()) {
				throw new Error(`Source archive cannot safely include symbolic link '${normalizeRelativePath(relativePath)}'.`);
			}

			if (entry.isDirectory()) {
				visit(absolutePath);
			} else if (entry.isFile()) {
				sourceFiles.push(relativePath);
			}
		}
	};

	visit(projectDirectory);

	return sourceFiles.sort((left: string, right: string): number => left.localeCompare(right));
};

const sha256File = (filePath: string): string => {
	return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
};

export const createSourceArchive = async (
	projectDirectory: string,
	outputPath: string,
	excludedOutputDirectory?: string
): Promise<SourceArchiveResult> => {
	const sourceFiles: string[] = collectSourceFiles(projectDirectory, excludedOutputDirectory);
	const output = fs.createWriteStream(outputPath);
	const archive = archiver('zip', { zlib: { level: 9 } });

	await new Promise<void>((resolve, reject): void => {
		output.on('close', resolve);
		output.on('error', reject);
		archive.on('warning', (error: NodeJS.ErrnoException): void => {
			if (error.code !== 'ENOENT') {
				reject(error);
			}
		});
		archive.on('error', reject);
		archive.pipe(output);

		for (const relativePath of sourceFiles) {
			archive.file(path.join(projectDirectory, relativePath), {
				name: normalizeRelativePath(relativePath)
			});
		}

		void archive.finalize();
	});

	return {
		fileCount: sourceFiles.length,
		sha256: sha256File(outputPath)
	};
};

export const readGitProvenance = (projectDirectory: string): GitProvenance => {
	const repositoryRoot = spawnSync('git', ['rev-parse', '--show-toplevel'], {
		cwd: projectDirectory,
		encoding: 'utf8',
		windowsHide: true
	});

	if (
		repositoryRoot.status !== 0
		|| path.relative(path.resolve(projectDirectory), path.resolve(repositoryRoot.stdout.trim())) !== ''
	) {
		return { commit: null, workingTreeClean: null };
	}

	const revision = spawnSync('git', ['rev-parse', 'HEAD'], {
		cwd: projectDirectory,
		encoding: 'utf8',
		windowsHide: true
	});

	if (revision.status !== 0) {
		return { commit: null, workingTreeClean: null };
	}

	const status = spawnSync('git', ['status', '--porcelain'], {
		cwd: projectDirectory,
		encoding: 'utf8',
		windowsHide: true
	});

	return {
		commit: revision.stdout.trim() || null,
		workingTreeClean: status.status === 0 ? status.stdout.trim() === '' : null
	};
};
