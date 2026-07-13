import DOMPurify from 'dompurify';

type SanitizeMode = 'svg' | 'html';

/**
 * Default SVG sanitization config.
 * USE_PROFILES: { svg: true } already includes ~58 standard SVG attributes
 * (fill, stroke, d, cx, cy, transform, viewBox, etc.)
 *
 * ADD_TAGS / ADD_ATTR: only non-standard extras that the SVG profile doesn't cover.
 * FORBID_TAGS: XSS vectors explicitly blocked even if the profile would allow them.
 *
 * Extend these arrays per-widget if needed. For example, the Map widget requires
 * 'inkscape:label' for Inkscape-exported SVGs:
 *
 *   SVG_EXTRA_ATTR.push('inkscape:label');
 */
const SVG_EXTRA_TAGS: string[] = ['use'];
const SVG_EXTRA_ATTR: string[] = ['xlink:href', 'dominant-baseline', 'label'];
const SVG_FORBID_TAGS: string[] = ['foreignObject', 'script'];

const SVG_CONFIG: DOMPurify.Config = {
	USE_PROFILES: { svg: true, svgFilters: true },
	ADD_TAGS: SVG_EXTRA_TAGS,
	ADD_ATTR: SVG_EXTRA_ATTR,
	FORBID_TAGS: SVG_FORBID_TAGS
};

const HTML_CONFIG: DOMPurify.Config = {
	ALLOWED_TAGS: ['p', 'span', 'b', 'i', 'em', 'strong', 'br', 'u', 'sub', 'sup', 'div'],
	ALLOWED_ATTR: ['class', 'style']
};

/**
 * Sanitizes untrusted HTML or SVG strings to prevent XSS injection.
 *
 * @param dirty - The untrusted string to sanitize
 * @param mode - 'svg' for SVG markup (maps, shapes), 'html' for rich text (descriptions, labels)
 * @returns Sanitized string safe for innerHTML usage
 *
 * @example
 * ```ts
 * container.innerHTML = sanitize(svgString, 'svg');
 * element.innerHTML = sanitize(description, 'html');
 * ```
 */
export function sanitize(dirty: string, mode: SanitizeMode): string {
	if (!dirty) {
		return '';
	}

	return DOMPurify.sanitize(dirty, mode === 'svg' ? SVG_CONFIG : HTML_CONFIG);
}

export { SVG_EXTRA_TAGS, SVG_EXTRA_ATTR, SVG_FORBID_TAGS };
