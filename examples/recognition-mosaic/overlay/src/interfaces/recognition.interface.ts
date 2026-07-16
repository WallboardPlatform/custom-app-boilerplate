export interface Recognition {
	id: string;
	name: string;
	role: string;
	achievement: string;
	team: string;
	imageUrl: string;
	quote: string;
}

export interface RecognitionTableRow extends Record<string, unknown> {
	name: string;
	role: string;
	achievement: string;
	team: string;
	imageUrl: string;
	quote: string;
}

export interface RecognitionDatasource {
	Recognitions: {
		header: Record<string, string>;
		rows: RecognitionTableRow[];
		connectors: Record<string, unknown>;
	};
}
