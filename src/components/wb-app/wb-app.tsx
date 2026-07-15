import { createMemo } from 'solid-js';
import type { Accessor, JSX } from 'solid-js';

import { useSettings } from '@hooks/system/useSettings';

import type { Settings } from '@interfaces/application.interface';

import style from '@components/wb-app/wb-app.module.scss';

export default (props: { hostElement: HTMLDivElement }): JSX.Element => {
	const settings: Accessor<Settings> = useSettings();
	const themeStyle: Accessor<JSX.CSSProperties> = createMemo((): JSX.CSSProperties => ({
		'--starter-accent': settings().accentColor,
		'--starter-background': settings().backgroundColor,
		'--starter-text': settings().textColor
	}));

	return (
		<div
			class={`wb-app ${style['wb-app']}`}
			data-host-ready={Boolean(props.hostElement)}
			style={themeStyle()}
		>
			<span>WALLBOARD CUSTOM APP</span>
			<h1>{settings().title}</h1>
		</div>
	);
};
