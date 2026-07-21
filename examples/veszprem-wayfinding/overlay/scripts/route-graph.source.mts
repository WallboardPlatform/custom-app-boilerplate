import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
	WayfindingEdge,
	WayfindingEdgeKind,
	WayfindingGraphDocument,
	WayfindingNode,
	WayfindingPoint,
	WayfindingTraversal,
	WayfindingWalkableMaskDocument,
	WayfindingWalkableMaskRun
} from '../src/utils/wayfinding.js';

const LEVEL_ID = 'downtown';
const nodes: WayfindingNode[] = [];
const edges: WayfindingEdge[] = [];
const nodeById = new Map<string, WayfindingNode>();

const addNode = (id: string, x: number, y: number, locationId?: string): void => {
	const node: WayfindingNode = {
		id,
		kind: locationId ? 'location' : 'route',
		levelId: LEVEL_ID,
		x,
		y,
		...(locationId ? { locationId } : {})
	};

	nodes.push(node);
	nodeById.set(id, node);
};

const addEdge = (
	id: string,
	from: string,
	to: string,
	geometry: WayfindingPoint[],
	options: {
		accessible?: boolean;
		kind?: WayfindingEdgeKind;
		traversal?: WayfindingTraversal;
		width?: number;
	} = {}
): void => {
	const fromNode: WayfindingNode | undefined = nodeById.get(from);
	const toNode: WayfindingNode | undefined = nodeById.get(to);

	if (!fromNode || !toNode) throw new Error(`Unknown edge endpoint for ${id}.`);

	edges.push({
		accessible: options.accessible ?? false,
		bidirectional: true,
		corridorWidth: options.width ?? 7,
		from,
		geometry: [
			{ x: fromNode.x, y: fromNode.y },
			...geometry,
			{ x: toNode.x, y: toNode.y }
		],
		id,
		kind: options.kind ?? 'outdoor',
		reviewStatus: 'confirmed',
		to,
		traversal: options.traversal ?? 'outdoor-path'
	});
};

// Reviewed tree centerlines follow the visible streets and park paths. Location
// nodes sit on walkable approaches; the SVG hit targets remain on the artwork.
addNode('j-tourinform', 365, 412);
addNode('j-castle-turn', 340, 398);
addNode('j-castle-south', 318, 372);
addNode('j-castle-gate', 320, 332);
addNode('j-castle-lower-east', 292, 312);
addNode('j-castle-lower-mid', 266, 290);
addNode('j-castle-lower-west', 238, 260);
addNode('j-castle-mid', 205, 230);
addNode('j-castle-upper-south', 170, 205);
addNode('j-castle-upper-mid', 138, 180);
addNode('j-castle-upper-north', 115, 150);
addNode('j-castle-plaza', 112, 118);
addNode('j-benedek', 116, 82);

addNode('j-east-entry', 395, 415);
addNode('j-east-boglyavari', 425, 400);
addNode('j-east-buhim-west', 455, 380);
addNode('j-east-buhim', 490, 365);
addNode('j-east-road-west', 540, 350);
addNode('j-east-road-mid', 600, 340);
addNode('j-east-road-jutasi', 660, 342);
addNode('j-east-road-budapest', 720, 350);
addNode('j-east-road-gyarkert', 770, 355);
addNode('j-gyarkert', 790, 365);
addNode('j-digitalis-north', 500, 400);
addNode('j-digitalis', 505, 425);

addNode('j-south-entry', 355, 435);
addNode('j-horgos-east', 335, 455);
addNode('j-horgos-west', 315, 478);
addNode('j-code-east', 285, 505);
addNode('j-code-approach', 255, 535);
addNode('j-virag-west', 350, 475);
addNode('j-virag-east', 365, 495);
addNode('j-crossing-north', 370, 520);
addNode('j-crossing-south', 375, 550);
addNode('j-ovari-east', 430, 545);
addNode('j-hangvilla', 470, 540);
addNode('j-park-north', 395, 565);
addNode('j-park-center', 420, 600);
addNode('j-park-east', 470, 615);
addNode('j-park-far-east', 520, 625);
addNode('j-park-southeast', 550, 645);
addNode('j-campus-north', 450, 650);
addNode('j-campus-mid', 460, 720);
addNode('j-campus-south', 485, 790);
addNode('j-acticity', 520, 835);

