// The results view's state for the selected step: which result is shown, the `[n]` last chosen,
// the page opened large on phones, zoom, and the keyboard (J/K/Space/O/C/Escape). Shared by the
// steps (choosing a summary marker) and the evidence pane.
import { tick } from 'svelte';
import { resolve } from '$app/paths';
import { SvelteSet } from 'svelte/reactivity';
import {
	answerMarks,
	answerSegments,
	markOutlines,
	pageOutlines,
	resultAnchorId,
	type Mark
} from '#lib/answer.js';
import { isTypingTarget, step as move } from '#lib/search-view.js';
import type { StepResult, TrailStep } from '#lib/trail.js';

const NONE: StepResult[] = [];
/** Pane width (px) from which the selected page sits beside the list; matches `@container evidence (min-width: 36rem)`. */
const WIDE_PANE = 576;

/** Permanent link to the PDF at the result's page; it leaves the app (`rel="external"`). */
export const pdfHref = (r: StepResult) =>
	`${resolve('/pdf/[ds]/[doc]', { ds: r.data_source_id, doc: r.document_id })}?page=${r.page_number}`;

/** The page render: the permanent link when the server can sign, else the live step's engine URL. */
export const pageSrc = (r: StepResult, permanentLinks: boolean): string | null =>
	permanentLinks
		? resolve('/pages/[ds]/[doc]/[page]', {
				ds: r.data_source_id,
				doc: r.document_id,
				page: String(r.page_number)
			})
		: (r.page_image_url ?? null);

/** Space activates buttons and toggles details: leave it to them. */
const usesSpace = (t: EventTarget | null) =>
	t instanceof HTMLElement && ['BUTTON', 'SUMMARY'].includes(t.tagName);

export class Evidence {
	#selected: () => TrailStep | null;
	#select: (n: number) => void;

	constructor(selected: () => TrailStep | null, selectStep: (n: number) => void) {
		this.#selected = selected;
		this.#select = selectStep;
	}

	results = $derived.by(() => this.#selected()?.results ?? NONE);
	marks = $derived.by(() => {
		const answer = this.#selected()?.answer ?? null;
		return answerMarks(answer ? answerSegments(answer, this.results) : []);
	});
	/** The result shown large beside the list: the first result the summary cites, else the top. */
	current = $derived(this.marks.length > 0 ? this.marks[0].ref - 1 : 0);
	shown = $derived(this.results[this.current] ?? null);
	/** The evidence pane's width in px (bound by `EvidencePane`): the pane, not the viewport, decides. */
	paneWidth = $state(0);
	/** The large page sits beside the list only in a wide pane; a narrow one opens a page under its row. */
	wide = $derived(this.paneWidth >= WIDE_PANE);
	/** Engine-signed URLs expire, and stored steps keep none; a missing render shows a plain line. */
	failed = new SvelteSet<string>();
	/** Space: the large page at full brightness and wider. */
	zoomed = $state(false);
	/** Phones: the result whose page is open large under its row. Closed by another step. */
	expanded = $derived.by<number | null>(() => {
		void this.results;
		return null;
	});
	/** What opened the expanded page: focus returns there on close. */
	#opener: HTMLElement | null = null;
	/**
	 * The `[n]` last chosen. Its page shows only its boxes; any other page shows every box the
	 * summary cites on it. Cleared by another step or by moving to another result.
	 */
	active = $derived.by<Mark | null>(() => {
		void this.results;
		return null;
	});
	/** "Citation copied", announced and shown briefly. */
	copyStatus = $state('');
	#copyTimer: ReturnType<typeof setTimeout> | undefined;

	boxesOn = (ref: number) =>
		this.active?.ref === ref ? markOutlines(this.active) : pageOutlines(this.marks, ref);

	expand = async (i: number, from: HTMLElement | null, toggle = true) => {
		if (toggle && this.expanded === i) return this.collapse();
		this.expanded = i;
		this.#opener = from;
		await tick();
		const panel = document.getElementById(`page-${i + 1}`);
		(panel?.querySelector('.mark') ?? panel)?.scrollIntoView({ block: 'nearest' });
	};

	collapse = () => {
		this.expanded = null;
		this.#opener?.focus();
		this.#opener = null;
	};

	select = (i: number, focus = false) => {
		this.current = i;
		if (this.active && this.active.ref !== i + 1) this.active = null;
		if (!focus) return;
		const el = document.getElementById(resultAnchorId(i + 1));
		el?.focus({ preventScroll: true });
		el?.scrollIntoView({ block: 'nearest' });
	};

	/**
	 * Show mark `m` of step `s`: open the step, select its result. Activated (`from` the link
	 * chosen): move focus there and scroll its first box into view; on phones, open its page
	 * large under the row. Focus alone only acts within the selected step.
	 */
	choose = async (s: TrailStep, m: Mark, from: HTMLElement | null) => {
		if (s !== this.#selected()) {
			if (!from) return;
			this.#select(s.n);
			await tick();
		}
		this.select(m.ref - 1, from !== null);
		this.active = m;
		if (!from) return;
		if (!this.wide) return this.expand(m.ref - 1, from, false);
		await tick();
		document.querySelector('.viewer .mark')?.scrollIntoView({ block: 'nearest' });
	};

	copyCitation = async (r: StepResult) => {
		const link = `${location.origin}${pdfHref(r)}`;
		try {
			await navigator.clipboard.writeText(`${r.document_title} · p.${r.page_number} · ${link}`);
			this.copyStatus = 'Citation copied';
		} catch {
			this.copyStatus = "Couldn't copy the citation";
		}
		clearTimeout(this.#copyTimer);
		this.#copyTimer = setTimeout(() => (this.copyStatus = ''), 2500);
	};

	onkeydown = (e: KeyboardEvent) => {
		const { results, current } = this;
		if (results.length === 0 || e.altKey || e.ctrlKey || e.metaKey || isTypingTarget(e.target))
			return;
		const r = results[current];
		switch (e.key) {
			case 'j':
			case 'k':
				e.preventDefault();
				this.select(move(current, e.key === 'j' ? 1 : -1, results.length), true);
				return;
			case 'o':
				e.preventDefault();
				window.open(pdfHref(r), '_blank', 'noopener');
				return;
			case 'c':
				e.preventDefault();
				this.copyCitation(r);
				return;
			case ' ':
				if (usesSpace(e.target)) return;
				e.preventDefault();
				if (this.wide) this.zoomed = !this.zoomed;
				else this.expand(current, document.getElementById(resultAnchorId(current + 1)));
				return;
			case 'Escape':
				if (this.expanded === null) return;
				e.preventDefault();
				this.collapse();
		}
	};
}
