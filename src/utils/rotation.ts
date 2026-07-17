export interface RotationScheduler {
	setInterval: (callback: () => void, intervalMilliseconds: number) => unknown;
	clearInterval: (handle: unknown) => void;
}

export interface RotationController {
	sync: (keys: readonly string[], activeKey: string | undefined, intervalMilliseconds: number) => void;
	destroy: () => void;
}

const browserScheduler: RotationScheduler = {
	setInterval: (callback: () => void, intervalMilliseconds: number): number => {
		return window.setInterval(callback, intervalMilliseconds);
	},
	clearInterval: (handle: unknown): void => window.clearInterval(handle as number)
};

const uniqueKeys = (keys: readonly string[]): string[] => Array.from(new Set(keys));

export const createRotationController = (
	onChange: (key: string, index: number) => void,
	scheduler: RotationScheduler = browserScheduler
): RotationController => {
	let timer: unknown;
	let currentKey: string | undefined;
	let destroyed = false;

	const stop = (): void => {
		if (timer !== undefined) {
			scheduler.clearInterval(timer);
			timer = undefined;
		}
	};

	return {
		sync: (inputKeys: readonly string[], activeKey: string | undefined, intervalMilliseconds: number): void => {
			stop();

			if (destroyed) {
				return;
			}

			const keys = uniqueKeys(inputKeys);

			if (keys.length === 0) {
				currentKey = undefined;

				return;
			}

			currentKey = currentKey && keys.includes(currentKey)
				? currentKey
				: activeKey && keys.includes(activeKey) ? activeKey : keys[0];

			if (currentKey !== activeKey) {
				onChange(currentKey, keys.indexOf(currentKey));
			}

			if (keys.length === 1) {
				return;
			}

			const duration = Number.isFinite(intervalMilliseconds)
				? Math.max(1, Math.round(intervalMilliseconds))
				: 1;

			timer = scheduler.setInterval((): void => {
				const currentIndex = currentKey ? keys.indexOf(currentKey) : -1;
				const nextIndex = (currentIndex + 1) % keys.length;

				currentKey = keys[nextIndex];
				onChange(currentKey, nextIndex);
			}, duration);
		},
		destroy: (): void => {
			destroyed = true;
			stop();
		}
	};
};
