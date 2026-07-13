import fs from 'node:fs';
import path from 'node:path';

export default function globalSetup(): void {
	const screenshotDirectory: string = path.resolve(process.cwd(), 'preview', 'output');

	fs.rmSync(screenshotDirectory, { recursive: true, force: true });
	fs.mkdirSync(screenshotDirectory, { recursive: true });
}
