import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show } from 'solid-js';
import type { Accessor, JSX } from 'solid-js';

import { useAutoFitText } from '@hooks/system/useAutoFitText';
import { useSettings } from '@hooks/system/useSettings';

import type { Settings, StoryItem } from '@interfaces/application.interface';

import style from '@components/wb-app/wb-app.module.scss';

const paddedIndex = (index: number): string => String(index + 1).padStart(2, '0');

export default (props: { hostElement: HTMLDivElement }): JSX.Element => {
	const settings: Accessor<Settings> = useSettings();
	const [activeIndex, setActiveIndex] = createSignal<number>(0);
	const [renderReady, setRenderReady] = createSignal<boolean>(false);
	let rotationTimer: number | undefined;
	let firstLayoutFrame: number | undefined;
	let secondLayoutFrame: number | undefined;
	const enabledStories: Accessor<StoryItem[]> = createMemo((): StoryItem[] => {
		return settings().customContent.stories.filter((story: StoryItem): boolean => story.enabled);
	});
	const activeStory: Accessor<StoryItem | null> = createMemo((): StoryItem | null => {
		const stories: StoryItem[] = enabledStories();

		if (stories.length === 0) {
			return null;
		}

		return stories[activeIndex() % stories.length];
	});
	const titleFitRef = useAutoFitText({
		minFontSize: 46,
		maxFontSize: 136,
		watch: (): string => `${activeStory()?.layout}:${activeStory()?.title ?? ''}`
	});
	const bodyFitRef = useAutoFitText({
		minFontSize: 26,
		maxFontSize: 54,
		watch: (): string => `${activeStory()?.layout}:${activeStory()?.body ?? ''}`
	});
	const detailFitRef = useAutoFitText({
		minFontSize: 22,
		maxFontSize: 38,
		watch: (): string => activeStory()?.detail ?? ''
	});
	const rootStyle: Accessor<JSX.CSSProperties> = createMemo((): JSX.CSSProperties => ({
		'--wb-curated-storyline-ground': settings().backgroundColor,
		'--wb-curated-storyline-surface': settings().surfaceColor,
		'--wb-curated-storyline-text': settings().textColor,
		'--wb-curated-storyline-muted': settings().mutedTextColor,
		'--wb-curated-storyline-coral': settings().coralColor,
		'--wb-curated-storyline-cobalt': settings().cobaltColor,
		'--wb-curated-storyline-sun': settings().sunColor,
		'--wb-curated-storyline-mint': settings().mintColor
	}));

	createEffect(on(
		(): Settings['customContent'] => settings().customContent,
		(): void => {
			setActiveIndex(0);
		},
		{ defer: true }
	));

	createEffect((): void => {
		const storyCount: number = enabledStories().length;
		const rotationMs: number = settings().rotationSeconds * 1000;

		if (rotationTimer !== undefined) {
			window.clearInterval(rotationTimer);
			rotationTimer = undefined;
		}

		if (storyCount > 1) {
			rotationTimer = window.setInterval((): void => {
				setActiveIndex((currentIndex: number): number => (currentIndex + 1) % storyCount);
			}, rotationMs);
		}
	});

	onMount((): void => {
		firstLayoutFrame = window.requestAnimationFrame((): void => {
			firstLayoutFrame = undefined;
			secondLayoutFrame = window.requestAnimationFrame((): void => {
				secondLayoutFrame = undefined;
				setRenderReady(true);
			});
		});
	});

	onCleanup((): void => {
		if (rotationTimer !== undefined) {
			window.clearInterval(rotationTimer);
		}

		if (firstLayoutFrame !== undefined) {
			window.cancelAnimationFrame(firstLayoutFrame);
		}

		if (secondLayoutFrame !== undefined) {
			window.cancelAnimationFrame(secondLayoutFrame);
		}
	});

	return (
		<section
			class={style['wb-app']}
			data-host-ready={Boolean(props.hostElement)}
			data-theme={settings().themePreset}
			data-motion={settings().motionPreset}
			style={rootStyle()}
			aria-label={`${settings().customContent.venue} curated storyline`}
		>
			<span class={`wb-curated-storyline-render-ready ${style['render-ready']}`} aria-hidden="true">
				{renderReady() ? 'ready' : ''}
			</span>

			<header class={style['masthead']}>
				<div class={style['brand-lockup']}>
					<span class={style['brand-mark']} aria-hidden="true">N</span>
					<strong>{settings().customContent.venue}</strong>
				</div>
				<div class={style['collection-heading']}>
					<span>CURATED STORYLINE</span>
					<strong class="wb-curated-storyline-collection-title">{settings().customContent.title}</strong>
				</div>
				<p>{settings().customContent.deck}</p>
			</header>

			<div class={style['story-shell']}>
				<aside class={style['story-index']} aria-label="Published stories">
					<div>
						<span class={style['index-label']}>NOW SHOWING</span>
						<strong class={style['index-count']}>
							{enabledStories().length > 0 ? paddedIndex(activeIndex() % enabledStories().length) : '00'}
						</strong>
						<span class={style['index-total']}>/ {String(enabledStories().length).padStart(2, '0')}</span>
					</div>
					<Show when={settings().showProgress && enabledStories().length > 0}>
						<ol class={style['progress-list']}>
							<For each={enabledStories()}>{(story: StoryItem, index: Accessor<number>): JSX.Element => (
								<li data-active={index() === activeIndex() % enabledStories().length}>
									<span>{paddedIndex(index())}</span>
									<i aria-hidden="true" />
									<em>{story.label}</em>
								</li>
							)}</For>
						</ol>
					</Show>
				</aside>

				<main class={style['story-stage']}>
					<Show
						when={activeStory()}
						fallback={
							<div class={`wb-curated-storyline-empty ${style['empty-state']}`}>
								<span>STORYLINE PAUSED</span>
								<strong>No published stories</strong>
								<p>Open the storyline editor and enable at least one scene.</p>
							</div>
						}
					>
						{(story: Accessor<StoryItem>): JSX.Element => (
							<article
								class={`wb-curated-storyline-scene ${style['scene']}`}
								data-layout={story().layout}
								data-tone={story().tone}
								data-story-id={story().id}
							>
								<div class={style['accent-field']} aria-hidden="true">
									<span>{paddedIndex(activeIndex() % enabledStories().length)}</span>
									<i />
								</div>
								<div class={style['scene-copy']}>
									<span class={`wb-curated-storyline-label ${style['scene-label']}`}>{story().label}</span>
									<div ref={titleFitRef} class={style['title-fit']}>
										<h1 class={`wb-curated-storyline-title ${style['scene-title']}`}>{story().title}</h1>
									</div>
									<div ref={bodyFitRef} class={style['body-fit']}>
										<p class={`wb-curated-storyline-body ${style['scene-body']}`}>{story().body}</p>
									</div>
									<div ref={detailFitRef} class={`wb-curated-storyline-detail ${style['scene-detail']}`}>
										{story().detail}
									</div>
								</div>
								<div class={style['scene-rule']} aria-hidden="true" />
							</article>
						)}
					</Show>
				</main>
			</div>
		</section>
	);
};
