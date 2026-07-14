import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { materializeExample } from './example-materialization.mjs';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exampleId = process.argv[2];
const requestedTarget = process.argv[3];

if (!exampleId) {
	throw new Error('Usage: npm run example:materialize -- <example-id> [target-directory]');
}

const targetDirectory = path.resolve(
	rootDirectory,
	requestedTarget ?? path.join('.tmp', 'examples', exampleId)
);

materializeExample({
	rootDirectory,
	exampleId,
	targetDirectory,
	requireEmpty: Boolean(requestedTarget)
});

console.log(`Materialized '${exampleId}' at ${targetDirectory}`);
console.log('Run npm run setup, then npm run deliver -- <output-directory> in that directory.');
