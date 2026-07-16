import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';

import WbStatusMarker from '@components/wb-status-marker/wb-status-marker';

import type { AndonPageSection, AndonStation, AndonTone } from '@interfaces/andon.interface';

import style from '@components/wb-line-section/wb-line-section.module.scss';

const lineStateLabel = (tone: AndonTone): string => {
	if (tone === 'normal') {
		return 'LINE CLEAR';
	}

	if (tone === 'attention') {
		return 'ATTENTION';
	}

	if (tone === 'stopped') {
		return 'STOP ACTIVE';
	}

	return 'VERIFY STATE';
};

export default (props: { section: AndonPageSection }): JSX.Element => {
	return (
		<article
			class={`line-section ${style['line-section']}`}
			data-line-tone={props.section.tone}
			style={{ 'flex-grow': String(props.section.stations.length + 0.72) }}
		>
			<header class="line-section__header">
				<div class="line-section__identity">
					<strong class="line-section__name" title={props.section.name}>{props.section.name}</strong>
					<span>
						{props.section.stations.length} STATIONS
						<Show when={props.section.continuedFromPrevious}> / CONTINUED</Show>
						<Show when={props.section.continuesNext}> / MORE NEXT</Show>
					</span>
				</div>
				<div class="line-section__status" data-tone={props.section.tone}>
					<strong>{lineStateLabel(props.section.tone)}</strong>
					<span>{props.section.exceptionCount} EXCEPTIONS</span>
				</div>
			</header>

			<div class="line-section__stations">
				<For each={props.section.stations}>
					{(station: AndonStation): JSX.Element => (
						<div class="station-row" data-state-tone={station.tone}>
							<div class="station-row__signal">
								<WbStatusMarker size="row" tone={station.tone} />
								<strong
									class="station-row__state"
									title={station.originalState ? `Source state: ${station.originalState}` : 'Source state not supplied'}
								>
									{station.stateLabel}
								</strong>
							</div>
							<div class="station-row__copy">
								<div class="station-row__identity">
									<strong class="station-row__name" title={station.station}>{station.station}</strong>
									<time class="station-row__elapsed" title={station.elapsedDuration}>{station.elapsedDuration}</time>
								</div>
								<p class="station-row__reason" title={station.reason}>{station.reason}</p>
								<span class="station-row__owner" title={station.ownerRole}>OWNER / {station.ownerRole}</span>
							</div>
						</div>
					)}
				</For>
			</div>
		</article>
	);
};
