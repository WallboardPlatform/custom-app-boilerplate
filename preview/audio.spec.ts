import { expect, test } from '@playwright/test';

test('audio preview validates tokens, excludes own sources and restores duck state', async ({
	page
}): Promise<void> => {
	await page.goto('/preview/widget.html');
	const result = await page.evaluate(async () => {
		const modulePath = '/preview/audio-mock.ts';
		const { PreviewAudioHost } = await import(modulePath);
		const host = new PreviewAudioHost();
		const updates: Array<{ audio: { muted: boolean; duckState: { isDucked: boolean } } }> = [];
		const first = host.beginRender(
			{ supported: true, ducking: { enabled: true, duckingLevel: 20, fadeDurationMS: 500 } },
			(event: (typeof updates)[number]): void => {
				updates.push(event);
			}
		);
		const second = host.beginRender({ supported: true }, (): void => {});
		const own = { instanceId: first.instanceId, sourceKey: 'main' };
		const other = { instanceId: second.instanceId, sourceKey: 'main' };
		const accepted = [
			host.handle('registerSource', own),
			host.handle('registerSource', own),
			host.handle('setPlaying', { ...own, isPlaying: true })
		];
		const ownDucked = updates.at(-1)?.audio.duckState.isDucked;
		host.handle('registerSource', other);
		host.handle('setPlaying', { ...other, isPlaying: true });
		const otherDucked = updates.at(-1)?.audio.duckState.isDucked;
		host.update(second.instanceId, { muted: true });
		const mutedDucked = updates.at(-1)?.audio.duckState.isDucked;
		host.update(second.instanceId, { muted: false });
		const unmutedDucked = updates.at(-1)?.audio.duckState.isDucked;
		const rejected = [
			host.handle('unknown', own),
			host.handle('setPlaying', { ...own, sourceKey: 'missing', isPlaying: true }),
			host.handle('registerElement', own)
		];
		host.endRender(second.instanceId);
		const restored = updates.at(-1)?.audio.duckState.isDucked;
		const stale = host.handle('release', other);
		const replacement = host.beginRender({ supported: true }, (): void => {});
		const separateHost = new PreviewAudioHost();
		return {
			accepted,
			rejected,
			ownDucked,
			otherDucked,
			mutedDucked,
			unmutedDucked,
			restored,
			stale,
			unique: replacement.instanceId !== second.instanceId,
			isolated: separateHost.handle('release', own),
			initial: first.duckState
		};
	});
	expect(result).toEqual({
		accepted: [true, true, true],
		rejected: [false, false, false],
		ownDucked: false,
		otherDucked: true,
		mutedDucked: false,
		unmutedDucked: true,
		restored: false,
		stale: false,
		unique: true,
		isolated: false,
		initial: { isDucked: false, duckingLevel: 20, fadeDurationMS: 500 }
	});
});

