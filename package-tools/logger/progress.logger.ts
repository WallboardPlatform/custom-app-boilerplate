/**
 * Progress logger for build and upload operations
 * Extends ConsoleLogger with progress tracking capabilities
 */
import path from 'path';
import { ConsoleLogger } from './console.logger';
import { ProgressBarFormatter, TimeEstimate } from './formatters';
import { ProgressState, StepState, LoggerConfig } from './types';

export interface ProgressLoggerConfig extends LoggerConfig {
	headerTitle?: string;
	headerIcon?: string;
}

export class ProgressLogger<TMetadata = Record<string, unknown>> extends ConsoleLogger {
	private progressState: ProgressState | null = null;
	private stepState: StepState | null = null;
	private metadata: TMetadata;
	private headerTitle: string;
	private headerIcon: string;

	constructor(
		metadata: TMetadata,
		config: Partial<ProgressLoggerConfig> = {}
	) {
		super(config);
		this.metadata = metadata;
		this.headerTitle = config.headerTitle || 'BUILD PROGRESS';
		this.headerIcon = config.headerIcon || '🔧';
	}

	/**
	 * Update metadata
	 */
	public updateMetadata(updates: Partial<TMetadata>): void {
		this.metadata = { ...this.metadata, ...updates };
		this.display();
	}

	/**
	 * Get current metadata
	 */
	public getMetadata(): TMetadata {
		return { ...this.metadata };
	}

	/**
	 * Set current step
	 */
	public setStep(currentStep: number, totalSteps: number, description: string): void {
		this.stepState = { currentStep, totalSteps, description };

		if (this.config.useSimpleOutput) {
			this.info(`Step ${currentStep}/${totalSteps}: ${description}`);
		} else {
			this.display();
		}
	}

	/**
	 * Update progress state
	 */
	public updateProgress(current: number, total: number, label?: string): void {
		if (!this.progressState) {
			this.progressState = {
				current: 0,
				total: 0,
				startTime: Date.now()
			};
		}

		this.progressState.current = current;
		this.progressState.total = total;
		if (label) {
			this.progressState.label = label;
		}

		if (this.config.useSimpleOutput) {
			this.displaySimpleProgress();
		} else {
			this.display();
		}
	}

	/**
	 * Reset progress state
	 */
	public resetProgress(): void {
		this.progressState = null;
	}

	/**
	 * Main display method
	 */
	public display(): void {
		if (this.config.useSimpleOutput) {
			this.displaySimpleProgress();
			return;
		}

		this.clear();
		this.displayHeader();
		this.displayStep();
		this.displayMetadata();
		this.displayProgress();
	}

	/**
	 * Simple output for CI/CD
	 */
	private displaySimpleProgress(): void {
		if (!this.progressState) return;

		const percentage: string = ProgressBarFormatter.formatPercentage(
			this.progressState.current,
			this.progressState.total
		);

		this.info(
			`Progress: ${percentage} (${this.progressState.current}/${this.progressState.total})${
				this.progressState.label ? ` - ${this.progressState.label}` : ''
			}`
		);
	}

	/**
	 * Display header
	 */
	private displayHeader(): void {
		this.header(this.headerTitle, this.headerIcon);
	}

	/**
	 * Display current step
	 */
	private displayStep(): void {
		if (!this.stepState) return;

		console.log(
			`📋 Step ${this.stepState.currentStep}/${this.stepState.totalSteps}: ${this.stepState.description}`
		);
		this.newline();
	}

	/**
	 * Display metadata (override in subclasses for custom metadata display)
	 */
	protected displayMetadata(): void {
		// Override in subclasses to display custom metadata
		// Base implementation does nothing - subclasses should provide their own formatting
	}

	/**
	 * Display progress bar
	 */
	private displayProgress(): void {
		if (!this.progressState) return;

		const bar: string = ProgressBarFormatter.createBar(
			this.progressState.current,
			this.progressState.total
		);

		console.log(bar);
		console.log(
			ProgressBarFormatter.formatFileProgress(
				this.progressState.current,
				this.progressState.total
			)
		);

		if (this.progressState.startTime) {
			const timeEstimate: TimeEstimate = ProgressBarFormatter.calculateTimeEstimate(
				this.progressState.current,
				this.progressState.total,
				this.progressState.startTime
			);

			console.log(
				`Time Elapsed: ${ProgressBarFormatter.formatTime(timeEstimate.elapsed)} | ` +
				`ETA: ${ProgressBarFormatter.formatTime(timeEstimate.remaining)}`
			);
		}

		if (this.progressState.label) {
			console.log(`📄 Current: ${path.basename(this.progressState.label)}`);
		}

		this.newline();
	}

	/**
	 * Show completion message
	 */
	public showCompletion(success: boolean, message: string, details?: string): void {
		if (this.config.useSimpleOutput) {
			if (success) {
				this.success('COMPLETED!');
				this.success(message);
				if (details) {
					this.info(details);
				}
			} else {
				this.error('FAILED!');
				this.error(message);
			}
		} else {
			this.clear();
			this.header(
				success ? 'COMPLETED' : 'FAILED',
				success ? '✅' : '❌'
			);

			console.log(message);
			this.newline();

			if (details) {
				console.log(details);
				this.newline();
			}
		}
	}
}