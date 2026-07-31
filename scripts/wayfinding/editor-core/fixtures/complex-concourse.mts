import {
	createWayfindingStudioProject,
	synchronizeWayfindingStudioGraph,
	type WayfindingStudioDoorElement,
	type WayfindingStudioPolygonElement,
	type WayfindingStudioProject
} from '../../studio-project.mts';
import type { WayfindingPoint } from '../../../../src/utils/wayfinding.js';

const DRAFT_SIZE = { height: 720, width: 1_200 } as const;

export const WAYFINDING_PROJECT_7_REFERENCE_SIZE = {
	height: 818,
	width: 1_574
} as const;

const polygon = (
	id: string,
	type: 'location' | 'obstacle' | 'walkable',
	geometry: WayfindingPoint[],
	destinationId?: string
): WayfindingStudioPolygonElement => ({
	...(destinationId ? { destinationId } : {}),
	floorId: 'level-0',
	geometry,
	id,
	label: id.replaceAll('-', ' '),
	provenance: 'reviewer-authored',
	status: 'confirmed',
	type
});

const door = (
	id: string,
	locationId: string,
	point: WayfindingPoint
): WayfindingStudioDoorElement => ({
	angle: 0,
	floorId: 'level-0',
	id,
	length: 34,
	locationId,
	point,
	provenance: 'reviewer-authored',
	status: 'confirmed',
	type: 'door'
});

const ellipse = (
	center: WayfindingPoint,
	radiusX: number,
	radiusY: number,
	vertices = 16
): WayfindingPoint[] => Array.from({ length: vertices }, (_, index) => {
	const angle = index / vertices * Math.PI * 2;

	return {
		x: center.x + Math.cos(angle) * radiusX,
		y: center.y + Math.sin(angle) * radiusY
	};
});

