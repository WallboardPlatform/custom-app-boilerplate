import { onCleanup } from 'solid-js';
import type { JSX } from 'solid-js';

import WbPresenceAvatar from '@components/wb-presence-avatar/wb-presence-avatar';

import type { PresencePerson } from '@interfaces/presence.interface';

import style from '@components/wb-presence-card/wb-presence-card.module.scss';

export default (props: {
	person: PresencePerson;
	statusText: (person: PresencePerson) => string;
	registerRef: (key: string, element: HTMLElement) => void;
	unregisterRef: (key: string, element: HTMLElement) => void;
}): JSX.Element => {
	let rootRef: HTMLElement | undefined;

	onCleanup((): void => {
		if (rootRef) {
			props.unregisterRef(props.person.key, rootRef);
		}
	});

	return (
		<article
			class={`wb-presence-card ${style['wb-presence-card']}`}
			data-group={props.person.group}
			data-person={props.person.key}
			ref={(element: HTMLElement): void => {
				rootRef = element;
				props.registerRef(props.person.key, element);
			}}
		>
			<WbPresenceAvatar person={props.person} />
			<h3 class="wb-presence-card-name" title={props.person.name}>{props.person.name}</h3>
			<p class="wb-presence-card-status">{props.statusText(props.person)}</p>
		</article>
	);
};