addNode('loc-tourinform-veszprem', 372, 416, 'tourinform-veszprem');
addNode('loc-hosok-kapuja', 338, 322, 'hosok-kapuja');
addNode('loc-modern-keptar-vass-gyujtemeny', 292, 322, 'modern-keptar-vass-gyujtemeny');
addNode('loc-tuztorony', 276, 326, 'tuztorony');
addNode('loc-foton-audiovizualis-kozpont', 250, 303, 'foton-audiovizualis-kozpont');
addNode('loc-csikasz-galeria', 223, 280, 'csikasz-galeria');
addNode('loc-dubniczay-palota', 207, 245, 'dubniczay-palota');
addNode('loc-biro-giczey-haz', 158, 216, 'biro-giczey-haz');
addNode('loc-szent-istvan-templom', 132, 184, 'szent-istvan-templom');
addNode('loc-kormendy-haz', 108, 153, 'kormendy-haz');
addNode('loc-szent-istvan-es-gizella-szobor', 115, 128, 'szent-istvan-es-gizella-szobor');
addNode('loc-benedek-hegy', 116, 78, 'benedek-hegy');
addNode('loc-szent-gyorgy-kapolna', 130, 138, 'szent-gyorgy-kapolna');
addNode('loc-szent-mihaly-foszekesegyhaz', 168, 166, 'szent-mihaly-foszekesegyhaz');
addNode('loc-szentharomsag-szobor', 176, 187, 'szentharomsag-szobor');
addNode('loc-varkut', 198, 184, 'varkut');
addNode('loc-gizella-kapolna', 225, 188, 'gizella-kapolna');
addNode('loc-erseki-palota', 215, 225, 'erseki-palota');
addNode('loc-szent-imre-templom', 270, 266, 'szent-imre-templom');
addNode('loc-deak-ferenc-rendezvenykozpont', 300, 240, 'deak-ferenc-rendezvenykozpont');
addNode('loc-auer-haz', 480, 365, 'auer-haz');
addNode('loc-posa-haz', 300, 382, 'posa-haz');
addNode('loc-ruttner-haz-varborton', 170, 288, 'ruttner-haz-varborton');
addNode('loc-code-digitalis-elmenykozpont', 255, 545, 'code-digitalis-elmenykozpont');
addNode('loc-petofi-szinhaz', 390, 545, 'petofi-szinhaz');
addNode('loc-hangvilla', 480, 538, 'hangvilla');
addNode('loc-eotvos-karoly-megyei-konyvtar', 382, 600, 'eotvos-karoly-megyei-konyvtar');
addNode('loc-szent-miklos-szeg', 420, 625, 'szent-miklos-szeg');
addNode('loc-laczko-dezso-muzeum', 528, 625, 'laczko-dezso-muzeum');
addNode('loc-bakonyi-haz', 565, 655, 'bakonyi-haz');
addNode('loc-egyetemi-rekortan-sportpalyak', 525, 735, 'egyetemi-rekortan-sportpalyak');
addNode('loc-acticity', 535, 842, 'acticity');
addNode('loc-digitalis-tudaskozpont', 505, 432, 'digitalis-tudaskozpont');
addNode('loc-gyarkert-kulturpark', 798, 365, 'gyarkert-kulturpark');

