import { createEffect, onCleanup, onMount } from 'solid-js';
import type { Accessor } from 'solid-js';

import { fitTextElement } from '@utils/text-fit';
import type { TextFitOptions } from '@utils/text-fit';

export interface AutoFitTextOptions extends TextFitOptions {
	watch?: Accessor<unknown>;
}

export const useAutoFitText = (options: AutoFitTextOptions): ((element: HTMLElement) => void) => {
	let element: HTMLElement | undefined;
	let resizeObserver: ResizeObserver | undefined;
	let resizePoller: number | undefined;
	let animationFrame: number | undefined;
	let mounted = false;
	let observedWidth = 0;
	let observedHeight = 0;

	const fit = (): void => {
		if (!element) return;

		element.style.fontSize = '';

		const cssMaximum: number = Number.parseFloat(window.getComputedStyle(element).fontSize);
		const maxFontSize: number = Number.isFinite(cssMaximum)
			? Math.min(options.maxFontSize, cssMaximum)
			: options.maxFontSize;

		fitTextElement(element, { ...options, maxFontSize });
	};

	const scheduleFit = (): void => {
		if (animationFrame !== undefined) window.cancelAnimationFrame(animationFrame);

		animationFrame = window.requestAnimationFrame((): void => {
			animationFrame = undefined;
			fit();
		});
	};

	const stopObserving = (): void => {
		resizeObserver?.disconnect();
		resizeObserver = undefined;

		if (resizePoller !== undefined) {
			window.clearInterval(resizePoller);
			resizePoller = undefined;
		}

		window.removeEventListener('resize', scheduleFit);
	};

	const observeElement = (): void => {
		stopObserving();

		if (!mounted || !element) return;

		if (typeof window.ResizeObserver === 'function') {
			resizeObserver = new window.ResizeObserver(scheduleFit);
			resizeObserver.observe(element);
		} else {
			observedWidth = element.clientWidth;
			observedHeight = element.clientHeight;
			resizePoller = window.setInterval((): void => {
				if (!element || (element.clientWidth === observedWidth && element.clientHeight === observedHeight)) return;

				observedWidth = element.clientWidth;
				observedHeight = element.clientHeight;
				scheduleFit();
			}, 250);
			window.addEventListener('resize', scheduleFit);
		}

		scheduleFit();
	};

	createEffect((): void => {
		options.watch?.();
		scheduleFit();
	});

	onMount((): void => {
		mounted = true;
		observeElement();
	});

	onCleanup((): void => {
		mounted = false;
		stopObserving();

		if (animationFrame !== undefined) window.cancelAnimationFrame(animationFrame);
	});

	return (target: HTMLElement): void => {
		element = target;
		observeElement();
	};
};
