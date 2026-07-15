import { createEffect, createMemo, createSignal, For, onCleanup, Show } from 'solid-js';
import type { Accessor, JSX } from 'solid-js';

import { useDataSources } from '@hooks/system/useDataSources';
import { useAutoFitText } from '@hooks/system/useAutoFitText';
import { useSettings } from '@hooks/system/useSettings';

import type { DataSources, Settings } from '@interfaces/application.interface';
import type {
	SkillAgentRow,
	SkillAgentTone,
	SkillGauge,
	SkillPage,
	SkillStatusCount
} from '@interfaces/skill-operations.interface';

import style from '@components/wb-app/wb-app.module.scss';

import sampleDatasourceJson from '../../../sample-datasource.json';

interface ExtractedSkillRows {
	rows: unknown[];
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

const objectValues = (value: unknown): unknown[] => {
	if (Array.isArray(value)) {
		return value;
	}

	if (!isRecord(value)) {
		return [];
	}

	if (Object.prototype.hasOwnProperty.call(value, 'skillname')) {
		return [value];
	}

	return Object.keys(value).map((key: string): unknown => value[key]);
};

const extractRows = (rawValue: unknown): ExtractedSkillRows => {
	const value: unknown = parseValue(rawValue);

	if (!isRecord(value)) {
		return { rows: objectValues(value), updatedAt: '' };
	}

	const nestedValue: unknown = parseValue(value.data);

	return {
		rows: nestedValue !== undefined ? objectValues(nestedValue) : objectValues(value),
		updatedAt: toText(value['json_file_update_timestamep (every 3 seconds)']) || toText(value.updatedAt)
	};
};

const toTone = (state: string): SkillAgentTone => {
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
		return 'active';
	}

	if (normalized.includes('ready') || normalized.includes('available')) {
		return 'ready';
	}

	return 'unknown';
};

const normalizeRows = (rows: unknown[]): SkillAgentRow[] => {
	return rows
		.map((rawRow: unknown): SkillAgentRow | undefined => {
			if (!isRecord(rawRow)) {
				return undefined;
			}

			const uniqueAgent: string = toText(rawRow.unique_agent);
			const resourceId: number = toNumber(rawRow.resourceid);
			const name: string = toText(rawRow.agent_name) || toText(rawRow.Name);
			const skill: string = toText(rawRow.skillname) || toText(rawRow.skill);

			if (
				!name ||
				!skill ||
				uniqueAgent === '_unique_agent' ||
				resourceId === 0 ||
				name.charAt(0) === '_' ||
				skill.charAt(0) === '_'
			) {
				return undefined;
			}

			const state: string = toText(rawRow.agent_state) || toText(rawRow.State) || 'Unknown';

			return {
				name,
				skill,
				businessUnit: toText(rawRow.business_unit),
				state,
				stateReason: toText(rawRow.agent_state_reason),
				duration: toText(rawRow.duration_time) || toText(rawRow.Duration_Time) || '00:00:00',
				tone: toTone(state)
			};
		})
		.filter((row: SkillAgentRow | undefined): row is SkillAgentRow => Boolean(row));
};

const groupSkills = (rows: SkillAgentRow[]): SkillPage[] => {
	const grouped: Record<string, SkillAgentRow[]> = {};

	rows.forEach((row: SkillAgentRow): void => {
		if (!grouped[row.skill]) {
			grouped[row.skill] = [];
		}

		grouped[row.skill].push(row);
	});

	return Object.keys(grouped)
		.sort((left: string, right: string): number => left.localeCompare(right))
		.map((skillName: string): SkillPage => {
			const agents: SkillAgentRow[] = grouped[skillName]
				.slice()
				.sort((left: SkillAgentRow, right: SkillAgentRow): number => left.name.localeCompare(right.name));

			return {
				name: skillName,
				businessUnit: agents[0]?.businessUnit || 'Unassigned unit',
				agents
			};
		});
};

const sampleDatasource: unknown = sampleDatasourceJson;