addEdge('route-tourinform-egress', 'loc-tourinform-veszprem', 'j-tourinform', [], { width: 9 });
addEdge('route-old-town-west', 'j-tourinform', 'j-castle-turn', [{ x: 355, y: 408 }, { x: 346, y: 403 }], { width: 10 });
addEdge('route-castle-entry', 'j-castle-turn', 'j-castle-south', [{ x: 332, y: 390 }, { x: 324, y: 380 }], { width: 9 });
addEdge('route-heroes-approach', 'j-castle-south', 'j-castle-gate', [{ x: 313, y: 360 }, { x: 314, y: 344 }], { width: 8 });
addEdge('route-castle-lower-east', 'j-castle-gate', 'j-castle-lower-east', [{ x: 312, y: 325 }, { x: 302, y: 318 }], { width: 8 });
addEdge('route-castle-lower-mid', 'j-castle-lower-east', 'j-castle-lower-mid', [{ x: 284, y: 305 }, { x: 275, y: 297 }], { width: 8 });
addEdge('route-castle-lower-west', 'j-castle-lower-mid', 'j-castle-lower-west', [{ x: 257, y: 280 }, { x: 248, y: 270 }], { width: 8 });
addEdge('route-castle-mid', 'j-castle-lower-west', 'j-castle-mid', [{ x: 227, y: 251 }, { x: 216, y: 240 }], { width: 8 });
addEdge('route-castle-upper-south', 'j-castle-mid', 'j-castle-upper-south', [{ x: 194, y: 220 }, { x: 182, y: 212 }], { width: 8 });
addEdge('route-castle-upper-mid', 'j-castle-upper-south', 'j-castle-upper-mid', [{ x: 159, y: 198 }, { x: 148, y: 188 }], { width: 8 });
addEdge('route-castle-upper-north', 'j-castle-upper-mid', 'j-castle-upper-north', [{ x: 128, y: 170 }, { x: 120, y: 160 }], { width: 7 });
addEdge('stairs-castle-north', 'j-castle-upper-north', 'j-castle-plaza', [{ x: 111, y: 138 }, { x: 111, y: 128 }], { kind: 'stairs', traversal: 'transition', width: 5 });
addEdge('route-benedek-approach', 'j-castle-plaza', 'j-benedek', [{ x: 112, y: 105 }, { x: 114, y: 94 }], { width: 7 });

addEdge('route-tourinform-east', 'j-tourinform', 'j-east-entry', [{ x: 378, y: 416 }, { x: 387, y: 416 }], { width: 10 });
addEdge('route-boglyavari-west', 'j-east-entry', 'j-east-boglyavari', [{ x: 405, y: 410 }, { x: 416, y: 405 }], { width: 10 });
addEdge('route-boglyavari-mid', 'j-east-boglyavari', 'j-east-buhim-west', [{ x: 435, y: 393 }, { x: 445, y: 386 }], { width: 10 });
addEdge('route-boglyavari-east', 'j-east-buhim-west', 'j-east-buhim', [{ x: 467, y: 374 }, { x: 480, y: 368 }], { width: 10 });
addEdge('route-east-road-west', 'j-east-buhim', 'j-east-road-west', [{ x: 506, y: 360 }, { x: 523, y: 354 }], { width: 10 });
addEdge('route-east-road-mid', 'j-east-road-west', 'j-east-road-mid', [{ x: 560, y: 345 }, { x: 580, y: 342 }], { width: 10 });
addEdge('route-east-road-jutasi', 'j-east-road-mid', 'j-east-road-jutasi', [{ x: 620, y: 340 }, { x: 640, y: 341 }], { width: 10 });
addEdge('route-east-road-budapest', 'j-east-road-jutasi', 'j-east-road-budapest', [{ x: 680, y: 344 }, { x: 700, y: 347 }], { width: 10 });
addEdge('route-east-road-gyarkert', 'j-east-road-budapest', 'j-east-road-gyarkert', [{ x: 738, y: 351 }, { x: 754, y: 353 }], { width: 10 });
addEdge('route-gyarkert-approach', 'j-east-road-gyarkert', 'j-gyarkert', [{ x: 780, y: 358 }], { width: 9 });
addEdge('route-digitalis-north', 'j-east-buhim', 'j-digitalis-north', [{ x: 496, y: 378 }, { x: 499, y: 389 }], { width: 8 });
addEdge('route-digitalis-approach', 'j-digitalis-north', 'j-digitalis', [{ x: 502, y: 412 }], { width: 7 });

