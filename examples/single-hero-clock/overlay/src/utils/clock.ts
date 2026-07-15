import type { ClockFormatOptions, ClockValue } from '@interfaces/clock.interface';

const padNumber = (value: number): string => {
	return value < 10 ? `0${value}` : String(value);
};

const resolveTimezone = (timezone: string, date: Date): { timezone: string; valid: boolean } => {
	try {
		new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(date);

		return { timezone, valid: true };
	} catch {
		return { timezone: 'UTC', valid: false };
	}
};

const dateOptions = (format: ClockFormatOptions['dateFormat']): Intl.DateTimeFormatOptions => {
	if (format === 'compact') {
		return { day: '2-digit', month: '2-digit', year: 'numeric' };
	}

	if (format === 'long') {
		return { day: 'numeric', month: 'long', weekday: 'long', year: 'numeric' };
	}

	return { day: '2-digit', month: 'short', weekday: 'short', year: 'numeric' };
};

const parseTime = (formattedTime: string): { hours: string; minutes: string; period: string } => {
	const match: RegExpMatchArray | null = formattedTime.match(/(\d{1,2})\D+(\d{2})(?:\s*([AP]M))?/i);

	if (!match) {
		return { hours: '--', minutes: '--', period: '' };
	}

	return {
		hours: padNumber(Number(match[1])),
		minutes: padNumber(Number(match[2])),
		period: match[3]?.toUpperCase() ?? ''
	};
};

export const formatClockValue = (date: Date, options: ClockFormatOptions): ClockValue => {
	const timezoneResolution = resolveTimezone(options.timezone, date);
	const isTwelveHour: boolean = options.hourFormat === '12';
	const locale: string = isTwelveHour ? 'en-US' : 'en-GB';
	const time: { hours: string; minutes: string; period: string } = parseTime(
		new Intl.DateTimeFormat(locale, {
			hour: '2-digit',
			hour12: isTwelveHour,
			minute: '2-digit',
			timeZone: timezoneResolution.timezone
		}).format(date)
	);

	return {
		...time,
		seconds: padNumber(date.getUTCSeconds()),
		date: new Intl.DateTimeFormat('en-US', {
			...dateOptions(options.dateFormat),
			timeZone: timezoneResolution.timezone
		}).format(date),
		timezone: timezoneResolution.timezone,
		timezoneValid: timezoneResolution.valid,
		epochSecond: Math.floor(date.getTime() / 1000)
	};
};

export const colorWithOpacity = (color: string, opacity: number): string => {
	const normalizedColor: string = color.trim();
	const shortMatch: RegExpMatchArray | null = normalizedColor.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
	const longMatch: RegExpMatchArray | null = normalizedColor.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
	const channels: string[] | undefined = shortMatch
		? shortMatch.slice(1).map((value: string): string => `${value}${value}`)
		: longMatch?.slice(1);

	if (!channels || channels.length !== 3) {
		return normalizedColor;
	}

	const alpha: number = Math.min(1, Math.max(0, opacity / 100));

	return `rgba(${channels.map((value: string): number => Number.parseInt(value, 16)).join(', ')}, ${alpha})`;
};
