declare module '*.scss' {
	const classes: { [key: string]: string };
	export default classes;
}

declare module '*.svg' {
	import type { JSX } from 'solid-js';
	const content: (props: JSX.SvgSVGAttributes<SVGSVGElement>) => JSX.Element;
	export default content;
}

declare module '*.svg?raw' {
	const content: string;
	export default content;
}

declare interface ImportMeta {
	env: {
		MODE: string;
	};
}

declare module '*.png' {
	const source: string;
	export default source;
}

declare module '*.jpg' {
	const source: string;
	export default source;
}

declare module '*.jpeg' {
	const source: string;
	export default source;
}

declare module '*.webp' {
	const source: string;
	export default source;
}