addEdge('route-horgos-entry', 'j-tourinform', 'j-south-entry', [{ x: 363, y: 421 }, { x: 360, y: 428 }], { width: 10 });
addEdge('route-horgos-east', 'j-south-entry', 'j-horgos-east', [{ x: 348, y: 442 }, { x: 342, y: 449 }], { width: 10 });
addEdge('route-horgos-west', 'j-horgos-east', 'j-horgos-west', [{ x: 329, y: 463 }, { x: 322, y: 470 }], { width: 9 });
addEdge('route-code-east', 'j-horgos-west', 'j-code-east', [{ x: 305, y: 486 }, { x: 295, y: 496 }], { width: 8 });
addEdge('route-code-approach', 'j-code-east', 'j-code-approach', [{ x: 275, y: 514 }, { x: 264, y: 525 }], { width: 7 });
addEdge('route-virag-west', 'j-horgos-east', 'j-virag-west', [{ x: 340, y: 463 }, { x: 345, y: 470 }], { width: 8 });
addEdge('route-virag-east', 'j-virag-west', 'j-virag-east', [{ x: 356, y: 482 }, { x: 361, y: 489 }], { width: 8 });
addEdge('route-crossing-entry', 'j-virag-east', 'j-crossing-north', [{ x: 368, y: 504 }, { x: 370, y: 512 }], { width: 7 });
addEdge('crossing-ovari-east', 'j-crossing-north', 'j-crossing-south', [{ x: 372, y: 532 }, { x: 374, y: 542 }], { kind: 'walk', traversal: 'crossing', width: 5 });
addEdge('route-ovari-east', 'j-crossing-south', 'j-ovari-east', [{ x: 392, y: 550 }, { x: 411, y: 548 }], { width: 10 });
addEdge('route-hangvilla', 'j-ovari-east', 'j-hangvilla', [{ x: 446, y: 543 }, { x: 459, y: 541 }], { width: 9 });
addEdge('route-park-entry', 'j-crossing-south', 'j-park-north', [{ x: 382, y: 556 }, { x: 389, y: 561 }], { width: 8 });
addEdge('route-park-center', 'j-park-north', 'j-park-center', [{ x: 404, y: 579 }, { x: 413, y: 590 }], { width: 8 });
addEdge('route-park-east', 'j-park-center', 'j-park-east', [{ x: 436, y: 607 }, { x: 453, y: 612 }], { width: 8 });
addEdge('route-park-far-east', 'j-park-east', 'j-park-far-east', [{ x: 487, y: 620 }, { x: 504, y: 623 }], { width: 8 });
addEdge('route-park-southeast', 'j-park-far-east', 'j-park-southeast', [{ x: 532, y: 631 }, { x: 542, y: 638 }], { width: 8 });
addEdge('route-campus-north', 'j-park-center', 'j-campus-north', [{ x: 432, y: 616 }, { x: 443, y: 635 }], { width: 8 });
addEdge('route-campus-mid', 'j-campus-north', 'j-campus-mid', [{ x: 453, y: 675 }, { x: 456, y: 698 }], { width: 8 });
addEdge('route-campus-south', 'j-campus-mid', 'j-campus-south', [{ x: 467, y: 744 }, { x: 476, y: 770 }], { width: 8 });
addEdge('route-acticity', 'j-campus-south', 'j-acticity', [{ x: 498, y: 808 }, { x: 510, y: 824 }], { width: 8 });

