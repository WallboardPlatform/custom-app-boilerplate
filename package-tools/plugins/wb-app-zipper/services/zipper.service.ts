/**
 * Zipper service - handles zip archive creation
 */

import * as fsSync from 'fs';
import * as path from 'path';
import archiver from 'archiver';
import { BaseZipperService, ZipperServiceConfig as ZSC } from './abstract';
import { FileSystemService } from '../../../filesystem';
import { ProgressLogger } from '../../../logger';
import { ZipResult, CompressionOptions } from '../types';

export interface ZipperServiceConfig extends ZSC {
	sourcePath: string;
	outputPath: string;
	fileName: string;
	compressionOptions?: CompressionOptions;
	progressLogger?: ProgressLogger<any>;
}

export class ZipperService extends BaseZipperService {
	private config: ZipperServiceConfig;
	private progressLogger?: ProgressLogger<any>;
	private filesProcessed: number = 0;
	private totalFiles: number = 0;

	constructor(config: ZipperServiceConfig) {
		super(config);
		this.config = config;
		this.progressLogger = config.progressLogger;
		this.validate();
	}

	/**
	 * Validate configuration
	 */
	private validate(): void {
		if (!FileSystemService.exists(this.config.sourcePath)) {
			throw new Error(
				`Source directory does not exist: ${this.config.sourcePath}. Please build your project first.`
			);
		}

		if (!this.config.outputPath) {
			throw new Error('Output path is required');
		}

		if (!this.config.fileName) {
			throw new Error('File name is required');
		}
	}

	/**
	 * Execute zip creation
	 */
	public async execute(): Promise<ZipResult> {
		this.logInfo('Starting zip creation...');

		// Count total files
		this.totalFiles = FileSystemService.countFiles(this.config.sourcePath);
		this.logInfo(`Found ${this.totalFiles} files to compress`);

		// Update progress
		if (this.progressLogger) {
			this.progressLogger.updateMetadata({
				isCompressing: true,
				compressionProgress: 0,
				filesProcessed: 0,
				totalFiles: this.totalFiles,
				startTime: Date.now()
			});
		}

		try {
			const result = await this.createZipArchive();
			this.logSuccess(`Zip archive created successfully: ${result.path}`);
			return result;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.logError(`Failed to create zip archive: ${message}`);
			throw error;
		} finally {
			// Reset compression state
			if (this.progressLogger) {
				this.progressLogger.updateMetadata({
					isCompressing: false
				});
			}
		}
	}

	/**
	 * Create zip archive with progress tracking
	 */
	private createZipArchive(): Promise<ZipResult> {
		return new Promise((resolve, reject) => {
			// Ensure output directory exists
			this.ensureOutputDirectory();

			// Set up archive streams
			const output = fsSync.createWriteStream(this.config.outputPath);
			const archive = archiver('zip', {
				zlib: {
					level: this.config.compressionOptions?.level ?? 9
				}
			});

			// Set up event listeners
			this.setupArchiveListeners(output, archive, resolve, reject);

			// Pipe archive data to the file
			archive.pipe(output);

			// Add files from directory to the archive
			this.logInfo('Adding files to archive...');
			archive.directory(this.config.sourcePath, false);

			// Finalize the archive
			archive.finalize();
		});
	}

	/**
	 * Ensure output directory exists
	 */
	private ensureOutputDirectory(): void {
		const outputDir = path.dirname(this.config.outputPath);
		FileSystemService.ensureDirectory(outputDir);
		this.logInfo(`Output directory ready: ${outputDir}`);
	}

	/**
	 * Set up event listeners for archive and output stream
	 */
	private setupArchiveListeners(
		output: fsSync.WriteStream,
		archive: archiver.Archiver,
		resolve: (value: ZipResult) => void,
		reject: (reason: Error) => void
	): void {
		// Output stream events
		output.on('close', () => {
			const result: ZipResult = {
				path: this.config.outputPath,
				size: archive.pointer(),
				success: true
			};

			// Update final progress
			if (this.progressLogger) {
				this.progressLogger.updateMetadata({
					isCompressing: false,
					compressionProgress: 100,
					filesProcessed: this.totalFiles
				});
			}

			resolve(result);
		});

		output.on('error', (err: Error) => {
			this.logError(`Output stream error: ${err.message}`);
			reject(new Error(`Output stream error: ${err.message}`));
		});

		// Archive events
		archive.on('warning', (err: archiver.ArchiverError) => {
			if (err.code === 'ENOENT') {
				this.logWarning(`Archive warning: ${err.message}`);
			} else {
				reject(new Error(`Archive warning: ${err.message}`));
			}
		});

		archive.on('error', (err: archiver.ArchiverError) => {
			this.logError(`Archive error: ${err.message}`);
			reject(new Error(`Archive error: ${err.message}`));
		});

		// Progress events
		archive.on('progress', (progress: archiver.ProgressData) => {
			this.filesProcessed = progress.entries.processed;

			if (progress.entries.total > this.totalFiles) {
				this.totalFiles = progress.entries.total;
			} else {
				const percentage = Math.min(100, Math.round(
					(this.filesProcessed / this.totalFiles) * 100
				));

				if (this.progressLogger) {
					this.progressLogger.updateMetadata({
						compressionProgress: percentage,
						filesProcessed: this.filesProcessed
					});
					this.progressLogger.updateProgress(
						this.filesProcessed,
						this.totalFiles,
						`Processing files...`
					);
				}
			}
		});
	}
}