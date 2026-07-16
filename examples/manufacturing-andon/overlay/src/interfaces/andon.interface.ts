export type AndonTone = 'normal' | 'attention' | 'stopped' | 'unknown';

export interface AndonStation {
	key: string;
	line: string;
	station: string;
	tone: AndonTone;
	stateLabel: string;
	originalState: string;
	reason: string;
	ownerRole: string;
	elapsedDuration: string;
}

export interface AndonLine {
	key: string;
	name: string;
	tone: AndonTone;
	exceptionCount: number;
	stations: AndonStation[];
}

export interface AndonPageSection extends AndonLine {
	continuedFromPrevious: boolean;
	continuesNext: boolean;
}

export interface AndonPage {
	sections: AndonPageSection[];
	stationCount: number;
}

export interface AndonSummary {
	tone: AndonTone;
	total: number;
	normal: number;
	attention: number;
	stopped: number;
	unknown: number;
}
