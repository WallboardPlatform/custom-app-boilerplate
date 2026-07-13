/**
 * Path configuration for the plugin
 */
import path from 'path';

export class PathConfig {
	// Folder names
	public static readonly ASSETS_FOLDER: string = 'assets';
	public static readonly EDITOR_ASSETS_FOLDER: string = 'editor-assets';

	// Paths relative to plugin location
	public static readonly EDITOR_ASSETS_SOURCE_FOLDER: string = path.join(
		__dirname,
		'..',
		'..',
		'..',
		'..',
		'src',
		PathConfig.EDITOR_ASSETS_FOLDER
	);

	public static readonly DIST_PATH: string = path.join(
		__dirname,
		'..',
		'..',
		'..',
		'..',
		'dist'
	);

	/**
	 * Get dist subfolder path
	 */
	public static getDistFolder(folder: string): string {
		return path.join(this.DIST_PATH, folder);
	}

	/**
	 * Get assets path
	 */
	public static getAssetsPath(): string {
		return this.getDistFolder(this.ASSETS_FOLDER);
	}

	/**
	 * Get editor assets path
	 */
	public static getEditorAssetsPath(): string {
		return this.getDistFolder(this.EDITOR_ASSETS_FOLDER);
	}
}