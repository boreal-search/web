// search_ratings writes, as the user's session: RLS decides who may rate what (the searcher their
// own searches and trails, platform admins any search as reviewers). One row per (target, user),
// so rating again replaces; a null rating clears it.
import type { SupabaseClient } from '@supabase/supabase-js';
import { cleanNote, isRating, type RatingTarget, type RatingValue } from '#lib/rating.js';
import type { Database } from '#lib/supabase/types.js';
import { isUuid } from './trails.js';

type Db = SupabaseClient<Database>;

export interface RatingRequest {
	target: RatingTarget;
	value: RatingValue | null;
}

/** POST /search/rating's body: `{ target: { kind, id }, rating: 'good' | 'bad' | null, note? }`. */
export function parseRatingRequest(body: unknown): RatingRequest | null {
	if (typeof body !== 'object' || body === null) return null;
	const { target, rating, note } = body as Record<string, unknown>;
	if (typeof target !== 'object' || target === null) return null;
	const { kind, id } = target as Record<string, unknown>;
	if ((kind !== 'search' && kind !== 'trail') || typeof id !== 'string' || !isUuid(id)) return null;
	if (rating !== null && !isRating(rating)) return null;
	return {
		target: { kind, id },
		value: rating === null ? null : { rating, note: cleanNote(note) }
	};
}

const targetColumns = (t: RatingTarget) =>
	t.kind === 'search'
		? { search_event_id: t.id, trail_id: null }
		: { search_event_id: null, trail_id: t.id };

/** Set or clear the caller's rating. Returns a message for the user, or null when done. */
export async function setRating(
	db: Db,
	userId: string,
	{ target, value }: RatingRequest
): Promise<string | null> {
	const cols = targetColumns(target);
	if (value === null) {
		const base = db.from('search_ratings').delete().eq('user_id', userId);
		const { error } =
			target.kind === 'search'
				? await base.eq('search_event_id', target.id)
				: await base.eq('trail_id', target.id);
		return error?.message ?? null;
	}
	const { error } = await db
		.from('search_ratings')
		.upsert(
			{ ...cols, user_id: userId, ...value, updated_at: new Date().toISOString() },
			{ onConflict: 'search_event_id,trail_id,user_id' }
		);
	if (!error) return null;
	if (error.code === '42501') return 'You can rate only your own searches.';
	// The search's analytics row may still be on its way (it's written as the stream ends).
	if (error.code === '23503') return 'That search is not recorded yet. Try again in a moment.';
	return error.message;
}

export interface TrailRatings {
	/** The whole trail. */
	trail: RatingValue | null;
	/** By search id (TrailStep.search_id). */
	searches: Record<string, RatingValue>;
}

/** The caller's own ratings of a trail and of the searches behind its steps. */
export async function trailRatings(
	db: Db,
	userId: string,
	trailId: string,
	searchIds: readonly string[]
): Promise<TrailRatings> {
	const targets = [`trail_id.eq.${trailId}`];
	if (searchIds.length > 0) targets.push(`search_event_id.in.(${searchIds.join(',')})`);
	const { data, error } = await db
		.from('search_ratings')
		.select('search_event_id, trail_id, rating, note')
		.eq('user_id', userId)
		.or(targets.join(','));
	if (error) throw error;
	const out: TrailRatings = { trail: null, searches: {} };
	for (const r of data) {
		const value = { rating: r.rating, note: r.note };
		if (r.search_event_id) out.searches[r.search_event_id] = value;
		else out.trail = value;
	}
	return out;
}
