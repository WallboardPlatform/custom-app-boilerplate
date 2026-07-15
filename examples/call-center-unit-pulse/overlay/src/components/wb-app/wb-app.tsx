import { createEffect, createMemo, createSignal, For, onCleanup, Show } from 'solid-js';
import type { Accessor, JSX } from 'solid-js';

import { useDataSources } from '@hooks/system/useDataSources';
import { useSettings } from '@hooks/system/useSettings';

import type { DataSources, Settings } from '@interfaces/application.interface';
import type { GaugeValue, MetricValue, UnitPulseRow } from '@interfaces/unit-pulse.interface';

import style from '@components/wb-app/wb-app.module.scss';

import sampleDatasourceJson from '../../../sample-datasource.json';

interface ExtractedUnits {
	rows: Array<{ key: string; value: unknown }>;
	updatedAt: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const parseValue = (value: unknown): unknown => {
	if (typeof value !== 'string') {
		return value;
	}

	try {
		return JSON.parse(value) as unknown;
	} catch {
		return value;
	}
};

const toText = (value: unknown): string => {
	return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
};

const toNumber = (value: unknown): number => {
	const parsed: number = Number(value);

	return Number.isFinite(parsed) ? parsed : 0;
};

const clampPercent = (value: number): number => Math.max(0, Math.min(100, value));

const keyedRows = (value: unknown): Array<{ key: string; value: unknown }> => {
	if (Array.isArray(value)) {
		return value.map((item: unknown, index: number): { key: string; value: unknown } => ({
			key: String(index),
			value: item
		}));
	}

	if (!isRecord(value)) {
		return [];
	}

	if (Object.prototype.hasOwnProperty.call(value, 'business_unit')) {
		return [{ key: toText(value.business_unit), value }];
	}

	return Object.keys(value).map((key: string): { key: string; value: unknown } => ({ key, value: value[key] }));
};

const extractUnits = (rawValue: unknown): ExtractedUnits => {
	const value: unknown = parseValue(rawValue);

	if (!isRecord(value)) {
		return { rows: keyedRows(value), updatedAt: '' };
	}

	const nestedValue: unknown = parseValue(value.data);
	const rows: Array<{ key: string; value: unknown }> =
		nestedValue !== undefined ? keyedRows(nestedValue) : keyedRows(value);

	return {
		rows,
		updatedAt: toText(value.json_updated) || toText(value.updatedAt)
	};
};

const normalizeUnit = (entry: { key: string; value: unknown }): UnitPulseRow | undefined => {
	if (!isRecord(entry.value)) {
		return undefined;
	}

	const name: string = toText(entry.value.business_unit) || entry.key.trim();

	if (!name) {
		return undefined;
	}

	return {
		name,
		onCalls: toNumber(entry.value.Agents_On_ACD_Calls),
		staffed: toNumber(entry.value.Agents_Staffed),
		available: toNumber(entry.value.Agents_Available),
		notReady: toNumber(entry.value.Agents_Not_Ready),
		auxiliary: toNumber(entry.value.Agents_Aux),
		waiting: toNumber(entry.value.Calls_Waiting),
		oldestWaiting: toText(entry.value.Oldest_Call_HMS) || '0:00:00',
		offered: toNumber(entry.value.Offered_Today),
		handled: toNumber(entry.value.Handled_Today),
		abandoned: toNumber(entry.value.Abandoned_Today),
		abandonmentRate: toNumber(entry.value.Aban_Rate_Today),
		serviceLevel: toNumber(entry.value.Service_Level_Today),
		asa: toText(entry.value.ASA_Today_HMS) || '0:00:00',
		aht: toText(entry.value.AHT_Today_HMS) || '0:00:00',
		occupancy: toNumber(entry.value.Occupancy_Today)
	};
};

const percentageTone = (value: number, healthy: number, attention: number): GaugeValue['tone'] => {
	if (value >= healthy) {
		return 'success';
	}

	return value >= attention ? 'warning' : 'danger';
};

const compactNumber = (value: number): string => {
	return Math.round(value).toLocaleString('en-US');
};

const sampleDatasource: unknown = sampleDatasourceJson;

export default (props: { hostElement: HTMLDivElement }): JSX.Element => {
	const dataSources: Accessor<DataSources> = useDataSources();
	const settings: Accessor<Settings> = useSettings();
	const [unitIndex, setUnitIndex] = createSignal<number>(0);
	const hasBoundDatasource: Accessor<boolean> = createMemo((): boolean => {
		return Object.prototype.hasOwnProperty.call(dataSources(), 'groupData');
	});
	const extracted: Accessor<ExtractedUnits> = createMemo((): ExtractedUnits => {
		const value: unknown = hasBoundDatasource() ? dataSources().groupData?.value : sampleDatasource;

		return extractUnits(value);
	});
	const units: Accessor<UnitPulseRow[]> = createMemo((): UnitPulseRow[] => {
		const excludedNames: string[] = settings()
			.excludedGroups.split(',')
			.map((name: string): string => name.trim().toLowerCase())
			.filter(Boolean);

		return extracted()
			.rows.map(normalizeUnit)
			.filter((row: UnitPulseRow | undefined): row is UnitPulseRow => Boolean(row))
			.filter((row: UnitPulseRow): boolean => !excludedNames.includes(row.name.toLowerCase()))
			.filter((row: UnitPulseRow): boolean => {
				return !settings().hideInactiveGroups || row.staffed > 0 || row.offered > 0 || row.waiting > 0;
			})
			.sort((left: UnitPulseRow, right: UnitPulseRow): number => left.name.localeCompare(right.name));
	});
	const currentUnit: Accessor<UnitPulseRow | undefined> = createMemo((): UnitPulseRow | undefined => {
		return units()[unitIndex() % Math.max(units().length, 1)];
	});
	const gauges: Accessor<GaugeValue[]> = createMemo((): GaugeValue[] => {
		const unit: UnitPulseRow | undefined = currentUnit();

		if (!unit) {
			return [];
		}

		const availability: number = unit.staffed > 0 ? (unit.available / unit.staffed) * 100 : 0;

		return [
			{
				label: 'Service level',
				value: clampPercent(unit.serviceLevel),
				displayValue: `${unit.serviceLevel.toFixed(1)}%`,
				tone: percentageTone(unit.serviceLevel, 85, 70)
			},
			{
				label: 'Availability',
				value: clampPercent(availability),
				displayValue: `${unit.available} / ${unit.staffed}`,
				tone: percentageTone(availability, 30, 15)
			},
			{
				label: 'Occupancy',
				value: clampPercent(unit.occupancy),
				displayValue: `${unit.occupancy.toFixed(0)}%`,
				tone: unit.occupancy > 90 ? 'danger' : unit.occupancy >= 75 ? 'warning' : 'success'
			}
		];
	});
	const metrics: Accessor<MetricValue[]> = createMemo((): MetricValue[] => {
		const unit: UnitPulseRow | undefined = currentUnit();

		if (!unit) {
			return [];
		}

		return [
			{
				label: 'Calls waiting',
				value: compactNumber(unit.waiting),
				detail: `Oldest ${unit.oldestWaiting}`,
				tone: unit.waiting > 5 ? 'danger' : unit.waiting > 0 ? 'warning' : 'accent'
			},
			{ label: 'Offered today', value: compactNumber(unit.offered), detail: 'Inbound demand' },
			{
				label: 'Handled today',
				value: compactNumber(unit.handled),
				detail: `${unit.onCalls} on active calls`,
				tone: 'accent'
			},
			{
				label: 'Abandoned',
				value: compactNumber(unit.abandoned),
				detail: `${unit.abandonmentRate.toFixed(1)}% abandon rate`,
				tone: unit.abandonmentRate >= 8 ? 'danger' : unit.abandonmentRate >= 5 ? 'warning' : 'accent'
			},
			{ label: 'Answer speed', value: unit.asa, detail: 'Average today' },
			{ label: 'Handle time', value: unit.aht, detail: `${unit.notReady} not ready / ${unit.auxiliary} aux` }
		];
	});
	const themeStyle: Accessor<JSX.CSSProperties> = createMemo((): JSX.CSSProperties => ({
		'--unit-background': settings().backgroundColor,
		'--unit-surface': settings().surfaceColor,
		'--unit-primary': settings().primaryTextColor,
		'--unit-secondary': settings().secondaryTextColor,
		'--unit-accent': settings().accentColor,
		'--unit-success': settings().successColor,
		'--unit-warning': settings().warningColor,
		'--unit-danger': settings().dangerColor,
		'--unit-font': settings().fontFamily
	}));

	createEffect((): void => {
		const count: number = units().length;

		if (unitIndex() >= count) {
			setUnitIndex(0);
		}
	});

	createEffect((): void => {
		const count: number = units().length;
		const duration: number = settings().rotationSeconds;

		if (count <= 1) {
			return;
		}

		const intervalId: number = window.setInterval((): void => {
			setUnitIndex((current: number): number => (current + 1) % count);
		}, duration * 1000);

		onCleanup((): void => window.clearInterval(intervalId));
	});

	return (
		<div class={`wb-app ${style['wb-app']}`} data-host-ready={Boolean(props.hostElement)} style={themeStyle()}>
			<header class="unit-header">
				<div>
					<span>{settings().subtitle}</span>
					<h1>{settings().title}</h1>
				</div>
				<div class="unit-header__meta">
					<strong>LIVE SNAPSHOT</strong>
					<small>{extracted().updatedAt || 'Update time unavailable'}</small>
				</div>
			</header>

			<Show
				when={currentUnit()}
				fallback={
					<main class="unit-empty">
						<span>NO ACTIVE VIEW</span>
						<strong>{settings().emptyState}</strong>
					</main>
				}
			>
				{(unit: Accessor<UnitPulseRow>): JSX.Element => (
					<main class="unit-content" data-unit-name={unit().name}>
						<section class="unit-identity">
							<div>
								<span>BUSINESS UNIT</span>
								<h2>{unit().name}</h2>
								<p>{unit().staffed} staffed agents across the current operation</p>
							</div>
							<div class="unit-page">
								<strong>{unitIndex() + 1}</strong>
								<span>/ {units().length}</span>
							</div>
						</section>

						<section class="unit-gauges">
							<For each={gauges()}>
								{(gauge: GaugeValue): JSX.Element => (
									<article data-tone={gauge.tone}>
										<div class="unit-gauge">
											<svg viewBox="0 0 120 120" aria-hidden="true">
												<circle class="unit-gauge__track" cx="60" cy="60" r="50" pathLength="100" />
												<circle
													class="unit-gauge__value"
													cx="60"
													cy="60"
													r="50"
													pathLength="100"
													stroke-dasharray={`${gauge.value} 100`}
												/>
											</svg>
											<strong>{gauge.displayValue}</strong>
										</div>
										<span>{gauge.label}</span>
									</article>
								)}
							</For>
						</section>

						<section class="unit-metrics">
							<For each={metrics()}>
								{(metric: MetricValue): JSX.Element => (
									<article data-tone={metric.tone || 'neutral'}>
										<span>{metric.label}</span>
										<strong>{metric.value}</strong>
										<small>{metric.detail}</small>
									</article>
								)}
							</For>
						</section>
					</main>
				)}
			</Show>
		</div>
	);
};
