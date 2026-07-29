import {
	renderWayfindingFloorSvg,
	type WayfindingStudioElement,
	type WayfindingStudioPolygonElement,
	type WayfindingStudioProject
} from '../../../studio-project.mts';
import type {
	EditorLayerId,
	EditorSelection
} from '../../../editor-core/types';
import type {
	WayfindingEdge,
	WayfindingNode,
	WayfindingPoint
} from '../../../../../src/utils/wayfinding.js';

const visibleGroupByLayer: Partial<Record<EditorLayerId, string>> = {
	background: 'Background',
	door: 'Doors',
	icon: 'Icons',
	label: 'Labels',
	location: 'Locations',
	logo: 'Logos',
	obstacle: 'Obstacles',
	origin: 'Origins',
	poi: 'POIs',
	transition: 'Transitions',
	walkable: 'Walkable'
};

const escaped = (value: string): string => value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');

export const pointsAttribute = (points: WayfindingPoint[]): string =>
	points.map((point) => `${point.x},${point.y}`).join(' ');

export const isPolygonElement = (
	element: WayfindingStudioElement | undefined
): element is WayfindingStudioPolygonElement =>
	element?.type === 'location' || element?.type === 'walkable' || element?.type === 'obstacle';

export const isPointElement = (
	element: WayfindingStudioElement | undefined
): element is Exclude<WayfindingStudioElement, WayfindingStudioPolygonElement> =>
	Boolean(element && 'point' in element);

export const edgeGeometry = (
	edge: WayfindingEdge | undefined,
	nodes: WayfindingNode[]
): WayfindingPoint[] => {
	if (!edge) return [];
	const from = nodes.find((node) => node.id === edge.from);
	const to = nodes.find((node) => node.id === edge.to);

	if (!from || !to) return [];

	return (edge.geometry?.length ? edge.geometry : [from, to])
		.map((point) => ({ x: point.x, y: point.y }));
};

export type FloorPresentationMode = 'editor' | 'route-preview' | 'visitor';

const presentationRules: Record<Exclude<FloorPresentationMode, 'editor'>, string[]> = {
	'route-preview': [
		'#POIs{display:none}',
		'#Labels{display:none}',
		'#Walkable polygon{fill:#eef4f2;fill-opacity:.96;stroke:#c7d5d1;stroke-width:2}',
		'#Locations polygon{fill-opacity:.82;stroke-width:2.5}',
		'#Obstacles polygon{fill:#263432;fill-opacity:.9;stroke:#172321;stroke-width:2}',
		'#Doors line{stroke:#fff;stroke-width:9}',
		'#Transitions circle{fill:#fff;stroke:#2563eb;stroke-width:4}'
	],
	visitor: [
		'#POIs{display:none}',
		'#Origins{display:none}',
		'#Labels{display:none}',
		'.visitor-floor-surface{fill:#f8faf9;stroke:#a9bbb6;stroke-width:2}',
		'#Walkable polygon{fill:#edf4f1;fill-opacity:.98;stroke:#c8d6d2;stroke-width:2}',
		'#Locations polygon{fill-opacity:.86;stroke-width:2.5;filter:drop-shadow(0 5px 8px rgba(22,42,37,.14))}',
		'#Obstacles polygon{fill:#263432;fill-opacity:.92;stroke:#172321;stroke-width:2}',
		'#Doors line{stroke:#fff;stroke-width:10}',
		'#Transitions circle{fill:#fff;stroke:#2563eb;stroke-width:4}'
	]
};

export const renderEditorFloorSvg = (
	project: WayfindingStudioProject,
	floorId: string,
	layerVisibility: Record<EditorLayerId, boolean>,
	selection: EditorSelection | undefined,
	hideSelectedElement: boolean,
	presentationMode: FloorPresentationMode = 'editor'
): string => {
	const hiddenRules: string[] = [];

	for (const [layer, group] of Object.entries(visibleGroupByLayer)) {
		if (!layerVisibility[layer as EditorLayerId]) hiddenRules.push(`#${group}{display:none}`);
	}

	if (presentationMode !== 'editor') hiddenRules.push(...presentationRules[presentationMode]);

	if (presentationMode === 'editor' && selection?.kind === 'element') {
		const selector = `[id="${escaped(selection.id)}"]`;
		hiddenRules.push(`${selector}{filter:drop-shadow(0 0 5px #15927d);stroke:#15927d;stroke-width:5}`);

		if (hideSelectedElement) hiddenRules.push(`${selector}{visibility:hidden}`);
	}
	const source = renderWayfindingFloorSvg(project, floorId);
	const floor = project.floors.find((candidate) => candidate.id === floorId);
	const presentationMarkup = presentationMode === 'visitor' && floor
		? `<rect class="visitor-floor-surface" x="0" y="0" width="${floor.width}" height="${floor.height}"/>`
		: '';

	return source.replace('>', `><style>${hiddenRules.join('')}</style>${presentationMarkup}`);
};
