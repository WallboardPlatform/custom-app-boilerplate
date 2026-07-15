import fs from 'node:fs';
import path from 'node:path';

const measurementDirectory: string = path.resolve(process.cwd(), 'preview', 'output', 'coverage-measurements');

fs.rmSync(measurementDirectory, { recursive: true, force: true });
fs.mkdirSync(measurementDirectory, { recursive: true });
