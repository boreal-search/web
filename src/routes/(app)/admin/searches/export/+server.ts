// GET /admin/searches/export: the /admin/searches view (same URL params) as CSV, every matching
// row up to EXPORT_MAX. Platform admins only; RLS on search_review says the same.
import { toCsv, type CsvCell } from '#lib/csv.js';
import { requirePlatformAdmin } from '#lib/server/auth.js';
import type { Answer } from '#lib/server/engine.types.js';
import { EXPORT_MAX, parseReviewQuery, reviewRows } from '#lib/server/search-review.js';
import type { RequestHandler } from './$types';

/** PostgREST returns at most this many rows per request (supabase/config.toml max_rows). */
const CHUNK = 1000;

const COLUMNS =
	'id, created_at, user_email, org_id, org_name, query, resolved_query, data_source_ids, status, result_count, total_ms, rating, note, trail_rating, trail_note, answer';

const HEADER = [
	'time_utc',
	'user_email',
	'context',
	'query',
	'resolved_query',
	'data_sources',
	'outcome',
	'result_count',
	'time_taken_ms',
	'rating',
	'rating_note',
	'trail_rating',
	'trail_note',
	'answer'
];

export const GET: RequestHandler = async ({ locals, url }) => {
	await requirePlatformAdmin();
	const query = parseReviewQuery(url.searchParams);

	const rows: CsvCell[][] = [];
	for (let from = 0; from < EXPORT_MAX; from += CHUNK) {
		const { data, error } = await reviewRows(locals.supabase, COLUMNS, query).range(
			from,
			Math.min(from + CHUNK, EXPORT_MAX) - 1
		);
		if (error) throw error;
		for (const r of data) {
			rows.push([
				new Date(r.created_at).toISOString(),
				r.user_email,
				r.org_id ? r.org_name : 'Public',
				r.query,
				r.resolved_query,
				r.data_source_ids.join(' '),
				r.status,
				r.result_count,
				r.total_ms,
				r.rating,
				r.note,
				r.trail_rating,
				r.trail_note,
				(r.answer as unknown as Answer | null)?.text ?? null
			]);
		}
		if (data.length < CHUNK) break;
	}

	const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
	return new Response(toCsv(HEADER, rows), {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': `attachment; filename="boreal-searches-${stamp}.csv"`,
			'cache-control': 'no-store'
		}
	});
};
