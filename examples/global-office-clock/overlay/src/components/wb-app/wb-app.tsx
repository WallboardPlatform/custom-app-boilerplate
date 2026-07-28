import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import type { Accessor, JSX } from 'solid-js';

import { useAutoFitText } from '@hooks/system/useAutoFitText';
import { useDataSources } from '@hooks/system/useDataSources';
import { useSettings } from '@hooks/system/useSettings';

import type { DataSources, Settings } from '@interfaces/application.interface';
import type { Office, OfficeReading } from '@interfaces/office-clock.interface';

import { columnsFor, normalizeOffices, hoursLabel, offsetFromHome, offsetLabel, readOffice, tierFor } from '@utils/office-clock';
import type { SurfaceTier } from '@utils/office-clock';

import WbOfficeColumn from '@components/wb-office-column/wb-office-column';

import style from '@components/wb-app/wb-app.module.scss';

export default (props: { hostElement: HTMLDivElement }): JSX.Element => {
	const dataSources: Accessor<DataSources> = useDataSources();
	const settings: Accessor<Settings> = useSettings();
	const [now, setNow] = createSignal<Date>(new Date());
	const [portrait, setPortrait] = createSignal(false);
	const [tier, setTier] = createSignal<SurfaceTier>('large');

	const fitTitle = useAutoFitText({
		minFontSize: 20,
		maxFontSize: 54,
		widthOnly: false,
		watch: (): string => settings().boardTitle
	});

	const offices: Accessor<Office[]> = createMemo((): Office[] => normalizeOffices(dataSources().officeData?.value));
	const readings: Accessor<OfficeReading[]> = createMemo((): OfficeReading[] => {
		const at: Date = now();
		const options = { hour12: settings().timeFormat === '12', showSeconds: settings().showSeconds };

		return offices().map((office: Office): OfficeReading => readOffice(office, at, options));
	});
	const columns: Accessor<number> = createMemo((): number => columnsFor(offices().length, portrait(), tier()));

	// A shared board clock rather than one timer per office: every column must tick together, and
	// one instance-local interval is one thing to clean up.
	onMount((): void => {
		const timer: number = window.setInterval((): void => {
			setNow(new Date());
		}, 1000);

		onCleanup((): void => window.clearInterval(timer));
	});

	onMount((): void => {
		const element: HTMLDivElement = props.hostElement;
		const measure = (): void => {
			setPortrait(element.clientHeight > element.clientWidth * 1.1);
			setTier(tierFor(element.clientWidth, element.clientHeight));
		};

		measure();

		if (typeof ResizeObserver !== 'function') {
			const poll: number = window.setInterval(measure, 500);

			onCleanup((): void => window.clearInterval(poll));

			return;
		}

		const observer = new ResizeObserver((): void => measure());

		observer.observe(element);
		onCleanup((): void => observer.disconnect());
	});

	createEffect((): void => {
		props.hostElement.dataset.officeCount = String(offices().length);
	});

	return (
		<section
			class={`wb-global-office-clock ${style['wb-global-office-clock']}`}
			data-preview-id="global-office-clock-root"
			data-host-ready={Boolean(props.hostElement)}
			data-office-count={offices().length}
			data-columns={columns()}
			data-orientation={portrait() ? 'portrait' : 'landscape'}
			data-tier={tier()}
			style={{
				'--wb-office-background': settings().backgroundColor,
				'--wb-office-surface': settings().surfaceColor,
				'--wb-office-primary': settings().primaryTextColor,
				'--wb-office-secondary': settings().secondaryTextColor,
				'--wb-office-accent': settings().accentColor,
				'--wb-office-divider': settings().dividerColor,
				'--wb-office-columns': String(columns())
			}}
		>
			<header class="wb-global-office-clock-header">
				<h1 ref={fitTitle} class="wb-global-office-clock-title">{settings().boardTitle}</h1>
				<Show when={readings().length > 0}>
					<span class="wb-global-office-clock-count">{readings().length} offices</span>
				</Show>
			</header>

			<Show
				when={readings().length > 0}
				fallback={(
					<div class="wb-global-office-clock-empty">
						<p class="wb-global-office-clock-empty-message">{settings().emptyStateText}</p>
					</div>
				)}
			>
				<div class="wb-global-office-clock-board">
					<For each={readings()}>
						{(reading: OfficeReading, index): JSX.Element => (
							<WbOfficeColumn
								reading={reading}
								home={index() === 0}
								hoursLabel={hoursLabel(reading.office)}
								offsetLabel={offsetLabel(offsetFromHome(offices()[0] as Office, reading.office, now()))}
								showOpenState={settings().showOpenState}
							/>
						)}
					</For>
				</div>
			</Show>
		</section>
	);
};
