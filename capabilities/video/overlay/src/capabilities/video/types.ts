import type { Accessor, JSX } from 'solid-js';

export type VideoFit = 'contain' | 'cover' | 'fill';
export type VideoRepeat = 'none' | 'item' | 'playlist';
export type VideoStatus = 'empty' | 'loading' | 'playing' | 'paused' | 'ended' | 'error';

export interface VideoCaptionTrack {
	default?: boolean;
	label: string;
	language: string;
	src: string;
}

export interface VideoSource {
	captions?: VideoCaptionTrack[];
	id: string;
	name: string;
	poster?: string;
	type?: string;
	url: string;
}

export interface VideoPlayerOptions {
	advanceOnError?: boolean;
	autoplay?: boolean;
	controls?: boolean;
	fit?: VideoFit;
	muted?: boolean;
	preload?: 'auto' | 'metadata' | 'none';
	repeat?: VideoRepeat;
	retryCount?: number;
	showCaptions?: boolean;
	startAtSeconds?: number;
	volume?: number;
}

export interface VideoPlayerState {
	currentIndex: number;
	currentSource?: VideoSource;
	duration: number;
	error: string;
	position: number;
	progress: number;
	status: VideoStatus;
}

export type VideoInteractionType =
	| 'source-change'
	| 'started'
	| 'paused'
	| 'progress'
	| 'completed'
	| 'error';

export interface VideoInteractionEvent {
	duration: number;
	index: number;
	position: number;
	source?: VideoSource;
	type: VideoInteractionType;
	value?: unknown;
}

export interface VideoPlayerController {
	destroy(): void;
	next(): void;
	pause(): void;
	play(): Promise<void>;
	previous(): void;
	reload(): void;
	seek(seconds: number): void;
	select(indexOrId: number | string): void;
	setMuted(muted: boolean): void;
	setVolume(volume: number): void;
	state: Accessor<VideoPlayerState>;
	toggle(): Promise<void>;
}

export interface VideoPlayerProps {
	class?: string;
	emptyFallback?: JSX.Element;
	errorFallback?: (message: string, retry: () => void) => JSX.Element;
	onController?: (controller: VideoPlayerController) => void;
	onInteraction?: (event: VideoInteractionEvent) => void;
	onStateChange?: (state: VideoPlayerState) => void;
	options?: VideoPlayerOptions;
	sources: VideoSource[];
}

export interface HlsErrorData {
	fatal?: boolean;
	type?: string;
}

export interface HlsInstance {
	attachMedia(media: HTMLMediaElement): void;
	destroy(): void;
	loadSource(source: string): void;
	recoverMediaError(): void;
	startLoad(): void;
	on(event: string, callback: (event: string, data: HlsErrorData) => void): void;
}

export interface HlsConstructor {
	Events: { ERROR: string; MANIFEST_PARSED: string };
	ErrorTypes: { MEDIA_ERROR: string; NETWORK_ERROR: string };
	isSupported(): boolean;
	new (): HlsInstance;
}
