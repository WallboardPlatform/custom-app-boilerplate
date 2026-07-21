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

// Route nodes are authored against the visible street, crossing, path, and stair centerlines.
// The current-location marker has distinct north-west, east, and south exits so the
// shortest path cannot leave in the wrong direction and loop back around a block.
addNode('j-tourinform-center', 374, 423);
addNode('j-tourinform-east', 396, 424);
addNode('j-square-west', 342, 388);
addNode('j-heroes-south', 354, 340);
addNode('j-heroes-west', 335, 320);
addNode('j-castle-lower-east', 300, 300);
addNode('j-castle-lower-mid', 250, 285);
addNode('j-castle-lower-west', 200, 260);
addNode('j-castle-upper-south', 155, 235);
addNode('j-castle-upper-mid', 135, 200);
addNode('j-castle-plaza', 160, 175);
addNode('j-castle-north', 135, 120);
addNode('j-benedek', 130, 75);
addNode('j-lower-stairs-top', 175, 290);
addNode('j-lower-stairs-bottom', 260, 365);

addNode('j-square-east', 420, 405);
addNode('j-boglyavari-west', 470, 395);
addNode('j-boglyavari-east', 520, 390);
addNode('j-kossuth-west', 540, 450);
addNode('j-kossuth-mid', 610, 455);
addNode('j-budapest-west', 680, 435);
addNode('j-budapest-east', 745, 405);
addNode('j-gyarkert', 795, 390);

addNode('j-horgos-east', 360, 455);
addNode('j-horgos-mid', 320, 480);
addNode('j-horgos-west', 280, 510);
addNode('j-crossing-west-north', 250, 525);
addNode('j-crossing-west-south', 250, 558);
addNode('j-virag-north', 370, 470);
addNode('j-crossing-east-north', 350, 520);
addNode('j-crossing-east-south', 350, 560);
addNode('j-ovari-mid', 400, 560);
addNode('j-ovari-east', 470, 555);
addNode('j-ovari-far-east', 540, 565);
addNode('j-park-west', 400, 595);
addNode('j-park-center', 450, 625);
addNode('j-park-east', 520, 635);
addNode('j-park-south', 525, 700);
addNode('j-fields', 530, 745);
addNode('j-acticity', 535, 830);

// Location nodes are entrances or walkable approaches, never artwork centroids.
addNode('loc-tourinform-veszprem', 384, 430, 'tourinform-veszprem');
addNode('loc-hosok-kapuja', 344, 322, 'hosok-kapuja');
addNode('loc-modern-keptar-vass-gyujtemeny', 292, 322, 'modern-keptar-vass-gyujtemeny');
addNode('loc-tuztorony', 275, 320, 'tuztorony');
addNode('loc-foton-audiovizualis-kozpont', 240, 305, 'foton-audiovizualis-kozpont');
addNode('loc-csikasz-galeria', 210, 285, 'csikasz-galeria');
addNode('loc-dubniczay-palota', 185, 270, 'dubniczay-palota');
addNode('loc-biro-giczey-haz', 155, 238, 'biro-giczey-haz');
addNode('loc-szent-istvan-templom', 136, 215, 'szent-istvan-templom');
addNode('loc-kormendy-haz', 115, 170, 'kormendy-haz');
addNode('loc-szent-istvan-es-gizella-szobor', 130, 130, 'szent-istvan-es-gizella-szobor');
addNode('loc-benedek-hegy', 130, 60, 'benedek-hegy');
addNode('loc-szent-gyorgy-kapolna', 142, 145, 'szent-gyorgy-kapolna');
addNode('loc-szent-mihaly-foszekesegyhaz', 175, 170, 'szent-mihaly-foszekesegyhaz');
addNode('loc-szentharomsag-szobor', 185, 190, 'szentharomsag-szobor');
addNode('loc-varkut', 210, 190, 'varkut');
addNode('loc-gizella-kapolna', 235, 200, 'gizella-kapolna');
addNode('loc-erseki-palota', 225, 240, 'erseki-palota');
addNode('loc-szent-imre-templom', 275, 265, 'szent-imre-templom');
addNode('loc-deak-ferenc-rendezvenykozpont', 310, 250, 'deak-ferenc-rendezvenykozpont');
addNode('loc-auer-haz', 488, 365, 'auer-haz');
addNode('loc-posa-haz', 300, 385, 'posa-haz');
addNode('loc-ruttner-haz-varborton', 170, 300, 'ruttner-haz-varborton');
addNode('loc-code-digitalis-elmenykozpont', 262, 549, 'code-digitalis-elmenykozpont');
addNode('loc-petofi-szinhaz', 395, 535, 'petofi-szinhaz');
addNode('loc-hangvilla', 485, 535, 'hangvilla');
addNode('loc-eotvos-karoly-megyei-konyvtar', 370, 590, 'eotvos-karoly-megyei-konyvtar');
addNode('loc-szent-miklos-szeg', 420, 620, 'szent-miklos-szeg');
addNode('loc-laczko-dezso-muzeum', 520, 620, 'laczko-dezso-muzeum');
addNode('loc-bakonyi-haz', 560, 650, 'bakonyi-haz');
addNode('loc-egyetemi-rekortan-sportpalyak', 530, 735, 'egyetemi-rekortan-sportpalyak');
addNode('loc-acticity', 535, 852, 'acticity');
addNode('loc-digitalis-tudaskozpont', 500, 455, 'digitalis-tudaskozpont');
addNode('loc-gyarkert-kulturpark', 800, 365, 'gyarkert-kulturpark');

