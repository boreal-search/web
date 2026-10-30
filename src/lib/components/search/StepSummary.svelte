<!--
	A step's generated summary (docs/ui.md "Answer states"): the label, one flag, then each
	sentence by its check state, every marker coloured by its own citation's status. The text is
	minimal markdown (`answerBlocks`: paragraphs, lists, bold, italic, code), rendered as elements
	from our own tree, never as HTML. A Not found
	is a normal result, read against the pages searched. `children`: what follows a Not found
	(the widen action). Choosing a marker is the page's business (`onchoose`).
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import {
		answerCheck,
		answerBlocks,
		answerCheckLabel,
		resultAnchorId,
		type AnswerBlock,
		type AnswerInline,
		type AnswerRun,
		type Mark
	} from '#lib/answer.js';
	import { checkFlag } from '#lib/search-view.js';
	import { searchedLine } from '#lib/step-view.js';
	import type { TrailStep } from '#lib/trail.js';

	let {
		step,
		active = null,
		dim = false,
		onchoose,
		children
	}: {
		step: TrailStep & { answer: NonNullable<TrailStep['answer']> };
		active?: Mark | null;
		dim?: boolean;
		onchoose: (m: Mark, from: HTMLElement | null) => void;
		children?: Snippet;
	} = $props();

	let answer = $derived(step.answer);
	let check = $derived(answerCheck(answer));
	let blocks = $derived(answerBlocks(answer, step.results));
	/** The sentence whose marker has focus: its unsupported note shows at the sentence's end. */
	let focused = $state<number | null>(null);

	/** The label's suffix when the check ran (kept as a value: markup trims its leading space). */
	const CHECKED = ' · each sentence checked';
	const UNSUPPORTED = "Unsupported: the cited page doesn't support this sentence";
	const STATUS_WORD = {
		verified: 'verified',
		unsupported: 'unsupported',
		not_checked: 'not checked'
	};

	const markLabel = (m: Mark) =>
		`Result ${m.ref}, page ${step.results[m.ref - 1]?.page_number}, ${STATUS_WORD[m.status]}` +
		(m.boxes.length > 0 ? ', cited text outlined' : '');
</script>

