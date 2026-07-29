export type DocumentFilePickerId = string | number;

export interface DocumentFilePicker extends Record<string, unknown> {
	id: DocumentFilePickerId;
	location: string;
	name: string;
}

export interface DocumentMetadataValue {
	field: string;
	label: string;
	rawValue: unknown;
	value: string;
}

export interface DocumentFieldMapping {
	categoryField: string;
	metadataFields: readonly string[];
	pdfField: string;
	scheduleField: string;
	titleField: string;
}

export interface DocumentScheduleWindow {
	endAt?: number;
	startAt?: number;
}

export interface DocumentRecord {
	category: string;
	filterText: string;
	id: string;
	metadata: DocumentMetadataValue[];
	pdf: DocumentFilePicker | null;
	scheduleWindows: DocumentScheduleWindow[];
	sourceIndex: number;
	sourceRow: Record<string, unknown>;
	title: string;
}
