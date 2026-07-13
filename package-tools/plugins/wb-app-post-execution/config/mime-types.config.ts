/**
 * MIME types configuration
 */
import path from 'path';

export class MimeTypesConfig {
	private static readonly MIME_TYPES: Record<string, string> = {
		// JavaScript and TypeScript
		'.js': 'text/javascript',
		'.mjs': 'text/javascript',
		'.ts': 'text/javascript',
		// JSON
		'.json': 'application/json',
		// CSS
		'.css': 'text/css',
		// HTML
		'.html': 'text/html',
		'.htm': 'text/html',
		// Images
		'.png': 'image/png',
		'.jpg': 'image/jpeg',
		'.jpeg': 'image/jpeg',
		'.gif': 'image/gif',
		'.svg': 'image/svg+xml',
		'.webp': 'image/webp',
		'.ico': 'image/x-icon',
		// Fonts
		'.woff': 'font/woff',
		'.woff2': 'font/woff2',
		'.ttf': 'font/ttf',
		'.otf': 'font/otf',
		'.eot': 'application/vnd.ms-fontobject',
		// Documents
		'.pdf': 'application/pdf',
		'.txt': 'text/plain',
		'.md': 'text/markdown',
		// Audio/Video
		'.mp3': 'audio/mpeg',
		'.mp4': 'video/mp4',
		'.webm': 'video/webm',
		'.ogg': 'audio/ogg',
		// Archives
		'.zip': 'application/zip',
		'.gz': 'application/gzip',
		// XML
		'.xml': 'application/xml',
		// Source maps
		'.map': 'application/json'
	};

	private static readonly DEFAULT_MIME_TYPE: string = 'application/octet-stream';

	/**
	 * Get MIME type for file path
	 */
	public static getMimeType(filePath: string): string {
		const ext: string = path.extname(filePath).toLowerCase();
		return this.MIME_TYPES[ext] || this.DEFAULT_MIME_TYPE;
	}

	/**
	 * Check if MIME type is registered
	 */
	public static hasMimeType(extension: string): boolean {
		const ext: string = extension.startsWith('.') ? extension : `.${extension}`;
		return ext.toLowerCase() in this.MIME_TYPES;
	}

	/**
	 * Register custom MIME type
	 */
	public static registerMimeType(extension: string, mimeType: string): void {
		const ext: string = extension.startsWith('.') ? extension : `.${extension}`;
		this.MIME_TYPES[ext.toLowerCase()] = mimeType;
	}
}