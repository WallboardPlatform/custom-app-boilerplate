export type MotionPreset = 'off' | 'subtle' | 'expressive';

export interface MotionTokens {
	distancePx: number;
	durationMs: number;
	easing: string;
	enabled: boolean;
}

const MOTION_TOKENS: Record<MotionPreset, MotionTokens> = {
	off: { distancePx: 0, durationMs: 0, easing: 'linear', enabled: false },
	subtle: { distancePx: 12, durationMs: 280, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)', enabled: true },
	expressive: { distancePx: 28, durationMs: 520, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', enabled: true }
};

export const motionPreset = (value: unknown): MotionPreset => {
	return value === 'subtle' || value === 'expressive' ? value : 'off';
};

export const resolveMotion = (value: unknown, disabled = false): MotionTokens => {
	return MOTION_TOKENS[disabled ? 'off' : motionPreset(value)];
};

export const motionVariables = (tokens: MotionTokens): Record<string, string> => ({
	'--wb-motion-distance': `${tokens.distancePx}px`,
	'--wb-motion-duration': `${tokens.durationMs}ms`,
	'--wb-motion-easing': tokens.easing
});
