import {
	createWayfindingStudioProject,
	synchronizeWayfindingStudioGraph,
	type WayfindingStudioDoorElement,
	type WayfindingStudioPolygonElement,
	type WayfindingStudioProject
} from '../../studio-project.mts';
import type { WayfindingPoint } from '../../../../src/utils/wayfinding.js';

type PointTuple = readonly [number, number];

const points = (values: readonly PointTuple[]): WayfindingPoint[] =>
	values.map(([x, y]) => ({ x, y }));

const polygon = (
	id: string,
	type: 'location' | 'obstacle' | 'walkable',
	geometry: readonly PointTuple[],
	destinationId?: string
): WayfindingStudioPolygonElement => ({
	...(destinationId ? { destinationId } : {}),
	floorId: 'level-0',
	geometry: points(geometry),
	id,
	provenance: 'reviewer-authored',
	status: 'confirmed',
	type
});

const door = (
	id: string,
	locationId: string,
	point: WayfindingPoint,
	angle: number
): WayfindingStudioDoorElement => ({
	angle,
	floorId: 'level-0',
	id,
	length: 42,
	locationId,
	point,
	provenance: 'reviewer-authored',
	status: 'confirmed',
	type: 'door'
});

/**
 * Sanitized from the irregular atrium in the user's Project 9. It intentionally
 * preserves concave boundaries, tiny doorway notches, a central organic
 * obstacle, curved concourse edges, and two heavily overlapping traced rooms.
 */
export const createIrregularAtriumFixture = (
	options: { includeOverlappingRoomEntrance?: boolean } = {}
): WayfindingStudioProject => {
	const project = createWayfindingStudioProject('Irregular atrium routing fixture');
	const floor = project.floors[0];
	floor.width = 1_574;
	floor.height = 818;
	floor.unitsPerMeter = 12;

	const destinations = [
		['destination-west', 'West gallery'],
		['destination-north-a', 'North gallery A'],
		['destination-north-b', 'North gallery B'],
		['destination-south-a', 'South gallery A'],
		['destination-south-b', 'South gallery B']
	] as const;

	project.destinations.push(...destinations.map(([id, name]) => ({
		floor: floor.id,
		id,
		name,
		routeable: true
	})));

	floor.elements.push(
		polygon('room-west', 'location', [
			[184, 258], [210, 256], [228, 262], [286, 318], [306, 358], [294, 376], [304, 378], [308, 388],
			[308, 472], [294, 476], [298, 492], [286, 496], [82, 678], [48, 630], [50, 626], [38, 606],
			[30, 572], [30, 520], [64, 516], [70, 444], [64, 440], [66, 404], [30, 400], [28, 304],
			[32, 300], [30, 292], [40, 286], [42, 268], [66, 218], [90, 196]
		], 'destination-west'),
		polygon('room-north-a', 'location', [
			[380, 116], [380, 224], [370, 228], [368, 322], [352, 320], [350, 314], [356, 310],
			[352, 304], [334, 306], [298, 270], [298, 226], [282, 222], [284, 116]
		], 'destination-north-a'),
		polygon('room-north-b', 'location', [
			[522, 114], [522, 168], [496, 174], [498, 304], [470, 322], [436, 322],
			[432, 318], [434, 232], [388, 228], [390, 118], [398, 114]
		], 'destination-north-b'),
		polygon('room-south-a', 'location', [
			[434, 514], [444, 528], [452, 526], [456, 514], [488, 516], [488, 632],
			[526, 636], [526, 662], [542, 666], [540, 716], [420, 714], [418, 518]
		], 'destination-south-a'),
		polygon('room-south-b', 'location', [
			[434, 514], [444, 528], [452, 526], [456, 514], [488, 516], [486, 630],
			[504, 632], [506, 636], [526, 634], [524, 660], [530, 666], [542, 666],
			[538, 716], [528, 712], [492, 712], [490, 716], [420, 712], [420, 524]
		], 'destination-south-b'),
		door('door-west', 'room-west', { x: 308, y: 417.2497661365762 }, 90),
		door('door-north-a', 'room-north-a', { x: 318.7072029934519, y: 291.47240411599626 }, -135),
		door('door-north-b', 'room-north-b', { x: 452.9897100093545, y: 322 }, 180),
		door('door-south-a', 'room-south-a', { x: 462.5153058453231, y: 514.4072066153327 }, 3.5763343749973515),
		polygon('walkable-atrium', 'walkable', [
			[798, 122], [800, 132], [820, 138], [820, 280], [824, 284], [870, 288], [928, 304], [974, 322],
			[1086, 322], [1090, 306], [1102, 316], [1172, 354], [1170, 364], [1174, 368], [1304, 372],
			[1316, 332], [1346, 286], [1346, 272], [1356, 266], [1372, 270], [1374, 278], [1348, 314],
			[1328, 354], [1326, 366], [1336, 370], [1342, 380], [1324, 386], [1324, 470], [1342, 474],
			[1340, 482], [1328, 488], [1328, 494], [1370, 546], [1368, 556], [1352, 566], [1268, 510],
			[1180, 508], [1174, 512], [966, 510], [962, 526], [952, 524], [950, 512], [940, 512],
			[892, 534], [888, 540], [874, 540], [852, 550], [844, 564], [808, 574], [744, 570],
			[722, 562], [662, 526], [622, 512], [586, 508], [518, 510], [514, 526], [504, 520],
			[500, 508], [456, 508], [450, 514], [448, 526], [440, 522], [438, 510], [402, 508],
			[394, 526], [386, 522], [384, 510], [304, 522], [284, 532], [272, 546], [268, 544],
			[268, 558], [260, 552], [250, 558], [244, 556], [244, 548], [260, 532], [260, 526],
			[306, 492], [296, 478], [314, 474], [314, 378], [296, 374], [302, 364], [312, 360],
			[308, 340], [294, 316], [256, 278], [260, 266], [270, 270], [280, 266], [282, 232],
			[292, 234], [292, 272], [332, 312], [348, 304], [352, 312], [344, 320], [350, 326],
			[478, 326], [484, 312], [490, 314], [490, 324], [500, 328], [504, 324], [518, 326],
			[524, 314], [540, 322], [602, 324], [644, 308], [644, 292], [648, 288], [656, 300],
			[686, 292], [750, 284], [754, 280], [752, 138], [764, 132], [770, 134], [774, 122],
			[780, 122], [784, 128]
		]),
		polygon('blocked-planter', 'obstacle', [
			[746, 338], [724, 356], [718, 354], [714, 358], [716, 366], [700, 390], [692, 422],
			[714, 484], [740, 502], [768, 512], [810, 510], [852, 486], [868, 454], [874, 426],
			[870, 396], [860, 372], [852, 364], [852, 356], [844, 356], [838, 348], [816, 336], [786, 330]
		]),
		{
			facingDegrees: 0,
			floorId: floor.id,
			id: 'origin-atrium',
			label: 'You are here',
			point: { x: 943.4552173960011, y: 401.1759151996939 },
			provenance: 'reviewer-authored',
			screenId: 'screen-atrium',
			status: 'confirmed',
			type: 'origin'
		}
	);

	if (options.includeOverlappingRoomEntrance) {
		floor.elements.push(
			door('door-south-b', 'room-south-b', { x: 470, y: 514.875 }, 3.5763343749973515)
		);
	}

	synchronizeWayfindingStudioGraph(project);

	return project;
};
