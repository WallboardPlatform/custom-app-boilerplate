export type SessionResetReason = 'manual' | 'inactivity' | 'completion';

export interface PageSessionOptions<View extends string> {
	initialView: View;
	inactivityMs?: number | (() => number);
	onReset?: (reason: SessionResetReason) => void;
	onViewChange: (view: View) => void;
}

export interface PageSessionController<View extends string> {
	activity: () => void;
	completeAfter: (delayMs: number) => void;
	destroy: () => void;
	getView: () => View;
	navigate: (view: View) => void;
	reset: (reason?: SessionResetReason) => void;
}

export const createPageSession = <View extends string>(
	options: PageSessionOptions<View>
): PageSessionController<View> => {
	let currentView: View = options.initialView;
	let timer: ReturnType<typeof setTimeout> | undefined;

	const clearTimer = (): void => {
		if (timer !== undefined) {
			clearTimeout(timer);
			timer = undefined;
		}
	};

	const reset = (reason: SessionResetReason = 'manual'): void => {
		clearTimer();
		currentView = options.initialView;
		options.onViewChange(currentView);
		options.onReset?.(reason);
	};

	const schedule = (delayMs: number, reason: SessionResetReason): void => {
		clearTimer();

		if (!Number.isFinite(delayMs) || delayMs <= 0) return;

		timer = setTimeout((): void => reset(reason), delayMs);
	};

	const activity = (): void => {
		if (options.inactivityMs !== undefined) {
			const inactivityMs: number = typeof options.inactivityMs === 'function'
				? options.inactivityMs()
				: options.inactivityMs;

			schedule(inactivityMs, 'inactivity');
		}
	};

	activity();

	return {
		activity,
		completeAfter: (delayMs: number): void => schedule(delayMs, 'completion'),
		destroy: clearTimer,
		getView: (): View => currentView,
		navigate: (view: View): void => {
			currentView = view;
			options.onViewChange(view);
			activity();
		},
		reset
	};
};
