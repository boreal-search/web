import { describe, expect, it } from 'vitest';
import {
	indexedDay,
	searchedLine,
	stageLabel,
	startClock,
	stepReadout,
	summaryProblem,
	tickClock,
	waitSegments
} from './step-view.js';
import { step } from './trail.fixture.js';
import { applyEvent } from './trail.js';

const text = (rs: ReturnType<typeof stepReadout>) =>
	rs.map((r) => [r.before, r.value, r.after].filter(Boolean).join(' ')).join(' · ');

describe('waiting bar', () => {
	it('fills the search segment linearly, then sits full without results', () => {
		const c = startClock(0, true);
		expect(waitSegments(c, 300).map((s) => s.value)).toEqual([0.5, 0, 0]);
		expect(waitSegments(c, 60_000).map((s) => s.value)).toEqual([1, 0, 0]);
	});

	it('moves to reading on results and to checking on its stage', () => {
		let c = startClock(0, true);
		c = tickClock(c, { type: 'results' }, 500);
		expect(waitSegments(c, 1250).map((s) => s.value)).toEqual([1, 0.5, 0]);
		c = tickClock(c, { type: 'stage', stage: 'checking', sentences: 2 }, 2000);
		expect(waitSegments(c, 3000).map((s) => s.value)).toEqual([1, 1, 0.5]);
	});

	it('weights 0.6 : 1.2 : 1.2, and only search without a summary', () => {
		expect(waitSegments(startClock(0, true), 0).map((s) => s.weight)).toEqual([0.6, 1.2, 1.2]);
		expect(waitSegments(startClock(0, false), 0)).toHaveLength(1);
	});

	it('steps in quarters with reduced motion', () => {
		expect(waitSegments(startClock(0, true), 400, true)[0].value).toBe(0.5);
	});

	it('labels stages only once reported, and drops search labels after results', () => {
		let c = startClock(0, true);
		expect(stageLabel(c)).toBeNull();
		c = tickClock(c, { type: 'stage', stage: 'searching', pages: 6214 }, 10);
		expect(stageLabel(c)).toBe('Searching 6,214 pages');
		c = tickClock(c, { type: 'results' }, 500);
		expect(stageLabel(c)).toBeNull();
		c = tickClock(c, { type: 'stage', stage: 'reading', pages: 5 }, 510);
		expect(stageLabel(c)).toBe('Reading 5 pages');
		c = tickClock(c, { type: 'stage', stage: 'checking', sentences: 1 }, 900);
		expect(stageLabel(c)).toBe('Checking 1 sentence');
	});
});

describe('readout', () => {
	it('reads summary pages, pages searched and time', () => {
		expect(text(stepReadout(step(1)))).toBe('summary from 2 pages · 6,214 searched · 3.4 s');
	});

	it('reads pages and PDFs without a summary', () => {
		expect(text(stepReadout(step(1, { answer: null })))).toBe(
			'2 pages · 1 PDF · 6,214 searched · 3.4 s'
		);
	});

	it('gives the oldest index date and the not-found line', () => {
		expect(indexedDay(step(1))).toBe('2026-10-27');
		expect(searchedLine(step(1))).toBe('Searched 6,214 pages in 14 PDFs.');
	});

	it('says why the summary is missing in plain words', () => {
		const s = step(1, { answer: null });
		expect(summaryProblem(s)).toBeNull();
		expect(summaryProblem(applyEvent(s, { type: 'timeout' }, null))).toBe(
			'Summary not available: the search engine is busy, try again in a few minutes.'
		);
		expect(
			summaryProblem(applyEvent(s, { type: 'error', status: 503, detail: 'ollama down' }, null))
		).toBe('Summary not available: the search engine reported an error (503).');
	});
});
