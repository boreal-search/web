// GET /admin/searches/export: the /admin/searches view (same URL params) as CSV, every matching
// row up to EXPORT_MAX. Platform admins only; RLS on search_review says the same.
import { CSV_BOM, csvLine, type CsvCell } from '#lib/csv.js';
import { requirePlatformAdmin } from '#lib/server/auth.js';
import type { Answer } from '#lib/server/engine.types.js';
import {
	EXPORT_MAX,
	parseReviewQuery,
	reviewRows,
	type ReviewQuery
} from '#lib/server/search-review.js';
import type { RequestHandler } from './$types';

/** Rows asked for per request (supabase/config.toml max_rows). */
const CHUNK = 1000;

const COLUMNS =
	'kind, id, created_at, user_id, user_email, org_id, org_name, query, resolved_query, data_source_ids, status, result_count, total_ms, rating, note, trail_rating, trail_note, answer';

const HEADER = [
	'time_utc',
	'kind',
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

/**
 * The rows from `from`, as many as PostgREST gives (it may cap below CHUNK). Rows recorded after
 * `startedAt` would shift the offsets while the export runs, so they are left out.
 */
async function rowsFrom(
	db: App.Locals['supabase'],
	query: ReviewQuery,
	startedAt: string,
	from: number
) {
	const { data, error } = await reviewRows(db, COLUMNS, query)
		.lte('created_at', startedAt)
		.range(from, Math.min(from + CHUNK, EXPORT_MAX) - 1);
	if (error) throw error;
	return data;
}
type Row = Awaited<ReturnType<typeof rowsFrom>>[number];

const cells = (r: Row): CsvCell[] => [
	new Date(r.created_at).toISOString(),
	r.kind,
	r.user_email,
	r.user_id === null && r.kind === 'conversation' ? null : r.org_id ? r.org_name : 'Public',
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
];

export const GET: RequestHandler = async ({ locals, url }) => {
	await requirePlatformAdmin();
	const query = parseReviewQuery(url.searchParams);
	const startedAt = new Date().toISOString();
	const next = (from: number) => rowsFrom(locals.supabase, query, startedAt, from);

	// The first rows before the response starts, so a failing query is an error page, not a
	// broken download. Then one chunk per pull: the body is never held whole.
	let rows = await next(0);
	let sent = 0;
	const encoder = new TextEncoder();
	const body = new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(encoder.encode(CSV_BOM + csvLine(HEADER)));
		},
		async pull(controller) {
			if (rows.length === 0) return controller.close();
			controller.enqueue(encoder.encode(rows.map((r) => csvLine(cells(r))).join('')));
			sent += rows.length;
			rows = sent < EXPORT_MAX ? await next(sent) : [];
		}
	});

	const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
	return new Response(body, {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': `attachment; filename="boreal-searches-${stamp}.csv"`,
			'cache-control': 'no-store'
		}
	});
};
