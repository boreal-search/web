import { describe, expect, it } from 'vitest';
import { answerCheck, answerCheckLabel, resultAnchorId, splitCitations } from './answer';

describe('splitCitations', () => {
	it('splits text and in-range refs', () => {
		expect(splitCitations('A is required [1]. B too [2][3].', 3)).toEqual([
			{ kind: 'text', text: 'A is required ' },
			{ kind: 'cite', ref: 1 },
			{ kind: 'text', text: '. B too ' },
			{ kind: 'cite', ref: 2 },
			{ kind: 'cite', ref: 3 },
			{ kind: 'text', text: '.' }
		]);
	});

	it('keeps out-of-range refs as plain text', () => {
		expect(splitCitations('x [0] y [4] z [2]', 2)).toEqual([
			{ kind: 'text', text: 'x [0] y [4] z ' },
			{ kind: 'cite', ref: 2 }
		]);
	});

	it('links nothing when there are no results', () => {
		expect(splitCitations('see [1]', 0)).toEqual([{ kind: 'text', text: 'see [1]' }]);
	});

	it('leaves non-numeric brackets and markup alone', () => {
		expect(splitCitations('<b>[a]</b> [1, 2]', 5)).toEqual([
			{ kind: 'text', text: '<b>[a]</b> [1, 2]' }
		]);
	});

	it('returns no segments for empty text', () => {
		expect(splitCitations('', 3)).toEqual([]);
	});

	it('anchors match result positions', () => {
		expect(resultAnchorId(1)).toBe('result-1');
	});
});

describe('answerCheck', () => {
	const claim = (supported: boolean, ref: number | null = 1) => ({ claim: 'c', supported, ref });

	it('is not found when the engine abstained, whatever the verifier said', () => {
		const check = answerCheck({
			abstained: true,
			verification: { supported: 1, total: 1, claims: [claim(true)] }
		});
		expect(check).toEqual({ state: 'not_found' });
		expect(answerCheckLabel(check)).toBe('Not found in the pages searched');
	});

	it('is not checked, never verified, when the verifier did not run', () => {
		const check = answerCheck({ abstained: false, verification: null });
		expect(check).toEqual({ state: 'not_checked' });
		expect(answerCheckLabel(check)).toBe('Not checked');
	});

	it('is not checked when no claims were checked', () => {
		expect(
			answerCheck({ abstained: false, verification: { supported: 0, total: 0, claims: [] } }).state
		).toBe('not_checked');
	});

	it('marks each claim verified or unsupported', () => {
		const check = answerCheck({
			abstained: false,
			verification: { supported: 1, total: 2, claims: [claim(true), claim(false, null)] }
		});
		expect(check).toEqual({
			state: 'checked',
			claims: [
				{ text: 'c', state: 'verified', ref: 1 },
				{ text: 'c', state: 'unsupported', ref: null }
			]
		});
		expect(answerCheckLabel(check)).toBe('1 of 2 claims verified');
	});
});
