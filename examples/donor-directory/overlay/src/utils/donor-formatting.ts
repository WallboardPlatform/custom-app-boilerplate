import type { DonorAmountFormat, DonorAmountFormatOptions } from '@interfaces/donor-directory.interface';

import { finiteNumber, resolveNumberLocale } from '@utils/donor-data';

export const normalizeAmountFormat = (value: unknown): DonorAmountFormat => {
	const format: string = typeof value === 'string' ? value.trim().toLocaleLowerCase() : '';

	if (format === 'currency') {
		return 'currency';
	}

	if (format === 'number' || format === 'localized' || format === 'localized-number') {
		return 'number';
	}

	return 'raw';
};

export const resolveCurrencyCode = (value: unknown, fallback = 'USD'): string => {
	const requested: string = typeof value === 'string' ? value.trim().toUpperCase() : '';
	const fallbackCode: string =
		typeof fallback === 'string' && /^[A-Za-z]{3}$/.test(fallback.trim()) ? fallback.trim().toUpperCase() : 'USD';

	if (/^[A-Z]{3}$/.test(requested)) {
		try {
			new Intl.NumberFormat('en-US', {
				style: 'currency',
				currency: requested
			});

			return requested;
		} catch {
			// Continue to the known-safe fallback.
		}
	}

	return fallbackCode;
};

const rawAmountText = (value: unknown): string => {
	if (typeof value === 'number') {
		return Number.isFinite(value) ? String(value) : '';
	}

	if (typeof value === 'string') {
		return value.trim();
	}

	return '';
};

export const formatDonorAmount = (value: unknown, options: DonorAmountFormatOptions): string => {
	const rawText: string = rawAmountText(value);
	const format: DonorAmountFormat = normalizeAmountFormat(options.format);

	if (!rawText || format === 'raw') {
		return rawText;
	}

	const numberValue: number | null = finiteNumber(value);

	if (numberValue === null) {
		return rawText;
	}

	const locale: string = resolveNumberLocale(options.locale);

	try {
		if (format === 'currency') {
			return new Intl.NumberFormat(locale, {
				style: 'currency',
				currency: resolveCurrencyCode(options.currencyCode)
			}).format(numberValue);
		}

		return new Intl.NumberFormat(locale).format(numberValue);
	} catch {
		return rawText;
	}
};
