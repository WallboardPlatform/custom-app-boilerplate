import path from 'node:path';

import { readAppMetadata } from './app-metadata.mjs';

const projectDirectory = path.resolve(process.argv[2] ?? process.cwd());
const metadata = readAppMetadata(projectDirectory);

console.log(`Validated app identity '${metadata.identity}'.`);
console.log('Replacement uploads must reuse the existing Wallboard app record with this identity.');
