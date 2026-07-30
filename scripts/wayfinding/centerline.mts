export interface SkeletonChain {
	indices: number[];
}

export interface SkeletonNetwork {
	chains: SkeletonChain[];
	nodeIndices: number[];
	skeleton: Uint8Array;
}

export interface NetworkEdgeReference {
	from: string;
	id: string;
	to: string;
}

export interface AnchorNetworkCore {
	edgeIds: Set<string>;
	nodeIds: Set<string>;
}

const indexOf = (column: number, row: number, columns: number): number => row * columns + column;

const inBounds = (column: number, row: number, columns: number, rows: number): boolean => {
	return column >= 0 && row >= 0 && column < columns && row < rows;
};

const skeletonNeighbors = (index: number, mask: Uint8Array, columns: number, rows: number): number[] => {
	const column: number = index % columns;
	const row: number = Math.floor(index / columns);
	const neighbors: number[] = [];

	for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
		for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
			if (columnOffset === 0 && rowOffset === 0) continue;

			const nextColumn: number = column + columnOffset;
			const nextRow: number = row + rowOffset;

			if (!inBounds(nextColumn, nextRow, columns, rows)) continue;

			const nextIndex: number = indexOf(nextColumn, nextRow, columns);

			if (mask[nextIndex] !== 1) continue;

			if (columnOffset !== 0 && rowOffset !== 0) {
				const horizontalIndex: number = indexOf(column + columnOffset, row, columns);
				const verticalIndex: number = indexOf(column, row + rowOffset, columns);

				// A diagonal is only topologically relevant when no orthogonal path connects the cells.
				if (mask[horizontalIndex] === 1 || mask[verticalIndex] === 1) continue;
			}

			neighbors.push(nextIndex);
		}
	}

	return neighbors;
};

const morph = (source: Uint8Array, columns: number, rows: number, radius: number, mode: 'dilate' | 'erode'): Uint8Array => {
	const result = new Uint8Array(source.length);

	for (let row = 0; row < rows; row += 1) {
		for (let column = 0; column < columns; column += 1) {
			let matches: boolean = mode === 'erode';

			for (let rowOffset = -radius; rowOffset <= radius; rowOffset += 1) {
				for (let columnOffset = -radius; columnOffset <= radius; columnOffset += 1) {
					if (columnOffset * columnOffset + rowOffset * rowOffset > radius * radius) continue;

					const sampleColumn: number = column + columnOffset;
					const sampleRow: number = row + rowOffset;
					const active: boolean = inBounds(sampleColumn, sampleRow, columns, rows)
						&& source[indexOf(sampleColumn, sampleRow, columns)] === 1;

					if (mode === 'dilate' && active) matches = true;

					if (mode === 'erode' && !active) matches = false;
				}
			}

			result[indexOf(column, row, columns)] = matches ? 1 : 0;
		}
	}

	return result;
};

export const closeWalkableMask = (source: Uint8Array, columns: number, rows: number, radius: number): Uint8Array => {
	if (radius <= 0) return new Uint8Array(source);

	return morph(morph(source, columns, rows, radius, 'dilate'), columns, rows, radius, 'erode');
};

export const erodeWalkableMask = (
	source: Uint8Array,
	columns: number,
	rows: number,
	radius: number
): Uint8Array => {
	if (radius <= 0) return new Uint8Array(source);

	return morph(source, columns, rows, radius, 'erode');
};

const transitionCount = (values: readonly number[]): number => values.reduce((count: number, value: number, index: number): number => {
	return count + (value === 0 && values[(index + 1) % values.length] === 1 ? 1 : 0);
}, 0);

