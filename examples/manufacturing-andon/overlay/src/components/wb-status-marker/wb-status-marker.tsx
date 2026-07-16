import type { JSX } from 'solid-js';

import type { AndonTone } from '@interfaces/andon.interface';

import style from '@components/wb-status-marker/wb-status-marker.module.scss';

const glyphByTone: Record<AndonTone, string> = {
	normal: 'OK',
	attention: '!',
	stopped: 'X',
	unknown: '?'
};

export default (props: { size: 'hero' | 'row' | 'legend'; tone: AndonTone }): JSX.Element => {
	return (
		<span
			aria-hidden="true"
			class={`state-marker ${style['state-marker']} ${style[`state-marker--${props.size}`]} ${style[`state-marker--${props.tone}`]}`}
		>
			<span class={style['state-marker__glyph']}>{glyphByTone[props.tone]}</span>
		</span>
	);
};
