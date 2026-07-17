import { createMemo, For, Show } from 'solid-js';
import type { Accessor, JSX } from 'solid-js';

import { useAutoFitText } from '@hooks/system/useAutoFitText';
import { useDataSources } from '@hooks/system/useDataSources';
import { useSettings } from '@hooks/system/useSettings';

import type { DataSources, SafetyResult, Settings } from '@interfaces/application.interface';
import { resolveTheme } from '@utils/theme';

import style from '@components/wb-app/wb-app.module.scss';

import sampleResultsData from '../../../sample-results-datasource.json';

type ThemeTokens = Record<'accent' | 'background' | 'border' | 'danger' | 'pass' | 'primary' | 'secondary' | 'surface' | 'surfaceStrong', string>;

interface ScoreBand {
	count: number;
	label: string;
	maximum: number;
	minimum: number;
	tone: 'danger' | 'warning' | 'pass' | 'excellent';
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const parseValue = (value: unknown): unknown => {
	if (typeof value !== 'string') return value;

	try {
		return JSON.parse(value) as unknown;
	} catch {
		return value;
	}
};

const extractRows = (rawValue: unknown): unknown[] | undefined => {
	const value: unknown = parseValue(rawValue);

	if (Array.isArray(value)) return value as unknown[];

	if (!isRecord(value)) return undefined;

	if (Array.isArray(value.rows)) return value.rows as unknown[];

	const results: unknown = parseValue(value.Results);

	if (Array.isArray(results)) return results as unknown[];

	return isRecord(results) && Array.isArray(results.rows) ? results.rows as unknown[] : undefined;
};

const text = (value: unknown): string => {
	return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
};

const normalizeResults = (rows: unknown[]): SafetyResult[] => {
	return rows.flatMap((item: unknown): SafetyResult[] => {
		if (!isRecord(item)) return [];

		const score: number = Number(item.score);
		const totalQuestions: number = Number(item.totalQuestions);
		const participantName: string = text(item.participantName);
		const completedAt: string = text(item.completedAt);

		if (!participantName || !completedAt || !Number.isFinite(score) || !Number.isFinite(totalQuestions) || totalQuestions <= 0) {
			return [];
		}

		return [{
			completedAt,
			corporateId: text(item.corporateId),
			participantName,
			percentage: Math.max(0, Math.min(100, Math.round((score / totalQuestions) * 100))),
			score: Math.max(0, score),
			submissionId: text(item.submissionId),
			totalQuestions
		}];
	}).sort((left: SafetyResult, right: SafetyResult): number => {
		return Date.parse(right.completedAt) - Date.parse(left.completedAt);
	});
};

const formatCompletedAt = (value: string): string => {
	const parsed: Date = new Date(value);

	if (Number.isNaN(parsed.getTime())) return value;

	return new Intl.DateTimeFormat('en-US', {
		day: '2-digit',
		hour: '2-digit',
		hour12: false,
		minute: '2-digit',
		month: 'short'
	}).format(parsed);
};

export default (props: { hostElement: HTMLDivElement }): JSX.Element => {
	const dataSources: Accessor<DataSources> = useDataSources();
	const settings: Accessor<Settings> = useSettings();
	const hasBoundResults: Accessor<boolean> = createMemo((): boolean => {
		return Object.prototype.hasOwnProperty.call(dataSources(), 'resultsData');
	});
	const results: Accessor<SafetyResult[]> = createMemo((): SafetyResult[] => {
		const source: unknown = hasBoundResults() ? dataSources().resultsData?.value : sampleResultsData;

		return normalizeResults(extractRows(source) ?? []);
	});
	const averageScore: Accessor<number> = createMemo((): number => {
		if (results().length === 0) return 0;

		return Math.round(results().reduce((sum: number, result: SafetyResult): number => sum + result.percentage, 0) / results().length);
	});
	const passCount: Accessor<number> = createMemo((): number => {
		return results().filter((result: SafetyResult): boolean => result.percentage >= settings().passThreshold).length;
	});
	const passRate: Accessor<number> = createMemo((): number => {
		return results().length > 0 ? Math.round((passCount() / results().length) * 100) : 0;
	});
	const perfectCount: Accessor<number> = createMemo((): number => {
		return results().filter((result: SafetyResult): boolean => result.percentage === 100).length;
	});
	const recentResults: Accessor<SafetyResult[]> = createMemo((): SafetyResult[] => {
		return results().slice(0, settings().maximumRows);
	});
	const scoreBands: Accessor<ScoreBand[]> = createMemo((): ScoreBand[] => {
		const bands: Array<Omit<ScoreBand, 'count'>> = [
			{ label: 'Needs review', minimum: 0, maximum: 59, tone: 'danger' },
			{ label: 'Developing', minimum: 60, maximum: 79, tone: 'warning' },
			{ label: 'Qualified', minimum: 80, maximum: 99, tone: 'pass' },
			{ label: 'Perfect', minimum: 100, maximum: 100, tone: 'excellent' }
		];

		return bands.map((band): ScoreBand => ({
			...band,
			count: results().filter((result: SafetyResult): boolean => result.percentage >= band.minimum && result.percentage <= band.maximum).length
		}));
	});
	const theme: Accessor<ThemeTokens> = createMemo((): ThemeTokens => resolveTheme(settings().themePreset, {
		custom: {
			accent: settings().accentColor,
			background: settings().backgroundColor,
			border: settings().borderColor,
			danger: settings().dangerColor,
			pass: settings().passColor,
			primary: settings().primaryTextColor,
			secondary: settings().secondaryTextColor,
			surface: settings().surfaceColor,
			surfaceStrong: settings().surfaceStrongColor
		},
		dark: {
			accent: '#ef5b45', background: '#071313', border: '#29413e', danger: '#ff6c5c', pass: '#59ddaf',
			primary: '#f7f2e8', secondary: '#9eb4ae', surface: '#102321', surfaceStrong: '#17302d'
		},
		light: {
			accent: '#c6402f', background: '#edf2ef', border: '#c7d3cf', danger: '#b9352b', pass: '#167b5d',
			primary: '#102321', secondary: '#536b65', surface: '#ffffff', surfaceStrong: '#dfe9e5'
		}
	}));
	const fitTitle = useAutoFitText({
		minFontSize: 27,
		maxFontSize: 62,
		widthOnly: true,
		watch: (): string => settings().title
	});

	return (
		<div
			class={style['wb-app']}
			style={{
				'--wb-factory-safety-dashboard-accent': theme().accent,
				'--wb-factory-safety-dashboard-background': theme().background,
				'--wb-factory-safety-dashboard-border': theme().border,
				'--wb-factory-safety-dashboard-danger': theme().danger,
				'--wb-factory-safety-dashboard-pass': theme().pass,
				'--wb-factory-safety-dashboard-primary': theme().primary,
				'--wb-factory-safety-dashboard-secondary': theme().secondary,
				'--wb-factory-safety-dashboard-surface': theme().surface,
				'--wb-factory-safety-dashboard-surface-strong': theme().surfaceStrong,
				'--wb-factory-safety-dashboard-font-family': settings().fontFamily
			}}
			data-host-ready={Boolean(props.hostElement)}
			data-preview-id="factory-safety-dashboard-root"
		>
			<header class={style['header']}>
				<div class={style['brand-mark']} aria-hidden="true"><span>N</span><span>M</span></div>
				<div class={style['heading']}>
					<p>{settings().plantName} / EHS PERFORMANCE</p>
					<h1 ref={fitTitle} class="wb-safety-dashboard-title">{settings().title}</h1>
				</div>
				<div class={style['live-status']}>
					<i aria-hidden="true" />
					<span>LIVE RESULTS</span>
					<strong>{results().length}</strong>
				</div>
			</header>

			<Show when={results().length > 0} fallback={
				<section class={style['empty-state']}>
					<p>RESULTS DATASOURCE</p>
					<h2>No completed safety checks yet.</h2>
					<span>New submissions will appear here automatically.</span>
				</section>
			}>
				<main class={style['dashboard']}>
					<section class={style['main-column']}>
						<div class={style['metrics']}>
							<article>
								<span>COMPLETIONS</span><strong data-metric="completion-count">{results().length}</strong><small>recorded checks</small>
							</article>
							<article>
								<span>AVERAGE SCORE</span><strong>{averageScore()}<em>%</em></strong><small>across all results</small>
							</article>
							<article data-tone={passRate() >= settings().passThreshold ? 'pass' : 'danger'}>
								<span>PASS RATE</span><strong data-metric="pass-rate">{passRate()}<em>%</em></strong><small>threshold {settings().passThreshold}%</small>
							</article>
							<article>
								<span>PERFECT CHECKS</span><strong>{perfectCount()}</strong><small>full marks achieved</small>
							</article>
						</div>

						<section class={style['recent-panel']}>
							<div class={style['section-heading']}>
								<div><p>RECENT ACTIVITY</p><h2>Latest submissions</h2></div>
								<span>Newest first</span>
							</div>
							<div class={style['result-table']} role="table" aria-label="Recent safety questionnaire results">
								<div class={style['table-header']} role="row">
									<span>PARTICIPANT</span><span>COMPLETED</span><span>SCORE</span><span>STATUS</span>
								</div>
								<For each={recentResults()}>
									{(result: SafetyResult): JSX.Element => (
										<div class={style['table-row']} role="row">
											<div class={style['participant']}><b class="wb-safety-dashboard-participant-name">{result.participantName}</b><Show when={settings().showCorporateId && result.corporateId}><small>{result.corporateId}</small></Show></div>
											<time>{formatCompletedAt(result.completedAt)}</time>
											<strong>{result.score}<small> / {result.totalQuestions}</small></strong>
											<span class={style['status']} data-pass={result.percentage >= settings().passThreshold}>{result.percentage >= settings().passThreshold ? 'PASS' : 'REVIEW'}</span>
										</div>
									)}
								</For>
							</div>
						</section>
					</section>

					<aside class={style['insights']}>
						<div class={style['score-summary']}>
							<p>READINESS SIGNAL</p>
							<strong>{passRate()}<small>%</small></strong>
							<span>{passCount()} of {results().length} checks meet the {settings().passThreshold}% threshold</span>
							<div><i style={{ width: `${passRate()}%` }} /></div>
						</div>
						<section class={style['distribution']}>
							<div class={style['section-heading']}><div><p>SCORE PROFILE</p><h2>Distribution</h2></div></div>
							<For each={scoreBands()}>
								{(band: ScoreBand): JSX.Element => {
									const width: number = results().length > 0 ? Math.round((band.count / results().length) * 100) : 0;

									return <div class={style['band']} data-tone={band.tone}>
										<div><span>{band.label}</span><strong>{band.count}</strong></div>
										<div><i style={{ width: `${width}%` }} /></div>
										<small>{band.minimum === band.maximum ? band.minimum : `${band.minimum}-${band.maximum}`}%</small>
									</div>;
								}}
							</For>
						</section>
						<footer><span>Last result</span><strong>{formatCompletedAt(results()[0].completedAt)}</strong></footer>
					</aside>
				</main>
			</Show>
		</div>
	);
};
