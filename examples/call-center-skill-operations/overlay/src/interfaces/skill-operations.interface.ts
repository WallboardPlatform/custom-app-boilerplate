export type SkillAgentTone = 'ready' | 'active' | 'acw' | 'away' | 'offline' | 'unknown';

export interface SkillAgentRow {
	name: string;
	skill: string;
	businessUnit: string;
	state: string;
	stateReason: string;
	duration: string;
	tone: SkillAgentTone;
}

export interface SkillPage {
	name: string;
	businessUnit: string;
	agents: SkillAgentRow[];
}

export interface SkillStatusCount {
	label: string;
	value: number;
	tone: SkillAgentTone;
}

export interface SkillGauge {
	label: string;
	value: number;
	displayValue: string;
	tone: SkillAgentTone;
}
