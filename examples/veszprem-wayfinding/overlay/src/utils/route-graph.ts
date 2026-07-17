import type { RoutePoint, RouteResult } from '@interfaces/wayfinding.interface';

interface QueueNode {
	id: string;
	priority: number;
}

const distance = (left: RoutePoint, right: RoutePoint): number => {
	return Math.hypot(right.x - left.x, right.y - left.y);
};

export class RouteGraph {
	private readonly adjacency = new Map<string, Array<{ id: string; weight: number }>>();

	private readonly pointById = new Map<string, RoutePoint>();

	constructor(points: RoutePoint[], sensitivity: number) {
		for (const point of points) {
			this.pointById.set(point.id, point);
			this.adjacency.set(point.id, []);
		}

		for (let leftIndex = 0; leftIndex < points.length; leftIndex += 1) {
			for (let rightIndex = leftIndex + 1; rightIndex < points.length; rightIndex += 1) {
				const left: RoutePoint = points[leftIndex];
				const right: RoutePoint = points[rightIndex];

				if (left.endPoint && right.endPoint) continue;

				const weight: number = distance(left, right);

				if (weight > sensitivity) continue;

				this.adjacency.get(left.id)!.push({ id: right.id, weight });
				this.adjacency.get(right.id)!.push({ id: left.id, weight });
			}
		}
	}

	public route(startId: string, destinationId: string, mapRatio: number): RouteResult | undefined {
		if (startId === destinationId || !this.pointById.has(startId) || !this.pointById.has(destinationId)) {
			return undefined;
		}

		const distances = new Map<string, number>();
		const previous = new Map<string, string>();
		const queue: QueueNode[] = [];

		for (const id of this.pointById.keys()) {
			const priority: number = id === startId ? 0 : Number.POSITIVE_INFINITY;
			distances.set(id, priority);
			queue.push({ id, priority });
		}

		while (queue.length > 0) {
			queue.sort((left: QueueNode, right: QueueNode): number => left.priority - right.priority);
			const current: QueueNode = queue.shift()!;

			if (!Number.isFinite(current.priority)) break;

			if (current.id === destinationId) break;

			for (const neighbor of this.adjacency.get(current.id) ?? []) {
				const candidate: number = current.priority + neighbor.weight;

				if (candidate >= (distances.get(neighbor.id) ?? Number.POSITIVE_INFINITY)) continue;

				distances.set(neighbor.id, candidate);
				previous.set(neighbor.id, current.id);
				const queued: QueueNode | undefined = queue.find((node: QueueNode): boolean => node.id === neighbor.id);

				if (queued) queued.priority = candidate;
			}
		}

		if (!previous.has(destinationId)) return undefined;

		const pointIds: string[] = [destinationId];
		let cursor: string = destinationId;

		while (previous.has(cursor)) {
			cursor = previous.get(cursor)!;
			pointIds.unshift(cursor);
		}

		const distancePixels: number = pointIds.slice(1).reduce((sum: number, id: string, index: number): number => {
			return sum + distance(this.pointById.get(pointIds[index])!, this.pointById.get(id)!);
		}, 0);
		const walkingDistance: number = Math.max(1, Math.round(distancePixels / Math.max(0.1, mapRatio)));

		return {
			distancePixels,
			pointIds,
			walkingDistance,
			walkingSeconds: Math.max(1, Math.round(walkingDistance / 1.4))
		};
	}

	public point(id: string): RoutePoint | undefined {
		return this.pointById.get(id);
	}
}

export const extractRoutePoints = (svg: SVGSVGElement): RoutePoint[] => {
	const routePoints: RoutePoint[] = Array.from(svg.querySelectorAll('#Level0-RoutePoints circle')).map((element: Element): RoutePoint => ({
		endPoint: false,
		id: element.id,
		x: Number(element.getAttribute('cx')),
		y: Number(element.getAttribute('cy'))
	}));
	const locationPoints: RoutePoint[] = Array.from(svg.querySelectorAll('#Level0-LocationPoints circle')).map((element: Element): RoutePoint => ({
		endPoint: true,
		id: element.id,
		x: Number(element.getAttribute('cx')),
		y: Number(element.getAttribute('cy'))
	}));

	return [...routePoints, ...locationPoints].filter((point: RoutePoint): boolean => {
		return point.id !== '' && Number.isFinite(point.x) && Number.isFinite(point.y);
	});
};
