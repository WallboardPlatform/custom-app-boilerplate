import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { closeWalkableMask, connectPointToSkeleton, extractSkeletonNetwork, nearestSkeletonIndex, retainAnchorNetworkCore, skeletonizeWalkableMask } from './centerline.mts';

const maskFromRows = (rows: string[]): Uint8Array => Uint8Array.from(rows.join('').split('').map((value: string): number => value === '#' ? 1 : 0));

void describe('wayfinding centerline extraction', (): void => {
	void it('closes a short crossing gap before centerline extraction', (): void => {
		const source = maskFromRows([
			'.........',
			'.###.###.',
			'.###.###.',
			'.###.###.',
			'.........'
		]);
		const closed = closeWalkableMask(source, 9, 5, 1);

		assert.equal(closed[2 * 9 + 4], 1);
	});

	void it('reduces a corridor to a one-cell centerline', (): void => {
		const source = maskFromRows([
			'.......',
			'.#####.',
			'.#####.',
			'.#####.',
			'.......'
		]);
		const skeleton = skeletonizeWalkableMask(source, 7, 5);

		assert.ok(Array.from(skeleton).reduce((sum: number, value: number): number => sum + value, 0) < 15);
		assert.ok(Array.from(skeleton).reduce((sum: number, value: number): number => sum + value, 0) >= 1);
	});

	void it('uses destination anchors as explicit network breakpoints', (): void => {
		const source = maskFromRows([
			'.......',
			'.#####.',
			'.......'
		]);
		const anchorIndex = 1 * 7 + 3;
		const network = extractSkeletonNetwork(source, 7, 3, new Set([anchorIndex]));

		assert.ok(network.nodeIndices.includes(anchorIndex));
		assert.equal(network.chains.length, 2);
	});

	void it('collapses a multi-pixel intersection into one logical junction', (): void => {
		const source = maskFromRows([
			'.........',
			'....#....',
			'....#....',
			'.#######.',
			'....#....',
			'....#....',
			'.........'
		]);
		const network = extractSkeletonNetwork(source, 9, 7);
		const junctions = network.nodeIndices.filter((index: number): boolean => network.chains.filter((chain): boolean => chain.indices[0] === index || chain.indices[chain.indices.length - 1] === index).length > 2);

		assert.equal(junctions.length, 1);
		assert.equal(network.chains.length, 4);
	});

	void it('finds the closest available centerline cell', (): void => {
		const skeleton = maskFromRows(['#...#']);

		assert.equal(nearestSkeletonIndex(skeleton, 5, { column: 3, row: 0 }), 4);
		assert.equal(nearestSkeletonIndex(skeleton, 5, { column: 3, row: 0 }, new Set([4])), 0);
	});

	void it('connects an entrance to a centerline without crossing blocked mask cells', (): void => {
		const mask = maskFromRows([
			'#######',
			'###.###',
			'###.###',
			'#######'
		]);
		const skeleton = maskFromRows([
			'.......',
			'.......',
			'......#',
			'.......'
		]);
		const path = connectPointToSkeleton(mask, skeleton, 7, 4, { column: 0, row: 2 });

		assert.ok(path);
		assert.equal(path.at(-1), 2 * 7 + 6);
		assert.ok(path.every((index: number): boolean => mask[index] === 1));
		assert.ok(!path.includes(2 * 7 + 3));
		assert.ok(path.some((index: number): boolean => Math.floor(index / 7) !== 2));
	});

	void it('removes dangling branches that do not terminate at destination anchors', (): void => {
		const core = retainAnchorNetworkCore(
			['left', 'junction', 'right', 'dead-end'],
			[
				{ id: 'left-junction', from: 'left', to: 'junction' },
				{ id: 'junction-right', from: 'junction', to: 'right' },
				{ id: 'junction-dead-end', from: 'junction', to: 'dead-end' }
			],
			new Set(['left', 'right'])
		);

		assert.deepEqual(Array.from(core.edgeIds).sort(), ['junction-right', 'left-junction']);
		assert.ok(!core.nodeIds.has('dead-end'));
	});
});
