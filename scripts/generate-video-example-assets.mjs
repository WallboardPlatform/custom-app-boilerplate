import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const outputPath = path.resolve('examples/lumen-media-program/overlay/src/assets/preview-videos.ts');
const iconPath = path.resolve('examples/lumen-media-program/overlay/src/editor-assets/icon.png');
const placeholderPath = path.resolve('examples/lumen-media-program/overlay/src/editor-assets/placeholder.png');
const scenes = [
	{
		accent: '#ff5a3d',
		background: '#0b1014',
		code: 'ARCHIVE 01',
		label: 'AFTER HOURS',
		secondary: '#f4eadf'
	},
	{
		accent: '#f4c84a',
		background: '#123d3a',
		code: 'FIELD NOTE 02',
		label: 'CITY IN MOTION',
		secondary: '#eff8f3'
	}
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const videos = [];

for (const scene of scenes) {
	const dataUrl = await page.evaluate(async (input) => {
		const canvas = document.createElement('canvas');
		canvas.width = 640;
		canvas.height = 360;
		const context = canvas.getContext('2d');
		if (!context) throw new Error('Canvas context unavailable.');
		const stream = canvas.captureStream(12);
		const recorder = new MediaRecorder(stream, {
			mimeType: 'video/webm;codecs=vp8',
			videoBitsPerSecond: 180000
		});
		const chunks = [];
		recorder.ondataavailable = (event) => {
			if (event.data.size > 0) chunks.push(event.data);
		};
		const stopped = new Promise((resolve) => {
			recorder.onstop = resolve;
		});
		recorder.start(100);

		const started = performance.now();
		await new Promise((resolve) => {
			const draw = (time) => {
				const elapsed = Math.min(1, (time - started) / 2200);
				context.fillStyle = input.background;
				context.fillRect(0, 0, 640, 360);
				context.fillStyle = input.accent;
				context.fillRect(-160 + elapsed * 460, 0, 160, 360);
				context.fillRect(520 - elapsed * 140, 278, 180, 10);
				context.fillStyle = input.secondary;
				context.font = '700 52px Arial';
				context.fillText(input.label, 54, 164);
				context.font = '700 18px Arial';
				context.fillStyle = input.accent;
				context.fillText(input.code, 58, 205);
				context.fillStyle = input.secondary;
				context.font = '400 14px Arial';
				context.fillText('LUMEN PUBLIC MEDIA PROGRAM', 58, 318);
				if (elapsed < 1) requestAnimationFrame(draw);
				else resolve(undefined);
			};
			requestAnimationFrame(draw);
		});

		recorder.stop();
		await stopped;
		stream.getTracks().forEach((track) => track.stop());
		const blob = new Blob(chunks, { type: 'video/webm' });
		const buffer = await blob.arrayBuffer();
		const bytes = new Uint8Array(buffer);
		let binary = '';
		for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
		return `data:video/webm;base64,${btoa(binary)}`;
	}, scene);

	videos.push({ ...scene, dataUrl });
}

await browser.close();
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(
	outputPath,
	`export const previewVideos = ${JSON.stringify(videos, null, '\t').replaceAll('"', "'")} as const;\n`
);

const artworkBrowser = await chromium.launch({ headless: true });
const artworkPage = await artworkBrowser.newPage();
const artwork = await artworkPage.evaluate(() => {
	const render = (width, height, icon) => {
		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		const context = canvas.getContext('2d');
		if (!context) throw new Error('Canvas context unavailable.');
		context.fillStyle = '#080b0d';
		context.fillRect(0, 0, width, height);
		context.fillStyle = '#ff5a3d';
		context.fillRect(0, 0, Math.round(width * 0.08), height);
		context.fillRect(Math.round(width * 0.66), Math.round(height * 0.75), Math.round(width * 0.3), Math.max(5, Math.round(height * 0.025)));
		context.fillStyle = '#f5f2e9';
		context.font = `800 ${Math.round(height * (icon ? 0.26 : 0.17))}px Arial`;
		context.fillText(icon ? 'LM' : 'NIGHT SIGNAL', Math.round(width * 0.16), Math.round(height * 0.5));
		if (!icon) {
			context.fillStyle = '#ff5a3d';
			context.font = `800 ${Math.round(height * 0.055)}px Arial`;
			context.fillText('LUMEN PUBLIC MEDIA', Math.round(width * 0.165), Math.round(height * 0.62));
		}
		return canvas.toDataURL('image/png').split(',')[1];
	};
	return { icon: render(512, 512, true), placeholder: render(640, 360, false) };
});
await artworkBrowser.close();
fs.mkdirSync(path.dirname(iconPath), { recursive: true });
fs.writeFileSync(iconPath, Buffer.from(artwork.icon, 'base64'));
fs.writeFileSync(placeholderPath, Buffer.from(artwork.placeholder, 'base64'));
console.log(`Wrote video fixtures and editor artwork (${fs.statSync(outputPath).size} bytes of embedded video data)`);