addEdge('route-tourinform-egress', 'loc-tourinform-veszprem', 'j-tourinform-center', [{ x: 379, y: 426 }], { width: 9 });
addEdge('route-old-town-west', 'j-tourinform-center', 'j-square-west', [{ x: 365, y: 413 }, { x: 355, y: 410 }, { x: 348, y: 399 }], { width: 10 });
addEdge('route-heroes-approach', 'j-square-west', 'j-heroes-south', [{ x: 346, y: 375 }, { x: 350, y: 355 }], { width: 9 });
addEdge('route-heroes-gate', 'j-heroes-south', 'j-heroes-west', [{ x: 350, y: 330 }], { width: 8 });
addEdge('route-castle-lower-east', 'j-heroes-west', 'j-castle-lower-east', [{ x: 324, y: 316 }, { x: 312, y: 308 }], { width: 8 });
addEdge('route-castle-lower-mid', 'j-castle-lower-east', 'j-castle-lower-mid', [{ x: 283, y: 297 }, { x: 266, y: 291 }], { width: 8 });
addEdge('route-castle-lower-west', 'j-castle-lower-mid', 'j-castle-lower-west', [{ x: 234, y: 280 }, { x: 216, y: 269 }], { width: 8 });
addEdge('route-castle-upper-south', 'j-castle-lower-west', 'j-castle-upper-south', [{ x: 184, y: 253 }, { x: 168, y: 245 }], { width: 8 });
addEdge('route-castle-upper-mid', 'j-castle-upper-south', 'j-castle-upper-mid', [{ x: 146, y: 222 }, { x: 139, y: 208 }], { width: 8 });
addEdge('route-castle-plaza', 'j-castle-upper-mid', 'j-castle-plaza', [{ x: 144, y: 189 }, { x: 151, y: 181 }], { width: 8 });
addEdge('stairs-castle-north', 'j-castle-plaza', 'j-castle-north', [{ x: 156, y: 160 }, { x: 149, y: 145 }, { x: 141, y: 131 }], { kind: 'stairs', traversal: 'transition', width: 5 });
addEdge('route-benedek-approach', 'j-castle-north', 'j-benedek', [{ x: 130, y: 105 }, { x: 126, y: 90 }], { width: 7 });
addEdge('route-lower-stairs-entry', 'j-castle-lower-west', 'j-lower-stairs-top', [{ x: 188, y: 274 }, { x: 180, y: 284 }], { width: 7 });
addEdge('stairs-jokai-ovaros', 'j-lower-stairs-top', 'j-lower-stairs-bottom', [{ x: 188, y: 310 }, { x: 207, y: 329 }, { x: 232, y: 350 }], { kind: 'stairs', traversal: 'transition', width: 5 });
addEdge('route-lower-stairs-exit', 'j-lower-stairs-bottom', 'j-square-west', [{ x: 282, y: 373 }, { x: 310, y: 381 }], { width: 8 });

