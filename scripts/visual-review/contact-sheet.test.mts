import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildContactSheetHtml, readPngSize } from './contact-sheet.mts';

const pngHeader = (width: number, height: number): Buffer => {
	const bytes: Buffer = Buffer.alloc(24);

	bytes.writeUInt32BE(0x49484452, 12);
	bytes.writeUInt32BE(width, 16);
	bytes.writeUInt32BE(height, 20);

	return bytes;
};

void describe('contact sheet', (): void => {
	void it('reads dimensions from a PNG header', (): void => {
		assert.deepEqual(readPngSize(pngHeader(1920, 1080)), { width: 1920, height: 1080 });
	});

	void it('reports zero for a buffer that is not a PNG', (): void => {
		assert.deepEqual(readPngSize(Buffer.alloc(24)), { width: 0, height: 0 });
		assert.deepEqual(readPngSize(Buffer.alloc(4)), { width: 0, height: 0 });
	});

	void it('renders one labelled cell per screenshot', (): void => {
		const html: string = buildContactSheetHtml(
			[
				{ file: '/out/app-default-1920x1080.png', width: 1920, height: 1080 },
				{ file: '/out/portrait-1080x1920.png', width: 1080, height: 1920 }
			],
			'demo'
		);

		assert.equal(html.match(/<figure>/g)?.length, 2);
		assert.ok(html.includes('app-default-1920x1080'));
		assert.ok(html.includes('1920×1080'));
		assert.ok(html.includes('2 screenshot(s)'));
	});

	void it('marks a screenshot whose header could not be read', (): void => {
		const html: string = buildContactSheetHtml([{ file: '/out/broken.png', width: 0, height: 0 }], 'demo');

		assert.ok(html.includes('unreadable'));
	});

	void it('escapes titles and file names', (): void => {
		const html: string = buildContactSheetHtml([{ file: '/out/a&b.png', width: 1, height: 1 }], '<script>');

		assert.ok(!html.includes('<script>'));
		assert.ok(html.includes('&lt;script&gt;'));
		assert.ok(html.includes('a&amp;b'));
	});
});