test('audio preview observes real media playback, volume, mute, end and release', async ({ page }): Promise<void> => {
	await page.goto('/preview/widget.html');
	const result = await page.evaluate(async () => {
		const modulePath = '/preview/audio-mock.ts';
		const { PreviewAudioHost } = await import(modulePath);
		const host = new PreviewAudioHost();
		let ducked = false;
		host.beginRender(
			{ supported: true, ducking: { enabled: true, duckingLevel: 30, fadeDurationMS: 0 } },
			(event: { audio: { duckState: { isDucked: boolean } } }): void => {
				ducked = event.audio.duckState.isDucked;
			}
		);
		const source = host.beginRender({ supported: true }, (): void => {});
		// An offline PCM WAV exercises browser media events without downloading assets.
		const buffer = new ArrayBuffer(44 + 8000 * 2);
		const view = new DataView(buffer);
		const text = (offset: number, value: string): void => {
			for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
		};
		text(0, 'RIFF');
		view.setUint32(4, buffer.byteLength - 8, true);
		text(8, 'WAVE');
		text(12, 'fmt ');
		view.setUint32(16, 16, true);
		view.setUint16(20, 1, true);
		view.setUint16(22, 1, true);
		view.setUint32(24, 8000, true);
		view.setUint32(28, 16000, true);
		view.setUint16(32, 2, true);
		view.setUint16(34, 16, true);
		text(36, 'data');
		view.setUint32(40, 16000, true);
		const url = URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
		const element = new Audio(url);
		document.body.append(element);
		const params = { instanceId: source.instanceId, sourceKey: 'media', element };
		const states: boolean[] = [];
		host.handle('registerElement', params);
		const duplicate = host.handle('registerElement', { ...params, sourceKey: 'duplicate' });
		const manual = host.handle('setPlaying', { ...params, isPlaying: true });
		await element.play();
		states.push(ducked);
		const volume = async (value: number): Promise<void> => {
			const changed = new Promise<void>((resolve): void => {
				element.addEventListener('volumechange', (): void => resolve(), { once: true });
			});
			element.volume = value;
			await changed;
		};
		await volume(0);
		states.push(ducked);
		await volume(0.6);
		states.push(ducked);
		host.update(source.instanceId, { globallyMuted: true });
		states.push(ducked);
		const forcedMute = element.muted;
		host.update(source.instanceId, { globallyMuted: false });
		states.push(ducked);
		const restoredMute = element.muted;
		element.pause();
		await new Promise<void>((resolve): void => {
			element.addEventListener('pause', (): void => resolve(), { once: true });
		});
		states.push(ducked);
		await element.play();
		await new Promise<void>((resolve): void => {
			element.addEventListener('ended', (): void => resolve(), { once: true });
		});
		states.push(ducked);
		element.currentTime = 0;
		await element.play();
		states.push(ducked);
		element.dispatchEvent(new Event('error'));
		states.push(ducked);
		element.dispatchEvent(new Event('playing'));
		states.push(ducked);
		host.handle('release', params);
		states.push(ducked);
		element.dispatchEvent(new Event('playing'));
		states.push(ducked);
		const repeatedRelease = host.handle('release', params);
		host.handle('registerElement', params);
		host.update(source.instanceId, { muted: true });
		host.handle('release', params);
		const pausedOnMutedRelease = element.paused;
		element.remove();
		URL.revokeObjectURL(url);
		return { states, duplicate, manual, forcedMute, restoredMute, repeatedRelease, pausedOnMutedRelease };
	});
	expect(result).toEqual({
		states: [true, false, true, false, true, false, false, true, false, true, false, false],
		duplicate: false,
		manual: false,
		forcedMute: true,
		restoredMute: false,
		repeatedRelease: true,
		pausedOnMutedRelease: true
	});
});

test('editor and unsupported previews reject commands while preserving initial mute; audio events are injectable', async ({
	page
}): Promise<void> => {
	await page.goto('/preview/widget.html');
	const result = await page.evaluate(async () => {
		const modulePath = '/preview/audio-mock.ts';
		const { PreviewAudioHost } = await import(modulePath);
		const host = new PreviewAudioHost();
		const configs = [
			host.beginRender({ supported: false, globallyMuted: true }, (): void => {}),
			host.beginRender({ supported: false, muted: true }, (): void => {})
		];
		const rejected = configs.map((audio: { instanceId: string }): boolean =>
			host.handle('registerSource', { instanceId: audio.instanceId, sourceKey: 'main' })
		);
		let injected = false;
		const supported = host.beginRender(
			{ supported: true, otherSourceActive: true, ducking: { enabled: true, duckingLevel: 0, fadeDurationMS: 250 } },
			(event: { audio: { muted: boolean } }): void => {
				injected = event.audio.muted;
			}
		);
		host.update(supported.instanceId, { muted: true });
		return {
			muted: configs.map((audio: { muted: boolean }): boolean => audio.muted),
			rejected,
			injected,
			duck: supported.duckState
		};
	});
	expect(result).toEqual({
		muted: [true, true],
		rejected: [false, false],
		injected: true,
		duck: { isDucked: true, duckingLevel: 0, fadeDurationMS: 250 }
	});
});
