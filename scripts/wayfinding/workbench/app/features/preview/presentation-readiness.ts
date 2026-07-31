import {
	wayfindingStudioProjectDefaults,
	type WayfindingStudioPolygonElement,
	type WayfindingStudioProject
} from '../../../../studio-project.mts';
import {
	buildPresentationScene,
	getPresentationThreeDimensionalReadiness
} from '../../../../../../src/utils/wayfinding-presentation.js';

export interface PresentationReadiness {
	ready: boolean;
	reasons: string[];
}

const channelLuminance = (channel: number): number => {
	const normalized = channel / 255;

	return normalized <= 0.04045
		? normalized / 12.92
		: ((normalized + 0.055) / 1.055) ** 2.4;
};

const colorLuminance = (color: string): number | undefined => {
	const match = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(color.trim());

	if (!match) return undefined;
	const source = match[1].length === 3
		? [...match[1]].map((character) => character + character).join('')
		: match[1];
	const channels = [0, 2, 4].map((offset) => Number.parseInt(source.slice(offset, offset + 2), 16));

	return 0.2126 * channelLuminance(channels[0])
		+ 0.7152 * channelLuminance(channels[1])
		+ 0.0722 * channelLuminance(channels[2]);
};

const contrastRatio = (left: string, right: string): number | undefined => {
	const leftLuminance = colorLuminance(left);
	const rightLuminance = colorLuminance(right);

	if (leftLuminance === undefined || rightLuminance === undefined) return undefined;
	const light = Math.max(leftLuminance, rightLuminance);
	const dark = Math.min(leftLuminance, rightLuminance);

	return (light + 0.05) / (dark + 0.05);
};

export const getThreeDimensionalReadiness = (
	project: WayfindingStudioProject,
	floorId: string
): PresentationReadiness => {
	const floor = project.floors.find((candidate) => candidate.id === floorId);

	if (!floor) return { ready: false, reasons: ['The active floor no longer exists.'] };
	const scene = buildPresentationScene({
		defaultLanguage: project.defaultLanguage,
		destinations: project.destinations,
		floors: project.floors,
		projectId: project.projectId
	}, { floorId });
	const reasons = [...getPresentationThreeDimensionalReadiness(scene).reasons];
	const defaults = wayfindingStudioProjectDefaults(project);
	const locations = floor.elements.filter(
		(element): element is WayfindingStudioPolygonElement => element.type === 'location'
	);
	const lowContrastLocation = locations.some((location) => {
		const fill = location.presentation?.fillColor ?? defaults.location.fillColor;
		const ratio = contrastRatio(fill, '#172321');

		return ratio === undefined || ratio < 3;
	});

	if (lowContrastLocation) reasons.push('Increase room contrast against the 3D background.');

	return {
		ready: reasons.length === 0,
		reasons
	};
};
