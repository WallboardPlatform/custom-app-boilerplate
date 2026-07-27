import fs from 'node:fs';
import path from 'node:path';

import { chromium } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';

import { collectScreenshotFiles } from './model.mts';

const COLUMNS = 4;
const CELL_WIDTH = 340;
const CELL_HEIGHT = 240;

export interface ContactSheetCell {
	file: string;
	width: number;
	height: number;
}

/**
 * PNG dimensions come from the IHDR chunk, which always starts at byte 16. Reading the header
 * avoids an image dependency for what is ultimately two big-endian integers.
 */
export const readPngSize = (bytes: Buffer): { width: number; height: number } => {
	if (bytes.length < 24 || bytes.readUInt32BE(12) !== 0x49484452) {
		return { width: 0, height: 0 };
	}

	return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
};

const escapeHtml = (value: string): string => {
	return value.replace(/[&<>"]/g, (character: string): string => {
		return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[character] ?? character;
	});
};

export const buildContactSheetHtml = (cells: readonly ContactSheetCell[], title: string): string => {
	const figures: string = cells.map((cell: ContactSheetCell): string => {
		const dimensions: string = cell.width > 0 ? `${cell.width}×${cell.height}` : 'unreadable';

		return `<figure>
			<div class="frame"><img src="${escapeHtml(cell.file)}" alt=""></div>
			<figcaption><span class="name">${escapeHtml(path.basename(cell.file, '.png'))}</span><span class="size">${dimensions}</span></figcaption>
		</figure>`;
	}).join('\n');

	return `<!doctype html>
<html><head><meta charset="utf-8"><style>
	* { box-sizing: border-box; }
	body { margin: 0; padding: 28px; background: #eef1f5; font-family: ui-sans-serif, system-ui, sans-serif; }
	h1 { margin: 0 0 6px; font-size: 20px; color: #16202e; }
	p.meta { margin: 0 0 22px; font-size: 13px; color: #5a6b7e; }
	.grid { display: grid; grid-template-columns: repeat(${COLUMNS}, ${CELL_WIDTH}px); gap: 22px; }
	figure { margin: 0; }
	.frame {
		display: flex; align-items: center; justify-content: center;
		width: ${CELL_WIDTH}px; height: ${CELL_HEIGHT}px; padding: 8px;
		background: #fff; border: 1px solid #d3dae3; border-radius: 4px;
	}
	.frame img { max-width: 100%; max-height: 100%; object-fit: contain; }
	figcaption { display: flex; justify-content: space-between; gap: 10px; margin-top: 7px; font-size: 11px; }
	.name { color: #16202e; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.size { color: #7b8794; flex: none; font-variant-numeric: tabular-nums; }
</style></head><body>
	<h1>${escapeHtml(title)}</h1>
	<p class="meta">${cells.length} screenshot(s). Inspect every cell before accepting the review.</p>
	<div class="grid">${figures}</div>
</body></html>`;
};

export const renderContactSheet = async (projectDirectory: string): Promise<string | undefined> => {
	const outputDirectory: string = path.join(projectDirectory, 'preview', 'output');
	const files: string[] = collectScreenshotFiles(projectDirectory);

	if (files.length === 0) return undefined;

	const cells: ContactSheetCell[] = files.map((file: string): ContactSheetCell => {
		const absolute: string = path.join(outputDirectory, file);

		return { file: absolute.replace(/\\/g, '/'), ...readPngSize(fs.readFileSync(absolute)) };
	});
	const title: string = `${path.basename(projectDirectory)} — visual review contact sheet`;
	const htmlPath: string = path.join(projectDirectory, 'preview', 'contact-sheet.html');
	const sheetPath: string = path.join(projectDirectory, 'preview', 'contact-sheet.png');

	fs.writeFileSync(htmlPath, buildContactSheetHtml(cells, title), 'utf8');

	const browser: Browser = await chromium.launch();

	try {
		const page: Page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

		await page.goto(`file://${htmlPath.replace(/\\/g, '/')}`);
		await page.waitForFunction((): boolean => {
			return [...document.images].every((image: HTMLImageElement): boolean => image.complete);
		});
		await page.screenshot({ path: sheetPath, fullPage: true });
	} finally {
		await browser.close();
	}

	fs.rmSync(htmlPath, { force: true });

	return sheetPath;
};
