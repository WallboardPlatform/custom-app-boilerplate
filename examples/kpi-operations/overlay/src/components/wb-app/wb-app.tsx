import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import type { Accessor, JSX } from 'solid-js';

import {
	CategoryScale,
	Chart,
	Filler,
	Legend,
	LinearScale,
	LineController,
	LineElement,
	PointElement,
	Tooltip
} from 'chart.js';
import type { ChartConfiguration } from 'chart.js';

import { useDataSources } from '@hooks/system/useDataSources';
import { useSettings } from '@hooks/system/useSettings';

import type { DataSourceState } from 'wallboard-app-sdk';

import type {
	MetricRow,
	OperationsPayload,
	Settings,
	TrendPoint
} from '@interfaces/application.interface';

import style from '@components/wb-app/wb-app.module.scss';

Chart.register(
	CategoryScale,
	LinearScale,
	LineController,
	LineElement,
	PointElement,
	Filler,
	Legend,
	Tooltip
);

const parseJson = (value: unknown): unknown => {
	if (typeof value !== 'string') return value;

	try {
		return JSON.parse(value) as unknown;
	} catch {
		return value;
	}
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const toFiniteNumber = (value: unknown): number | undefined => {
	const parsed: number = typeof value === 'number' ? value : Number(value);

	return Number.isFinite(parsed) ? parsed : undefined;
};

const isOperationsPayload = (value: Record<string, unknown>): boolean => {
	return Array.isArray(parseJson(value.metrics)) || Array.isArray(parseJson(value.history));
};

const extractPayload = (value: unknown): Record<string, unknown> | undefined => {
	const candidate: unknown = parseJson(value);

	if (!isRecord(candidate)) return undefined;

	if (isOperationsPayload(candidate)) {
		return candidate;
	}

	const wrapped: unknown = parseJson(candidate.Operations);

	return isRecord(wrapped) && isOperationsPayload(wrapped) ? wrapped : undefined;
};

const normalizePayload = (value: unknown): OperationsPayload | undefined => {
	const source: Record<string, unknown> | undefined = extractPayload(value);

	if (!source) return undefined;

	const metricValues: unknown = parseJson(source.metrics);
	const historyValues: unknown = parseJson(source.history);
	const metrics: MetricRow[] = Array.isArray(metricValues)
		? metricValues.flatMap((item: unknown): MetricRow[] => {
			if (!item || typeof item !== 'object' || Array.isArray(item)) return [];

			const row: Record<string, unknown> = item as Record<string, unknown>;
			const label: string = typeof row.label === 'string' ? row.label.trim() : '';
			const valueIsValid: boolean = typeof row.value === 'string' || typeof row.value === 'number';

			if (!label || !valueIsValid) return [];

			const tone: MetricRow['tone'] =
				row.tone === 'positive' || row.tone === 'warning' ? row.tone : 'neutral';

			return [{
				label,
				value: row.value as string | number,
				unit: typeof row.unit === 'string' ? row.unit : undefined,
				delta: typeof row.delta === 'string' ? row.delta : undefined,
				tone
			}];
		}).slice(0, 3)
		: [];
	const history: TrendPoint[] = Array.isArray(historyValues)
		? historyValues.flatMap((item: unknown): TrendPoint[] => {
			if (!item || typeof item !== 'object' || Array.isArray(item)) return [];

			const row: Record<string, unknown> = item as Record<string, unknown>;
			const value: number | undefined = toFiniteNumber(row.value);
			const label: string = typeof row.label === 'string' ? row.label.trim() : '';

			return value === undefined || !label ? [] : [{ label, value }];
		}).slice(-24)
		: [];

	if (metrics.length === 0 && history.length === 0) return undefined;

	return {
		metrics,
		history,
		updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : undefined
	};
};

const formatValue = (value: string | number): string => {
	return typeof value === 'number'
		? new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value)
		: value;
};

