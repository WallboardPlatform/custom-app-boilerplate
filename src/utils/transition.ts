export interface TransitionState {
	currentKey: string;
	previousKey: string | null;
	transitioning: boolean;
}

export interface TransitionOptions {
	enabled: boolean;
	durationMs: number;
}

export interface TransitionController {
	getState: () => TransitionState;
	select: (nextKey: string, options: TransitionOptions) => TransitionState;
	destroy: () => void;
}

export interface TransitionScheduler {
	setTimeout: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
	clearTimeout: (timer: ReturnType<typeof setTimeout>) => void;
}

const defaultScheduler: TransitionScheduler = {
	setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
	clearTimeout: (timer) => clearTimeout(timer)
};

export const createTransitionController = (
	initialKey: string,
	onChange: (state: TransitionState) => void,
	scheduler: TransitionScheduler = defaultScheduler
): TransitionController => {
	let timer: ReturnType<typeof setTimeout> | null = null;
	let state: TransitionState = {
		currentKey: initialKey,
		previousKey: null,
		transitioning: false
	};

	const clear = (): void => {
		if (timer !== null) {
			scheduler.clearTimeout(timer);
			timer = null;
		}
	};

	const publish = (): TransitionState => {
		onChange(state);

		return state;
	};

	return {
		getState: (): TransitionState => state,
		select: (nextKey, options): TransitionState => {
			if (nextKey === state.currentKey) {
				if (state.transitioning && (!options.enabled || options.durationMs <= 0)) {
					clear();
					state = { currentKey: state.currentKey, previousKey: null, transitioning: false };

					return publish();
				}

				return state;
			}

			clear();
			const previousKey = state.currentKey;
			const enabled = options.enabled && options.durationMs > 0;
			state = {
				currentKey: nextKey,
				previousKey: enabled ? previousKey : null,
				transitioning: enabled
			};
			publish();

			if (enabled) {
				timer = scheduler.setTimeout((): void => {
					timer = null;
					state = { currentKey: state.currentKey, previousKey: null, transitioning: false };
					publish();
				}, options.durationMs);
			}

			return state;
		},
		destroy: (): void => {
			clear();
			state = { currentKey: state.currentKey, previousKey: null, transitioning: false };
		}
	};
};