addEdge('route-tourinform-east', 'j-tourinform-center', 'j-tourinform-east', [{ x: 386, y: 425 }], { width: 10 });
addEdge('route-old-town-east', 'j-tourinform-east', 'j-square-east', [{ x: 406, y: 416 }], { width: 10 });
addEdge('route-boglyavari-west', 'j-square-east', 'j-boglyavari-west', [{ x: 438, y: 401 }, { x: 455, y: 398 }], { width: 10 });
addEdge('route-boglyavari-east', 'j-boglyavari-west', 'j-boglyavari-east', [{ x: 488, y: 392 }, { x: 505, y: 390 }], { width: 10 });
addEdge('route-buhim-kossuth', 'j-boglyavari-east', 'j-kossuth-west', [{ x: 526, y: 410 }, { x: 532, y: 432 }], { width: 10 });
addEdge('route-kossuth-west', 'j-kossuth-west', 'j-kossuth-mid', [{ x: 564, y: 454 }, { x: 588, y: 458 }], { width: 10 });
addEdge('route-kossuth-east', 'j-kossuth-mid', 'j-budapest-west', [{ x: 635, y: 451 }, { x: 660, y: 442 }], { width: 10 });
addEdge('route-budapest-west', 'j-budapest-west', 'j-budapest-east', [{ x: 702, y: 424 }, { x: 724, y: 414 }], { width: 10 });
addEdge('route-budapest-east', 'j-budapest-east', 'j-gyarkert', [{ x: 762, y: 399 }, { x: 780, y: 394 }], { width: 10 });

addEdge('route-horgos-east', 'j-tourinform-center', 'j-horgos-east', [{ x: 370, y: 435 }, { x: 365, y: 445 }], { width: 10 });
addEdge('route-horgos-mid', 'j-horgos-east', 'j-horgos-mid', [{ x: 346, y: 465 }, { x: 332, y: 475 }], { width: 9 });
addEdge('route-horgos-west', 'j-horgos-mid', 'j-horgos-west', [{ x: 306, y: 491 }, { x: 292, y: 501 }], { width: 9 });
addEdge('route-crossing-west-entry', 'j-horgos-west', 'j-crossing-west-north', [{ x: 266, y: 518 }], { width: 8 });
addEdge('crossing-ovari-west', 'j-crossing-west-north', 'j-crossing-west-south', [{ x: 250, y: 537 }, { x: 250, y: 548 }], { kind: 'walk', traversal: 'crossing', width: 5 });
addEdge('route-virag-entry', 'j-horgos-east', 'j-virag-north', [], { width: 8 });
addEdge('route-virag-benedek', 'j-virag-north', 'j-crossing-east-north', [{ x: 365, y: 486 }, { x: 358, y: 503 }], { width: 8 });
addEdge('crossing-ovari-east', 'j-crossing-east-north', 'j-crossing-east-south', [{ x: 350, y: 535 }, { x: 350, y: 548 }], { kind: 'walk', traversal: 'crossing', width: 5 });
addEdge('route-ovari-west', 'j-crossing-west-south', 'j-crossing-east-south', [{ x: 282, y: 560 }, { x: 316, y: 560 }], { width: 10 });
addEdge('route-ovari-mid', 'j-crossing-east-south', 'j-ovari-mid', [{ x: 366, y: 560 }, { x: 383, y: 560 }], { width: 10 });
addEdge('route-ovari-east', 'j-ovari-mid', 'j-ovari-east', [{ x: 424, y: 560 }, { x: 448, y: 558 }], { width: 10 });
addEdge('route-ovari-far-east', 'j-ovari-east', 'j-ovari-far-east', [{ x: 494, y: 556 }, { x: 518, y: 560 }], { width: 10 });
addEdge('route-park-entry', 'j-ovari-mid', 'j-park-west', [{ x: 398, y: 575 }], { width: 8 });
addEdge('route-park-west', 'j-park-west', 'j-park-center', [{ x: 416, y: 607 }, { x: 433, y: 618 }], { width: 8 });
addEdge('route-park-east', 'j-park-center', 'j-park-east', [{ x: 472, y: 630 }, { x: 495, y: 633 }], { width: 8 });
addEdge('route-park-south', 'j-park-east', 'j-park-south', [{ x: 522, y: 656 }, { x: 524, y: 678 }], { width: 8 });
addEdge('route-fields', 'j-park-south', 'j-fields', [{ x: 527, y: 716 }], { width: 8 });
addEdge('route-acticity', 'j-fields', 'j-acticity', [{ x: 532, y: 774 }, { x: 534, y: 802 }], { width: 8 });

const connectLocation = (id: string, from: string, to: string, geometry: WayfindingPoint[] = [], width = 6): void => {
	addEdge(`approach-${id.replace(/^loc-/, '')}`, from, to, geometry, { width });
};

