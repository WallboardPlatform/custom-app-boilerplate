import { createEffect, createMemo, createSignal, For, Show } from 'solid-js';
import type { Accessor, JSX } from 'solid-js';

import type { ApiService, IExternalCommandService } from 'wallboard-app-sdk';
import { useApiMethods } from 'wallboard-app-sdk';

import { getMetadata } from '@hooks/system/getMetadata';
import { useAutoFitText } from '@hooks/system/useAutoFitText';
import { useExternalCommandListener } from '@hooks/system/useExternalCommandListener';
import { useSettings } from '@hooks/system/useSettings';

import type { Settings } from '@interfaces/application.interface';

import { resolveTheme } from '@utils/theme';

import style from '@components/wb-app/wb-app.module.scss';

import { previewVideos } from '../../assets/preview-videos';
import { resolveVideoSources, VideoPlayer } from '../../capabilities/video';
import type {
	VideoInteractionEvent,
	VideoPlayerController,
	VideoPlayerState,
	VideoSource
} from '../../capabilities/video';

type ThemeTokens = Record<'accent' | 'background' | 'muted' | 'primary', string>;

const withAlpha = (color: string, alpha: number, fallback: string): string => {
	const normalized: string = color.trim();
	const shortHex = /^#([\da-f])([\da-f])([\da-f])$/i.exec(normalized);
	const fullHex = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(normalized);
	const channels: string[] | undefined = fullHex?.slice(1) ?? shortHex?.slice(1).map((channel: string): string => `${channel}${channel}`);

	if (!channels) return fallback;

	return `rgba(${channels.map((channel: string): number => Number.parseInt(channel, 16)).join(', ')}, ${alpha})`;
};

const PlaylistSource = (props: {
	active: boolean;
	index: number;
	onSelect: () => void;
	source: VideoSource;
}): JSX.Element => {
	const fitName = useAutoFitText({
		minFontSize: 28,
		maxFontSize: 32,
		widthOnly: true,
		watch: (): string => props.source.name
	});

	return (
		<button
			class={`${style.playlistItem} ${props.active ? style.active : ''}`}
			onClick={props.onSelect}
			type="button"
		>
			<span>{String(props.index + 1).padStart(2, '0')}</span>
			<strong ref={fitName} data-text-role="video-title">{props.source.name}</strong>
		</button>
	);
};

const captionDataUri = (label: string): string => {
	const vtt = `WEBVTT\n\n00:00.000 --> 00:01.200 line:72% position:50% align:middle\n${label}\n\n00:01.200 --> 00:02.400 line:72% position:50% align:middle\nLumen public media program\n`;
	return `data:text/vtt;charset=utf-8,${encodeURIComponent(vtt)}`;
};

const bundledSources = (): VideoSource[] => previewVideos.map((video, index): VideoSource => ({
	captions: [{ default: true, label: 'English', language: 'en', src: captionDataUri(video.label) }],
	id: `lumen-${index + 1}`,
	name: video.label,
	type: 'video/webm',
	url: video.dataUrl
}));

const formatTime = (seconds: number): string => {
	const safe: number = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
	return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
};

