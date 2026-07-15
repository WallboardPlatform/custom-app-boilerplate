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
	let animationFrame: number | undefined;

	const fit = (): void => {
		if (element) {
			element.style.fontSize = '';

			const cssMaximum: number = Number.parseFloat(window.getComputedStyle(element).fontSize);
			const maxFontSize: number = Number.isFinite(cssMaximum)
				? Math.min(options.maxFontSize, cssMaximum)
				: options.maxFontSize;

			fitTextElement(element, { ...options, maxFontSize });
		}
	};

	const scheduleFit = (): void => {
		if (animationFrame !== undefined) {
			window.cancelAnimationFrame(animationFrame);
		}

		animationFrame = window.requestAnimationFrame((): void => {
			animationFrame = undefined;
			fit();
		});
	};

	createEffect((): void => {
		options.watch?.();
		scheduleFit();
	});

	onMount((): void => {
		if (!element) {
			return;
		}

		resizeObserver = new ResizeObserver(scheduleFit);
		resizeObserver.observe(element);
		scheduleFit();
	});

	onCleanup((): void => {
		resizeObserver?.disconnect();

		if (animationFrame !== undefined) {
			window.cancelAnimationFrame(animationFrame);
		}
	});

	return (target: HTMLElement): void => {
		element = target;
	};
};
