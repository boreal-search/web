import { describe, expect, it } from 'vitest';
import { step } from '#lib/trail.fixture.js';
import type { SearchContext } from './access.js';
import { branchSeed, branchTitle, TITLE_MAX, trailListView } from './trails.js';

describe('branchSeed', () => {
	const steps = [
		step(3),
		step(1),
		step(2, { req: { from: 1 }, resolved: 'Chinook habitat offsetting' })
	];

	it('copies steps 01..n in order, without signed URLs', () => {
		const seed = branchSeed(steps, 2);
		expect(seed?.map((s) => s.n)).toEqual([1, 2]);
		expect(seed?.flatMap((s) => s.results).some((r) => 'page_image_url' in r)).toBe(false);
		expect(steps[1].results.some((r) => 'page_image_url' in r)).toBe(true); // source untouched
	});

	it('keeps each copied step as it was', () => {
		const [, second] = branchSeed(steps, 2) ?? [];
		expect(second).toMatchObject({ resolved_query: 'Chinook habitat offsetting', builds_on: 1 });
	});

	it('refuses the latest step, a missing one, and a trail with gaps', () => {
		expect(branchSeed(steps, 3)).toBeNull();
		expect(branchSeed(steps, 0)).toBeNull();
		expect(branchSeed([step(1), step(3), step(4)], 3)).toBeNull();
	});
});

describe('branchTitle', () => {
	it('adds "(branch)" and stays within the title limit', () => {
		expect(branchTitle('Chinook habitat')).toBe('Chinook habitat (branch)');
		const long = branchTitle('x'.repeat(TITLE_MAX));
		expect(long.length).toBe(TITLE_MAX);
		expect(long.endsWith(' (branch)')).toBe(true);
	});
});

describe('trailListView', () => {
	const org = (slug: string): SearchContext => ({
		kind: 'org',
		org: {
			id: `${slug}-id`,
			slug,
			name: slug,
			role: 'member',
			log_queries: true,
			conversation_history: true
		}
	});
	const [acme, beta] = [org('acme'), org('beta')];
	const contexts: SearchContext[] = [acme, beta, { kind: 'public' }];
	const view = (s: string, cs = contexts) => trailListView(cs, acme, new URLSearchParams(s));

	it('defaults to the current context, latest only', () => {
		expect(view('')).toEqual({ context: acme, all: false, keep: '' });
	});
	it('picks another of the user contexts and keeps it on links', () => {
		expect(view('org=beta')).toEqual({ context: beta, all: false, keep: 'org=beta' });
		expect(view('org=public&all=1')).toEqual({
			context: { kind: 'public' },
			all: true,
			keep: 'org=public&all=1'
		});
	});
	it('ignores an org the user is not in', () => {
		expect(view('org=other').context).toBe(acme);
	});
	it('lists every context for a user with only one', () => {
		expect(view('org=acme&all=1', [acme])).toEqual({ context: null, all: true, keep: 'all=1' });
	});
});