const connectLocation = (id: string, junction: string, geometry: WayfindingPoint[] = [], width = 6): void => {
	addEdge(`approach-${id.replace(/^loc-/, '')}`, junction, id, geometry, { width });
};

connectLocation('loc-hosok-kapuja', 'j-castle-gate', [{ x: 329, y: 326 }]);
connectLocation('loc-modern-keptar-vass-gyujtemeny', 'j-castle-lower-east', []);
connectLocation('loc-tuztorony', 'j-castle-lower-east', [{ x: 284, y: 319 }]);
connectLocation('loc-foton-audiovizualis-kozpont', 'j-castle-lower-mid', [{ x: 257, y: 297 }]);
connectLocation('loc-csikasz-galeria', 'j-castle-lower-west', [{ x: 230, y: 270 }]);
connectLocation('loc-dubniczay-palota', 'j-castle-lower-west', [{ x: 224, y: 252 }]);
connectLocation('loc-biro-giczey-haz', 'j-castle-mid', [{ x: 188, y: 224 }, { x: 173, y: 220 }]);
connectLocation('loc-szent-istvan-templom', 'j-castle-upper-south', [{ x: 154, y: 197 }, { x: 143, y: 190 }]);
connectLocation('loc-kormendy-haz', 'j-castle-upper-mid', [{ x: 126, y: 171 }, { x: 116, y: 160 }]);
connectLocation('loc-szent-istvan-es-gizella-szobor', 'j-castle-upper-north', [{ x: 115, y: 139 }]);
connectLocation('loc-benedek-hegy', 'j-benedek', []);
connectLocation('loc-szent-gyorgy-kapolna', 'j-castle-upper-north', [{ x: 122, y: 145 }]);
connectLocation('loc-szent-mihaly-foszekesegyhaz', 'j-castle-upper-south', [{ x: 169, y: 185 }]);
connectLocation('loc-szentharomsag-szobor', 'j-castle-upper-south', [{ x: 173, y: 196 }]);
connectLocation('loc-varkut', 'j-castle-upper-south', [{ x: 183, y: 198 }, { x: 191, y: 190 }]);
connectLocation('loc-gizella-kapolna', 'j-castle-mid', [{ x: 212, y: 215 }, { x: 220, y: 201 }]);
connectLocation('loc-erseki-palota', 'j-castle-mid', [{ x: 210, y: 228 }]);
connectLocation('loc-szent-imre-templom', 'j-castle-lower-mid', [{ x: 268, y: 280 }]);
connectLocation('loc-deak-ferenc-rendezvenykozpont', 'j-castle-lower-mid', [{ x: 278, y: 277 }, { x: 290, y: 258 }]);
connectLocation('loc-auer-haz', 'j-east-buhim', []);
connectLocation('loc-posa-haz', 'j-castle-turn', [{ x: 326, y: 393 }, { x: 312, y: 387 }]);
addEdge('stairs-jokai-ruttner', 'j-castle-mid', 'loc-ruttner-haz-varborton', [{ x: 192, y: 244 }, { x: 180, y: 267 }], { kind: 'stairs', traversal: 'transition', width: 5 });
connectLocation('loc-code-digitalis-elmenykozpont', 'j-code-approach', []);
connectLocation('loc-petofi-szinhaz', 'j-crossing-south', [{ x: 383, y: 548 }]);
connectLocation('loc-hangvilla', 'j-hangvilla', []);
connectLocation('loc-eotvos-karoly-megyei-konyvtar', 'j-park-center', [{ x: 405, y: 602 }, { x: 394, y: 602 }]);
connectLocation('loc-szent-miklos-szeg', 'j-park-center', [{ x: 420, y: 612 }]);
connectLocation('loc-laczko-dezso-muzeum', 'j-park-far-east', []);
connectLocation('loc-bakonyi-haz', 'j-park-southeast', [{ x: 558, y: 650 }]);
connectLocation('loc-egyetemi-rekortan-sportpalyak', 'j-campus-mid', [{ x: 485, y: 726 }, { x: 505, y: 731 }]);
connectLocation('loc-acticity', 'j-acticity', []);
connectLocation('loc-digitalis-tudaskozpont', 'j-digitalis', []);
connectLocation('loc-gyarkert-kulturpark', 'j-gyarkert', []);

