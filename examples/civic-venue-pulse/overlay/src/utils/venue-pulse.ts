import type {
	CalendarModel,
	CalendarSource,
	FeedModel,
	FeedSource,
	VenueAnnouncement,
	VenueProgram
} from '@interfaces/venue-pulse.interface';

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

export const plainText = (value: unknown): string => {
	if (typeof value !== 'string' && typeof value !== 'number') {
		return '';
	}

	const raw: string = String(value);

	if (typeof document === 'undefined') {
		return raw
			.replace(/<[^>]*>/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();
	}

	const container: HTMLDivElement = document.createElement('div');
	container.innerHTML = raw;

	return (container.textContent ?? '').replace(/\s+/g, ' ').trim();
};

const timestampValue = (value: unknown): number | undefined => {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value < 100000000000 ? value * 1000 : value;
	}

	const text: string = plainText(value);

	if (!text) {
		return undefined;
	}

	const numericValue: number = Number(text);

	if (Number.isFinite(numericValue) && numericValue > 0) {
		return numericValue < 100000000000 ? numericValue * 1000 : numericValue;
	}

	const parsedDate: number = Date.parse(text);

	return Number.isFinite(parsedDate) ? parsedDate : undefined;
};

const nestedTime = (value: unknown): number | undefined => {
	if (!isRecord(value)) {
		return timestampValue(value);
	}

	return timestampValue(value.timeStamp) ?? timestampValue(value.dateTime) ?? timestampValue(value.date);
};

const numericValue = (value: unknown): number | undefined => {
	const numeric: number = Number(value);

	return Number.isFinite(numeric) ? numeric : undefined;
};

const isRelativeSample = (value: Record<string, unknown>): boolean => {
	return isRecord(value._wallboardSample) && value._wallboardSample.mode === 'relative-to-now';
};

const safeImageUrl = (value: unknown): string => {
	const url: string = plainText(value);

	if (!url) {
		return '';
	}

	if (/^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(url)) {
		return url;
	}

	try {
		const parsed: URL = new URL(url);

		return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? url : '';
	} catch {
		return '';
	}
};

const readMediaUrl = (row: Record<string, unknown>): string => {
	if (isRecord(row.media)) {
		const value: string = safeImageUrl(row.media.url);

		if (value) {
			return value;
		}
	}

	if (isRecord(row.enclosure)) {
		const value: string = safeImageUrl(row.enclosure.url);

		if (value) {
			return value;
		}
	}

	if (Array.isArray(row.attachments)) {
		for (const attachment of row.attachments) {
			if (!isRecord(attachment)) {
				continue;
			}

			const type: string = plainText(attachment.type).toLowerCase();
			const value: string = safeImageUrl(attachment.url);

			if (value && (!type || type.indexOf('image') === 0)) {
				return value;
			}
		}
	}

	return safeImageUrl(row.image) || safeImageUrl(row.thumbnail);
};

const extractCalendarRows = (
	rawValue: unknown
): { rows: unknown[]; source: CalendarSource; relativeSample: boolean } => {
	const value: unknown = parseValue(rawValue);

	if (Array.isArray(value)) {
		return { rows: value, source: 'array', relativeSample: false };
	}

	if (!isRecord(value)) {
		return { rows: [], source: 'unknown', relativeSample: false };
	}

	if (Array.isArray(value.events)) {
		const firstRow: unknown = value.events[0];
		const source: CalendarSource =
			isRecord(firstRow) && ('startTimestamp' in firstRow || 'summary' in firstRow)
				? 'icalendar'
				: 'google-or-microsoft';

		return { rows: value.events, source, relativeSample: isRelativeSample(value) };
	}

	if (isRecord(value.calendar) && Array.isArray(value.calendar.events)) {
		return { rows: value.calendar.events, source: 'icalendar', relativeSample: isRelativeSample(value) };
	}

	return { rows: [], source: 'unknown', relativeSample: false };
};

export const normalizeCalendar = (rawValue: unknown): CalendarModel => {
	const extracted = extractCalendarRows(rawValue);
	const sampleAnchor: number = Date.now();
	const programs: VenueProgram[] = extracted.rows
		.map((rawRow: unknown, index: number): VenueProgram | undefined => {
			if (!isRecord(rawRow)) {
				return undefined;
			}

			const title: string = plainText(rawRow.title) || plainText(rawRow.summary) || plainText(rawRow.subject);
			const sampleStartOffset: number | undefined = extracted.relativeSample
				? numericValue(rawRow._sampleStartOffsetMinutes)
				: undefined;
			const sampleEndOffset: number | undefined = extracted.relativeSample
				? numericValue(rawRow._sampleEndOffsetMinutes)
				: undefined;
			const start: number | undefined =
				sampleStartOffset === undefined
					? (nestedTime(rawRow.start) ?? timestampValue(rawRow.startTimestamp))
					: sampleAnchor + sampleStartOffset * 60000;
			const end: number | undefined =
				sampleEndOffset === undefined
					? (nestedTime(rawRow.end) ?? timestampValue(rawRow.endTimestamp))
					: sampleAnchor + sampleEndOffset * 60000;
			const status: string = plainText(rawRow.status).toLowerCase();

			if (!title || start === undefined || end === undefined || end <= start || status === 'cancelled') {
				return undefined;
			}

			return {
				id: plainText(rawRow.id) || `${start}-${index}`,
				title,
				summary: plainText(rawRow.description) || plainText(rawRow.summaryText) || plainText(rawRow.body),
				location: plainText(rawRow.location) || plainText(rawRow.room),
				start,
				end,
				isAllDay: rawRow.isAllDay === true || rawRow.allDay === true
			};
		})
		.filter((program: VenueProgram | undefined): program is VenueProgram => Boolean(program))
		.sort((left: VenueProgram, right: VenueProgram): number => left.start - right.start);

	return { programs, source: extracted.source };
};

