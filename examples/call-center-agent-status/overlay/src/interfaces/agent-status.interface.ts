export type AgentTone = 'ready' | 'busy' | 'acw' | 'away' | 'offline' | 'unknown';

export interface AgentStatusRow {
	name: string;
	state: string;
	tone: AgentTone;
	duration: string;
	presented: number;
	handled: number;
	averageTalk: string;
	timestamp: string;
}

export interface StatusSummary {
	label: string;
	value: number;
	tone: AgentTone;
}