export const createComplexConcourseFixture = (): WayfindingStudioProject => {
	const project = createWayfindingStudioProject('Wayfinding Project 7 route stress fixture');
	const floor = project.floors[0];
	floor.width = DRAFT_SIZE.width;
	floor.height = DRAFT_SIZE.height;
	floor.unitsPerMeter = 12;
	floor.elements.push(
		polygon('walkable-concourse', 'walkable', [
			{ x: 40, y: 140 },
			{ x: 260, y: 140 },
			{ x: 300, y: 165 },
			{ x: 900, y: 165 },
			{ x: 940, y: 140 },
			{ x: 1_160, y: 140 },
			{ x: 1_160, y: 580 },
			{ x: 940, y: 580 },
			{ x: 900, y: 555 },
			{ x: 300, y: 555 },
			{ x: 260, y: 580 },
			{ x: 40, y: 580 }
		]),
		polygon('blocked-central-planter', 'obstacle', ellipse({ x: 600, y: 350 }, 92, 72)),
		polygon('blocked-lower-garden', 'obstacle', [
			{ x: 720, y: 455 },
			{ x: 840, y: 455 },
			{ x: 860, y: 525 },
			{ x: 700, y: 525 }
		]),
		{
			facingDegrees: 90,
			floorId: floor.id,
			id: 'origin-west',
			label: 'West entrance',
			point: { x: 90, y: 350 },
			provenance: 'reviewer-authored',
			screenId: 'screen-west',
			status: 'confirmed',
			type: 'origin'
		}
	);
	const topRooms = [
		{ id: 'north-a', left: 80, right: 190 },
		{ id: 'north-b', left: 220, right: 330 },
		{ id: 'north-c', left: 360, right: 470 },
		{ id: 'north-d', left: 500, right: 610 },
		{ id: 'north-e', left: 650, right: 760 },
		{ id: 'north-f', left: 800, right: 910 }
	];
	const bottomRooms = [
		{ id: 'south-a', left: 120, right: 245 },
		{ id: 'south-b', left: 305, right: 430 },
		{ id: 'south-c', left: 875, right: 1_000 },
		{ id: 'south-d', left: 1_025, right: 1_140 }
	];

	for (const room of topRooms) {
		const destinationId = `destination-${room.id}`;
		floor.elements.push(
			polygon(room.id, 'location', [
				{ x: room.left, y: 35 },
				{ x: room.right, y: 35 },
				{ x: room.right, y: 140 },
				{ x: room.left, y: 140 }
			], destinationId),
			door(`door-${room.id}`, room.id, {
				x: (room.left + room.right) / 2,
				y: 140
			})
		);
		project.destinations.push({
			floor: floor.id,
			id: destinationId,
			name: `North ${room.id.at(-1)?.toUpperCase()}`,
			routeable: true
		});
	}

	for (const room of bottomRooms) {
		const destinationId = `destination-${room.id}`;
		floor.elements.push(
			polygon(room.id, 'location', [
				{ x: room.left, y: 580 },
				{ x: room.right, y: 580 },
				{ x: room.right, y: 685 },
				{ x: room.left, y: 685 }
			], destinationId),
			door(`door-${room.id}`, room.id, {
				x: (room.left + room.right) / 2,
				y: 580
			})
		);
		project.destinations.push({
			floor: floor.id,
			id: destinationId,
			name: `South ${room.id.at(-1)?.toUpperCase()}`,
			routeable: true
		});
	}
	floor.elements.unshift(door('door-north-c-stale-link', 'north-c', { x: 1_080, y: 310 }));
	floor.elements.push({
		destinationId: 'destination-information',
		floorId: floor.id,
		id: 'poi-information',
		label: 'Information',
		point: { x: 1_075, y: 350 },
		provenance: 'reviewer-authored',
		status: 'confirmed',
		type: 'poi'
	});
	project.destinations.push({
		floor: floor.id,
		id: 'destination-information',
		name: 'Information',
		routeable: true
	});
	synchronizeWayfindingStudioGraph(project);
	project.graph.nodes.push(
		{
			authoringOwnership: 'generated',
			id: `generated:${floor.id}:stale-node-1`,
			kind: 'route',
			levelId: floor.id,
			x: 80,
			y: 350
		},
		{
			authoringOwnership: 'generated',
			id: `generated:${floor.id}:stale-node-2`,
			kind: 'route',
			levelId: floor.id,
			x: 1_100,
			y: 350
		},
		{
			authoringOwnership: 'generated',
			id: `generated:${floor.id}:stale-node-3`,
			kind: 'route',
			levelId: floor.id,
			x: 115,
			y: 350
		}
	);
	project.graph.edges.push(
		{
			accessible: true,
			authoringOwnership: 'generated',
			bidirectional: true,
			from: `generated:${floor.id}:stale-node-1`,
			geometry: [{ x: 80, y: 350 }, { x: 1_100, y: 350 }],
			id: `generated:${floor.id}:stale-edge-1`,
			kind: 'walk',
			reviewStatus: 'proposed',
			to: `generated:${floor.id}:stale-node-2`,
			traversal: 'indoor-corridor'
		},
		{
			accessible: true,
			authoringOwnership: 'generated',
			bidirectional: true,
			from: 'semantic:origin-west',
			geometry: [{ x: 90, y: 350 }, { x: 115, y: 350 }],
			id: `generated:${floor.id}:stale-edge-2`,
			kind: 'walk',
			reviewStatus: 'proposed',
			to: `generated:${floor.id}:stale-node-3`,
			traversal: 'portal'
		},
		{
			accessible: true,
			authoringOwnership: 'generated',
			bidirectional: true,
			from: 'semantic:north-a',
			geometry: [{ x: 135, y: 140 }, { x: 80, y: 350 }],
			id: `generated:${floor.id}:stale-edge-3`,
			kind: 'walk',
			reviewStatus: 'proposed',
			to: `generated:${floor.id}:stale-node-1`,
			traversal: 'portal'
		},
		{
			accessible: true,
			authoringOwnership: 'manual',
			bidirectional: true,
			from: 'semantic:origin-west',
			geometry: [{ x: 90, y: 350 }, { x: 118, y: 445 }, { x: 182.5, y: 580 }],
			id: 'manual-reviewed-edge',
			kind: 'walk',
			reviewStatus: 'confirmed',
			to: 'semantic:south-a',
			traversal: 'portal'
		}
	);
	const scaleX = WAYFINDING_PROJECT_7_REFERENCE_SIZE.width / DRAFT_SIZE.width;
	const scaleY = WAYFINDING_PROJECT_7_REFERENCE_SIZE.height / DRAFT_SIZE.height;
	const scalePoint = (point: WayfindingPoint): WayfindingPoint => ({
		x: point.x * scaleX,
		y: point.y * scaleY
	});

	for (const element of floor.elements) {
		if ('geometry' in element) element.geometry = element.geometry.map(scalePoint);

		if ('point' in element) element.point = scalePoint(element.point);

		if (element.type === 'door') element.length *= Math.sqrt(scaleX * scaleY);
	}

	for (const node of project.graph.nodes) {
		node.x *= scaleX;
		node.y *= scaleY;
	}

	for (const edge of project.graph.edges) {
		if (edge.geometry) edge.geometry = edge.geometry.map(scalePoint);
	}
	floor.width = WAYFINDING_PROJECT_7_REFERENCE_SIZE.width;
	floor.height = WAYFINDING_PROJECT_7_REFERENCE_SIZE.height;
	floor.unitsPerMeter = (floor.unitsPerMeter ?? 12) * Math.sqrt(scaleX * scaleY);

	return project;
};
