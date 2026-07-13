/**
 * Shared filesystem utilities
 */
import fs from 'fs';
import path from 'path';

import { CopyOptions } from './types';

export class FileSystemService {
	/**
	 * Ensure directory exists, create if not
	 */
	public static ensureDirectory(directory: string): void {
		if (!fs.existsSync(directory)) {
			fs.mkdirSync(directory, { recursive: true });
		}
	}

	/**
	 * Clear directory contents
	 */
	public static clearDirectory(directory: string): void {
		if (fs.existsSync(directory)) {
			fs.rmSync(directory, { recursive: true, force: true });
			fs.mkdirSync(directory, { recursive: true });
		}
	}

	/**
	 * Copy files recursively with optional transformations
	 */
	public static copyRecursive(
		source: string,
		destination: string,
		options: CopyOptions = {}
	): void {
		if (!fs.existsSync(source)) {
			throw new Error(`Source directory does not exist: ${source}`);
		}

		this.ensureDirectory(destination);

		const entries: fs.Dirent[] = fs.readdirSync(source, { withFileTypes: true });

		for (const entry of entries) {
			const sourcePath: string = path.join(source, entry.name);

			// Apply filter if provided
			if (options.filter && !options.filter(sourcePath)) {
				continue;
			}

			if (entry.isDirectory()) {
				const destPath: string = path.join(destination, entry.name);
				this.copyRecursive(sourcePath, destPath, options);
			} else {
				// Apply filename transformation if provided
				const fileName: string = options.transformFileName
					? options.transformFileName(entry.name)
					: entry.name;

				const destPath = path.join(destination, fileName);
				fs.copyFileSync(sourcePath, destPath);
			}
		}
	}

	/**
	 * Count total files in directory recursively
	 */
	public static countFiles(directory: string, filter?: (filePath: string) => boolean): number {
		if (!fs.existsSync(directory)) {
			return 0;
		}

		let count: number = 0;
		const entries: fs.Dirent[] = fs.readdirSync(directory, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath: string = path.join(directory, entry.name);

			if (entry.isDirectory()) {
				count += this.countFiles(fullPath, filter);
			} else {
				if (!filter || filter(fullPath)) {
					count++;
				}
			}
		}

		return count;
	}

	/**
	 * Get all files in directory recursively
	 */
	public static getAllFiles(
		directory: string,
		filter?: (filePath: string) => boolean
	): string[] {
		if (!fs.existsSync(directory)) {
			return [];
		}

		const files: string[] = [];
		const entries: fs.Dirent[] = fs.readdirSync(directory, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath: string = path.join(directory, entry.name);

			if (entry.isDirectory()) {
				files.push(...this.getAllFiles(fullPath, filter));
			} else {
				if (!filter || filter(fullPath)) {
					files.push(fullPath);
				}
			}
		}

		return files;
	}

	/**
	 * Check if path exists
	 */
	public static exists(filePath: string): boolean {
		return fs.existsSync(filePath);
	}

	/**
	 * Get file stats
	 */
	public static getStats(filePath: string): fs.Stats {
		return fs.statSync(filePath);
	}

	/**
	 * Read file as string
	 */
	public static readFile(filePath: string, encoding: BufferEncoding = 'utf8'): string {
		return fs.readFileSync(filePath, encoding);
	}

	/**
	 * Write file
	 */
	public static writeFile(filePath: string, content: string): void {
		const directory: string = path.dirname(filePath);
		this.ensureDirectory(directory);
		fs.writeFileSync(filePath, content, 'utf8');
	}

	/**
	 * Create read stream
	 */
	public static createReadStream(filePath: string): fs.ReadStream {
		return fs.createReadStream(filePath);
	}
}