export default (props: { hostElement: HTMLDivElement }): JSX.Element => {
	const settingsSIG: Accessor<Settings> = useSettings();
	const dataSourcesSIG: Accessor<Record<string, DataSourceState>> = useDataSources();
	const payloadSIG: Accessor<OperationsPayload | undefined> = createMemo(
		(): OperationsPayload | undefined => normalizePayload(dataSourcesSIG().operationsData?.value)
	);
	const completionSIG: Accessor<number> = createMemo((): number => {
		const history: TrendPoint[] = payloadSIG()?.history ?? [];
		const latest: number = history.length > 0 ? history[history.length - 1].value : 0;

		return Math.max(0, Math.min(100, Math.round((latest / settingsSIG().targetValue) * 100)));
	});
	const [chartReadySIG, setChartReadySIG] = createSignal<boolean>(false);
	let canvas: HTMLCanvasElement | undefined;
	let chart: Chart<'line'> | undefined;

	onMount((): void => {
		if (!canvas) return;

		const settings: Settings = settingsSIG();
		const configuration: ChartConfiguration<'line'> = {
			type: 'line',
			data: { labels: [], datasets: [] },
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: false,
				events: [],
				layout: { padding: 0 },
				plugins: {
					legend: { display: false },
					tooltip: { enabled: false }
				},
				scales: {
					x: {
						grid: { display: false },
						border: { display: false },
						ticks: { color: settings.secondaryTextColor, maxTicksLimit: 7 }
					},
					y: {
						beginAtZero: false,
						grid: { color: '#303a3f' },
						border: { display: false },
						ticks: { color: settings.secondaryTextColor, maxTicksLimit: 4 }
					}
				}
			}
		};

		chart = new Chart(canvas, configuration);
		setChartReadySIG(true);
	});

	createEffect((): void => {
		const history: TrendPoint[] = payloadSIG()?.history ?? [];
		const settings: Settings = settingsSIG();

		if (!chartReadySIG() || !chart) return;

		chart.data.labels = history.map((point: TrendPoint): string => point.label);
		chart.data.datasets = [{
			data: history.map((point: TrendPoint): number => point.value),
			borderColor: settings.accentColor,
			backgroundColor: `${settings.accentColor}24`,
			borderWidth: 3,
			fill: true,
			pointRadius: 0,
			pointHitRadius: 0,
			tension: 0.32
		}];
		chart.update('none');
	});

	onCleanup((): void => chart?.destroy());

	return (
		<div
			class={`wb-app ${style['wb-app']}`}
			style={{
				'--kpi-font-family': settingsSIG().fontFamily,
				'--kpi-background': settingsSIG().backgroundColor,
				'--kpi-surface': settingsSIG().surfaceColor,
				'--kpi-primary': settingsSIG().primaryTextColor,
				'--kpi-secondary': settingsSIG().secondaryTextColor,
				'--kpi-accent': settingsSIG().accentColor,
				'--kpi-positive': settingsSIG().positiveColor,
				'--kpi-warning': settingsSIG().warningColor
			}}
			data-host-ready={Boolean(props.hostElement)}
		>
			<header class="wb-app__header">
				<div>
					<span>Operations center</span>
					<h1>{settingsSIG().title}</h1>
					<p>{settingsSIG().subtitle}</p>
				</div>
				<b>LIVE</b>
			</header>

			<Show
				when={payloadSIG()}
				fallback={
					<section class="wb-app__empty-state">
						<span>No signal</span>
						<strong>{settingsSIG().emptyState}</strong>
					</section>
				}
			>
				<section class="wb-app__metrics">
					<For each={payloadSIG()?.metrics ?? []}>
						{(metric: MetricRow): JSX.Element => (
							<article data-tone={metric.tone}>
								<span>{metric.label}</span>
								<div>
									<strong>{formatValue(metric.value)}</strong>
									<Show when={metric.unit}><small>{metric.unit}</small></Show>
								</div>
								<Show when={metric.delta}><p>{metric.delta}</p></Show>
							</article>
						)}
					</For>
				</section>

				<section class="wb-app__trend">
					<div class="wb-app__chart-column">
						<div class="wb-app__trend-heading">
							<div><span>Throughput</span><strong>Today by hour</strong></div>
							<Show when={payloadSIG()?.updatedAt}><small>{payloadSIG()?.updatedAt}</small></Show>
						</div>
						<div class="wb-app__chart"><canvas ref={canvas} /></div>
					</div>
					<aside>
						<span>{settingsSIG().targetLabel}</span>
						<strong>{completionSIG()}%</strong>
						<div><i style={{ width: `${completionSIG()}%` }} /></div>
						<p>{formatValue(settingsSIG().targetValue)} units</p>
					</aside>
				</section>
			</Show>
		</div>
	);
};
