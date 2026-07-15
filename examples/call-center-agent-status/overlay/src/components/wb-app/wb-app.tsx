import { createEffect, createMemo, createSignal, For, onCleanup, Show } from 'solid-js';
import type { Accessor, JSX } from 'solid-js';

import { useDataSources } from '@hooks/system/useDataSources';
import { useAutoFitText } from '@hooks/system/useAutoFitText';
import { useSettings } from '@hooks/system/useSettings';

import type { DataSources, Settings } from '@interfaces/application.interface';
import type { AgentStatusRow, AgentTone, StatusSummary } from '@interfaces/agent-status.interface';

import style from '@components/wb-app/wb-app.module.scss';

import sampleDatasourceJson from '../../../sample-datasource.json';

const AGENTS_PER_PAGE = 8;

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

const extractRows = (rawValue: unknown): unknown[] => {
	const value: unknown = parseValue(rawValue);

	if (Array.isArray(value)) {
		return value;
	}

	if (!isRecord(value)) {
		return [];
	}

	const candidates: unknown[] = [parseValue(value.agents), parseValue(value.data), parseValue(value.rows)];
	const selected: unknown = candidates.find((candidate: unknown): boolean => Array.isArray(candidate));

	if (Array.isArray(selected)) {
		return selected;
	}

	if (isRecord(value.data)) {
		return Object.keys(value.data).map((key: string): unknown => (value.data as Record<string, unknown>)[key]);
	}

	return [];
};

const toTone = (state: string): AgentTone => {
	const normalized: string = state.toLowerCase().replace(/[_-]+/g, ' ').trim();

	if (normalized.includes('logged out') || normalized.includes('offline') || normalized === 'logout') {
		return 'offline';
	}

	if (normalized.includes('after call') || normalized.includes('acw') || normalized.includes('wrap')) {
		return 'acw';
	}

	if (
		normalized.includes('not ready') ||
		normalized.includes('aux') ||
		normalized.includes('break') ||
		normalized.includes('away')
	) {
		return 'away';
	}

	if (
		normalized.includes('talk') ||
		normalized.includes('busy') ||
		normalized.includes('ring') ||
		normalized.includes('acd call')
	) {
		return 'busy';
	}

	if (normalized.includes('ready') || normalized.includes('available')) {
		return 'ready';
	}

	return 'unknown';
};

const normalizeRows = (rows: unknown[]): AgentStatusRow[] => {
	return rows
		.map((rawRow: unknown): AgentStatusRow | undefined => {
			if (!isRecord(rawRow)) {
				return undefined;
			}

			const name: string = toText(rawRow.Name) || toText(rawRow.name) || toText(rawRow.agent_name);

			if (!name) {
				return undefined;
			}

			const state: string = toText(rawRow.State) || toText(rawRow.state) || toText(rawRow.agent_state) || 'Unknown';

			return {
				name,
				state,
				tone: toTone(state),
				duration: toText(rawRow.Duration_Time) || toText(rawRow.duration_time) || '00:00:00',
				presented: toNumber(rawRow.Presented ?? rawRow.presented),
				handled: toNumber(rawRow.Handled ?? rawRow.handled),
				averageTalk: toText(rawRow.Avg_Talk_Time) || toText(rawRow.avg_talk_time) || '00:00:00',
				timestamp: toText(rawRow.Time_Stamp) || toText(rawRow.timestamp)
			};
		})
		.filter((row: AgentStatusRow | undefined): row is AgentStatusRow => Boolean(row))
		.sort((left: AgentStatusRow, right: AgentStatusRow): number => left.name.localeCompare(right.name));
};

const chunkRows = (rows: AgentStatusRow[]): AgentStatusRow[][] => {
	const pages: AgentStatusRow[][] = [];

	for (let index: number = 0; index < rows.length; index += AGENTS_PER_PAGE) {
		pages.push(rows.slice(index, index + AGENTS_PER_PAGE));
	}

	return pages;
};

const initials = (name: string): string => {
	return name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part: string): string => part.charAt(0).toUpperCase())
		.join('');
};

const sampleDatasource: unknown = sampleDatasourceJson;

