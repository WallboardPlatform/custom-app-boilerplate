import childProcess from 'node:child_process';
import { createRequire } from 'node:module';

import { findAvailablePort } from '../playwright/free-port.mjs';

const port = await findAvailablePort({ startPort: 5198 });
const require = createRequire(import.meta.url);
const playwrightCli = require.resolve('@playwright/test/cli');
const result = childProcess.spawnSync(
	process.execPath,
	[playwrightCli, 'test', '--config', 'scripts/custom-settings-editor/playwright.config.ts'],
	{
		cwd: process.cwd(),
		env: { ...process.env, WALLBOARD_CUSTOM_EDITOR_PORT: String(port) },
		stdio: 'inherit'
	}
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
