// /admin/searches: the view in the URL (filters and sort, shareable), the one query the page and
// its CSV export both run on search_review, and a row as the TrailStep the search screen's
// summary component reads. Builds queries but runs none; RLS decides who reads what.
import type { SupabaseClient } from '@supabase/supabase-js';
import { RATINGS, type Rating } from '#lib/rating.js';
import type { Database, SearchStatus } from '#lib/supabase/types.js';
import type { StepResult, TrailStep } from '#lib/trail.js';
import { isUuid, storedAnswer } from './trails.js';
import { containsFilter, escapeLike, parseUsersQuery } from './users.js';

type ReviewRow = Database['public']['Views']['search_review']['Row'];

export const OUTCOMES: readonly SearchStatus[] = [
	'ok',
	'forbidden',
	'timeout',
	'unreachable',
	'unavailable',
	'engine_error'
];

/** The search's or its trail's rating: one value, any, or none at all. */
export type RatingFilter = Rating | 'rated' | 'none';
const RATING_FILTERS: readonly RatingFilter[] = [...RATINGS, 'rated', 'none'];
/** The org filter: an org's id, or the Public context. */
type OrgFilter = { kind: 'org'; id: string } | { kind: 'public' };

/** The table's sortable columns, in table order. */
export const SORT_KEYS = [
	'time',
	'user',
	'context',
	'query',
	'sources',
	'outcome',
	'taken',
	'rating'
] as const;
export type SortKey = (typeof SORT_KEYS)[number];
type SortDir = 'asc' | 'desc';
export interface Sort {
	key: SortKey;
	dir: SortDir;
}

/** search_review columns behind each sort key. */
const SORT_COLUMNS: Record<SortKey, readonly (keyof ReviewRow)[]> = {
	time: ['created_at'],
	user: ['user_email'],
	context: ['org_name'],
	query: ['query'],
	sources: ['data_source_ids'],
	outcome: ['status'],
	taken: ['total_ms'],
	rating: ['rating', 'trail_rating']
};
/** A column's first click: newest, slowest; everything else A to Z. */
const firstDir = (key: SortKey): SortDir => (key === 'time' || key === 'taken' ? 'desc' : 'asc');
/** Most rows one CSV export holds. */
export const EXPORT_MAX = 10_000;

export const DEFAULT_SORT: Sort = { key: 'time', dir: 'desc' };

export interface ReviewQuery {
	/** Part of the query text (as typed or as searched); '' for none. */
	q: string;
	/** Part of the user's email; '' for none. */
	user: string;
	org: OrgFilter | null;
	/** A data source id the search covered. */
	source: string | null;
	status: SearchStatus | null;
	rating: RatingFilter | null;
	/** UTC dates (YYYY-MM-DD), both inclusive. */
	from: string | null;
	to: string | null;
	/** Time taken bounds in seconds, inclusive. */
	minSeconds: number | null;
	maxSeconds: number | null;
	sort: Sort;
	page: number;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SOURCE = /^[\w][\w.:-]{0,127}$/;
const SECONDS = /^\d{1,6}(\.\d{1,3})?$/;

const date = (v: string | null) =>
	v && DATE.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) ? v : null;
const seconds = (v: string | null) => (v && SECONDS.test(v) ? Number(v) : null);
const text = (v: string | null) => (v ?? '').trim().replace(/\s+/g, ' ').slice(0, 200);

/** The view from the URL; anything unknown is ignored. */
export function parseReviewQuery(params: URLSearchParams): ReviewQuery {
	const status = params.get('status');
	const rating = params.get('rating');
	const org = params.get('org') ?? '';
	const source = params.get('source')?.trim() ?? '';
	const key = SORT_KEYS.find((k) => k === params.get('sort')) ?? DEFAULT_SORT.key;
	const dir = params.get('dir');
	return {
		...parseUsersQuery(params),
		user: text(params.get('user')),
		org: org === 'public' ? { kind: 'public' } : isUuid(org) ? { kind: 'org', id: org } : null,
		source: SOURCE.test(source) ? source : null,
		status: OUTCOMES.find((o) => o === status) ?? null,
		rating: RATING_FILTERS.find((r) => r === rating) ?? null,
		from: date(params.get('from')),
		to: date(params.get('to')),
		minSeconds: seconds(params.get('min_s')),
		maxSeconds: seconds(params.get('max_s')),
		sort: { key, dir: dir === 'asc' || dir === 'desc' ? dir : firstDir(key) }
	};
}

