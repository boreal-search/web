// Pure helpers for showing one trail step: the waiting bar while it streams, then its readout
// (search-trail handover, "Waiting"; docs/ui.md "Waiting").
import { count, day, plural } from './format.js';
import { seconds } from './search-view.js';
import type { EngineEvent, TrailStep } from './trail.js';

export type StageEvent = Extract<EngineEvent, { type: 'stage' }>;

/** Nothing shows for this long: fast searches never flash a bar. */
export const WAIT_DELAY_MS = 300;

/** The bar's segments: width weight and the typical time each takes, filled linearly. */
export const SEGMENTS = [
	{ name: 'search', weight: 0.6, typical_ms: 600 },
	{ name: 'reading', weight: 1.2, typical_ms: 1500 },
	{ name: 'checking', weight: 1.2, typical_ms: 2000 }
] as const;

/** What the browser has seen of a live step, as `performance.now()` times. */
export interface WaitClock {
	started: number;
	/** The last stage event, if any. */
	stage: StageEvent | null;
	/** When `results` arrived: search is done, reading starts. */
	results_at: number | null;
	/** When the `checking` stage arrived. */
	checking_at: number | null;
	/** Whether a summary was asked for (else only the search segment). */
	wants_answer: boolean;
}

export const startClock = (now: number, wants_answer: boolean): WaitClock => ({
	started: now,
	stage: null,
	results_at: null,
	checking_at: null,
	wants_answer
});

/** The clock after an event: only stages and results move it. */
export function tickClock(clock: WaitClock, event: EngineEvent | { type: string }, now: number) {
	if (event.type === 'results') return { ...clock, results_at: clock.results_at ?? now };
	if (event.type !== 'stage') return clock;
	const stage = event as StageEvent;
	return {
		...clock,
		stage,
		checking_at: stage.stage === 'checking' ? (clock.checking_at ?? now) : clock.checking_at
	};
}

export interface Segment {
	weight: number;
	/** 0..1. Sits at 1 when a stage runs long: never stalls short of full, never a percentage. */
	value: number;
}

/**
 * Each segment's fill at `now`: done segments full, the running one linear over its typical
 * time (then full), later ones empty. `reduced` (prefers-reduced-motion): steps in quarters.
 */
export function waitSegments(clock: WaitClock, now: number, reduced = false): Segment[] {
	const frac = (from: number | null, ms: number) =>
		from === null ? 0 : Math.min(1, Math.max(0, (now - from) / ms));
	const [search, reading, checking] = SEGMENTS;
	const values = [
		clock.results_at !== null ? 1 : frac(clock.started, search.typical_ms),
		clock.checking_at !== null ? 1 : frac(clock.results_at, reading.typical_ms),
		frac(clock.checking_at, checking.typical_ms)
	];
	const shown = clock.wants_answer ? SEGMENTS : SEGMENTS.slice(0, 1);
	return shown.map((s, i) => ({
		weight: s.weight,
		value: reduced ? Math.floor(values[i] * 4) / 4 : values[i]
	}));
}

/** The stage label, only once the engine reports one; search labels end with the results. */
export function stageLabel(clock: WaitClock): string | null {
	const s = clock.stage;
	if (!s) return null;
	if (clock.results_at !== null && (s.stage === 'rewriting' || s.stage === 'searching'))
		return null;
	switch (s.stage) {
		case 'rewriting':
			return 'Rewriting query';
		case 'searching':
			return `Searching ${count(s.pages)} ${plural(s.pages, 'page')}`;
		case 'reading':
			return `Reading ${count(s.pages)} ${plural(s.pages, 'page')}`;
		case 'checking':
			return `Checking ${count(s.sentences)} ${plural(s.sentences, 'sentence')}`;
	}
}

/** One reading: `before` and `after` in muted, `value` in ink (`<b>`). */
export interface Reading {
	before?: string;
	value: string;
	after?: string;
}

/**
 * What the bar becomes: "summary from 5 pages · 6,214 searched · 3.4 s" with a summary, else
 * "5 pages · 3 PDFs · 6,214 searched · 0.6 s". Empty before results.
 */
export function stepReadout(step: TrailStep): Reading[] {
	const s = step.readout.search;
	if (!s) return [];
	const used = step.answer && !step.answer.abstained ? step.readout.answer?.pages_used : undefined;
	const head: Reading[] =
		used !== undefined
			? [{ before: 'summary from', value: count(used), after: plural(used, 'page') }]
			: [
					{ value: count(step.results.length), after: plural(step.results.length, 'page') },
					pdfs(step)
				];
	return [
		...head,
		{ value: count(s.pages_searched), after: 'searched' },
		{ value: seconds(s.total_ms), after: 's' }
	];
}

function pdfs(step: TrailStep): Reading {
	const n = new Set(step.results.map((r) => r.document_id)).size;
	return { value: count(n), after: plural(n, 'PDF') };
}

/** The index date searched against: the oldest of the step's data sources, or null. */
export function indexedDay(step: TrailStep): string | null {
	const days = Object.values(step.readout.indexed_at)
		.filter((t): t is string => t !== null)
		.map(day)
		.sort();
	return days[0] ?? null;
}

/** For a Not found: "Searched 3 pages in 1 PDF." */
export function searchedLine(step: TrailStep): string | null {
	const s = step.readout.search;
	if (!s) return null;
	return `Searched ${count(s.pages_searched)} ${plural(s.pages_searched, 'page')} in ${count(s.documents_searched)} ${plural(s.documents_searched, 'PDF')}.`;
}

/** Why the summary slot is empty, as one plain line; null when nothing failed. */
export function summaryProblem(step: TrailStep): string | null {
	const e = step.readout.error;
	if (!e) return null;
	const what = step.readout.search ? 'Summary' : 'Results';
	if (e.kind === 'timeout')
		return `${what} not available: the search engine is busy, try again in a few minutes.`;
	if (e.status === null) return `${what} not available. ${e.detail}`;
	return `${what} not available: the search engine reported an error (${e.status}).`;
}
