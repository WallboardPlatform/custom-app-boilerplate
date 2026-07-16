export interface DirectoryDatasource {
	Directory: {
		header: Record<string, string>;
		rows: DirectorySourceRow[];
		connectors: Record<string, unknown>;
	};
}

export interface DirectorySourceRow extends Record<string, unknown> {
	building?: unknown;
	floor?: unknown;
	department?: unknown;
	room?: unknown;
	direction?: unknown;
	accessibilityNote?: unknown;
}

export interface DirectoryEntry {
	building: string;
	floor: string;
	department: string;
	room: string;
	direction: string;
	accessibilityNote: string;
}

export interface DirectoryDisplayEntry extends DirectoryEntry {
	buildingStart: boolean;
	floorStart: boolean;
}
