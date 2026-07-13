/**
 * MinIO upload service
 */
import path from 'path';
import { Stats, ReadStream } from 'fs';
import * as Minio from 'minio';
import { BaseService, ServiceConfig } from './abstract';
import { FileSystemService } from '../../../filesystem';
import { ProgressLogger } from '../../../logger';
import { MinioConfig } from '../types';
import { MimeTypesConfig, PathConfig } from '../config';

export interface MinIOServiceConfig extends ServiceConfig {
	widgetId: string;
	minioConfig: MinioConfig;
	uploadFolders: string[];
	progressLogger?: ProgressLogger<any>;
}

export class MinIOService extends BaseService {
	private config: MinIOServiceConfig;
	private client?: Minio.Client;
	private progressLogger?: ProgressLogger<unknown>;
	private uploadedCount: number = 0;
	private totalFiles: number = 0;

	constructor(config: MinIOServiceConfig) {
		super(config);
		this.config = config;
		this.progressLogger = config.progressLogger;
		this.validate();
		this.initializeClient();
	}

	/**
	 * Validate configuration
	 */
	protected validate(): void {
		if (!this.config.widgetId) {
			throw new Error('Widget ID is required for MinIO upload');
		}

		if (!this.config.minioConfig) {
			throw new Error('MinIO configuration is required');
		}

		const { host, port, bucket, accessKey, secretKey } = this.config.minioConfig;

		if (!host || !port || !bucket || !accessKey || !secretKey) {
			throw new Error('Incomplete MinIO configuration');
		}
	}

	/**
	 * Initialize MinIO client
	 */
	private initializeClient(): void {
		const { host, port, useSSL, accessKey, secretKey } = this.config.minioConfig;

		this.client = new Minio.Client({
			endPoint: host,
			port,
			useSSL,
			accessKey,
			secretKey
		});
	}

	/**
	 * Execute upload process
	 */
	public async execute(): Promise<void> {
		if (!this.client) {
			throw new Error('MinIO client not initialized');
		}

		// Verify bucket exists
		await this.verifyBucket();

		// Count total files
		this.totalFiles = this.countTotalFiles();
		this.uploadedCount = 0;

		// Update progress logger
		if (this.progressLogger) {
			this.progressLogger.updateProgress(0, this.totalFiles);
		}

		// Upload all folders
		const baseMinioPath = `apps/widgets/${this.config.widgetId}`;

		for (const folder of this.config.uploadFolders) {
			const localPath: string = path.join(PathConfig.DIST_PATH, folder);

			if (FileSystemService.exists(localPath)) {
				const minioPath = `${baseMinioPath}/${folder}`;
				await this.uploadDirectory(localPath, minioPath);
			}
		}

		this.logSuccess(
			`Uploaded ${this.uploadedCount} files to MinIO bucket: ${this.config.minioConfig.bucket}`
		);
	}

	/**
	 * Verify bucket exists
	 */
	private async verifyBucket(): Promise<void> {
		if (!this.client) {
			throw new Error('MinIO client not initialized');
		}

		const bucketExists: boolean = await this.client.bucketExists(
			this.config.minioConfig.bucket
		);

		if (!bucketExists) {
			throw new Error(
				`Bucket "${this.config.minioConfig.bucket}" does not exist`
			);
		}
	}

	/**
	 * Count total files to upload
	 */
	private countTotalFiles(): number {
		let total: number = 0;

		for (const folder of this.config.uploadFolders) {
			const localPath: string = path.join(PathConfig.DIST_PATH, folder);
			if (FileSystemService.exists(localPath)) {
				total += FileSystemService.countFiles(localPath);
			}
		}

		return total;
	}

	/**
	 * Upload directory recursively
	 */
	private async uploadDirectory(
		localDir: string,
		minioPrefix: string
	): Promise<void> {
		const files: string[] = FileSystemService.getAllFiles(localDir);

		for (const filePath of files) {
			const relativePath: string = path.relative(localDir, filePath);
			const minioPath = `${minioPrefix}/${relativePath.replace(/\\/g, '/')}`;

			await this.uploadFile(filePath, minioPath);
		}
	}

	/**
	 * Upload single file
	 */
	private async uploadFile(localPath: string, minioPath: string): Promise<void> {
		if (!this.client) {
			throw new Error('MinIO client not initialized');
		}

		try {
			const fileStream: ReadStream = FileSystemService.createReadStream(localPath);
			const fileStats: Stats = FileSystemService.getStats(localPath);
			const mimeType: string = MimeTypesConfig.getMimeType(localPath);

			// Update progress
			if (this.progressLogger) {
				this.progressLogger.updateProgress(
					this.uploadedCount,
					this.totalFiles,
					localPath
				);
			}

			await this.client.putObject(
				this.config.minioConfig.bucket,
				minioPath,
				fileStream,
				fileStats.size,
				{
					'Content-Type': mimeType,
					'X-Uploaded-By': 'WB-App-Post-Execution-Plugin'
				}
			);

			this.uploadedCount++;

			// Update progress
			if (this.progressLogger) {
				this.progressLogger.updateProgress(
					this.uploadedCount,
					this.totalFiles
				);
			}
		} catch (error) {
			throw new Error(
				`Failed to upload ${path.basename(localPath)}: ${error}`
			);
		}
	}

	/**
	 * Get upload statistics
	 */
	public getUploadStats(): { uploaded: number; total: number } {
		return {
			uploaded: this.uploadedCount,
			total: this.totalFiles
		};
	}
}