<div class={['summary', dim && 'dim']}>
	{#if answer.abstained}
		<p class="status">
			<span class="flag" data-state="not_found">{answerCheckLabel(check)}.</span>
		</p>
		{@const searched = searchedLine(step)}
		{#if searched}<p class="searched">{searched}</p>{/if}
		{@render children?.()}
	{:else}
		<p class="eyebrow">
			Generated summary{#if answer.verification !== null}<span class="muted">{CHECKED}</span>{/if}
		</p>
		<p class="status">
			<span class="flag" data-state={checkFlag(check)}>{answerCheckLabel(check)}</span>
		</p>
		<div class="text">
			{#each blocks as b, i (i)}{@render block(b)}{/each}
		</div>
	{/if}
</div>

{#snippet block(b: AnswerBlock)}
	{#if b.kind === 'paragraph'}
		<p>
			{#each b.children as n, i (i)}{@render inline(n)}{/each}
		</p>
	{:else if b.ordered}
		<ol start={b.start}>
			{#each b.items as item, i (i)}<li>
					{#each item as c, j (j)}{@render block(c)}{/each}
				</li>{/each}
		</ol>
	{:else}
		<ul>
			{#each b.items as item, i (i)}<li>
					{#each item as c, j (j)}{@render block(c)}{/each}
				</li>{/each}
		</ul>
	{/if}
{/snippet}

{#snippet inline(n: AnswerInline)}
	{#if n.kind === 'run'}{@render run(n)}{:else if n.kind === 'break'}<br
		/>{:else if n.kind === 'strong'}<strong
			>{#each n.children as c, i (i)}{@render inline(c)}{/each}</strong
		>{:else if n.kind === 'emphasis'}<em
			>{#each n.children as c, i (i)}{@render inline(c)}{/each}</em
		>{:else}<code
			>{#each n.children as c, i (i)}{@render inline(c)}{/each}</code
		>{/if}
{/snippet}

{#snippet run(r: AnswerRun)}<span
		class={['sentence', r.status]}
		title={r.status === 'unsupported' ? UNSUPPORTED : undefined}
		>{#each r.segments as seg, j (j)}{#if seg.kind === 'cite'}{@const one =
					seg.marks.length === 1}<span class="cite"
					>{#if !one}[{/if}{#each seg.marks as m, k (m.ref)}{#if k > 0},
						{/if}<a
							href="#{resultAnchorId(m.ref)}"
							data-status={m.status}
							class={{ on: active === m }}
							aria-label={markLabel(m)}
							onfocus={() => {
								focused = r.sentence;
								onchoose(m, null);
							}}
							onblur={() => (focused = null)}
							onclick={(e) => {
								// The page shows the result (and may open an overlay); no hash entry in history.
								e.preventDefault();
								onchoose(m, e.currentTarget);
							}}>{one ? `[${m.ref}]` : m.ref}</a
						>{/each}{#if !one}]{/if}</span
				>{:else}{seg.text}{/if}{/each}{#if r.last && r.status === 'unsupported'}<span
				class={['why', r.sentence !== null && focused === r.sentence && 'shown']}
				>({UNSUPPORTED})</span
			>{/if}</span
	>{/snippet}

<style>
	.summary {
		max-width: 68ch;
	}
	.summary p {
		margin: 0 0 0.5rem;
	}
	/* A narrow steps column (beside the evidence) wraps the state's label. */
	.status .flag {
		white-space: normal;
	}
	.eyebrow {
		font-size: 0.9375rem;
		font-weight: 600;
	}
	.eyebrow .muted {
		font-weight: 400;
	}
	.status {
		margin-bottom: 0.75rem;
	}
	.text {
		font-size: 1.0625rem;
		line-height: 1.6;
	}
	.text ul,
	.text ol {
		margin: 0 0 0.5rem;
		padding-left: 1.5rem;
	}
	.text ul {
		list-style: disc;
	}
	.text ol {
		list-style: decimal;
	}
	.text li + li {
		margin-top: 0.25rem;
	}
	.text li > :last-child {
		margin-bottom: 0;
	}
	.text strong {
		font-weight: 600;
	}
	.text code {
		font: 400 0.9375em/1 var(--font-mono);
	}
	.searched {
		font: 400 0.875rem/1.5 var(--font-mono);
		color: var(--color-muted);
		font-variant-numeric: tabular-nums;
	}
	/* Unsupported stays visible, marked inline in Resin; verified and not checked read plain. */
	.sentence.unsupported {
		text-decoration: underline dotted 1px var(--color-unsupported);
		text-underline-offset: 3px;
	}
	/* Shown when a marker in the sentence has focus; screen readers always get it. */
	.why {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	.why.shown {
		position: static;
		width: auto;
		height: auto;
		clip-path: none;
		white-space: normal;
		margin-left: 0.375rem;
		font: 400 0.8125rem/1.5 var(--font-mono);
		color: var(--color-unsupported);
	}
	.cite {
		font: 500 0.8125rem/1 var(--font-mono);
		font-variant-numeric: tabular-nums;
		padding: 0 0.1em;
		white-space: nowrap;
		color: var(--color-muted);
	}
	/* Each marker by its own citation: green only where the check confirmed it. */
	.cite a {
		color: var(--color-muted);
	}
	.cite a[data-status='verified'] {
		color: var(--color-verified);
	}
	.cite a[data-status='unsupported'] {
		color: var(--color-unsupported);
	}
	.cite a.on {
		background: var(--color-highlight);
	}
	.dim .text,
	.dim .eyebrow {
		color: var(--color-muted);
	}
</style>
