export type PharmacyQueueState = 'called' | 'waiting' | 'hold' | 'complete' | 'unknown';

export interface PharmacyQueueRow {
	ticket: string;
	counter: string;
	state: PharmacyQueueState;
	note: string;
}

export interface PharmacyQueueView {
	hero?: PharmacyQueueRow;
	upcoming: PharmacyQueueRow[];
}

export interface PharmacyQueueDatasource {
	PharmacyQueue: {
		header: Record<string, string>;
		rows: Record<string, unknown>[];
		connectors: Record<string, unknown>;
	};
}
