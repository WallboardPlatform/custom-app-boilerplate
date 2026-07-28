import { Show } from 'solid-js';
import type { JSX } from 'solid-js';

import { useAutoFitText } from '@hooks/system/useAutoFitText';

import type { OfficeReading } from '@interfaces/office-clock.interface';

export interface WbOfficeColumnProps {
	reading: OfficeReading;
	showOpenState: boolean;
}

export default (props: WbOfficeColumnProps): JSX.Element => {
	/**
	 * The name is auto-fitted rather than merely clamped. A fixed two-line clamp lets a third line
	 * peek through the moment a long name wraps at a smaller tier, which the ink-safety gate reads
	 * — correctly — as clipped text. Fitting the name to the budget means the third line never forms.
	 */
	const fitName = useAutoFitText({
		minFontSize: 14,
		maxFontSize: 30,
		widthOnly: false,
		watch: (): string => props.reading.office.name
	});

	return (
		<article class="wb-global-office-clock-office" data-open-state={props.reading.openState}>
			<div class="wb-global-office-clock-identity">
				<span ref={fitName} class="wb-global-office-clock-office-name">{props.reading.office.name}</span>
				<Show when={props.reading.office.region}>
					<span class="wb-global-office-clock-region">{props.reading.office.region}</span>
				</Show>
			</div>
			<strong class="wb-global-office-clock-time">{props.reading.time}</strong>
			<div class="wb-global-office-clock-foot">
				<span class="wb-global-office-clock-date">{props.reading.date}</span>
				<Show when={props.showOpenState}>
					<span class="wb-global-office-clock-open-state">{props.reading.openLabel}</span>
				</Show>
			</div>
		</article>
	);
};