/** The URL's params for this view (page 1, the default sort and unset filters left out). */
function reviewParams(query: ReviewQuery, page: number): URLSearchParams {
	const { sort } = query;
	const entries: [string, string | number | null][] = [
		['q', query.q || null],
		['user', query.user || null],
		['org', query.org && (query.org.kind === 'public' ? 'public' : query.org.id)],
		['source', query.source],
		['status', query.status],
		['rating', query.rating],
		['from', query.from],
		['to', query.to],
		['min_s', query.minSeconds],
		['max_s', query.maxSeconds],
		['sort', sort.key === DEFAULT_SORT.key && sort.dir === DEFAULT_SORT.dir ? null : sort.key],
		['dir', sort.dir === firstDir(sort.key) ? null : sort.dir],
		['page', page > 1 ? page : null]
	];
	return new URLSearchParams(
		entries.flatMap(([k, v]) => (v === null ? [] : [[k, String(v)] as [string, string]]))
	);
}

/** `?…` for this view on another page, or sorted another way (back on page 1). */
export function reviewSearch(query: ReviewQuery, page = query.page, sort = query.sort): string {
	const s = reviewParams({ ...query, sort }, page).toString();
	return s ? `?${s}` : '';
}

/** Sorting by `key`: flips the current column, starts a new one at its first direction. */
export function sortBy(current: Sort, key: SortKey): Sort {
	if (current.key !== key) return { key, dir: firstDir(key) };
	return { key, dir: current.dir === 'asc' ? 'desc' : 'asc' };
}

/** The day after a YYYY-MM-DD, for an inclusive `to`. */
const nextDay = (d: string) =>
	new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

/**
 * search_review filtered and sorted as `query` says, newest then id as tie-breakers so pages
 * are stable. The caller adds `.range()`. Each `or` is its own parameter, and PostgREST ANDs them.
 */
export function reviewRows<Cols extends string>(
	db: SupabaseClient<Database>,
	columns: Cols,
	query: ReviewQuery,
	count?: 'exact'
) {
	let q = db.from('search_review').select(columns, count ? { count } : undefined);
	if (query.q) q = q.or(containsFilter(['query', 'resolved_query'], query.q));
	if (query.user) q = q.ilike('user_email', `%${escapeLike(query.user)}%`);
	// Public: no org, but not another user's conversation (its context isn't readable).
	if (query.org?.kind === 'public')
		q = q.is('org_id', null).or('kind.eq.search,user_id.not.is.null');
	else if (query.org) q = q.eq('org_id', query.org.id);
	if (query.source) q = q.contains('data_source_ids', [query.source]);
	if (query.status) q = q.eq('status', query.status);
	if (query.rating === 'none') q = q.is('rating', null).is('trail_rating', null);
	else if (query.rating === 'rated') q = q.or('rating.not.is.null,trail_rating.not.is.null');
	else if (query.rating) q = q.or(`rating.eq.${query.rating},trail_rating.eq.${query.rating}`);
	if (query.from) q = q.gte('created_at', `${query.from}T00:00:00Z`);
	if (query.to) q = q.lt('created_at', `${nextDay(query.to)}T00:00:00Z`);
	if (query.minSeconds !== null) q = q.gte('total_ms', Math.round(query.minSeconds * 1000));
	if (query.maxSeconds !== null) q = q.lte('total_ms', Math.round(query.maxSeconds * 1000));

	const ascending = query.sort.dir === 'asc';
	for (const column of SORT_COLUMNS[query.sort.key])
		q = q.order(column, { ascending, nullsFirst: false });
	if (query.sort.key !== 'time') q = q.order('created_at', { ascending: false });
	return q.order('id');
}

/**
 * The search as the step the user saw, for StepSummary: what search_events keeps of it (as
 * searched, the summary, the result locators). Names, index dates and the search readout
 * aren't kept, so ids stand in and searchedLine stays empty.
 */
export function reviewStep(row: ReviewRow): TrailStep {
	const answer = storedAnswer(row.answer);
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
