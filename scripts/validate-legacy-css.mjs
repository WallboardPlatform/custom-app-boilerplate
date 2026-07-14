import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateLegacyCss } from './legacy-css/validation.mjs';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const result = await validateLegacyCss(rootDirectory);

console.log(`Legacy CSS validation passed (${result.checkedFiles} stylesheet(s) checked).`);
