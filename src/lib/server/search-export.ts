// /admin/searches/export: searches as JSON for analysis (Python, notebooks). One object keyed by
// search id; each search carries the engine version, timings, what it searched, the engine's
// plan, the result pages and the summary with each citation's sentence, page and check. Pure:
// the route fetches search_review rows and streams `exportHead` + `exportEntry`… + `EXPORT_TAIL`.
import type { Rating } from '#lib/rating.js';
import type { Database, Json, SearchStatus } from '#lib/supabase/types.js';
import type { Answer, SearchResult } from './engine.types';
import { storedAnswer } from './trails.js';

/** Bumped whenever a field is renamed, removed or changes meaning. */
export const EXPORT_FORMAT = 'boreal-searches/1';

export const EXPORT_COLUMNS =
	'id, created_at, user_email, org_id, org_name, query, resolved_query, data_source_ids, status, error, result_count, retrieval_ms, total_ms, trail_id, step_n, answer, results, rating, note, rated_by, trail_rating, trail_note, engine_version, plan';

type ReviewRow = Database['public']['Views']['search_review']['Row'];
export type ExportRow = Pick<
	ReviewRow,
	| 'id'
	| 'created_at'
	| 'user_email'
	| 'org_id'
	| 'org_name'
	| 'query'
	| 'resolved_query'
	| 'data_source_ids'
	| 'status'
	| 'error'
	| 'result_count'
	| 'retrieval_ms'
	| 'total_ms'
	| 'trail_id'
	| 'step_n'
	| 'answer'
	| 'results'
	| 'rating'
	| 'note'
	| 'rated_by'
	| 'trail_rating'
	| 'trail_note'
	| 'engine_version'
	| 'plan'
>;

/** A result as search_events keeps it; rows from before 2026-11-21 have no score or facets. */
type KeptResult = Omit<SearchResult, 'page_image_url' | 'pdf_url' | 'score'> & { score?: number };

export interface ExportedResult {
	/** 1-based: the `ref` a citation of this page uses (pages pulled in by cross-reference aside). */
	rank: number;
	document_id: string;
	document_title: string;
	data_source_id: string;
	page_number: number;
	section: string | null;
	score: number | null;
	/** Which plan facets found the page (indexes into `plan.facets`). */
	facets: number[] | null;
}

export interface ExportedCitation {
	ref: number;
	/** The answer text this citation backs. */
	answer_text: string;
	document_id: string;
	page_number: number;
	/** The page came from a cross-reference, so it isn't in `results`. */
	via_xref: boolean;
	/** The cited page's text that matched, when the engine placed it. */
	source_quote: string | null;
	status: Answer['citations'][number]['status'];
}

export interface ExportedSearch {
	created_at: string;
	engine_version: string | null;
	user_email: string | null;
	/** The org's name, or 'Public'. */
	context: string;
	org_id: string | null;
	/** null where the org doesn't keep queries (log_queries off): the same goes for the text fields below. */
	query: string | null;
	resolved_query: string | null;
	trail_id: string | null;
	step_n: number | null;
	data_source_ids: string[];
	outcome: SearchStatus;
	error: string | null;
	/** The whole search, engine-reported. */
	total_ms: number | null;
	retrieval_ms: number | null;
	result_count: number | null;
	plan: Json | null;
	results: ExportedResult[] | null;
	answer: {
		text: string;
		abstained: boolean;
		model: string;
		generation_ms: number;
		verify_ms: number;
		citations: ExportedCitation[];
	} | null;
	ratings: {
		search: { rating: Rating; note: string | null; by: string | null } | null;
		trail: { rating: Rating; note: string | null } | null;
	};
}

function exportedAnswer(answer: Answer | null): ExportedSearch['answer'] {
	if (!answer) return null;
	const xref = new Set(answer.sources.filter((s) => s.via_xref).map((s) => s.ref));
	return {
		text: answer.text,
		abstained: answer.abstained,
		model: answer.model,
		generation_ms: answer.generation_ms,
		verify_ms: answer.verify_ms,
		citations: answer.citations.map((c) => ({
			ref: c.ref,
			answer_text: c.text,
			document_id: c.document_id,
			page_number: c.page_number,
			via_xref: xref.has(c.ref),
			source_quote: c.highlight.quote,
			status: c.status
		}))
	};
}

export function exportedSearch(row: ExportRow & { status: SearchStatus }): ExportedSearch {
	const results = row.results as unknown as KeptResult[] | null;
	return {
		created_at: new Date(row.created_at).toISOString(),
		engine_version: row.engine_version,
		user_email: row.user_email,
		context: row.org_id ? (row.org_name ?? 'Deleted org') : 'Public',
		org_id: row.org_id,
		query: row.query,
		resolved_query: row.resolved_query,
		trail_id: row.trail_id,
		step_n: row.step_n,
		data_source_ids: row.data_source_ids,
		outcome: row.status,
		error: row.error,
		total_ms: row.total_ms,
		retrieval_ms: row.retrieval_ms,
		result_count: row.result_count,
		plan: row.plan,
		results:
			results?.map((r, i) => ({
				rank: i + 1,
				document_id: r.document_id,
				document_title: r.document_title,
				data_source_id: r.data_source_id,
				page_number: r.page_number,
				section: r.section,
				score: r.score ?? null,
				facets: r.facets ?? null
			})) ?? null,
		answer: exportedAnswer(storedAnswer(row.answer)),
		ratings: {
			search: row.rating ? { rating: row.rating, note: row.note, by: row.rated_by } : null,
			trail: row.trail_rating ? { rating: row.trail_rating, note: row.trail_note } : null
		}
	};
}

/** What the file holds: a view of the table (its `?…`, '' for all), or rows picked by hand. */
export type ExportScope = { view: string } | { selected: number };

/** The file up to the first search: `{"format":…,"exported_at":…,…,"searches":{`. */
export const exportHead = (scope: ExportScope, exportedAt: string) =>
	JSON.stringify({ format: EXPORT_FORMAT, exported_at: exportedAt, ...scope }).slice(0, -1) +
	',"searches":{';

/** One `"id":{…}` member, with its leading comma after the first. */
export const exportEntry = (row: ExportRow & { status: SearchStatus }, first: boolean) =>
	`${first ? '' : ','}${JSON.stringify(row.id)}:${JSON.stringify(exportedSearch(row))}`;

export const EXPORT_TAIL = '}}\n';
