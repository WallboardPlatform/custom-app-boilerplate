export interface FeedStory {
	id: string;
	title: string;
	description: string;
	imageUrl: string;
	category: string;
	publishedAt?: number;
}

export type FeedSource = 'wallboard-feed' | 'rss-parser' | 'rss-channel' | 'array' | 'unknown';