const extractFeedRows = (rawValue: unknown): { rows: unknown[]; source: FeedSource; relativeSample: boolean } => {
	const value: unknown = parseValue(rawValue);

	if (Array.isArray(value)) {
		return { rows: value, source: 'array', relativeSample: false };
	}

	if (!isRecord(value)) {
		return { rows: [], source: 'unknown', relativeSample: false };
	}

	if (Array.isArray(value.items)) {
		return { rows: value.items, source: 'wallboard-feed', relativeSample: isRelativeSample(value) };
	}

	if (isRecord(value.feed) && Array.isArray(value.feed.entries)) {
		return { rows: value.feed.entries, source: 'rss-parser', relativeSample: isRelativeSample(value) };
	}

	if (isRecord(value.channel)) {
		if (Array.isArray(value.channel.items)) {
			return { rows: value.channel.items, source: 'wallboard-feed', relativeSample: isRelativeSample(value) };
		}

		if (Array.isArray(value.channel.item)) {
			return { rows: value.channel.item, source: 'rss-channel', relativeSample: isRelativeSample(value) };
		}
	}

	if (isRecord(value.rss)) {
		const channel: unknown = Array.isArray(value.rss.channel) ? value.rss.channel[0] : value.rss.channel;

		if (isRecord(channel) && Array.isArray(channel.item)) {
			return { rows: channel.item, source: 'rss-channel', relativeSample: isRelativeSample(value) };
		}
	}

	return { rows: [], source: 'unknown', relativeSample: false };
};

export const normalizeFeed = (rawValue: unknown, now: number, freshHours: number): FeedModel => {
	const extracted = extractFeedRows(rawValue);
	const freshnessMs: number = freshHours * 60 * 60 * 1000;
	const announcements: Array<VenueAnnouncement & { sourceIndex: number }> = extracted.rows
		.map((rawRow: unknown, sourceIndex: number): (VenueAnnouncement & { sourceIndex: number }) | undefined => {
			if (!isRecord(rawRow)) {
				return undefined;
			}

			const title: string = plainText(rawRow.title) || plainText(rawRow.name);

			if (!title) {
				return undefined;
			}

			const categories: unknown[] = Array.isArray(rawRow.categories) ? rawRow.categories : [];
			const category: string = plainText(categories[0]) || plainText(rawRow.category) || 'Venue note';
			const samplePublishedOffset: number | undefined = extracted.relativeSample
				? numericValue(rawRow._samplePublishedOffsetMinutes)
				: undefined;
			const publishedAt: number | undefined =
				samplePublishedOffset === undefined
					? (timestampValue(rawRow.publishDate) ?? timestampValue(rawRow.pubDate) ?? timestampValue(rawRow.date))
					: now + samplePublishedOffset * 60000;
			const isFresh: boolean = publishedAt === undefined || now - publishedAt <= freshnessMs;

			if (!isFresh) {
				return undefined;
			}

			return {
				id: plainText(rawRow.guid) || plainText(rawRow.id) || `${title}-${sourceIndex}`,
				title,
				summary:
					plainText(rawRow.description) ||
					plainText(rawRow.contentSnippet) ||
					plainText(rawRow.summary) ||
					plainText(rawRow.content),
				category,
				imageUrl: readMediaUrl(rawRow),
				publishedAt,
				sourceIndex
			};
		})
		.filter((item): item is VenueAnnouncement & { sourceIndex: number } => Boolean(item))
		.sort((left, right): number => {
			if (left.publishedAt !== undefined && right.publishedAt !== undefined) {
				return right.publishedAt - left.publishedAt;
			}

			return left.sourceIndex - right.sourceIndex;
		});

	return {
		source: extracted.source,
		announcements: announcements.map((announcement): VenueAnnouncement => ({
			id: announcement.id,
			title: announcement.title,
			summary: announcement.summary,
			category: announcement.category,
			imageUrl: announcement.imageUrl,
			publishedAt: announcement.publishedAt
		}))
	};
};
