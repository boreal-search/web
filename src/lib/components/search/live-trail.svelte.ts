// The trail shown on the search page: stored steps from `?trail=`, or the ones searched here.
// Steps stream from POST /search/stream and are built with the same reducer the server stores
// them with (`applyEvent`).
import { tick } from 'svelte';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import type { Failure } from '#lib/failure.js';
import { ndjson } from '#lib/ndjson.js';
import { startClock, summaryProblem, tickClock, type WaitClock } from '#lib/step-view.js';
import {
	applyEvent,
	newStep,
	type StepRequest,
	type StreamEvent,
	type TrailStep
} from '#lib/trail.js';

/** Which form a search came from: its problem is shown there. */
export type SearchWhere = 'new' | 'refine';

/** A search that produced no step (refused, or failed before results). */
export interface SearchProblem {
	where: SearchWhere;
	text: string | null;
	failure: Failure | null;
}

/** What a new step needs to know about the data sources it searches. */
export interface StepSource {
	id: string;
	name: string;
	indexed_at: string | null;
}

const searchHref = () => resolve('/(app)/search');
const trailHref = (id: string) => `${searchHref()}?trail=${id}`;

export class LiveTrail {
	steps = $state.raw<TrailStep[]>([]);
	trailId = $state<string | null>(null);
	selectedN = $state(0);
	selected = $derived(this.steps.find((s) => s.n === this.selectedN) ?? this.steps.at(-1) ?? null);
	/** The step streaming now, and its waiting clock. */
	live = $state<{ key: string; clock: WaitClock } | null>(null);
	now = $state(0);
	problem = $state<SearchProblem | null>(null);
	#ticker: ReturnType<typeof setInterval> | undefined;
	#controller: AbortController | null = null;

	constructor(steps: TrailStep[], id: string | null) {
		this.steps = steps;
		this.trailId = id;
		this.selectedN = steps.at(-1)?.n ?? 0;
	}

	/** Show another trail (or none), stopping any search in flight. */
	show(steps: TrailStep[], id: string | null) {
		this.stop();
		this.steps = steps;
		this.trailId = id;
		this.selectedN = steps.at(-1)?.n ?? 0;
	}

	stop = () => {
		this.#controller?.abort();
		this.#controller = null;
		this.live = null;
		clearInterval(this.#ticker);
	};

	async run(req: StepRequest, where: SearchWhere, sources: readonly StepSource[]) {
		this.stop();
		const ac = new AbortController();
		this.#controller = ac;
		this.problem = null;
		if (req.from === null) {
			this.steps = [];
			this.trailId = null;
			// eslint-disable-next-line svelte/prefer-svelte-reactivity -- read once, not state
			if (new URLSearchParams(location.search).has('trail'))
				void goto(searchHref(), { shallow: true, replace: true });
		}
		const n = Math.max(0, ...this.steps.map((s) => s.n)) + 1;
		const fresh = newStep(
			req,
			n,
			Object.fromEntries(sources.map((ds) => [ds.id, ds.name])),
			Object.fromEntries(sources.map((ds) => [ds.id, ds.indexed_at]))
		);
		const key = fresh.created_at;
		const current = () => this.steps.find((s) => s.created_at === key);
		const update = (f: (s: TrailStep) => TrailStep) =>
			(this.steps = this.steps.map((s) => (s.created_at === key ? f(s) : s)));
		const drop = () => (this.steps = this.steps.filter((s) => s.created_at !== key));
		this.steps = [...this.steps, fresh];
		this.selectedN = n;
		this.now = performance.now();
		this.live = { key, clock: startClock(this.now, req.answer) };
		this.#ticker = setInterval(() => (this.now = performance.now()), 100);
		void tick().then(() =>
			document.querySelector(`[data-step="${key}"]`)?.scrollIntoView({ block: 'nearest' })
		);
		let newTrail: string | null = null;

		try {
			const res = await fetch(resolve('/(app)/search/stream'), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(req),
				signal: ac.signal
			});
			if (!res.ok || !res.body) {
				const body = (await res.json().catch(() => null)) as {
					error?: string;
					failure?: Failure;
				} | null;
				drop();
				this.problem = {
					where,
					failure: body?.failure ?? null,
					text: body?.failure ? null : (body?.error ?? `The search failed (${res.status}).`)
				};
				return;
			}
			for await (const event of ndjson<StreamEvent>(res.body)) {
				if (this.live?.key === key)
					this.live = { key, clock: tickClock(this.live.clock, event, performance.now()) };
				if (event.type === 'stored') {
					if (this.selectedN === current()?.n) this.selectedN = event.n;
					if (this.trailId === null) {
						this.trailId = newTrail = event.trail_id;
						// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved, plus ?trail=
						void goto(trailHref(event.trail_id), { shallow: true, replace: true });
					}
				}
				update((s) => applyEvent(s, event, req.from));
			}
		} catch {
			const got = current();
			if (got && got.readout.search !== null && !got.readout.finished) {
				const detail = ac.signal.aborted
					? 'The search was stopped.'
					: 'The connection to Boreal was lost.';
				update((s) => applyEvent(s, { type: 'error', status: null, detail }, req.from));
			}
		} finally {
			if (this.#controller === ac) this.stop();
			// No results: nothing to keep in the trail; say why where it was asked.
			const got = current();
			if (got && got.readout.search === null) {
				drop();
				if (!ac.signal.aborted)
					this.problem = {
						where,
						failure: null,
						text: summaryProblem(got) ?? 'Results not available. Try again.'
					};
			}
		}
		// Load the trail just stored (owner, people to share with), keeping the steps shown.
		if (newTrail && this.trailId === newTrail)
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved, plus ?trail=
			await goto(trailHref(newTrail), { replace: true, reset: false });
	}
}
