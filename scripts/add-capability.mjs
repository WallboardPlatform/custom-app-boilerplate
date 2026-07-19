import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { applyCapability } from './capability-materialization.mjs';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const capabilityId = process.argv[2];
const requestedTarget = process.argv[3];

if (!capabilityId) {
	throw new Error('Usage: npm run capability:add -- <capability-id> [target-directory]');
}

const targetDirectory = path.resolve(rootDirectory, requestedTarget ?? '.');
const result = applyCapability({ rootDirectory, targetDirectory, capabilityId });

console.log(`Added '${result.capabilityId}' capability to ${result.targetDirectory}`);
