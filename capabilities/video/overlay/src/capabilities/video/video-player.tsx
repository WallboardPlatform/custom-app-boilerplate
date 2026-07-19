import { createEffect, createSignal, For, onCleanup, Show, untrack } from 'solid-js';
import type { JSX } from 'solid-js';

import * as HlsModule from './vendor/hls.min.js';

import { isHlsSource } from './source';
import type {
	HlsErrorData,
	HlsConstructor,
	HlsInstance,
	VideoInteractionEvent,
	VideoPlayerController,
	VideoPlayerOptions,
	VideoPlayerProps,
	VideoPlayerState,
	VideoSource,
	VideoStatus
} from './types';

import style from './video-player.module.scss';

const bounded = (value: number, minimum: number, maximum: number): number => {
	return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));
};

const resolveHlsConstructor = (): HlsConstructor | undefined => {
	const imported = HlsModule as unknown as Partial<HlsConstructor> & { default?: HlsConstructor };
	if (typeof imported.default === 'function') return imported.default;
	if (typeof imported.isSupported === 'function') return imported as HlsConstructor;
	return typeof window === 'undefined' ? undefined : window.Hls;
};

const defaultOptions = (options: VideoPlayerOptions | undefined): Required<VideoPlayerOptions> => ({
	advanceOnError: options?.advanceOnError ?? true,
	autoplay: options?.autoplay ?? true,
	controls: options?.controls ?? false,
	fit: options?.fit ?? 'cover',
	muted: options?.muted ?? true,
	preload: options?.preload ?? 'auto',
	repeat: options?.repeat ?? 'playlist',
	retryCount: Math.round(bounded(options?.retryCount ?? 2, 0, 5)),
	showCaptions: options?.showCaptions ?? true,
	startAtSeconds: bounded(options?.startAtSeconds ?? 0, 0, Number.MAX_SAFE_INTEGER),
	volume: bounded(options?.volume ?? 1, 0, 1)
});

const emptyState = (): VideoPlayerState => ({
	currentIndex: 0,
	duration: 0,
	error: '',
	position: 0,
	progress: 0,
	status: 'empty'
});

