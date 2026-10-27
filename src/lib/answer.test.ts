import { describe, expect, it } from 'vitest';
import { resultAnchorId, splitCitations, verificationBadge } from './answer';

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

describe('verificationBadge', () => {
	it('treats null as unverified, never verified', () => {
		expect(verificationBadge(null)).toEqual({
			state: 'unverified',
			label: 'Unverified',
			unsupported: []
		});
	});

	it('is verified when every claim is supported', () => {
		const b = verificationBadge({
			supported: 1,
			total: 1,
			claims: [{ claim: 'a', supported: true, ref: 1 }]
		});
		expect(b).toEqual({ state: 'verified', label: '1/1 claims verified', unsupported: [] });
	});

	it('is partial and lists unsupported claims when supported < total', () => {
		const bad = { claim: 'b', supported: false, ref: null };
		const b = verificationBadge({
			supported: 1,
			total: 2,
			claims: [{ claim: 'a', supported: true, ref: 1 }, bad]
		});
		expect(b).toEqual({ state: 'partial', label: '1/2 claims verified', unsupported: [bad] });
	});

	it('does not call zero checked claims verified', () => {
		expect(verificationBadge({ supported: 0, total: 0, claims: [] }).state).toBe('unverified');
	});
});
