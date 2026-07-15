import { createEffect, createMemo, createSignal, For, onCleanup, Show } from 'solid-js';
import type { Accessor, JSX } from 'solid-js';

import { useDataSources } from '@hooks/system/useDataSources';
import { useSettings } from '@hooks/system/useSettings';

import type { DataSources, Settings } from '@interfaces/application.interface';
import type { FeedSource, FeedStory } from '@interfaces/feed.interface';

import style from '@components/wb-app/wb-app.module.scss';

interface FeedModel {
	stories: FeedStory[];
	source: FeedSource;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const parseValue = (value: unknown): unknown => {
	if (typeof value !== 'string') {
		return value;
	}

	try {
		return JSON.parse(value) as unknown;
	} catch {
		return value;
	}
};

const plainText = (value: unknown): string => {
	if (typeof value !== 'string' && typeof value !== 'number') {
		return '';
	}

	const container: HTMLDivElement = document.createElement('div');
	container.innerHTML = String(value);

	return (container.textContent ?? '').replace(/\s+/g, ' ').trim();
};

const timestampValue = (value: unknown): number | undefined => {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value < 100000000000 ? value * 1000 : value;
	}

	const text: string = plainText(value);

	if (!text) {
		return undefined;
	}

	const numeric: number = Number(text);

	if (Number.isFinite(numeric) && numeric > 0) {
		return numeric < 100000000000 ? numeric * 1000 : numeric;
	}

	const parsed: number = Date.parse(text);

	return Number.isFinite(parsed) ? parsed : undefined;
};

const safeImageUrl = (value: unknown): string => {
	const url: string = plainText(value);

	if (!url) {
		return '';
	}

	if (/^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(url)) {
		return url;
	}

	try {
		const parsed: URL = new URL(url);

		return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? url : '';
	} catch {
		return '';
	}
};

const mediaUrl = (row: Record<string, unknown>): string => {
	if (isRecord(row.media)) {
		const value: string = safeImageUrl(row.media.url);

		if (value) {
			return value;
		}
	}

	if (isRecord(row.enclosure)) {
		const value: string = safeImageUrl(row.enclosure.url);

		if (value) {
			return value;
		}
	}

	if (Array.isArray(row.attachments)) {
		for (const attachment of row.attachments) {
			if (!isRecord(attachment)) {
				continue;
			}

			const type: string = plainText(attachment.type).toLowerCase();
			const value: string = safeImageUrl(attachment.url);

			if (value && (!type || type.indexOf('image') === 0)) {
				return value;
			}
		}
	}

	return safeImageUrl(row.image) || safeImageUrl(row.thumbnail);
};

const extractRows = (rawValue: unknown): { rows: unknown[]; source: FeedSource } => {
	const value: unknown = parseValue(rawValue);

	if (Array.isArray(value)) {
		return { rows: value, source: 'array' };
	}

	if (!isRecord(value)) {
		return { rows: [], source: 'unknown' };
	}

	if (Array.isArray(value.items)) {
		return { rows: value.items, source: 'wallboard-feed' };
	}

	if (isRecord(value.feed) && Array.isArray(value.feed.entries)) {
		return { rows: value.feed.entries, source: 'rss-parser' };
	}

	if (isRecord(value.channel) && Array.isArray(value.channel.item)) {
		return { rows: value.channel.item, source: 'rss-channel' };
	}

	if (isRecord(value.rss)) {
		const channel: unknown = Array.isArray(value.rss.channel) ? value.rss.channel[0] : value.rss.channel;

		if (isRecord(channel) && Array.isArray(channel.item)) {
			return { rows: channel.item, source: 'rss-channel' };
		}
	}

	return { rows: [], source: 'unknown' };
};

const normalizeFeed = (rawValue: unknown, maximum: number): FeedModel => {
	const extracted = extractRows(rawValue);
	const stories: Array<FeedStory & { sourceIndex: number }> = extracted.rows
		.map((rawRow: unknown, sourceIndex: number): (FeedStory & { sourceIndex: number }) | undefined => {
			if (!isRecord(rawRow)) {
				return undefined;
			}

			const title: string = plainText(rawRow.title) || plainText(rawRow.name);

			if (!title) {
				return undefined;
			}

			const categories: unknown[] = Array.isArray(rawRow.categories) ? rawRow.categories : [];
			const category: string = plainText(categories[0]) || plainText(rawRow.category) || 'Latest';

			return {
				id: plainText(rawRow.guid) || plainText(rawRow.id) || `${title}-${sourceIndex}`,
				title,
				description: plainText(rawRow.description) || plainText(rawRow.contentSnippet) || plainText(rawRow.summary) || plainText(rawRow.content),
				imageUrl: mediaUrl(rawRow),
				category,
				publishedAt: timestampValue(rawRow.publishDate) ?? timestampValue(rawRow.pubDate) ?? timestampValue(rawRow.date),
				sourceIndex
			};
		})
		.filter((story: (FeedStory & { sourceIndex: number }) | undefined): story is FeedStory & { sourceIndex: number } => Boolean(story))
		.sort((left, right): number => {
			if (left.publishedAt !== undefined && right.publishedAt !== undefined) {
				return right.publishedAt - left.publishedAt;
			}

			return left.sourceIndex - right.sourceIndex;
		})
		.slice(0, maximum);

	return {
		source: extracted.source,
		stories: stories.map((story): FeedStory => ({
			id: story.id,
			title: story.title,
			description: story.description,
			imageUrl: story.imageUrl,
			category: story.category,
			publishedAt: story.publishedAt
		}))
	};
};

