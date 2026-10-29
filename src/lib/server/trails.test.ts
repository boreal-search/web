import { describe, expect, it } from 'vitest';
import { step } from '#lib/trail.fixture.js';
import { branchSeed, branchTitle, TITLE_MAX } from './trails.js';

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
