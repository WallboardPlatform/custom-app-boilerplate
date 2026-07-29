import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
	closeWalkableMask,
	erodeWalkableMask,
	extractSkeletonNetwork,
	nearestSkeletonIndex,
	retainAnchorNetworkCore,
	skeletonizeWalkableMask
} from './centerline.mts';

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

	void it('creates a clearance inset without inventing walkable cells', (): void => {
		const source = maskFromRows([
			'.......',
			'.#####.',
			'.#####.',
			'.#####.',
			'.......'
		]);
		const inset = erodeWalkableMask(source, 7, 5, 1);

		assert.equal(inset[2 * 7 + 3], 1);
		assert.equal(inset[1 * 7 + 3], 0);
		assert.equal(inset[2 * 7 + 1], 0);
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
