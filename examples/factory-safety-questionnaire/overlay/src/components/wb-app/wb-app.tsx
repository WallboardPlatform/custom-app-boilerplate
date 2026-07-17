import { createMemo, createSignal, For, onCleanup, Show } from 'solid-js';
import type { Accessor, JSX } from 'solid-js';

import {
	type ApiService,
	type DataSourceService,
	useApiMethods,
	useDatasourceMethods
} from 'wallboard-app-sdk';

import { getMetadata } from '@hooks/system/getMetadata';
import { useAutoFitText } from '@hooks/system/useAutoFitText';
import { useDataSources } from '@hooks/system/useDataSources';
import { useExternalCommandListener } from '@hooks/system/useExternalCommandListener';
import { useSettings } from '@hooks/system/useSettings';

import type { DataSources, Settings } from '@interfaces/application.interface';
import type {
	AnswerOption,
	SafetyAnswer,
	SafetyQuestion,
	SafetySubmission
} from '@interfaces/questionnaire.interface';

import { createInternalDatasourceWriter } from '@utils/internal-datasource';
import { motionVariables, resolveMotion } from '@utils/motion';
import { createPageSession } from '@utils/page-session';
import { resolveTheme } from '@utils/theme';

import style from '@components/wb-app/wb-app.module.scss';

import sampleQuestionData from '../../../sample-questions-datasource.json';

type AppView = 'start' | 'identity' | 'question' | 'summary' | 'complete';
type SubmissionStatus = 'idle' | 'saving' | 'saved' | 'preview' | 'failed';
type ThemeTokens = Record<'accent' | 'background' | 'border' | 'primary' | 'secondary' | 'surface', string>;

const ANSWER_OPTIONS: AnswerOption[] = ['A', 'B', 'C', 'D'];

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

	const table: unknown = parseValue(value.Questions);

	if (Array.isArray(table)) return table as unknown[];

	return isRecord(table) && Array.isArray(table.rows) ? table.rows as unknown[] : undefined;
};

const text = (value: unknown): string => {
	return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
};

const enabled = (value: unknown): boolean => {
	return value === undefined || value === null || value === '' || (value !== false && value !== 0 && value !== 'false');
};

const normalizeQuestions = (rows: unknown[]): SafetyQuestion[] => {
	return rows
		.map((row: unknown, index: number): SafetyQuestion | undefined => {
			if (!isRecord(row) || !enabled(row.enabled)) return undefined;

			const questionId: string = text(row.questionId);
			const prompt: string = text(row.prompt);
			const correctOption: string = text(row.correctOption).toUpperCase();
			const options = ANSWER_OPTIONS.map((id: AnswerOption) => ({
				id,
				label: text(row[`option${id}`])
			}));

			if (
				!questionId
				|| !prompt
				|| !ANSWER_OPTIONS.includes(correctOption as AnswerOption)
				|| options.some((option) => !option.label)
			) return undefined;

			const parsedOrder: number = Number(row.sortOrder);

			return {
				correctOption: correctOption as AnswerOption,
				explanation: text(row.explanation),
				options,
				prompt,
				questionId,
				sortOrder: Number.isFinite(parsedOrder) ? parsedOrder : index + 1
			};
		})
		.filter((question: SafetyQuestion | undefined): question is SafetyQuestion => Boolean(question))
		.sort((left, right): number => left.sortOrder - right.sortOrder);
};

