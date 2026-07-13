/**
 * Path configuration for the zipper plugin
 */
import path from 'path';

export class ZipperPathConfig {
	// Source paths
	public static readonly DIST_PATH: string = path.join(__dirname, '..', '..', '..', '..', 'dist');

	/**
	 * Get default output path (Desktop)
	 */
	public static getDefaultOutputPath(): string {
		return path.join(
			process.env.HOMEDRIVE || '',
			process.env.HOMEPATH || '',
			'Desktop'
		);
	}
}