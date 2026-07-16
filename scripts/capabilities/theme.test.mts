import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { contrastRatio, mixHexColors, readableTextColor } from '../../src/utils/theme.js';

void describe('theme capability', (): void => {
	void it('derives deterministic surface colors from a palette', (): void => {
		assert.equal(mixHexColors('#000000', '#ffffff', 0.5), '#808080');
		assert.equal(mixHexColors('#abc', '#000', 0), '#aabbcc');
	});

	void it('selects the higher-contrast text token for accent surfaces', (): void => {
		assert.equal(readableTextColor('#f4c542'), '#111315');
		assert.equal(readableTextColor('#111315'), '#f7f8f6');
		assert.ok(contrastRatio('#f4c542', '#111315') > 4.5);
	});
});
