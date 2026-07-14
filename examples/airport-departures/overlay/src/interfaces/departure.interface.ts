export type DepartureStatusTone = 'boarding' | 'gate' | 'delayed' | 'cancelled' | 'scheduled' | 'departed';

export interface DepartureRow {
	sortOrder: number;
	scheduledTime: string;
	destination: string;
	flight: string;
	airline: string;
	terminal: string;
	gate: string;
	status: string;
	statusTone: DepartureStatusTone;
}

export interface DepartureTable {
	header: Record<string, string>;
	rows: DepartureRow[];
	connectors: Record<string, unknown>;
}

export interface DepartureDatasource {
	Departures: DepartureTable;
}
