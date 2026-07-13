import { ConfigValues, Settings } from '@interfaces/application.interface';

/**
 * Maps configuration values to the Settings interface for use with the useSettings() hook.
 *
 * This function transforms raw configuration values from the config panel into a structured Settings object.
 * Developers can customize this mapping to match their widget's specific configuration schema and requirements.
 *
 * @param config - The raw configuration values from the widget's config panel
 * @returns A Settings object with typed properties accessible via useSettings() hook.
 *
 * @example
 * ```typescript
 * // The returned settings object can be accessed in your widget:
 * const settings = useSettings();
 * console.log(settings().text); // Access the txtField value
 * console.log(settings().font.family); // Access nested font properties
 * ```
 */
export default function(config: ConfigValues): Settings {
	return {
		text: config.txtField,
		layoutEditor: config.layoutEditor?.items,
		keyboardEnabled: config.wbKeyboardEnabled,
		slider: config.sampleSlider,
		font: {
			family: config.sampleFont['font-family']!.toString(),
			size: parseInt(config.sampleFont['font-size']!.toString()),
			style: config.sampleFont['font-style']!.toString(),
			weight: config.sampleFont['font-weight']!.toString(),
			color: config.sampleFont.color!.toString(),
			decoration: config.sampleFont['text-decoration']!.toString()
		},
		file: config.filePicker,
		folder: config.folderPicker,
		button: config.btnSample,
		select: config.sampleType,
		color: config.colorPicker,
		number: config.sampleNumberInput,
		textArea: config.sampleTextAreaInput,
		svgFile: config.svgFile
	};
}