export const skeletonizeWalkableMask = (source: Uint8Array, columns: number, rows: number): Uint8Array => {
	const skeleton = new Uint8Array(source);
	let changed = true;

	while (changed) {
		changed = false;

		for (const phase of [0, 1] as const) {
			const removals: number[] = [];

			for (let row = 1; row < rows - 1; row += 1) {
				for (let column = 1; column < columns - 1; column += 1) {
					const index: number = indexOf(column, row, columns);

					if (skeleton[index] === 0) continue;

					const north: number = skeleton[indexOf(column, row - 1, columns)];
					const northEast: number = skeleton[indexOf(column + 1, row - 1, columns)];
					const east: number = skeleton[indexOf(column + 1, row, columns)];
					const southEast: number = skeleton[indexOf(column + 1, row + 1, columns)];
					const south: number = skeleton[indexOf(column, row + 1, columns)];
					const southWest: number = skeleton[indexOf(column - 1, row + 1, columns)];
					const west: number = skeleton[indexOf(column - 1, row, columns)];
					const northWest: number = skeleton[indexOf(column - 1, row - 1, columns)];
					const neighbors = [north, northEast, east, southEast, south, southWest, west, northWest];
					const activeNeighbors: number = neighbors.reduce((sum: number, value: number): number => sum + value, 0);

					if (activeNeighbors < 2 || activeNeighbors > 6 || transitionCount(neighbors) !== 1) continue;

					const firstCondition: boolean = phase === 0
						? north * east * south === 0 && east * south * west === 0
						: north * east * west === 0 && north * south * west === 0;

					if (firstCondition) removals.push(index);
				}
			}

			for (const index of removals) skeleton[index] = 0;

			if (removals.length > 0) changed = true;
		}
	}

	return skeleton;
};

const connectionKey = (left: number, right: number): string => left < right ? `${left}:${right}` : `${right}:${left}`;

export const extractSkeletonNetwork = (
	source: Uint8Array,
	columns: number,
	rows: number,
	anchorIndices: ReadonlySet<number> = new Set<number>()
): SkeletonNetwork => {
	const skeleton: Uint8Array = skeletonizeWalkableMask(source, columns, rows);
	const criticalIndices = new Set<number>();

	for (let index = 0; index < skeleton.length; index += 1) {
		if (skeleton[index] === 0) continue;

		const degree: number = skeletonNeighbors(index, skeleton, columns, rows).length;

		if (degree !== 2 || anchorIndices.has(index)) criticalIndices.add(index);
	}

	const clusters: number[][] = [];
	const clusterByIndex = new Map<number, number>();

	for (const anchorIndex of anchorIndices) {
		if (skeleton[anchorIndex] !== 1) continue;

		clusterByIndex.set(anchorIndex, clusters.length);
		clusters.push([anchorIndex]);
	}

	for (const startIndex of criticalIndices) {
		if (anchorIndices.has(startIndex) || clusterByIndex.has(startIndex)) continue;

		const clusterIndex: number = clusters.length;
		const members: number[] = [];
		const queue: number[] = [startIndex];
		clusterByIndex.set(startIndex, clusterIndex);

		for (let cursor = 0; cursor < queue.length; cursor += 1) {
			const currentIndex: number = queue[cursor];
			members.push(currentIndex);

			for (const neighborIndex of skeletonNeighbors(currentIndex, skeleton, columns, rows)) {
				if (!criticalIndices.has(neighborIndex) || anchorIndices.has(neighborIndex) || clusterByIndex.has(neighborIndex)) continue;

				clusterByIndex.set(neighborIndex, clusterIndex);
				queue.push(neighborIndex);
			}
		}

		clusters.push(members);
	}

	const representatives: number[] = clusters.map((members: number[]): number => {
		if (members.length === 1) return members[0];

		const centroid = members.reduce((total, index: number) => ({
			column: total.column + index % columns,
			row: total.row + Math.floor(index / columns)
		}), { column: 0, row: 0 });
		centroid.column /= members.length;
		centroid.row /= members.length;

		return members.reduce((nearest: number, candidate: number): number => {
			const candidateDistance: number = (candidate % columns - centroid.column) ** 2 + (Math.floor(candidate / columns) - centroid.row) ** 2;
			const nearestDistance: number = (nearest % columns - centroid.column) ** 2 + (Math.floor(nearest / columns) - centroid.row) ** 2;

			return candidateDistance < nearestDistance ? candidate : nearest;
		}, members[0]);
	});
	const clusterMemberSets: Set<number>[] = clusters.map((members: number[]): Set<number> => new Set(members));
	const pathWithinCluster = (clusterIndex: number, fromIndex: number, toIndex: number): number[] => {
		if (fromIndex === toIndex) return [fromIndex];

		const members: Set<number> = clusterMemberSets[clusterIndex];
		const queue: number[] = [fromIndex];
		const previousByIndex = new Map<number, number>();
		const visited = new Set<number>([fromIndex]);

		for (let cursor = 0; cursor < queue.length; cursor += 1) {
			const currentIndex: number = queue[cursor];

			for (const neighborIndex of skeletonNeighbors(currentIndex, skeleton, columns, rows)) {
				if (!members.has(neighborIndex) || visited.has(neighborIndex)) continue;

				visited.add(neighborIndex);
				previousByIndex.set(neighborIndex, currentIndex);
				queue.push(neighborIndex);
			}
		}

		if (!visited.has(toIndex)) return [fromIndex, toIndex];

		const path: number[] = [toIndex];
		let currentIndex: number = toIndex;

		while (currentIndex !== fromIndex) {
			currentIndex = previousByIndex.get(currentIndex)!;
			path.push(currentIndex);
		}

		return path.reverse();
	};

	const visited = new Set<string>();
	const chains: SkeletonChain[] = [];

	for (const [startClusterIndex, members] of clusters.entries()) {
		for (const startIndex of members) {
			for (const neighborIndex of skeletonNeighbors(startIndex, skeleton, columns, rows)) {
				if (clusterByIndex.get(neighborIndex) === startClusterIndex || visited.has(connectionKey(startIndex, neighborIndex))) continue;

				const indices: number[] = pathWithinCluster(startClusterIndex, representatives[startClusterIndex], startIndex);
				indices.push(neighborIndex);
				let previousIndex: number = startIndex;
				let currentIndex: number = neighborIndex;
				visited.add(connectionKey(previousIndex, currentIndex));

				while (true) {
					const endClusterIndex: number | undefined = clusterByIndex.get(currentIndex);

					if (endClusterIndex !== undefined) {
						const endIndex: number = representatives[endClusterIndex];

						if (indices[indices.length - 1] !== endIndex) {
							indices.push(...pathWithinCluster(endClusterIndex, currentIndex, endIndex).slice(1));
						}

						if (endClusterIndex !== startClusterIndex) chains.push({ indices });
						break;
					}

					const nextIndices: number[] = skeletonNeighbors(currentIndex, skeleton, columns, rows)
						.filter((candidate: number): boolean => candidate !== previousIndex);

					if (nextIndices.length === 0) break;

					const nextIndex: number = nextIndices[0];
					previousIndex = currentIndex;
					currentIndex = nextIndex;
					visited.add(connectionKey(previousIndex, currentIndex));
					indices.push(currentIndex);
				}
			}
		}
	}

	return { chains, nodeIndices: representatives, skeleton };
};

