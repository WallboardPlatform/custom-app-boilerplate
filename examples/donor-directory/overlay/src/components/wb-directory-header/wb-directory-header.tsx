import { createEffect, createSignal, Show } from 'solid-js';
import type { JSX } from 'solid-js';

import { useAutoFitText } from '@hooks/system/useAutoFitText';

import style from './wb-directory-header.module.scss';

export interface WbDirectoryHeaderProps {
	dateText: string;
	layout: 'landscape' | 'portrait' | 'square';
	logoScale: number;
	logoUrl: string;
	subtitle: string;
	timeText: string;
	title: string;
	titleFontSize: number;
}

export default (props: WbDirectoryHeaderProps): JSX.Element => {
	const [logoFailed, setLogoFailed] = createSignal(false);
	const fitTitle = useAutoFitText({
		minFontSize: 18,
		maxFontSize: 96,
		widthOnly: false,
		watch: (): string => [props.title, props.titleFontSize, props.layout].join('|')
	});

	createEffect((): void => {
		if (typeof props.logoUrl === 'string') {
			setLogoFailed(false);
		}
	});

	return (
		<header class={style.header} data-layout={props.layout} data-preview-id="donor-header">
			<Show when={props.subtitle}>
				<div class={style.strap}>
					<p class={`${style.subtitle} wb-donor-directory-subtitle`}>{props.subtitle}</p>
				</div>
			</Show>

			<div class={style.primary}>
				<div
					class={style.logo}
					style={{ '--wb-donor-directory-logo-scale': `${props.logoScale}%` }}
					data-preview-id="donor-logo-region"
				>
					<Show when={props.logoUrl && !logoFailed()}>
						<img
							src={props.logoUrl}
							alt=""
							onError={(): void => {
								setLogoFailed(true);
							}}
						/>
					</Show>
				</div>

				<div class={style.copy}>
					<h1
						ref={fitTitle}
						class={`${style.title} wb-donor-directory-title`}
						data-preview-id="donor-title"
						style={{ '--wb-donor-directory-title-size': `${props.titleFontSize}px` }}
					>
						{props.title}
					</h1>
				</div>

				<div class={style.meta} data-preview-id="header-meta">
					<Show when={props.timeText}>
						<strong class="wb-donor-directory-meta">{props.timeText}</strong>
					</Show>
					<Show when={props.dateText}>
						<span class="wb-donor-directory-meta">{props.dateText}</span>
					</Show>
				</div>
			</div>
		</header>
	);
};
