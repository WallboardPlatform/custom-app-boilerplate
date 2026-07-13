/* Configuration Interface */
export interface Config {
	configValues: ConfigValues;
	dataPickerValues: DataPickerValues;
	datasourceIds: Record<DataSourceKey, string | number | undefined>;
}

/* Generic DataSourceValue type */
export interface DataSourceValue<T = unknown> {
	id?: string | null;
	value?: T;
}

/* Create a unified type for all data sources */
export type DataSources = { [K in DataSourceKey]?: DataSourceValue };

/* Interface for Layout Builder */
export interface LayoutItem {
	id: string;
	paletteId: string;
	label: string;
	position: {
		x: string;
		y: string;
	};
	size: {
		width: string;
		height: string;
	};
	// @ts-ignore
	properties: never;
	style: {
		accentColor: string;
		'z-index': number;
	};
}

/*
 * Define the available datasource's in your widget
 * Add more specific keys as needed!
 */
export type DataSourceKey = 'myDataset';

/* Interface for dataPickerValues in Config */
export interface DataPickerValues {
	// Add other data picker values as needed (from DataSourceKey)
	myDataset?: DataSourceValue['value'];
}

// Settings Subject Interface
export interface Settings {
	keyboardEnabled?: boolean;
	layoutEditor?: LayoutItem[];
	text?: string;
	slider?: number;
	font?: {
		family: string;
		size: number;
		style: string;
		weight: string;
		color: string;
		decoration: string;
	};
	file?: string;
	folder?: string;
	button?: boolean;
	select?: string;
	color?: string;
	number?: number;
	textArea?: string;
	svgFile?: string;
}

// Interface for raw configuration, which will be migrated to Settings type
export interface ConfigValues {
	layoutEditor?: { items?: LayoutItem[] };
	wbKeyboardEnabled?: boolean;
	txtField?: string;
	sampleSlider?: number;
	sampleFont: Record<string, string | number | undefined>;
	filePicker?: string;
	folderPicker?: string;
	btnSample?: boolean;
	sampleType?: string;
	colorPicker?: string;
	sampleNumberInput?: number;
	sampleTextAreaInput?: string;
	svgFile?: string;
}