connectLocation('loc-hosok-kapuja', 'loc-hosok-kapuja', 'j-heroes-west', []);
connectLocation('loc-modern-keptar-vass-gyujtemeny', 'loc-modern-keptar-vass-gyujtemeny', 'j-castle-lower-east', [{ x: 294, y: 312 }]);
connectLocation('loc-tuztorony', 'loc-tuztorony', 'j-castle-lower-east', [{ x: 284, y: 312 }]);
connectLocation('loc-foton-audiovizualis-kozpont', 'loc-foton-audiovizualis-kozpont', 'j-castle-lower-mid', [{ x: 244, y: 296 }]);
connectLocation('loc-csikasz-galeria', 'loc-csikasz-galeria', 'j-castle-lower-west', [{ x: 204, y: 274 }]);
connectLocation('loc-dubniczay-palota', 'loc-dubniczay-palota', 'j-castle-lower-west', []);
connectLocation('loc-biro-giczey-haz', 'loc-biro-giczey-haz', 'j-castle-upper-south', []);
connectLocation('loc-szent-istvan-templom', 'loc-szent-istvan-templom', 'j-castle-upper-mid', []);
connectLocation('loc-kormendy-haz', 'loc-kormendy-haz', 'j-castle-plaza', [{ x: 128, y: 174 }, { x: 145, y: 174 }]);
connectLocation('loc-szent-istvan-es-gizella-szobor', 'loc-szent-istvan-es-gizella-szobor', 'j-castle-north', []);
connectLocation('loc-benedek-hegy', 'loc-benedek-hegy', 'j-benedek', []);
connectLocation('loc-szent-gyorgy-kapolna', 'loc-szent-gyorgy-kapolna', 'j-castle-north', []);
connectLocation('loc-szent-mihaly-foszekesegyhaz', 'loc-szent-mihaly-foszekesegyhaz', 'j-castle-plaza', []);
connectLocation('loc-szentharomsag-szobor', 'loc-szentharomsag-szobor', 'j-castle-plaza', [{ x: 174, y: 184 }]);
connectLocation('loc-varkut', 'loc-varkut', 'j-castle-plaza', [{ x: 192, y: 184 }, { x: 176, y: 178 }]);
connectLocation('loc-gizella-kapolna', 'loc-gizella-kapolna', 'j-castle-plaza', [{ x: 214, y: 194 }, { x: 190, y: 184 }]);
connectLocation('loc-erseki-palota', 'loc-erseki-palota', 'j-castle-lower-west', [{ x: 216, y: 248 }]);
connectLocation('loc-szent-imre-templom', 'loc-szent-imre-templom', 'j-castle-lower-mid', [{ x: 264, y: 276 }]);
connectLocation('loc-deak-ferenc-rendezvenykozpont', 'loc-deak-ferenc-rendezvenykozpont', 'j-castle-lower-east', [{ x: 304, y: 270 }, { x: 302, y: 285 }]);
connectLocation('loc-auer-haz', 'loc-auer-haz', 'j-boglyavari-east', [{ x: 500, y: 370 }, { x: 513, y: 380 }]);
connectLocation('loc-posa-haz', 'loc-posa-haz', 'j-square-west', [{ x: 315, y: 385 }]);
connectLocation('loc-ruttner-haz-varborton', 'loc-ruttner-haz-varborton', 'j-lower-stairs-top', [{ x: 172, y: 295 }]);
connectLocation('loc-code-digitalis-elmenykozpont', 'loc-code-digitalis-elmenykozpont', 'j-crossing-west-south', [{ x: 256, y: 554 }]);
connectLocation('loc-petofi-szinhaz', 'loc-petofi-szinhaz', 'j-ovari-mid', [{ x: 398, y: 548 }]);
connectLocation('loc-hangvilla', 'loc-hangvilla', 'j-ovari-east', [{ x: 480, y: 544 }]);
connectLocation('loc-eotvos-karoly-megyei-konyvtar', 'loc-eotvos-karoly-megyei-konyvtar', 'j-park-west', [{ x: 382, y: 591 }]);
connectLocation('loc-szent-miklos-szeg', 'loc-szent-miklos-szeg', 'j-park-center', [{ x: 433, y: 622 }]);
connectLocation('loc-laczko-dezso-muzeum', 'loc-laczko-dezso-muzeum', 'j-park-east', []);
connectLocation('loc-bakonyi-haz', 'loc-bakonyi-haz', 'j-park-east', [{ x: 548, y: 646 }]);
connectLocation('loc-egyetemi-rekortan-sportpalyak', 'loc-egyetemi-rekortan-sportpalyak', 'j-fields', []);
connectLocation('loc-acticity', 'loc-acticity', 'j-acticity', []);
connectLocation('loc-digitalis-tudaskozpont', 'loc-digitalis-tudaskozpont', 'j-kossuth-west', [{ x: 518, y: 453 }]);
connectLocation('loc-gyarkert-kulturpark', 'loc-gyarkert-kulturpark', 'j-gyarkert', []);

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