const publishedLabel = (timestamp: number | undefined): string => {
	if (timestamp === undefined) {
		return '';
	}

	return new Date(timestamp).toLocaleDateString([], {
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	});
};

const twoDigits = (value: number): string => value < 10 ? `0${value}` : String(value);

export default (props: { hostElement: HTMLDivElement }): JSX.Element => {
	const dataSources: Accessor<DataSources> = useDataSources();
	const settings: Accessor<Settings> = useSettings();
	const [activeIndex, setActiveIndex] = createSignal(0);
	const [imageFailed, setImageFailed] = createSignal(false);
	const feed: Accessor<FeedModel> = createMemo((): FeedModel => {
		return normalizeFeed(dataSources().feedData?.value, settings().maxStories);
	});
	const featured: Accessor<FeedStory | undefined> = createMemo((): FeedStory | undefined => {
		const stories: FeedStory[] = feed().stories;

		return stories.length > 0 ? stories[activeIndex() % stories.length] : undefined;
	});
	const railStories: Accessor<FeedStory[]> = createMemo((): FeedStory[] => {
		const stories: FeedStory[] = feed().stories;
		const current: FeedStory | undefined = featured();

		return stories.filter((story: FeedStory): boolean => story.id !== current?.id).slice(0, 3);
	});
	const rootStyle: Accessor<JSX.CSSProperties> = createMemo((): JSX.CSSProperties => ({
		'--feed-background': settings().backgroundColor,
		'--feed-panel': settings().panelColor,
		'--feed-primary': settings().primaryTextColor,
		'--feed-secondary': settings().secondaryTextColor,
		'--feed-accent': settings().accentColor
	}));

	createEffect((): void => {
		const storyId: string | undefined = featured()?.id;

		if (storyId !== undefined) {
			setImageFailed(false);
		}
	});

	createEffect((): void => {
		const count: number = feed().stories.length;
		const intervalSeconds: number = settings().rotationSeconds;

		if (count <= 1) {
			setActiveIndex(0);

			return;
		}

		setActiveIndex((current: number): number => current % count);
		const timer: number = window.setInterval((): void => {
			setActiveIndex((current: number): number => (current + 1) % count);
		}, intervalSeconds * 1000);

		onCleanup((): void => window.clearInterval(timer));
	});

	return (
		<section
			class={`wb-app ${style['wb-app']}`}
			style={rootStyle()}
			data-feed-source={feed().source}
			data-image-position={settings().imagePosition}
			data-show-description={settings().showDescription ? 'true' : 'false'}
			data-show-timestamp={settings().showTimestamp ? 'true' : 'false'}
			data-host-ready={Boolean(props.hostElement)}
		>
			<Show when={featured()} fallback={<div class="feed-empty">{settings().emptyStateText}</div>}>
				{(story: Accessor<FeedStory>): JSX.Element => (
					<>
						<header class="feed-header">
							<span>{settings().sourceLabel}</span>
							<strong>{twoDigits(activeIndex() + 1)} / {twoDigits(feed().stories.length)}</strong>
						</header>

						<div class="feed-feature">
							<div class="story-media" data-media-state={story().imageUrl && !imageFailed() ? 'image' : 'fallback'}>
								<Show
									when={story().imageUrl && !imageFailed()}
									fallback={
										<div class="story-media-fallback">
											<i />
											<span>{story().category}</span>
										</div>
									}
								>
									<img
										src={story().imageUrl}
										alt={story().title}
										onError={(): void => {
											setImageFailed(true);
										}}
									/>
								</Show>
							</div>

							<article class="story-copy">
								<div class="story-meta">
									<span>{story().category}</span>
									<Show when={settings().showTimestamp && story().publishedAt !== undefined}>
										<time>{publishedLabel(story().publishedAt)}</time>
									</Show>
								</div>
								<h1 class="story-title">{story().title}</h1>
								<Show when={settings().showDescription && story().description}>
									<p class="story-description">{story().description}</p>
								</Show>
								<div class="story-rule"><i /></div>
							</article>
						</div>

						<Show when={railStories().length > 0}>
							<div class="story-rail">
								<For each={railStories()}>
									{(railStory: FeedStory, index: Accessor<number>): JSX.Element => (
										<article>
											<span>{twoDigits(index() + 2)}</span>
											<div>
												<strong>{railStory.category}</strong>
												<h2>{railStory.title}</h2>
											</div>
										</article>
									)}
								</For>
							</div>
						</Show>
					</>
				)}
			</Show>
		</section>
	);
};
