/**
 * Assets service - handles copying editor assets
 */

import path from 'path';
import { BaseService, ServiceConfig } from './abstract';
import { FileSystemService } from '../../../filesystem';
import { PathConfig } from '../config';

export interface AssetsServiceConfig extends ServiceConfig {
	sourceFolder: string;
	destinationFolder: string;
	transformFileName?: (fileName: string) => string;
}

export class AssetsService extends BaseService {
	private config: AssetsServiceConfig;

	constructor(config: AssetsServiceConfig) {
		super(config);
		this.config = config;
		this.validate();
	}

	/**
	 * Validate configuration
	 */
	protected validate(): void {
		if (!FileSystemService.exists(this.config.sourceFolder)) {
			throw new Error(
				`Source folder not found: ${this.config.sourceFolder}`
			);
		}
	}

	/**
	 * Execute asset copying
	 */
	public execute(): void {
		try {
			// Clear destination if exists
			if (FileSystemService.exists(this.config.destinationFolder)) {
				FileSystemService.clearDirectory(this.config.destinationFolder);
			}

			// Copy assets with optional transformation
			FileSystemService.copyRecursive(
				this.config.sourceFolder,
				this.config.destinationFolder,
				{
					transformFileName: this.config.transformFileName
				}
			);

			this.logSuccess(
				`Assets copied from ${path.basename(this.config.sourceFolder)}`
			);
		} catch (error) {
			this.logError(`Failed to copy assets: ${error}`);
			throw error;
		}
	}

	/**
	 * Static factory method for editor assets
	 */
	public static createForEditorAssets(config: ServiceConfig): AssetsService {
		const destinationFolder: string = path.join(
			PathConfig.DIST_PATH,
			PathConfig.EDITOR_ASSETS_FOLDER
		);

		return new AssetsService({
			...config,
			sourceFolder: PathConfig.EDITOR_ASSETS_SOURCE_FOLDER,
			destinationFolder,
			transformFileName: (fileName: string): string => {
				// Transform properties.json to config.json
				return fileName === 'properties.json' ? 'config.json' : fileName;
			}
		});
	}
}