export const nearestSkeletonIndex = (
	skeleton: Uint8Array,
	columns: number,
	point: { column: number; row: number },
	excludedIndices: ReadonlySet<number> = new Set<number>()
): number | undefined => {
	let nearestIndex: number | undefined;
	let nearestDistance = Number.POSITIVE_INFINITY;

	for (let index = 0; index < skeleton.length; index += 1) {
		if (skeleton[index] === 0 || excludedIndices.has(index)) continue;

		const column: number = index % columns;
		const row: number = Math.floor(index / columns);
		const distance: number = (column - point.column) ** 2 + (row - point.row) ** 2;

		if (distance < nearestDistance) {
			nearestDistance = distance;
			nearestIndex = index;
		}
	}

	return nearestIndex;
};

export const retainAnchorNetworkCore = (
	nodeIds: Iterable<string>,
	edges: readonly NetworkEdgeReference[],
	anchorIds: ReadonlySet<string>
): AnchorNetworkCore => {
	const retainedNodeIds = new Set(nodeIds);
	const retainedEdgeIds = new Set(edges.map((edge: NetworkEdgeReference): string => edge.id));
	let changed = true;

	while (changed) {
		changed = false;
		const degree = new Map<string, number>();

		for (const edge of edges) {
			if (!retainedEdgeIds.has(edge.id)) continue;

			degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1);
			degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1);
		}

		const removableNodeIds = Array.from(retainedNodeIds)
			.filter((nodeId: string): boolean => !anchorIds.has(nodeId) && (degree.get(nodeId) ?? 0) <= 1);

		if (removableNodeIds.length === 0) continue;

		changed = true;
		const removableSet = new Set(removableNodeIds);

		for (const nodeId of removableNodeIds) retainedNodeIds.delete(nodeId);

		for (const edge of edges) {
			if (removableSet.has(edge.from) || removableSet.has(edge.to)) retainedEdgeIds.delete(edge.id);
		}
	}

	return { edgeIds: retainedEdgeIds, nodeIds: retainedNodeIds };
};