export default (props: { hostElement: HTMLDivElement }): JSX.Element => {
	const dataSources: Accessor<DataSources> = useDataSources();
	const settings: Accessor<Settings> = useSettings();
	const [skillIndex, setSkillIndex] = createSignal<number>(0);
	const hasBoundDatasource: Accessor<boolean> = createMemo((): boolean => {
		return Object.prototype.hasOwnProperty.call(dataSources(), 'skillData');
	});
	const extracted: Accessor<ExtractedSkillRows> = createMemo((): ExtractedSkillRows => {
		const value: unknown = hasBoundDatasource() ? dataSources().skillData?.value : sampleDatasource;

		return extractRows(value);
	});
	const skills: Accessor<SkillPage[]> = createMemo((): SkillPage[] => groupSkills(normalizeRows(extracted().rows)));
	const currentSkill: Accessor<SkillPage | undefined> = createMemo((): SkillPage | undefined => {
		return skills()[skillIndex() % Math.max(skills().length, 1)];
	});
	const fitTitle = useAutoFitText({
		minFontSize: 18,
		maxFontSize: 38,
		widthOnly: true,
		watch: (): string => settings().title
	});
	const visibleAgents: Accessor<SkillAgentRow[]> = createMemo((): SkillAgentRow[] => {
		return currentSkill()?.agents.slice(0, settings().maxAgentsShown) ?? [];
	});
	const remainingAgentCount: Accessor<number> = createMemo((): number => {
		return Math.max(0, (currentSkill()?.agents.length ?? 0) - visibleAgents().length);
	});
	const statusCounts: Accessor<SkillStatusCount[]> = createMemo((): SkillStatusCount[] => {
		const agents: SkillAgentRow[] = currentSkill()?.agents ?? [];

		return [
			{
				label: 'Ready',
				value: agents.filter((agent: SkillAgentRow): boolean => agent.tone === 'ready').length,
				tone: 'ready'
			},
			{
				label: 'Active',
				value: agents.filter((agent: SkillAgentRow): boolean => agent.tone === 'active').length,
				tone: 'active'
			},
			{
				label: 'ACW',
				value: agents.filter((agent: SkillAgentRow): boolean => agent.tone === 'acw').length,
				tone: 'acw'
			},
			{
				label: 'Away',
				value: agents.filter((agent: SkillAgentRow): boolean => agent.tone === 'away').length,
				tone: 'away'
			},
			{
				label: 'Offline',
				value: agents.filter((agent: SkillAgentRow): boolean => agent.tone === 'offline' || agent.tone === 'unknown')
					.length,
				tone: 'offline'
			}
		];
	});
	const gauges: Accessor<SkillGauge[]> = createMemo((): SkillGauge[] => {
		const agents: SkillAgentRow[] = currentSkill()?.agents ?? [];
		const total: number = Math.max(agents.length, 1);
		const ready: number = agents.filter((agent: SkillAgentRow): boolean => agent.tone === 'ready').length;
		const active: number = agents.filter((agent: SkillAgentRow): boolean => agent.tone === 'active').length;
		const readyPercent: number = (ready / total) * 100;
		const activePercent: number = (active / total) * 100;

		return [
			{ label: 'Ready coverage', value: readyPercent, displayValue: `${ready} / ${agents.length}`, tone: 'ready' },
			{ label: 'On contacts', value: activePercent, displayValue: `${active} active`, tone: 'active' }
		];
	});
	const themeStyle: Accessor<JSX.CSSProperties> = createMemo((): JSX.CSSProperties => ({
		'--skill-background': settings().backgroundColor,
		'--skill-surface': settings().surfaceColor,
		'--skill-row-surface': settings().rowSurfaceColor,
		'--skill-divider': settings().dividerColor,
		'--skill-track': settings().trackColor,
		'--skill-primary': settings().primaryTextColor,
		'--skill-secondary': settings().secondaryTextColor,
		'--skill-ready': settings().readyColor,
		'--skill-active': settings().activeColor,
		'--skill-acw': settings().acwColor,
		'--skill-away': settings().awayColor,
		'--skill-offline': settings().offlineColor,
		'--skill-unknown': settings().unknownColor,
		'--skill-font': settings().fontFamily
	}));

	createEffect((): void => {
		const count: number = skills().length;

		if (skillIndex() >= count) {
			setSkillIndex(0);
		}
	});

	createEffect((): void => {
		const count: number = skills().length;
		const duration: number = settings().rotationSeconds;

		if (count <= 1) {
			return;
		}

		const intervalId: number = window.setInterval((): void => {
			setSkillIndex((current: number): number => (current + 1) % count);
		}, duration * 1000);

		onCleanup((): void => window.clearInterval(intervalId));
	});

	return (
		<div class={`wb-app ${style['wb-app']}`} data-host-ready={Boolean(props.hostElement)} style={themeStyle()}>
			<header class="skill-header">
				<div>
					<span>{settings().subtitle}</span>
					<h1 ref={fitTitle}>{settings().title}</h1>
				</div>
				<div class="skill-header__meta">
					<strong>LIVE SKILL SNAPSHOT</strong>
					<small>{extracted().updatedAt || 'Update time unavailable'}</small>
				</div>
			</header>

			<Show
				when={currentSkill()}
				fallback={
					<main class="skill-empty">
						<span>SKILL COVERAGE</span>
						<strong>{settings().emptyState}</strong>
					</main>
				}
			>
				{(skill: Accessor<SkillPage>): JSX.Element => (
					<main class="skill-content" data-skill-name={skill().name}>
						<aside class="skill-overview">
							<div class="skill-identity">
								<span>{skill().businessUnit || 'UNASSIGNED UNIT'}</span>
								<h2 title={skill().name}>{skill().name}</h2>
								<p>{skill().agents.length} agents assigned to this skill</p>
							</div>

							<div class="skill-gauges">
								<For each={gauges()}>
									{(gauge: SkillGauge): JSX.Element => (
										<div data-tone={gauge.tone}>
											<div class="skill-gauge">
												<svg viewBox="0 0 120 120" aria-hidden="true">
													<circle class="skill-gauge__track" cx="60" cy="60" r="50" pathLength="100" />
													<circle
														class="skill-gauge__value"
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
										</div>
									)}
								</For>
							</div>

							<div class="skill-distribution">
								<div class="skill-distribution__bar">
									<For each={statusCounts()}>
										{(item: SkillStatusCount): JSX.Element => (
											<i data-tone={item.tone} style={{ 'flex-grow': Math.max(item.value, 0) }} />
										)}
									</For>
								</div>
								<div class="skill-distribution__labels">
									<For each={statusCounts()}>
										{(item: SkillStatusCount): JSX.Element => (
											<span data-tone={item.tone}>
												<i />
												{item.label} <strong>{item.value}</strong>
											</span>
										)}
									</For>
								</div>
							</div>

							<div class="skill-page" aria-label={`Skill ${skillIndex() + 1} of ${skills().length}`}>
								<span>
									SKILL {skillIndex() + 1} OF {skills().length}
								</span>
								<div>
									<For each={skills()}>
										{(_item: SkillPage, index: Accessor<number>): JSX.Element => (
											<i data-active={index() === skillIndex()} />
										)}
									</For>
								</div>
							</div>
						</aside>

						<section class="skill-roster">
							<header>
								<div>
									<span>AGENT ROSTER</span>
									<strong>Current state and duration</strong>
								</div>
								<Show when={remainingAgentCount() > 0}>
									<b>+ {remainingAgentCount()} more agents</b>
								</Show>
							</header>
							<div
								class="skill-roster__grid"
								classList={{
									'skill-roster__grid--sparse': visibleAgents().length <= 3,
									'skill-roster__grid--medium': visibleAgents().length > 3 && visibleAgents().length <= 6,
									'skill-roster__grid--large': visibleAgents().length > 6 && visibleAgents().length <= 9,
									'skill-roster__grid--dense': visibleAgents().length > 9
								}}
							>
								<For each={visibleAgents()}>
									{(agent: SkillAgentRow): JSX.Element => (
										<article data-agent-tone={agent.tone} data-agent-name={agent.name}>
											<i />
											<div>
												<strong>{agent.name}</strong>
												<span>{agent.stateReason || agent.state}</span>
											</div>
											<time>{agent.duration}</time>
										</article>
									)}
								</For>
							</div>
						</section>
					</main>
				)}
			</Show>
		</div>
	);
};
