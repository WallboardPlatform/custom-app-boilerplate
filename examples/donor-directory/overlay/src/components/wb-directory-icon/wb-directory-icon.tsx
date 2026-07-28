import type { JSX } from 'solid-js';

/**
 * The five icons this app needs, drawn inline.
 *
 * An icon set is a runtime dependency for every app generated from this boilerplate, which is a
 * high price for five glyphs used in one widget. Inline paths cost nothing, inherit `currentColor`
 * so they follow the theme without extra wiring, and keep the legacy Chromium 56 bundle free of
 * another package to transpile.
 */

export interface WbDirectoryIconProps {
	name: 'chevron-left' | 'chevron-right' | 'close' | 'keyboard' | 'search';
	size?: number;
}

const PATHS: Record<WbDirectoryIconProps['name'], JSX.Element> = {
	'chevron-left': <polyline points="15 18 9 12 15 6" />,
	'chevron-right': <polyline points="9 18 15 12 9 6" />,
	close: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
	keyboard: (
		<>
			<rect x="2" y="6" width="20" height="12" rx="2" />
			<line x1="6" y1="10" x2="6" y2="10" />
			<line x1="10" y1="10" x2="10" y2="10" />
			<line x1="14" y1="10" x2="14" y2="10" />
			<line x1="18" y1="10" x2="18" y2="10" />
			<line x1="7" y1="14" x2="17" y2="14" />
		</>
	),
	search: <><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>
};

export default (props: WbDirectoryIconProps): JSX.Element => {
	return (
		<svg
			aria-hidden="true"
			width={props.size ?? 24}
			height={props.size ?? 24}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width={2}
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			{PATHS[props.name]}
		</svg>
	);
};