const createSubmissionId = (): string => {
	return `safety-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
};

export default (props: { hostElement: HTMLDivElement }): JSX.Element => {
	const dataSources: Accessor<DataSources> = useDataSources();
	const settings: Accessor<Settings> = useSettings();
	const metadata = getMetadata();
	const api: ApiService = useApiMethods(metadata);
	const datasource: DataSourceService = useDatasourceMethods(metadata);
	const writer = createInternalDatasourceWriter(api, datasource);
	const [view, setView] = createSignal<AppView>('start');
	const [participantName, setParticipantName] = createSignal('');
	const [corporateId, setCorporateId] = createSignal('');
	const [questionIndex, setQuestionIndex] = createSignal(0);
	const [answers, setAnswers] = createSignal<SafetyAnswer[]>([]);
	const [submissionError, setSubmissionError] = createSignal('');
	const [submissionStatus, setSubmissionStatus] = createSignal<SubmissionStatus>('idle');
	const session = createPageSession<AppView>({
		initialView: 'start',
		inactivityMs: (): number => settings().inactivityResetSeconds * 1000,
		onViewChange: setView,
		onReset: (): void => {
			setParticipantName('');
			setCorporateId('');
			setQuestionIndex(0);
			setAnswers([]);
			setSubmissionError('');
			setSubmissionStatus('idle');
		}
	});
	const hasBoundQuestions: Accessor<boolean> = createMemo((): boolean => {
		return Object.prototype.hasOwnProperty.call(dataSources(), 'questionData');
	});
	const questions: Accessor<SafetyQuestion[]> = createMemo((): SafetyQuestion[] => {
		const source: unknown = hasBoundQuestions()
			? dataSources().questionData?.value
			: sampleQuestionData;

		return normalizeQuestions(extractRows(source) ?? []);
	});
	const currentQuestion: Accessor<SafetyQuestion | undefined> = createMemo(() => questions()[questionIndex()]);
	const selectedAnswer: Accessor<SafetyAnswer | undefined> = createMemo(() => {
		const question: SafetyQuestion | undefined = currentQuestion();

		return question ? answers().find((answer) => answer.questionId === question.questionId) : undefined;
	});
	const score: Accessor<number> = createMemo((): number => answers().filter((answer) => answer.correct).length);
	const fitWelcomeTitle = useAutoFitText({
		minFontSize: 34,
		maxFontSize: 88,
		watch: (): string => settings().welcomeTitle
	});
	const fitQuestionPrompt = useAutoFitText({
		minFontSize: 28,
		maxFontSize: 58,
		watch: (): string => currentQuestion()?.prompt ?? ''
	});
	const themeStyle: Accessor<JSX.CSSProperties> = createMemo((): JSX.CSSProperties => {
		const custom: ThemeTokens = {
			accent: settings().accentColor,
			background: settings().backgroundColor,
			border: settings().secondaryTextColor,
			primary: settings().primaryTextColor,
			secondary: settings().secondaryTextColor,
			surface: settings().surfaceColor
		};
		const tokens: ThemeTokens = resolveTheme(settings().themePreset, {
			dark: {
				accent: '#ff5d48', background: '#071313', border: '#31504b',
				primary: '#f8f4eb', secondary: '#a9bfba', surface: '#102321'
			},
			light: {
				accent: '#c83b2d', background: '#eef2ed', border: '#9aada7',
				primary: '#102321', secondary: '#51645f', surface: '#ffffff'
			},
			custom
		});

		return {
			'--wb-factory-safety-accent': tokens.accent,
			'--wb-factory-safety-background': tokens.background,
			'--wb-factory-safety-border': tokens.border,
			'--wb-factory-safety-primary': tokens.primary,
			'--wb-factory-safety-secondary': tokens.secondary,
			'--wb-factory-safety-surface': tokens.surface,
			...motionVariables(resolveMotion(settings().motionPreset))
		};
	});
	const progressPercent: Accessor<number> = createMemo((): number => {
		if (view() === 'start') {
			return 0;
		}

		if (view() === 'identity') {
			return 12;
		}

		if (view() === 'question') {
			return 20 + ((questionIndex() + 1) / Math.max(questions().length, 1)) * 65;
		}

		return 100;
	});

	const reset = (): void => session.reset('manual');
	const chooseAnswer = (selectedOption: AnswerOption): void => {
		const question: SafetyQuestion | undefined = currentQuestion();

		if (!question) {
			return;
		}

		setAnswers((current): SafetyAnswer[] => [
			...current.filter((answer) => answer.questionId !== question.questionId),
			{
				correct: selectedOption === question.correctOption,
				questionId: question.questionId,
				selectedOption
			}
		]);
		session.activity();
	};
	const continueFromQuestion = (): void => {
		if (!selectedAnswer()) return;

		if (questionIndex() + 1 >= questions().length) {
			session.navigate('summary');
		} else {
			setQuestionIndex((current) => current + 1);
			session.activity();
		}
	};
	const submit = (): void => {
		if (submissionStatus() === 'saving' || submissionStatus() === 'saved' || submissionStatus() === 'preview') {
			return;
		}

		setSubmissionStatus('saving');
		const submission: SafetySubmission = {
			answersJson: JSON.stringify(answers()),
			completedAt: new Date().toISOString(),
			corporateId: corporateId().trim(),
			participantName: participantName().trim(),
			score: score(),
			submissionId: createSubmissionId(),
			totalQuestions: questions().length
		};
		const result = writer.append('resultsData', 'Results.rows', submission, {
			maxElementCount: settings().resultRetentionLimit,
			rotateEnabled: true
		});

		if (result.status === 'failed') {
			setSubmissionError(result.message);
			setSubmissionStatus('failed');
			session.navigate('complete');

			return;
		}

		setSubmissionError('');
		setSubmissionStatus(result.status === 'editor-blocked' ? 'preview' : 'saved');
		api.triggerSensorEvent('safety-check-completed', {
			score: submission.score,
			submissionId: submission.submissionId,
			totalQuestions: submission.totalQuestions
		});
		session.navigate('complete');
		session.completeAfter(settings().completionResetSeconds * 1000);
	};

	useExternalCommandListener((command): void => {
		if (command.getCommand() === 'resetSession') reset();
	});
	onCleanup((): void => session.destroy());

	return (
		<div
			class={style['wb-app']}
			data-host-ready={Boolean(props.hostElement)}
			data-motion={settings().motionPreset}
			data-preview-id="factory-safety-root"
			data-view={view()}
			style={themeStyle()}
		>
			<aside class={style['brand-rail']}>
				<div class={style['brand-mark']} aria-hidden="true"><span>NM</span></div>
				<div>
					<strong>{settings().plantName}</strong>
					<span>Safety checkpoint</span>
				</div>
				<div class={style['rail-status']}>
					<span>ASSEMBLY ACCESS</span>
					<strong>{view() === 'complete' ? 'COMPLETE' : 'CHECK IN PROGRESS'}</strong>
				</div>
			</aside>

			<section class={style['experience']}>
				<header class={`${style['topbar']} wb-factory-safety-metadata`}>
					<span>WORKPLACE SAFETY</span>
					<Show when={view() !== 'start'}>
						<button class={style['reset-button']} type="button" onClick={reset}>Reset</button>
					</Show>
				</header>

				<div class={style['progress-track']} aria-hidden="true">
					<span style={{ width: `${progressPercent()}%` }} />
				</div>

				<main class={style['view-stage']}>
					<Show when={view() === 'start'}>
						<div class={`${style['view']} ${style['start-view']}`}>
							<div class={style['step-number']} data-step-number="true">01</div>
							<p class={`${style['eyebrow']} wb-factory-safety-metadata`}>ONE-SHOT SAFETY CHECK</p>
							<h1 ref={fitWelcomeTitle} class="wb-factory-safety-welcome-title">{settings().welcomeTitle}</h1>
							<p class={`${style['lead']} wb-factory-safety-secondary`}>{settings().introText}</p>
							<Show
								when={questions().length > 0}
								fallback={<div class={style['empty-state']}>No active safety questions are available.</div>}
							>
								<button class={style['primary-button']} type="button" onClick={(): void => session.navigate('identity')}>
									Start safety check <span aria-hidden="true">-&gt;</span>
								</button>
							</Show>
						</div>
					</Show>

					<Show when={view() === 'identity'}>
						<form
							class={`${style['view']} ${style['identity-view']}`}
							onSubmit={(event): void => {
								event.preventDefault();

								if (participantName().trim() && corporateId().trim()) {
									session.navigate('question');
								}
							}}
						>
							<div class={style['step-number']} data-step-number="true">02</div>
							<p class={`${style['eyebrow']} wb-factory-safety-metadata`}>IDENTITY</p>
							<h1 class="wb-factory-safety-identity-title">Before we begin</h1>
							<p class={`${style['lead']} wb-factory-safety-secondary`}>{settings().identityPrompt}</p>
							<div class={style['field-row']}>
								<label>
									<span>Full name</span>
									<input value={participantName()} onInput={(event): void => { setParticipantName(event.currentTarget.value); session.activity(); }} autocomplete="name" required />
								</label>
								<label>
									<span>Corporate ID</span>
									<input value={corporateId()} onInput={(event): void => { setCorporateId(event.currentTarget.value); session.activity(); }} autocomplete="off" required />
								</label>
							</div>
							<button class={style['primary-button']} type="submit">Continue <span aria-hidden="true">-&gt;</span></button>
						</form>
					</Show>

					<Show when={view() === 'question' && currentQuestion()} keyed>
						{(question: SafetyQuestion): JSX.Element => (
							<div class={`${style['view']} ${style['question-view']}`}>
								<div class={`${style['question-meta']} wb-factory-safety-metadata`}>
									<span>QUESTION {questionIndex() + 1} / {questions().length}</span>
									<strong>{Math.round(((questionIndex() + 1) / questions().length) * 100)}%</strong>
								</div>
								<h1 ref={fitQuestionPrompt} class="wb-factory-safety-question-prompt">{question.prompt}</h1>
								<div class={style['options']}>
									<For each={question.options}>
										{(option): JSX.Element => (
											<button
												class={`${style['option-button']} ${selectedAnswer()?.selectedOption === option.id ? style['option-selected'] : ''}`}
												type="button"
												onClick={(): void => chooseAnswer(option.id)}
											>
												<span class={style['option-id']}>{option.id}</span>
												<span class="wb-factory-safety-option-label">{option.label}</span>
											</button>
										)}
									</For>
								</div>
								<div class={style['question-actions']}>
									<button
										class={style['secondary-button']}
										disabled={questionIndex() === 0}
										type="button"
										onClick={(): void => { setQuestionIndex((current) => Math.max(0, current - 1)); session.activity(); }}
									>Back</button>
									<button class={style['primary-button']} disabled={!selectedAnswer()} type="button" onClick={continueFromQuestion}>
										{questionIndex() + 1 === questions().length ? 'Review score' : 'Next question'} <span aria-hidden="true">-&gt;</span>
									</button>
								</div>
							</div>
						)}
					</Show>

					<Show when={view() === 'summary'}>
						<div class={`${style['view']} ${style['summary-view']}`}>
							<div class={style['score-block']}>
								<span>YOUR SCORE</span>
								<strong class="wb-factory-safety-score">{score()}<small>/{questions().length}</small></strong>
							</div>
							<div class={style['summary-copy']}>
								<p class={`${style['eyebrow']} wb-factory-safety-metadata`}>CHECK COMPLETE</p>
								<h1 class="wb-factory-safety-summary-title">{score() === questions().length ? 'All clear.' : 'Review before entry.'}</h1>
								<p class={`${style['lead']} wb-factory-safety-secondary`}>{participantName()}, your answers are ready to submit to the safety record.</p>
								<div class={style['answer-strip']}>
									<For each={answers()}>{(answer, index): JSX.Element => <span data-correct={answer.correct}>Q{index() + 1}</span>}</For>
								</div>
								<button class={style['primary-button']} disabled={submissionStatus() === 'saving'} type="button" onClick={submit}>Submit result <span aria-hidden="true">-&gt;</span></button>
							</div>
						</div>
					</Show>

					<Show when={view() === 'complete'}>
						<div class={`${style['view']} ${style['complete-view']}`} data-submit-status={submissionStatus()}>
							<div class={style['completion-mark']} aria-hidden="true">{submissionStatus() === 'failed' ? '!' : submissionStatus() === 'preview' ? 'i' : 'OK'}</div>
							<p class={`${style['eyebrow']} wb-factory-safety-metadata`}>{submissionStatus() === 'failed' ? 'RESULT NOT SAVED' : submissionStatus() === 'preview' ? 'PREVIEW COMPLETE' : 'SAFETY CHECK RECORDED'}</p>
							<h1 class="wb-factory-safety-complete-title">{submissionStatus() === 'failed' ? 'Please try again.' : submissionStatus() === 'preview' ? 'Ready for the displayer.' : 'Thank you. Stay alert.'}</h1>
							<p class={`${style['lead']} wb-factory-safety-secondary`}>
								{submissionError() || (submissionStatus() === 'preview'
									? 'Results are saved only when this app runs in the displayer.'
									: `This station will reset in ${settings().completionResetSeconds} seconds.`)}
							</p>
							<Show when={submissionError()}>
								<button class={style['primary-button']} type="button" onClick={(): void => session.navigate('summary')}>Return to summary</button>
							</Show>
						</div>
					</Show>
				</main>

				<footer class={style['footer']}>
					<span>Northline EHS / Training station 04</span>
					<span>Shared device - participant data clears after reset</span>
				</footer>
			</section>
		</div>
	);
};
