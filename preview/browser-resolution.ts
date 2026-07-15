import fs from 'node:fs';
import path from 'node:path';

export type PlaywrightBrowserChannel =
	| 'chromium'
	| 'chrome'
	| 'chrome-beta'
	| 'chrome-dev'
	| 'chrome-canary'
	| 'msedge'
	| 'msedge-beta'
	| 'msedge-dev'
	| 'msedge-canary';

export interface PlaywrightBrowserResolution {
	source: 'explicit-executable' | 'explicit-channel' | 'playwright-cache' | 'system-channel';
	channel?: PlaywrightBrowserChannel;
	executablePath?: string;
}

export interface PlaywrightBrowserResolutionOptions {
	bundledExecutablePath: string;
	environment?: NodeJS.ProcessEnv;
	pathExists?: (candidatePath: string) => boolean;
	platform?: NodeJS.Platform;
}

const supportedChannels: PlaywrightBrowserChannel[] = [
	'chromium',
	'chrome',
	'chrome-beta',
	'chrome-dev',
	'chrome-canary',
	'msedge',
	'msedge-beta',
	'msedge-dev',
	'msedge-canary'
];

const isSupportedChannel = (value: string): value is PlaywrightBrowserChannel => {
	return supportedChannels.includes(value as PlaywrightBrowserChannel);
};

const existingSystemChannel = (
	platform: NodeJS.Platform,
	environment: NodeJS.ProcessEnv,
	pathExists: (candidatePath: string) => boolean
): PlaywrightBrowserChannel | undefined => {
	const candidates: Array<{ channel: PlaywrightBrowserChannel; paths: string[] }> = [];

	if (platform === 'win32') {
		const programFiles: string[] = [
			environment.PROGRAMFILES,
			environment['PROGRAMFILES(X86)'],
			environment.LOCALAPPDATA
		].filter((value: string | undefined): value is string => Boolean(value));

		candidates.push(
			{
				channel: 'chrome',
				paths: programFiles.map((directory: string): string => {
					return path.join(directory, 'Google', 'Chrome', 'Application', 'chrome.exe');
				})
			},
			{
				channel: 'msedge',
				paths: programFiles.map((directory: string): string => {
					return path.join(directory, 'Microsoft', 'Edge', 'Application', 'msedge.exe');
				})
			}
		);
	} else if (platform === 'darwin') {
		candidates.push(
			{ channel: 'chrome', paths: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'] },
			{ channel: 'msedge', paths: ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'] }
		);
	} else {
		candidates.push(
			{ channel: 'chrome', paths: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'] },
			{ channel: 'msedge', paths: ['/usr/bin/microsoft-edge', '/usr/bin/microsoft-edge-stable'] }
		);
	}

	return candidates.find((candidate): boolean => candidate.paths.some(pathExists))?.channel;
};

export const resolvePlaywrightBrowser = (
	options: PlaywrightBrowserResolutionOptions
): PlaywrightBrowserResolution => {
	const environment: NodeJS.ProcessEnv = options.environment ?? process.env;
	const pathExists: (candidatePath: string) => boolean = options.pathExists ?? fs.existsSync;
	const platform: NodeJS.Platform = options.platform ?? process.platform;
	const requestedExecutablePath: string = environment.WALLBOARD_PLAYWRIGHT_EXECUTABLE_PATH?.trim() ?? '';
	const requestedChannel: string = environment.WALLBOARD_PLAYWRIGHT_CHANNEL?.trim().toLowerCase() ?? '';

	if (requestedExecutablePath && requestedChannel) {
		throw new Error(
			'Use either WALLBOARD_PLAYWRIGHT_EXECUTABLE_PATH or WALLBOARD_PLAYWRIGHT_CHANNEL, not both.'
		);
	}

	if (requestedExecutablePath) {
		const executablePath: string = path.resolve(requestedExecutablePath);

		if (!pathExists(executablePath)) {
			throw new Error(`WALLBOARD_PLAYWRIGHT_EXECUTABLE_PATH does not exist: ${executablePath}`);
		}

		return { source: 'explicit-executable', executablePath };
	}

	if (requestedChannel) {
		if (!isSupportedChannel(requestedChannel)) {
			throw new Error(
				`Unsupported WALLBOARD_PLAYWRIGHT_CHANNEL '${requestedChannel}'. Use ${supportedChannels.join(', ')}.`
			);
		}

		return { source: 'explicit-channel', channel: requestedChannel };
	}

	if (options.bundledExecutablePath && pathExists(options.bundledExecutablePath)) {
		return { source: 'playwright-cache' };
	}

	const systemChannel: PlaywrightBrowserChannel | undefined = existingSystemChannel(
		platform,
		environment,
		pathExists
	);

	if (systemChannel) {
		return { source: 'system-channel', channel: systemChannel };
	}

	throw new Error(
		[
			'No Playwright-compatible browser was found.',
			'Install the pinned browser with `npx playwright install chromium`,',
			'set PLAYWRIGHT_BROWSERS_PATH to a shared Playwright cache,',
			'or set WALLBOARD_PLAYWRIGHT_CHANNEL=chrome|msedge.',
			'Use `npm run deliver:unverified -- <output-directory>` only for a clearly marked non-upload-ready handoff.'
		].join(' ')
	);
};
