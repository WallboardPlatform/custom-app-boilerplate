import type { JSX } from 'solid-js';

/**
 * The thirteen glyphs this kiosk needs, drawn inline.
 *
 * An icon package is a runtime dependency for every app generated from this boilerplate, and the
 * legacy Chromium 56 bundle has to transpile whatever it pulls in. Inline paths cost nothing,
 * inherit `currentColor` so they follow the theme without extra wiring, and keep the icon set
 * visible in the source rather than behind an import.
 */

export type WbIconName =
	| 'chevron-left'
	| 'chevron-right'
	| 'close'
	| 'first-page'
	| 'keyboard'
	| 'landmark'
	| 'last-page'
	| 'pdf'
	| 'search'
	| 'touch'
	| 'universal-access'
	| 'zoom-in'
	| 'zoom-out';

export interface WbIconProps {
	name: WbIconName;
	size?: number;
}

const PATHS: Record<WbIconName, JSX.Element> = {
	'chevron-left': <polyline points="15 18 9 12 15 6" />,
	'chevron-right': <polyline points="9 18 15 12 9 6" />,
	'first-page': <><polyline points="17 18 11 12 17 6" /><line x1="7" y1="6" x2="7" y2="18" /></>,
	'last-page': <><polyline points="7 18 13 12 7 6" /><line x1="17" y1="6" x2="17" y2="18" /></>,
	'universal-access': (
		<>
			<circle cx="12" cy="12" r="10" />
			<circle cx="12" cy="7" r="1.4" fill="currentColor" />
			<path d="M7 10.5h10" />
			<path d="M12 10.5v4m0 0-2.5 5m2.5-5 2.5 5" />
		</>
	),
	'zoom-in': <><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="8" y1="11" x2="14" y2="11" /><line x1="11" y1="8" x2="11" y2="14" /></>,
	'zoom-out': <><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="8" y1="11" x2="14" y2="11" /></>,
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
	landmark: (
		<>
			<line x1="3" y1="21" x2="21" y2="21" />
			<line x1="4" y1="10" x2="4" y2="18" />
			<line x1="9" y1="10" x2="9" y2="18" />
			<line x1="15" y1="10" x2="15" y2="18" />
			<line x1="20" y1="10" x2="20" y2="18" />
			<polygon points="12 3 21 8 3 8" />
		</>
	),
	pdf: (
		<>
			<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
			<polyline points="14 3 14 8 19 8" />
			<line x1="9" y1="13" x2="15" y2="13" />
			<line x1="9" y1="17" x2="13" y2="17" />
		</>
	),
	search: <><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>,
	touch: (
		<>
			<path d="M9 11V6a2 2 0 0 1 4 0v6" />
			<path d="M13 10a2 2 0 0 1 4 0v2" />
			<path d="M17 11a2 2 0 0 1 4 0v3a7 7 0 0 1-7 7h-1a7 7 0 0 1-7-7v-1a2 2 0 0 1 4 0" />
		</>
	)
};

export default (props: WbIconProps): JSX.Element => {
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