const document: WayfindingGraphDocument = {
	contractVersion: 2,
	edges,
	graphId: 'veszprem-downtown-reviewed-routes',
	nodes
};

const createCorridorEnvelope = (): WayfindingWalkableMaskDocument => {
	const cellSize = 4;
	const width = 1341;
	const height = 947;
	const columns = Math.ceil(width / cellSize);
	const rows = Math.ceil(height / cellSize);
	const cells = new Set<string>();

	const markDisc = (point: WayfindingPoint, radius: number): void => {
		const minColumn = Math.max(0, Math.floor((point.x - radius) / cellSize));
		const maxColumn = Math.min(columns - 1, Math.floor((point.x + radius) / cellSize));
		const minRow = Math.max(0, Math.floor((point.y - radius) / cellSize));
		const maxRow = Math.min(rows - 1, Math.floor((point.y + radius) / cellSize));

		for (let row = minRow; row <= maxRow; row += 1) {
			for (let column = minColumn; column <= maxColumn; column += 1) {
				const cellCenter = { x: column * cellSize + cellSize / 2, y: row * cellSize + cellSize / 2 };

				if (Math.hypot(cellCenter.x - point.x, cellCenter.y - point.y) <= radius) cells.add(`${row}:${column}`);
			}
		}
	};

	for (const edge of edges) {
		const points = edge.geometry ?? [];
		const radius = (edge.corridorWidth ?? 8) / 2 + cellSize * 1.5;

		for (let index = 1; index < points.length; index += 1) {
			const from = points[index - 1];
			const to = points[index];
			const length = Math.hypot(to.x - from.x, to.y - from.y);
			const samples = Math.max(1, Math.ceil(length / (cellSize / 2)));

			for (let sample = 0; sample <= samples; sample += 1) {
				const ratio = sample / samples;
				markDisc({ x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio }, radius);
			}
		}
	}

	const columnsByRow = new Map<number, number[]>();

	for (const key of cells) {
		const [row, column] = key.split(':').map(Number);
		const rowColumns = columnsByRow.get(row) ?? [];
		rowColumns.push(column);
		columnsByRow.set(row, rowColumns);
	}

	const walkableRuns: WayfindingWalkableMaskRun[] = [];

	for (const [row, rowColumns] of [...columnsByRow.entries()].sort(([left], [right]): number => left - right)) {
		const sorted = [...new Set(rowColumns)].sort((left, right): number => left - right);
		let start = sorted[0];
		let end = sorted[0];

		for (const column of sorted.slice(1)) {
			if (column === end + 1) {
				end = column;

				continue;
			}

			walkableRuns.push([row, start, end]);
			start = column;
			end = column;
		}

		walkableRuns.push([row, start, end]);
	}

	return {
		cellSize,
		columns,
		contractVersion: 1,
		height,
		mapId: 'veszprem-downtown-reviewed-corridor-envelope',
		reviewStatus: 'confirmed',
		rows,
		walkableRuns,
		width
	};
};

const assetsDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'assets');
const graphOutputPath = path.join(assetsDirectory, 'route-graph.json');
const maskOutputPath = path.join(assetsDirectory, 'walkable-mask.json');
await Promise.all([
	writeFile(graphOutputPath, `${JSON.stringify(document, null, '\t')}\n`),
	writeFile(maskOutputPath, `${JSON.stringify(createCorridorEnvelope(), null, '\t')}\n`)
]);
process.stdout.write(`Wrote ${nodes.length} nodes, ${edges.length} reviewed edges, and the corridor regression envelope.\n`);
