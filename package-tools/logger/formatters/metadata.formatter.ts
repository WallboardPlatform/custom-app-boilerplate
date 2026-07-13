/**
 * Metadata formatting utilities
 */
export class MetadataFormatter {
	/**
	 * Convert camelCase to Title Case with spaces
	 * Examples:
	 * - 'widgetId' -> 'Widget Id'
	 * - 'minioBucket' -> 'Minio Bucket'
	 * - 'buildMode' -> 'Build Mode'
	 */
	public static formatKey(key: string): string {
		return key
			// Insert space before uppercase letters
			.replace(/([A-Z])/g, ' $1')
			// Capitalize first letter
			.replace(/^./, (str: string): string => str.toUpperCase())
			// Trim any extra spaces
			.trim();
	}

	/**
	 * Format a value for display
	 */
	public static formatValue(value: unknown): string {
		if (value === null || value === undefined) {
			return '';
		}

		if (typeof value === 'boolean') {
			return value ? 'Yes' : 'No';
		}

		if (typeof value === 'object') {
			return JSON.stringify(value);
		}

		return String(value);
	}

	/**
	 * Get icon for common keys
	 */
	public static getIconForKey(key: string): string {
		const iconMap: Record<string, string> = {
			id: '🏷️',
			widgetId: '🏷️',
			name: '📛',
			version: '🔖',
			mode: '⚙️',
			buildMode: '⚙️',
			bucket: '🪣',
			minioBucket: '🪣',
			host: '🌐',
			minioHost: '🌐',
			path: '📁',
			file: '📄',
			folder: '📂',
			url: '🔗',
			port: '🔌',
			status: '📊',
			progress: '📈',
			time: '⏱️',
			date: '📅',
			user: '👤',
			email: '📧',
			project: '📦',
			target: '🎯',
			environment: '🌍'
		};

		// Try exact match first
		const lowerKey: string = key.toLowerCase();
		if (iconMap[lowerKey]) {
			return iconMap[lowerKey];
		}

		// Try partial match
		for (const [pattern, icon] of Object.entries(iconMap)) {
			if (lowerKey.includes(pattern)) {
				return icon;
			}
		}

		return '•';
	}

	/**
	 * Format metadata object for display
	 */
	public static formatMetadata(
		metadata: Record<string, unknown>,
		options: {
			showIcons?: boolean;
			indent?: string;
			filterEmpty?: boolean;
		} = {}
	): string[] {
		const {
			showIcons = true,
			indent = '   ',
			filterEmpty = true
		} = options;

		const lines: string[] = [];

		for (const [key, value] of Object.entries(metadata)) {
			// Skip empty values if filtering is enabled
			if (filterEmpty && (value === null || value === undefined || value === '')) {
				continue;
			}

			const icon: string = showIcons ? `${this.getIconForKey(key)} ` : '';
			const formattedKey: string = this.formatKey(key);
			const formattedValue: string = this.formatValue(value);

			lines.push(`${indent}${icon}${formattedKey}: ${formattedValue}`);
		}

		return lines;
	}

	/**
	 * Display formatted metadata to console
	 */
	public static displayMetadata(
		title: string,
		metadata: Record<string, unknown>,
		options?: {
			showIcons?: boolean;
			indent?: string;
			filterEmpty?: boolean;
		}
	): void {
		console.log(`${title}`);
		const lines: string[] = this.formatMetadata(metadata, options);
		lines.forEach((line: string): void => console.log(line));
	}
}