export const VideoPlayer = (props: VideoPlayerProps): JSX.Element => {
	const [currentIndex, setCurrentIndex] = createSignal(0);
	const [reloadVersion, setReloadVersion] = createSignal(0);
	const [state, setState] = createSignal<VideoPlayerState>(emptyState());
	let videoElement: HTMLVideoElement | undefined;
	let hls: HlsInstance | undefined;
	let destroyed = false;
	let retryTimer: ReturnType<typeof setTimeout> | undefined;
	let retryAttempt = 0;
	let lastProgressMilestone = 0;
	let loadedSourceKey = '';

	const options = (): Required<VideoPlayerOptions> => defaultOptions(props.options);
	const sources = (): VideoSource[] => props.sources.filter((source: VideoSource): boolean => Boolean(source.url));
	const activeSource = (): VideoSource | undefined => sources()[currentIndex()];

	const updateState = (status?: VideoStatus, overrides: Partial<VideoPlayerState> = {}): void => {
		const currentState: VideoPlayerState = untrack(state);
		const duration: number = videoElement && Number.isFinite(videoElement.duration) ? videoElement.duration : currentState.duration;
		const position: number = videoElement && Number.isFinite(videoElement.currentTime) ? videoElement.currentTime : currentState.position;
		const next: VideoPlayerState = {
			...currentState,
			currentIndex: currentIndex(),
			currentSource: activeSource(),
			duration,
			position,
			progress: duration > 0 ? bounded(position / duration, 0, 1) : 0,
			status: status ?? state().status,
			...overrides
		};

		setState(next);
		props.onStateChange?.(next);
	};

	const emit = (type: VideoInteractionEvent['type'], value?: unknown): void => {
		const currentState: VideoPlayerState = untrack(state);
		props.onInteraction?.({
			duration: currentState.duration,
			index: currentIndex(),
			position: currentState.position,
			source: activeSource(),
			type,
			value
		});
	};

	const clearRetry = (): void => {
		if (retryTimer) clearTimeout(retryTimer);
		retryTimer = undefined;
	};

	const destroyHls = (): void => {
		hls?.destroy();
		hls = undefined;
	};

	const play = async (): Promise<void> => {
		if (!videoElement || !activeSource()) return;

		try {
			await videoElement.play();
		} catch (reason: unknown) {
			if (!options().muted && videoElement) {
				videoElement.muted = true;
				try {
					await videoElement.play();
					return;
				} catch {
					// The player remains paused until a user or external command starts it.
				}
			}

			updateState('paused', { error: reason instanceof Error ? reason.message : 'Playback requires user interaction.' });
		}
	};

	const pause = (): void => {
		videoElement?.pause();
	};

	const select = (indexOrId: number | string): void => {
		const list: VideoSource[] = sources();
		if (list.length === 0) return;

		const requested: number = typeof indexOrId === 'number'
			? indexOrId
			: list.findIndex((source: VideoSource): boolean => source.id === indexOrId || source.name === indexOrId);
		if (!Number.isFinite(requested) || requested < 0 || requested >= list.length) return;

		setCurrentIndex(Math.floor(requested));
	};

	const next = (): void => {
		const length: number = sources().length;
		if (length === 0) return;
		setCurrentIndex((currentIndex() + 1) % length);
	};

	const previous = (): void => {
		const length: number = sources().length;
		if (length === 0) return;
		setCurrentIndex((currentIndex() - 1 + length) % length);
	};

	const reload = (): void => {
		retryAttempt = 0;
		setReloadVersion((version: number): number => version + 1);
	};

	const controller: VideoPlayerController = {
		destroy: (): void => {
			destroyed = true;
			clearRetry();
			destroyHls();
			videoElement?.pause();
			videoElement?.removeAttribute('src');
			videoElement?.load();
		},
		next,
		pause,
		play,
		previous,
		reload,
		seek: (seconds: number): void => {
			if (!videoElement || !Number.isFinite(seconds)) return;
			videoElement.currentTime = bounded(seconds, 0, Number.isFinite(videoElement.duration) ? videoElement.duration : seconds);
		},
		select,
		setMuted: (muted: boolean): void => {
			if (videoElement) videoElement.muted = muted;
		},
		setVolume: (volume: number): void => {
			if (videoElement) videoElement.volume = bounded(volume, 0, 1);
		},
		state,
		toggle: async (): Promise<void> => {
			if (videoElement?.paused) await play();
			else pause();
		}
	};

	createEffect((): void => props.onController?.(controller));

	createEffect((): void => {
		const list: VideoSource[] = sources();
		if (list.length === 0) {
			setCurrentIndex(0);
			updateState('empty', { currentSource: undefined, error: '' });
			return;
		}

		if (currentIndex() >= list.length) setCurrentIndex(0);
	});

	createEffect((): void => {
		reloadVersion();
		const source: VideoSource | undefined = activeSource();
		const element: HTMLVideoElement | undefined = videoElement;
		if (!element || !source) return;
		const sourceKey = `${source.id ?? ''}\n${source.url}`;
		const sourceChanged = sourceKey !== loadedSourceKey;

		clearRetry();
		destroyHls();
		if (sourceChanged) retryAttempt = 0;
		loadedSourceKey = sourceKey;
		lastProgressMilestone = 0;
		element.pause();
		element.removeAttribute('src');
		element.load();
		updateState('loading', { duration: 0, error: '', position: 0, progress: 0 });
		if (sourceChanged) emit('source-change');

		const Hls: HlsConstructor | undefined = resolveHlsConstructor();
		if (isHlsSource(source) && !element.canPlayType('application/vnd.apple.mpegurl') && Hls?.isSupported()) {
			const instance: HlsInstance = new Hls();
			hls = instance;
			instance.on(Hls.Events.ERROR, (_event: string, data: HlsErrorData): void => {
				if (!data.fatal) return;
				if (data.type === Hls.ErrorTypes.NETWORK_ERROR) instance.startLoad();
				else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) instance.recoverMediaError();
				else handleError();
			});
			instance.loadSource(source.url);
			instance.attachMedia(element);
		} else {
			element.src = source.url;
		}

		element.load();
		if (untrack((): boolean => options().autoplay)) void play();
	});

	createEffect((): void => {
		const element: HTMLVideoElement | undefined = videoElement;
		const resolved = options();
		if (!element) return;

		element.controls = resolved.controls;
		element.muted = resolved.muted;
		element.volume = resolved.volume;
	});

	const handleLoadedMetadata = (): void => {
		if (!videoElement) return;
		retryAttempt = 0;
		if (options().startAtSeconds > 0 && videoElement.currentTime === 0) {
			videoElement.currentTime = Math.min(options().startAtSeconds, videoElement.duration || options().startAtSeconds);
		}
		updateState(videoElement.paused ? 'paused' : 'playing', { error: '' });
	};

	const handlePlay = (): void => {
		updateState('playing', { error: '' });
		emit('started');
	};

	const handlePause = (): void => {
		if (state().status === 'ended' || state().status === 'error') return;
		updateState('paused');
		emit('paused');
	};

	const handleTimeUpdate = (): void => {
		updateState();
		const milestone: number = Math.floor(state().progress * 4) * 25;
		if (milestone > 0 && milestone < 100 && milestone > lastProgressMilestone) {
			lastProgressMilestone = milestone;
			emit('progress', { percent: milestone });
		}
	};

	const handleEnded = (): void => {
		updateState('ended');
		emit('completed');
		if (options().repeat === 'item') {
			if (videoElement) videoElement.currentTime = 0;
			void play();
		} else if (options().repeat === 'playlist' || currentIndex() < sources().length - 1) {
			next();
		}
	};

	function handleError(): void {
		if (destroyed) return;
		const source: VideoSource | undefined = activeSource();
		const message = `Unable to play ${source?.name || 'the selected video'}.`;

		if (retryAttempt < options().retryCount) {
			retryAttempt += 1;
			updateState('loading', { error: `${message} Retrying ${retryAttempt}/${options().retryCount}.` });
			clearRetry();
			retryTimer = setTimeout(
				(): void => {
					setReloadVersion((version: number): number => version + 1);
				},
				600 * retryAttempt
			);
			return;
		}

		updateState('error', { error: message });
		emit('error', { message });
		if (options().advanceOnError && sources().length > 1) next();
	}

	onCleanup((): void => controller.destroy());

	return (
		<div
			class={`${style.root} ${props.class ?? ''}`}
			data-source-count={sources().length}
			data-status={state().status}
			style={{ '--wb-video-fit': options().fit }}
		>
			<Show when={activeSource()} fallback={props.emptyFallback ?? <div class={style.message}>No video source configured.</div>}>
				<video
					ref={videoElement}
					class={style.video}
					controls={options().controls}
					muted={options().muted}
					playsinline
					poster={activeSource()?.poster}
					preload={options().preload}
					onEnded={handleEnded}
					onError={handleError}
					onLoadedMetadata={handleLoadedMetadata}
					onPause={handlePause}
					onPlay={handlePlay}
					onTimeUpdate={handleTimeUpdate}
				>
					<Show when={options().showCaptions}>
						<For each={activeSource()?.captions ?? []}>
							{(track) => <track default={track.default} kind="captions" label={track.label} src={track.src} srclang={track.language} />}
						</For>
					</Show>
				</video>
				<Show when={state().status === 'error'}>
					{props.errorFallback?.(state().error, reload) ?? <div class={style.message}>{state().error}</div>}
				</Show>
			</Show>
		</div>
	);
};
