// /admin/searches: the filters in the URL (shareable views), and a search_review row as the
// TrailStep the search screen's summary component reads. Pure; the loads query as the admin.
import { isRating, type Rating } from '#lib/rating.js';
import type { Database, SearchStatus } from '#lib/supabase/types.js';
import type { StepResult, TrailStep } from '#lib/trail.js';
import type { Answer } from './engine.types';
import { isUuid } from './trails.js';
import { parseUsersQuery } from './users.js';

type ReviewRow = Database['public']['Views']['search_review']['Row'];

export const OUTCOMES: readonly SearchStatus[] = [
	'ok',
	'forbidden',
	'timeout',
	'unreachable',
	'unavailable',
	'engine_error'
];

/** A rating filter: one value, or none given at all. */
export type RatingFilter = Rating | 'none';
/** The org filter: an org's id, or the Public context. */
export type OrgFilter = { kind: 'org'; id: string } | { kind: 'public' };

export interface ReviewQuery {
	/** Part of the query text (as typed or as searched); '' for none. */
	q: string;
	status: SearchStatus | null;
	/** The searcher's own rating. */
	rating: RatingFilter | null;
	/** A reviewer's verdict. */
	verdict: RatingFilter | null;
	org: OrgFilter | null;
	page: number;
}

const ratingFilter = (v: string | null): RatingFilter | null =>
	v === 'none' || isRating(v) ? v : null;

/** The filters from the URL; anything unknown is ignored. */
export function parseReviewQuery(params: URLSearchParams): ReviewQuery {
	const status = params.get('status');
	const org = params.get('org') ?? '';
	return {
		...parseUsersQuery(params),
		status: OUTCOMES.find((o) => o === status) ?? null,
		rating: ratingFilter(params.get('rating')),
		verdict: ratingFilter(params.get('verdict')),
		org: org === 'public' ? { kind: 'public' } : isUuid(org) ? { kind: 'org', id: org } : null
	};
}

/** `?…` for this view on another page (page 1 and unset filters left out). */
export function reviewSearch(query: ReviewQuery, page = query.page): string {
	const entries: [string, string][] = [];
	if (query.q) entries.push(['q', query.q]);
	if (query.status) entries.push(['status', query.status]);
	if (query.rating) entries.push(['rating', query.rating]);
	if (query.verdict) entries.push(['verdict', query.verdict]);
	if (query.org) entries.push(['org', query.org.kind === 'public' ? 'public' : query.org.id]);
	if (page > 1) entries.push(['page', String(page)]);
	return entries.length ? `?${new URLSearchParams(entries)}` : '';
}

/**
 * The search as the step the user saw, for StepSummary: what search_events keeps of it (as
 * searched, the summary, the result locators). Names, index dates and the search readout
 * aren't kept, so ids stand in and searchedLine stays empty.
 */
export function reviewStep(row: ReviewRow): TrailStep {
	const answer = row.answer as unknown as Answer | null;
	return {
		n: row.step_n ?? 1,
		query: row.query ?? '',
		resolved_query: row.resolved_query ?? row.query ?? '',
		rewrite: true,
		scope: {
			data_source_ids: row.data_source_ids,
			document_ids: null,
			inferred_documents: [],
			data_source_names: {},
			document_titles: {}
		},
		builds_on: null,
		results: (row.results ?? []) as unknown as StepResult[],
		answer,
		wants_answer: answer !== null,
		readout: {
			search: null,
			answer: answer?.readout ?? null,
			indexed_at: {},
			error: null,
			finished: true
		},
		created_at: row.created_at,
		search_id: row.id
	};
}
