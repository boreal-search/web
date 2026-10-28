import { describe, expect, it } from 'vitest';
import { describeFailure, pageFailure, type Failure } from './failure';

const all: Failure[] = [
	{ kind: 'unreachable' },
	{ kind: 'timeout' },
	{ kind: 'unavailable', detail: 'Qdrant unreachable' },
	{ kind: 'error', status: 422, detail: 'bad top_k' },
	{ kind: 'not_found', what: 'page' },
	{ kind: 'not_found', what: 'data_source' },
	{ kind: 'not_found', what: 'org' },
	{ kind: 'forbidden', gate: 'platform_admin' },
	{ kind: 'forbidden', gate: 'org_admin', org: 'Acme' },
	{ kind: 'forbidden', gate: null },
	{ kind: 'bad_request', status: 400, detail: 'You are not in that org.' },
	{ kind: 'internal', ref: 'a1b2c3d4', at: '2026-10-28T14:03:12.345Z' }
];

describe('describeFailure', () => {
	it('gives each failure its own headline', () => {
		expect(new Set(all.map((f) => describeFailure(f).title)).size).toBe(all.length);
	});

	it('follows the copy rules', () => {
		for (const f of all) {
			const c = describeFailure(f);
			const text = [c.title, c.cause, c.next].join(' ');
			expect(text).not.toMatch(/!|\bI\b|oops|\bengine\b(?<!search engine)/i);
			expect(c.title).not.toMatch(/\.$/);
		}
	});

	it('never makes engine problems red', () => {
		const engine = all.filter((f) =>
			['unreachable', 'timeout', 'unavailable', 'error'].includes(f.kind)
		);
		for (const f of engine)
			expect(describeFailure(f)).toMatchObject({ tone: 'neutral', retry: true });
	});

	it('says search is offline when the engine is unreachable, and what still works', () => {
		const c = describeFailure({ kind: 'unreachable' });
		expect(c.title).toBe('Search is offline');
		expect(c.next).toMatch(/still work/);
	});

	it('puts engine status and detail in the readout, not the headline', () => {
		const c = describeFailure({ kind: 'error', status: 422, detail: 'bad top_k' });
		expect(c.title).not.toMatch(/422/);
		expect(c.readout).toEqual([
			{ label: 'search engine', value: '422' },
			{ label: 'detail', value: 'bad top_k' }
		]);
	});

	it('shows Boreal-side failures with a reference and UTC time', () => {
		const c = describeFailure({
			kind: 'internal',
			ref: 'a1b2c3d4',
			at: '2026-10-28T14:03:12.345Z'
		});
		expect(c.tone).toBe('error');
		expect(c.readout).toEqual([
			{ label: 'ref', value: 'a1b2c3d4' },
			{ label: 'at', value: '2026-10-28 14:03:12 UTC' }
		]);
		expect(describeFailure({ kind: 'internal', ref: null, at: null }).readout).toEqual([]);
	});

	it('suggests switching context for a missing data source only when there is a switcher', () => {
		const f: Failure = { kind: 'not_found', what: 'data_source' };
		expect(describeFailure(f, { canSwitch: true }).next).toMatch(/Searching in/);
		expect(describeFailure(f).next).not.toMatch(/Searching in/);
	});

	it('names who can open a gated page', () => {
		expect(describeFailure({ kind: 'forbidden', gate: 'org_admin', org: 'Acme' }).next).toMatch(
			/org admin of Acme/
		);
	});
});

describe('pageFailure', () => {
	it('uses the attached failure', () => {
		const failure: Failure = { kind: 'forbidden', gate: 'platform_admin' };
		expect(pageFailure({ status: 403, message: 'x', failure })).toBe(failure);
	});

	it.each([
		[404, { kind: 'not_found', what: 'page' }],
		[403, { kind: 'forbidden', gate: null }],
		[400, { kind: 'bad_request', status: 400, detail: 'm' }],
		[500, { kind: 'internal', ref: null, at: null }],
		[502, { kind: 'internal', ref: null, at: null }]
	])('reads %i from the status', (status, expected) => {
		expect(pageFailure({ status, message: 'm' })).toEqual(expected);
	});
});
