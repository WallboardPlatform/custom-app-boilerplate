import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validatePackageAssets } from './package-assets/validation.mjs';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const result = validatePackageAssets(rootDirectory);

console.log(`Package asset validation passed (${result.runtimeAssetCount} runtime assets cache-listed).`);
