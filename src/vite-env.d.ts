declare module '*.scss' {
	const classes: { [key: string]: string };
	export default classes;
}

declare module '*.svg' {
	import type { JSX } from 'solid-js';
	const content: (props: JSX.SvgSVGAttributes<SVGSVGElement>) => JSX.Element;
	export default content;
}

declare interface ImportMeta {
	env: {
		MODE: string;
	};
}