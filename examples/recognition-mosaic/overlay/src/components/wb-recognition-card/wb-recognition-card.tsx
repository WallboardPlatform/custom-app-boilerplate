import { createEffect, createMemo, createSignal, on, Show } from 'solid-js';
import type { Accessor, JSX } from 'solid-js';

import type { Recognition } from '@interfaces/recognition.interface';

import { recognitionInitials } from '@utils/recognition';

import style from '@components/wb-recognition-card/wb-recognition-card.module.scss';

type RecognitionTone = 'accent' | 'highlight' | 'cool' | 'surface';

const tones: RecognitionTone[] = ['accent', 'highlight', 'cool', 'surface'];

export default (props: {
	recognition: Recognition;
	position: number;
	lead?: boolean;
	showQuote: boolean;
}): JSX.Element => {
	const [imageFailed, setImageFailed] = createSignal<boolean>(false);
	const [imageLoaded, setImageLoaded] = createSignal<boolean>(false);
	const tone: Accessor<RecognitionTone> = createMemo((): RecognitionTone => {
		return tones[props.position % tones.length] ?? 'surface';
	});
	const hasImageSource: Accessor<boolean> = createMemo((): boolean => {
		return Boolean(props.recognition.imageUrl);
	});
	const showFallback: Accessor<boolean> = createMemo((): boolean => {
		return !hasImageSource() || imageFailed() || !imageLoaded();
	});

	createEffect(on(
		(): string => props.recognition.imageUrl,
		(): void => {
			setImageFailed(false);
			setImageLoaded(false);
		}
	));

	return (
		<article
			class={`recognition-card ${style['recognition-card']}`}
			classList={{
				'recognition-card--lead': Boolean(props.lead),
				[style['recognition-card--lead']]: Boolean(props.lead)
			}}
			data-person={props.recognition.name}
			data-tone={tone()}
		>
			<div class="recognition-card__media">
				<Show when={hasImageSource()}>
					<img
						alt=""
						classList={{ 'recognition-card__image--loading': showFallback() }}
						draggable={false}
						src={props.recognition.imageUrl}
						onLoad={(): void => {
							setImageLoaded(true);
						}}
						onError={(): void => {
							setImageFailed(true);
						}}
					/>
				</Show>
				<Show when={showFallback()}>
					<div class="recognition-card__initials" aria-label={`${props.recognition.name} portrait unavailable`}>
						<span>{recognitionInitials(props.recognition.name)}</span>
						<i aria-hidden="true" />
					</div>
				</Show>
				<span class="recognition-card__number" aria-hidden="true">
					{String(props.position + 1).padStart(2, '0')}
				</span>
			</div>
			<div class="recognition-card__copy">
				<div class="recognition-card__meta">
					<span class="recognition-card__team">{props.recognition.team}</span>
					<span class="recognition-card__role">{props.recognition.role}</span>
				</div>
				<h2 class="recognition-card__name">{props.recognition.name}</h2>
				<p class="recognition-card__achievement">{props.recognition.achievement}</p>
				<Show when={props.showQuote && props.recognition.quote}>
					<blockquote class="recognition-card__quote">{props.recognition.quote}</blockquote>
				</Show>
			</div>
		</article>
	);
};
