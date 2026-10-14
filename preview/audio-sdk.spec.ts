import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';

const sdkDirectory = process.env.WALLBOARD_PREVIEW_SDK_PATH;
test.skip(!sdkDirectory, 'Set WALLBOARD_PREVIEW_SDK_PATH to the locally built SDK dist directory.');

test('local SDK controls actual WebAudio silence, unmute and baseline duck fades', async ({ page }): Promise<void> => {
	await page.goto('/preview/widget.html');
	await page.waitForFunction((): boolean => document.documentElement.dataset.previewReady === 'true');
	const result = await page.evaluate(
		async (sdkModule) => {
			const { AudioService, MetadataProvider } = await import(sdkModule);
			const mockModule = '/preview/platform-mock.ts';
			const { installPlatformMock } = await import(mockModule);
			const platform = installPlatformMock({ isDisplayer: true });
			let service: InstanceType<typeof AudioService>;
			const config = platform.audio.beginRender(
				{ supported: true, muted: true, ducking: { enabled: true, duckingLevel: 25, fadeDurationMS: 100 } },
				(event: { audio: unknown }): void => {
					service?.updateState(event.audio);
				}
			);
			const metadata = new MetadataProvider();
			metadata.setMetadata({ audio: config });
			service = new AudioService(metadata);
			// Real browser audio rendering proves the callback silences the output, rather than only changing host bookkeeping.
			const render = async (muted: boolean): Promise<number> => {
				platform.audio.update(config.instanceId, { muted });
				const context = new OfflineAudioContext(1, 256, 8000);
				const oscillator = context.createOscillator();
				const gain = context.createGain();
				oscillator.connect(gain).connect(context.destination);
				const handle = service.createSource({
					setMuted: (inherited: boolean): void => {
						gain.gain.value = inherited ? 0 : 0.6;
					}
				});
				oscillator.onended = (): void => {
					handle.setPlaying(false);
				};
				oscillator.start();
				handle.setPlaying(true);
				oscillator.stop(0.02);
				const buffer = await context.startRendering();
				handle.release();
				return Math.max(...Array.from(buffer.getChannelData(0)).map(Math.abs));
			};
			const silent = await render(true);
			const audible = await render(false);
			const context = new OfflineAudioContext(1, 2400, 8000);
			const background = context.createConstantSource();
			const gain = context.createGain();
			background.connect(gain).connect(context.destination);
			const baseline = 0.8;
			const subscription = service.duck$.subscribe(
				(duck: { isDucked: boolean; duckingLevel: number; fadeDurationMS: number }): void => {
					gain.gain.cancelScheduledValues(context.currentTime);
					gain.gain.setValueAtTime(gain.gain.value, context.currentTime);
					gain.gain.linearRampToValueAtTime(
						baseline * (duck.isDucked ? duck.duckingLevel / 100 : 1),
						context.currentTime + duck.fadeDurationMS / 1000
					);
				}
			);
			gain.gain.value = baseline;
			platform.audio.update(config.instanceId, { otherSourceActive: true });
			// Repeat an unrelated host update: target remains 0.8 * 25%, never 0.2 * 25%.
			platform.audio.update(config.instanceId, { globallyMuted: false });
			background.start();
			const rendered = await context.startRendering();
			const samples = rendered.getChannelData(0);
			subscription.unsubscribe();
			const restoreContext = new OfflineAudioContext(1, 1600, 8000);
			const restoreSource = restoreContext.createConstantSource();
			const restoreGain = restoreContext.createGain();
			restoreSource.connect(restoreGain).connect(restoreContext.destination);
			restoreGain.gain.value = 0.2;
			const restoreSubscription = service.duck$.subscribe(
				(duck: { isDucked: boolean; duckingLevel: number; fadeDurationMS: number }): void => {
					restoreGain.gain.cancelScheduledValues(0);
					restoreGain.gain.setValueAtTime(0.2, 0);
					restoreGain.gain.linearRampToValueAtTime(
						baseline * (duck.isDucked ? duck.duckingLevel / 100 : 1),
						duck.fadeDurationMS / 1000
					);
				}
			);
			platform.audio.update(config.instanceId, { otherSourceActive: false });
			restoreSource.start();
			const restored = (await restoreContext.startRendering()).getChannelData(0)[1200];
			restoreSubscription.unsubscribe();
			service.destroy();
			platform.audio.endRender(config.instanceId);
			return {
				silent,
				audible,
				start: samples[0],
				halfway: samples[400],
				settled: samples[1600],
				restored,
				manualLifecycle: platform.audio.calls
					.filter((call: { action: string }): boolean => call.action === 'setPlaying')
					.map((call: { params: { isPlaying: boolean } }): boolean => call.params.isPlaying)
			};
		},
		`/@fs/${resolve(sdkDirectory!, 'index.es.js').replace(/\\/g, '/')}`
	);
	expect(result.silent).toBe(0);
	expect(result.audible).toBeGreaterThan(0.5);
	expect(result.start).toBeCloseTo(0.8);
	expect(result.halfway).toBeCloseTo(0.5);
	expect(result.settled).toBeCloseTo(0.2);
	expect(result.restored).toBeCloseTo(0.8);
	expect(result.manualLifecycle).toEqual([true, false, true, false]);
});
