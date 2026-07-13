/**
 * Chrome 49 build service
 */
import { spawn, ChildProcess } from 'child_process';
import { BaseService, ServiceConfig } from './abstract';
import { ProgressLogger } from '../../../logger';
import { WBPluginMetadata } from '../types';

export interface Chrome49ServiceConfig extends ServiceConfig {
	isDevelopment: boolean;
	progressLogger?: ProgressLogger<WBPluginMetadata>;
}

export class Chrome49Service extends BaseService {
	private config: Chrome49ServiceConfig;
	private progressLogger?: ProgressLogger<WBPluginMetadata>;

	constructor(config: Chrome49ServiceConfig) {
		super(config);
		this.config = config;
		this.progressLogger = config.progressLogger;
	}

	/**
	 * Execute Chrome 49 build
	 */
	public async execute(): Promise<void> {
		return new Promise((resolve, reject): void => {
			const buildMode: string = this.config.isDevelopment ? 'development' : 'production';

			this.updateProgress({
				isBuilding: true,
				progress: 0,
				step: 'Initializing build',
				startTime: Date.now()
			});

			const buildProcess: ChildProcess = this.spawnBuildProcess(buildMode);

			buildProcess.stdout?.on('data', (data: Buffer): void => {
				this.handleStdout(data);
			});

			buildProcess.stderr?.on('data', (data: Buffer): void => {
				this.handleStderr(data);
			});

			buildProcess.on('close', (code: number | null): void => {
				this.handleClose(code, resolve, reject);
			});

			buildProcess.on('error', (error: Error): void => {
				this.handleError(error, reject);
			});
		});
	}

	/**
	 * Spawn the build process
	 */
	private spawnBuildProcess(mode: string): ChildProcess {
		return spawn('npm', ['run', `build:chrome-49:${mode}`], {
			shell: true,
			stdio: ['inherit', 'pipe', 'pipe']
		});
	}

	/**
	 * Handle stdout data
	 */
	private handleStdout(data: Buffer): void {
		const output: string = data.toString().trim();
		if (output) {
			this.parseBuildOutput(output);
		}
	}

	/**
	 * Handle stderr data
	 */
	private handleStderr(data: Buffer): void {
		const error: string = data.toString().trim();
		// Filter out npm warnings
		if (error && !error.includes('npm WARN')) {
			console.error(error);
		}
	}

	/**
	 * Handle process close
	 */
	private handleClose(
		code: number | null,
		resolve: () => void,
		reject: (error: Error) => void
	): void {
		this.updateProgress({
			isBuilding: false,
			progress: 100,
			step: code === 0 ? 'Build completed' : 'Build failed',
			startTime: 0
		});

		if (code === 0) {
			this.logSuccess('Chrome 49 build completed successfully');
			resolve();
		} else {
			const error = new Error(`Build process failed with code ${code}`);
			this.logError(error.message);
			reject(error);
		}
	}

	/**
	 * Handle process error
	 */
	private handleError(error: Error, reject: (error: Error) => void): void {
		this.logError(`Build process error: ${error.message}`);
		reject(error);
	}

	/**
	 * Parse build output and update progress
	 */
	private parseBuildOutput(output: string): void {
		const line: string = output.toLowerCase();
		const updates: Partial<WBPluginMetadata> = {};

		if (line.includes('starting') || line.includes('build')) {
			updates.step = 'Initializing build';
			updates.progress = 5;
		} else if (line.includes('resolving') || line.includes('dependencies')) {
			updates.step = 'Resolving dependencies';
			updates.progress = 15;
		} else if (line.includes('transform') || line.includes('compiling') || line.includes('typescript')) {
			updates.step = 'Transforming TypeScript';
			updates.progress = 35;
		} else if (line.includes('bundle') || line.includes('rollup') || line.includes('chunk')) {
			updates.step = 'Bundling modules';
			updates.progress = 60;
		} else if (line.includes('minify') || line.includes('optimize') || line.includes('terser')) {
			updates.step = 'Optimizing for Chrome 49';
			updates.progress = 80;
		} else if (line.includes('writing') || line.includes('dist') || line.includes('output')) {
			updates.step = 'Writing output files';
			updates.progress = 90;
		} else if (line.includes('built in') || line.includes('build completed') || line.includes('done')) {
			updates.step = 'Build completed successfully';
			updates.progress = 100;
		} else if (line.includes('error') || line.includes('failed')) {
			updates.step = 'Build failed';
		}

		if (Object.keys(updates).length > 0) {
			this.updateProgress(updates);
		}
	}

	/**
	 * Update progress state
	 */
	private updateProgress(updates: Partial<WBPluginMetadata>): void {
		if (this.progressLogger) {
			this.progressLogger.updateMetadata(updates);
		}
	}
}