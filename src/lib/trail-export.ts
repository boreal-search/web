// Exporting a trail as a record (search-trail handover, "Export"): every query, scope and
// citation, so a reviewer can show how they found what they found. From the stored snapshots
// only, never the engine. Pure and deterministic: times are UTC (format.ts).
import { answerCheck, answerCheckLabel } from './answer.js';
import { count, day, plural, stamp } from './format.js';
import { seconds } from './search-view.js';
import { scopeLabel, stepNumber, storedStep, type StepResult, type TrailStep } from './trail.js';

export interface TrailExportMeta {
	title: string;
	/** ISO timestamp. */
	exported_at: string;
	/** Who exported it. */
	email: string;
	/** The org's name, or "Public". */
	context: string;
	/** Makes the permanent PDF links absolute, e.g. "https://boreal.example". */
	origin: string;
}

const STATUS_LABEL = {
	verified: 'Verified',
	unsupported: 'Unsupported',
	not_checked: 'Not checked'
};
const QUOTE_MAX = 300;
const INDENT = '    ';

/** Web's permanent PDF link (signs on demand), never the engine's expiring URL. */
export const pdfLink = (
	origin: string,
	r: Pick<StepResult, 'data_source_id' | 'document_id' | 'page_number'>
) =>
	`${origin}/pdf/${encodeURIComponent(r.data_source_id)}/${encodeURIComponent(r.document_id)}?page=${r.page_number}`;

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();
const quoted = (s: string) => {
	const t = oneLine(s);
	return `"${t.length > QUOTE_MAX ? `${t.slice(0, QUOTE_MAX - 1).trimEnd()}…` : t}"`;
};
const locatorOf = (r: StepResult) =>
	[r.document_title, ...(r.section ? [r.section] : []), `p.${r.page_number}`].join(' · ');

function scopeLine(step: TrailStep) {
	const docs = step.readout.search?.documents_searched;
	const parts = [
		`Scope: ${scopeLabel(step)}${docs === undefined ? '' : ` (${count(docs)} ${plural(docs, 'document')})`}`
	];
	if (step.builds_on !== null) parts.push(`builds on ${stepNumber(step.builds_on)}`);
	if (!step.rewrite) parts.push('exactly as typed');
	const indexed = [
		...new Set(
			Object.values(step.readout.indexed_at)
				.filter((t) => t !== null)
				.map(day)
		)
	].sort();
	if (indexed.length > 0) parts.push(`indexed ${indexed.join(', ')}`);
	return parts.join(' · ');
}

function readoutLine(step: TrailStep) {
	const s = step.readout.search;
	const searched = `searched ${stamp(step.created_at)}`;
	if (!s) return `No results · ${searched}`;
	const pdfs = new Set(step.results.map((r) => r.document_id)).size;
	return [
		`${count(s.pages_returned)} ${plural(s.pages_returned, 'page')}`,
		`${count(pdfs)} ${plural(pdfs, 'PDF')}`,
		`${count(s.pages_searched)} searched`,
		`${seconds(s.total_ms)} s`,
		searched
	].join(' · ');
}

/** Why there's no summary (or no results), as the screen says it; null when nothing failed. */
function errorLine(step: TrailStep) {
	const e = step.readout.error;
	if (!e) return null;
	const what = step.readout.search ? 'Summary' : 'Results';
	if (e.kind === 'timeout')
		return `${what} not available: the search engine is busy, try again in a few minutes.`;
	return `${what} not available: the search engine reported an error (${e.status ?? 'no status'}: ${oneLine(e.detail)}).`;
}

function stepLines(step: TrailStep, origin: string): string[] {
	const lines = [`${stepNumber(step.n)}  ${oneLine(step.query)}`];
	const add = (s: string) => lines.push(INDENT + s);
	if (step.resolved_query !== step.query) add(`Searched as: ${oneLine(step.resolved_query)}`);
	add(scopeLine(step));
	add(readoutLine(step));

	const { answer } = step;
	if (answer?.abstained) add('Not found in the pages searched.');
	else if (answer) {
		add(`Generated summary · ${answerCheckLabel(answerCheck(answer))}`);
		// The summary is markdown: keep its lines so lists stay lists.
		for (const l of answer.text.split('\n').map(oneLine)) if (l) add(l);
		const seen = new Set<string>();
		for (const c of answer.citations) {
			const r = step.results[c.ref - 1];
			if (!r) continue;
			const quote = c.highlight.quote ?? r.snippet;
			const line = [
				`[${c.ref}] ${locatorOf(r)}`,
				STATUS_LABEL[c.status],
				...(quote ? [quoted(quote)] : [])
			].join(' · ');
			if (seen.has(line)) continue;
			seen.add(line);
			add(line);
			add(`${INDENT}${pdfLink(origin, r)}`);
		}
	}
	const error = errorLine(step);
	if (error && !answer) add(error);
	// Without a summary, the pages are the record.
	if (!answer) {
		step.results.forEach((r, i) => {
			add(`${i + 1}. ${locatorOf(r)}${r.snippet ? ` · ${quoted(r.snippet)}` : ''}`);
			add(`${INDENT}${pdfLink(origin, r)}`);
		});
	}
	return lines;
}

/** The trail as plain text that reads as Markdown: for filing and pasting into a memo. */
export function trailMarkdown(meta: TrailExportMeta, steps: readonly TrailStep[]): string {
	const head = [
		`Boreal Search trail: ${oneLine(meta.title)}`,
		`Exported ${stamp(meta.exported_at)} · ${meta.email} · ${meta.context}`
	];
	const body = [...steps]
		.sort((a, b) => a.n - b.n)
		.map((s) => stepLines(s, meta.origin).join('\n'));
	return `${[head.join('\n'), ...body].join('\n\n')}\n`;
}

/** The trail with its full snapshots (no signed URLs), for anyone who wants to re-check. */
export function trailJson(meta: TrailExportMeta, steps: readonly TrailStep[]): string {
	const { origin, ...rest } = meta;
	const record = {
		format: 'boreal-trail/1',
		...rest,
		steps: [...steps]
			.sort((a, b) => a.n - b.n)
			.map((s) => {
				const stored = storedStep(s);
				return {
					...stored,
					results: stored.results.map((r) => ({ ...r, pdf: pdfLink(origin, r) }))
				};
			})
	};
	return `${JSON.stringify(record, null, 2)}\n`;
}

/** The download's file name: `boreal-trail-<title slug>-<YYYY-MM-DD>.<md|json>`. */
export function trailFileName(title: string, exportedAt: string, kind: 'md' | 'json'): string {
	const slug =
		title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '')
			.slice(0, 48) || 'search';
	return `boreal-trail-${slug}-${exportedAt.slice(0, 10)}.${kind}`;
}
