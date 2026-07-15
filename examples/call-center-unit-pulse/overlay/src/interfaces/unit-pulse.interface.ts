export interface UnitPulseRow {
	name: string;
	onCalls: number;
	staffed: number;
	available: number;
	notReady: number;
	auxiliary: number;
	waiting: number;
	oldestWaiting: string;
	offered: number;
	handled: number;
	abandoned: number;
	abandonmentRate: number;
	serviceLevel: number;
	asa: string;
	aht: string;
	occupancy: number;
}

export interface GaugeValue {
	label: string;
	value: number;
	displayValue: string;
	tone: 'success' | 'warning' | 'danger';
}

export interface MetricValue {
	label: string;
	value: string;
	detail: string;
	tone?: 'accent' | 'warning' | 'danger';
}
