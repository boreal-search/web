import { describe, expect, it } from 'vitest';
import { beside } from './popover';

const viewport = { width: 1000, height: 800 };

describe('beside', () => {
	it('opens down and right from a trigger in the top-left', () => {
		expect(beside({ top: 10, bottom: 40, left: 20, right: 200 }, viewport)).toEqual({
			top: '44px',
			bottom: 'auto',
			left: '20px',
			right: 'auto'
		});
	});

	it('opens up and left from a trigger in the bottom-right', () => {
		expect(beside({ top: 700, bottom: 740, left: 900, right: 980 }, viewport)).toEqual({
			top: 'auto',
			bottom: '104px',
			left: 'auto',
			right: '20px'
		});
	});
});
