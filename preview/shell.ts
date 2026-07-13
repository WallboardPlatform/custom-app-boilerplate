import './shell.css';

import { appViewport } from './app-viewport';

interface ViewportPreset {
	width: number;
	height: number;
}

const presets: Record<string, ViewportPreset> = {
	'app-default': appViewport,
	'full-hd': { width: 1920, height: 1080 },
	'wide-low': { width: 1536, height: 432 },
	landscape: { width: 960, height: 540 },
	portrait: { width: 1080, height: 1920 },
	square: { width: 600, height: 600 }
};

const stage: HTMLElement = document.getElementById('preview-stage')!;
const viewportFrame: HTMLElement = document.getElementById('viewport-frame')!;
const widgetFrame: HTMLIFrameElement = document.getElementById('widget-frame') as HTMLIFrameElement;
const presetSelect: HTMLSelectElement = document.getElementById('viewport-preset') as HTMLSelectElement;
const widthInput: HTMLInputElement = document.getElementById('viewport-width') as HTMLInputElement;
const heightInput: HTMLInputElement = document.getElementById('viewport-height') as HTMLInputElement;
const applyButton: HTMLButtonElement = document.getElementById('apply-size') as HTMLButtonElement;
const backgroundSelect: HTMLSelectElement = document.getElementById('preview-background') as HTMLSelectElement;
const viewportLabel: HTMLElement = document.getElementById('viewport-label')!;

let viewportWidth: number = appViewport.width;
let viewportHeight: number = appViewport.height;

const updateQuery = (): void => {
	const url: URL = new URL(window.location.href);
	url.searchParams.set('preset', presetSelect.value);
	url.searchParams.set('width', viewportWidth.toString());
	url.searchParams.set('height', viewportHeight.toString());
	url.searchParams.set('background', backgroundSelect.value);
	window.history.replaceState({}, '', url);
};

const fitViewport = (): void => {
	const horizontalPadding: number = 56;
	const verticalPadding: number = 56;
	const availableWidth: number = Math.max(1, stage.clientWidth - horizontalPadding);
	const availableHeight: number = Math.max(1, stage.clientHeight - verticalPadding);
	const scale: number = Math.min(1, availableWidth / viewportWidth, availableHeight / viewportHeight);

	widgetFrame.style.width = `${viewportWidth}px`;
	widgetFrame.style.height = `${viewportHeight}px`;
	widgetFrame.style.transform = `scale(${scale})`;
	viewportFrame.style.width = `${Math.round(viewportWidth * scale)}px`;
	viewportFrame.style.height = `${Math.round(viewportHeight * scale)}px`;
	viewportLabel.textContent = `${viewportWidth} x ${viewportHeight} at ${Math.round(scale * 100)}%`;
};

const applySize = (width: number, height: number): void => {
	viewportWidth = Math.max(1, Math.min(7680, Math.round(width)));
	viewportHeight = Math.max(1, Math.min(4320, Math.round(height)));
	widthInput.value = viewportWidth.toString();
	heightInput.value = viewportHeight.toString();
	fitViewport();
	updateQuery();
};

const reloadBackground = (): void => {
	const url: URL = new URL('/preview/widget.html', window.location.origin);
	url.searchParams.set('background', backgroundSelect.value);
	widgetFrame.src = url.toString();
	updateQuery();
};

const loadQuery = (): void => {
	const params: URLSearchParams = new URLSearchParams(window.location.search);
	const presetName: string | null = params.get('preset');
	const width: number = Number(params.get('width'));
	const height: number = Number(params.get('height'));
	const background: string | null = params.get('background');

	if (presetName && presets[presetName]) {
		presetSelect.value = presetName;
		viewportWidth = presets[presetName].width;
		viewportHeight = presets[presetName].height;
	} else if (Number.isFinite(width) && Number.isFinite(height) && width >= 1 && height >= 1) {
		presetSelect.value = 'custom';
		viewportWidth = width;
		viewportHeight = height;
	}

	if (background && ['checker', 'light', 'dark'].includes(background)) {
		backgroundSelect.value = background;
		widgetFrame.src = `/preview/widget.html?background=${background}`;
	}
};

presetSelect.addEventListener('change', (): void => {
	const preset: ViewportPreset | undefined = presets[presetSelect.value];

	if (preset) {
		applySize(preset.width, preset.height);
	}
});

applyButton.addEventListener('click', (): void => {
	presetSelect.value = 'custom';
	applySize(Number(widthInput.value), Number(heightInput.value));
});

backgroundSelect.addEventListener('change', reloadBackground);

window.addEventListener('resize', fitViewport);

loadQuery();
applySize(viewportWidth, viewportHeight);