export default (props: { hostElement: HTMLDivElement }): JSX.Element => {
	const dataSources: Accessor<DataSources> = useDataSources();
	const settings: Accessor<Settings> = useSettings();
	const [pageIndex, setPageIndex] = createSignal<number>(0);
	const hasBoundDatasource: Accessor<boolean> = createMemo((): boolean => {
		return Object.prototype.hasOwnProperty.call(dataSources(), 'agentData');
	});
	const agents: Accessor<AgentStatusRow[]> = createMemo((): AgentStatusRow[] => {
		const value: unknown = hasBoundDatasource() ? dataSources().agentData?.value : sampleDatasource;

		return normalizeRows(extractRows(value));
	});
	const pages: Accessor<AgentStatusRow[][]> = createMemo((): AgentStatusRow[][] => chunkRows(agents()));
	const pageCount: Accessor<number> = createMemo((): number => Math.max(pages().length, 1));
	const currentAgents: Accessor<AgentStatusRow[]> = createMemo((): AgentStatusRow[] => {
		return pages()[pageIndex() % pageCount()] ?? [];
	});
	const summary: Accessor<StatusSummary[]> = createMemo((): StatusSummary[] => [
		{
			label: 'Ready',
			value: agents().filter((agent: AgentStatusRow): boolean => agent.tone === 'ready').length,
			tone: 'ready'
		},
		{
			label: 'Active',
			value: agents().filter((agent: AgentStatusRow): boolean => agent.tone === 'busy').length,
			tone: 'busy'
		},
		{
			label: 'Attention',
			value: agents().filter((agent: AgentStatusRow): boolean => agent.tone === 'acw' || agent.tone === 'away').length,
			tone: 'acw'
		},
		{
			label: 'Offline',
			value: agents().filter((agent: AgentStatusRow): boolean => agent.tone === 'offline').length,
			tone: 'offline'
		}
	]);
	const updatedAt: Accessor<string> = createMemo((): string => agents()[0]?.timestamp || 'Update time unavailable');
	const fitTitle = useAutoFitText({
		minFontSize: 18,
		maxFontSize: 38,
		widthOnly: true,
		watch: (): string => settings().title
	});
	const themeStyle: Accessor<JSX.CSSProperties> = createMemo((): JSX.CSSProperties => ({
		'--agent-background': settings().backgroundColor,
		'--agent-surface': settings().surfaceColor,
		'--agent-primary': settings().primaryTextColor,
		'--agent-secondary': settings().secondaryTextColor,
		'--agent-ready': settings().readyColor,
		'--agent-busy': settings().busyColor,
		'--agent-acw': settings().acwColor,
		'--agent-away': settings().awayColor,
		'--agent-offline': settings().offlineColor,
		'--agent-unknown': settings().unknownColor,
		'--agent-font': settings().fontFamily
	}));

	createEffect((): void => {
		const count: number = pageCount();

		if (pageIndex() >= count) {
			setPageIndex(0);
		}
	});

	createEffect((): void => {
		const count: number = pageCount();
		const duration: number = settings().pageDurationSeconds;

		if (count <= 1) {
			return;
		}

		const intervalId: number = window.setInterval((): void => {
			setPageIndex((current: number): number => (current + 1) % count);
		}, duration * 1000);

		onCleanup((): void => window.clearInterval(intervalId));
	});

	return (
		<div
			class={`wb-app ${style['wb-app']}`}
			data-host-ready={Boolean(props.hostElement)}
			data-page-index={pageIndex()}
			style={themeStyle()}
		>
			<header class="agent-header">
				<div class="agent-header__title">
					<span>{settings().subtitle}</span>
					<h1 ref={fitTitle}>{settings().title}</h1>
					<small>{updatedAt()}</small>
				</div>
				<div class="agent-summary">
					<For each={summary()}>
						{(item: StatusSummary): JSX.Element => (
							<div data-tone={item.tone}>
								<i />
								<strong>{item.value}</strong>
								<span>{item.label}</span>
							</div>
						)}
					</For>
				</div>
				<div class="agent-page" aria-label={`Page ${pageIndex() + 1} of ${pageCount()}`}>
					<For each={pages()}>
						{(_page: AgentStatusRow[], index: Accessor<number>): JSX.Element => (
							<i data-active={index() === pageIndex()} />
						)}
					</For>
				</div>
			</header>

			<Show
				when={currentAgents().length > 0}
				fallback={
					<main class="agent-empty">
						<span>WORKFORCE STATUS</span>
						<strong>{settings().emptyState}</strong>
					</main>
				}
			>
				<main class={`agent-grid ${currentAgents().length <= 4 ? 'agent-grid--sparse' : ''}`}>
					<For each={currentAgents()}>
						{(agent: AgentStatusRow): JSX.Element => (
							<article class="agent-card" data-agent-tone={agent.tone} data-agent-name={agent.name}>
									<div class="agent-card__top">
										<div class="agent-avatar">{initials(agent.name)}</div>
										<div class="agent-identity">
											<strong title={agent.name}>{agent.name}</strong>
										<span>
											<i />
											<b>{agent.state}</b>
										</span>
									</div>
									<time>{agent.duration}</time>
								</div>
								<div class="agent-card__metrics">
									<div>
										<span>Handled</span>
										<strong>{agent.handled}</strong>
									</div>
									<div>
										<span>Presented</span>
										<strong>{agent.presented}</strong>
									</div>
									<div>
										<span>Avg. talk</span>
										<strong>{agent.averageTalk}</strong>
									</div>
								</div>
							</article>
						)}
					</For>
				</main>
			</Show>
		</div>
	);
};
