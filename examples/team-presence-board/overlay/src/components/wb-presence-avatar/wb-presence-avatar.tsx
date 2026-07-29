import { createMemo, createSignal, Match, Show, Switch } from 'solid-js';
import type { Accessor, JSX } from 'solid-js';

import { initials, initialsHue } from '@utils/presence';

import type { PresencePerson } from '@interfaces/presence.interface';

import style from '@components/wb-presence-avatar/wb-presence-avatar.module.scss';

export default (props: { person: PresencePerson; feature?: boolean }): JSX.Element => {
	const [photoFailed, setPhotoFailed] = createSignal<boolean>(false);
	const photoSIG: Accessor<string | undefined> = createMemo((): string | undefined => {
		return photoFailed() ? undefined : props.person.photo;
	});

	return (
		<div
			class={`wb-presence-avatar ${style['wb-presence-avatar']}`}
			classList={{ 'wb-presence-avatar--feature': Boolean(props.feature) }}
			data-group={props.person.group}
		>
			<span class="wb-presence-avatar-media">
				<Show
					when={photoSIG()}
					fallback={
						<span class="wb-presence-initials" style={{ 'background-color': initialsHue(props.person.rosterIndex) }}>
							{initials(props.person.name)}
						</span>
					}
				>
					<img
						src={photoSIG()}
						alt=""
						onError={(): void => {
							setPhotoFailed(true);
						}}
					/>
				</Show>
			</span>
			<span class="wb-presence-ring-pulse" />
			<span class="wb-presence-badge">
				<Switch>
					<Match when={props.person.group === 'available'}>
						<svg viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">
							<path d="M5 12.5l4.5 4.5L19 7" />
						</svg>
					</Match>
					<Match when={props.person.group === 'busy'}>
						<svg viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3.4" stroke-linecap="round">
							<path d="M6.5 12h11" />
						</svg>
					</Match>
					<Match when={props.person.group === 'away'}>
						<svg viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
							<circle cx="12" cy="12" r="8" />
							<path d="M12 7.5V12l3 2.4" />
						</svg>
					</Match>
					<Match when={props.person.group === 'offline'}>
						<svg viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3.2" stroke-linecap="round">
							<path d="M7.5 7.5l9 9M16.5 7.5l-9 9" />
						</svg>
					</Match>
				</Switch>
			</span>
		</div>
	);
};