export default (props: { hostElement: HTMLDivElement }): JSX.Element => {
	const settings: Accessor<Settings> = useSettings();
	const api: ApiService = useApiMethods(getMetadata());
	const [controller, setController] = createSignal<VideoPlayerController>();
	const [sources, setSources] = createSignal<VideoSource[]>(bundledSources());
	const [sourceError, setSourceError] = createSignal('');
	const [playerState, setPlayerState] = createSignal<VideoPlayerState>({
		currentIndex: 0,
		currentSource: bundledSources()[0],
		duration: 0,
		error: '',
		position: 0,
		progress: 0,
		status: 'loading'
	});
	const fitCurrentTitle = useAutoFitText({
		minFontSize: 28,
		maxFontSize: 44,
		widthOnly: true,
		watch: (): string => playerState().currentSource?.name || 'Waiting for media'
	});
	let sourceGeneration = 0;

	const themeStyle: Accessor<JSX.CSSProperties> = createMemo((): JSX.CSSProperties => {
		const custom: ThemeTokens = {
			accent: settings().accentColor,
			background: settings().backgroundColor,
			muted: settings().mutedTextColor,
			primary: settings().primaryTextColor
		};
		const tokens: ThemeTokens = resolveTheme(settings().themePreset, {
			custom,
			dark: { accent: '#ff5a3d', background: '#080b0d', muted: '#b8c0c5', primary: '#f5f2e9' },
			light: { accent: '#c63824', background: '#f4efe7', muted: '#586268', primary: '#10171b' }
		});

		return {
			'--wb-lumen-media-program-accent': tokens.accent,
			'--wb-lumen-media-program-background': tokens.background,
			'--wb-lumen-media-program-chrome': withAlpha(tokens.background, 0.88, 'rgba(5, 8, 10, 0.88)'),
			'--wb-lumen-media-program-chrome-soft': withAlpha(tokens.background, 0.74, 'rgba(5, 8, 10, 0.74)'),
			'--wb-lumen-media-program-divider': withAlpha(tokens.primary, 0.18, 'rgba(255, 255, 255, 0.18)'),
			'--wb-lumen-media-program-muted': tokens.muted,
			'--wb-lumen-media-program-primary': tokens.primary,
			'--wb-lumen-media-program-selection': withAlpha(tokens.primary, 0.12, 'rgba(255, 255, 255, 0.12)'),
			'--wb-lumen-media-program-track': withAlpha(tokens.primary, 0.24, 'rgba(255, 255, 255, 0.24)')
		};
	});

	createEffect((): void => {
		const generation: number = sourceGeneration + 1;
		sourceGeneration = generation;
		setSourceError('');

		void resolveVideoSources({
			api,
			directSource: settings().videoFile,
			fallbackSources: bundledSources(),
			folder: settings().videoFolder,
			playlist: settings().playlistJson,
			recursive: settings().recursiveFolder,
			sourceMode: settings().sourceMode
		})
			.then((resolved: VideoSource[]): void => {
				if (generation === sourceGeneration) setSources(resolved);
			})
			.catch((reason: unknown): void => {
				if (generation !== sourceGeneration) return;
				setSources(bundledSources());
				setSourceError(reason instanceof Error ? reason.message : 'The configured video source could not be read.');
			});
	});

	const handleInteraction = (event: VideoInteractionEvent): void => {
		api.triggerSensorEvent('video-playback', {
			duration: event.duration,
			index: event.index,
			position: event.position,
			sourceId: event.source?.id,
			sourceName: event.source?.name,
			type: event.type,
			value: event.value
		});
	};

	useExternalCommandListener((command: IExternalCommandService): void => {
		const player: VideoPlayerController | undefined = controller();
		if (!player) return;

		switch (command.getCommand()) {
			case 'playVideo':
				void player.play();
				break;
			case 'pauseVideo':
				player.pause();
				break;
			case 'toggleVideo':
				void player.toggle();
				break;
			case 'nextVideo':
				player.next();
				break;
			case 'previousVideo':
				player.previous();
				break;
			case 'reloadVideo':
				player.reload();
				break;
			case 'selectVideo': {
				const id = command.getParameter('id');
				const index = Number(command.getParameter('index'));
				if (typeof id === 'string' && id) player.select(id);
				else if (Number.isFinite(index)) player.select(index);
				break;
			}
			case 'seekVideo': {
				const seconds = Number(command.getParameter('seconds'));
				if (Number.isFinite(seconds)) player.seek(seconds);
				break;
			}
			case 'setVideoVolume': {
				const volume = Number(command.getParameter('volume'));
				if (Number.isFinite(volume)) player.setVolume(volume > 1 ? volume / 100 : volume);
				break;
			}
			case 'muteVideo':
				player.setMuted(true);
				break;
			case 'unmuteVideo':
				player.setMuted(false);
				break;
		}
	});

	return (
		<main
			class={`${style.root} wb-lumen-media-program-root`}
			data-host-ready={Boolean(props.hostElement)}
			data-fit={settings().fit}
			data-volume={settings().volume}
			data-source-count={sources().length}
			data-status={playerState().status}
			data-theme={settings().themePreset}
			style={themeStyle()}
		>
			<VideoPlayer
				class={style.player}
				onController={setController}
				onInteraction={handleInteraction}
				onStateChange={setPlayerState}
				options={{
					advanceOnError: settings().advanceOnError,
					autoplay: settings().autoplay,
					controls: false,
					fit: settings().fit,
					muted: settings().muted,
					repeat: settings().repeat,
					retryCount: settings().retryCount,
					showCaptions: settings().showCaptions,
					startAtSeconds: settings().startAtSeconds,
					volume: settings().volume / 100
				}}
				sources={sources()}
			/>
			<div class={style.scrim} />
			<Show when={settings().showChrome}>
				<header class={style.header}>
					<div class={style.brandMark} aria-hidden="true">LM</div>
					<div class={style.brandCopy}>
						<strong data-text-role="venue-name">{settings().venueName}</strong>
						<span data-text-role="program-name">{settings().programName}</span>
					</div>
					<div class={style.status}>{playerState().status}</div>
				</header>
				<aside class={style.playlist} aria-label="Video playlist">
					<div class={style.playlistLabel}>PROGRAM</div>
					<For each={sources()}>
						{(source: VideoSource, index: Accessor<number>) => (
							<PlaylistSource
								active={index() === playerState().currentIndex}
								index={index()}
								onSelect={(): void => controller()?.select(index())}
								source={source}
							/>
						)}
					</For>
				</aside>
				<footer class={style.footer}>
					<div class={style.nowPlaying}>
						<span>NOW PLAYING</span>
						<strong ref={fitCurrentTitle} data-text-role="video-title">{playerState().currentSource?.name || 'Waiting for media'}</strong>
					</div>
					<div class={style.timeline}>
						<div class={style.timelineTrack}>
							<div class={style.timelineProgress} style={{ width: `${playerState().progress * 100}%` }} />
						</div>
						<span>{formatTime(playerState().position)} / {formatTime(playerState().duration)}</span>
					</div>
					<Show when={settings().showControls}>
						<nav class={style.controls} aria-label="Video controls">
							<button aria-label="Previous video" onClick={(): void => controller()?.previous()} type="button">|&lt;</button>
							<button aria-label={playerState().status === 'playing' ? 'Pause video' : 'Play video'} onClick={(): void => { void controller()?.toggle(); }} type="button">
								{playerState().status === 'playing' ? '||' : '>'}
							</button>
							<button aria-label="Next video" onClick={(): void => controller()?.next()} type="button">&gt;|</button>
						</nav>
					</Show>
				</footer>
			</Show>
			<Show when={sourceError()}>
				<div class={style.sourceNotice}>{sourceError()} Using the packaged program.</div>
			</Show>
		</main>
	);
};
