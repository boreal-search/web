// Good/bad marks on searches (search_ratings), platform admins only for now (`canRate`). Shared
// by the search screen, POST /search/rating and /admin/searches. A rating is about whether the response was useful, not an answer state:
// answer states stay AnswerCheck's.
import type { Rating } from '#lib/supabase/types.js';

export type { Rating };

export const RATINGS: readonly Rating[] = ['good', 'bad'];
export const RATING_LABELS: Record<Rating, string> = { good: 'Good', bad: 'Bad' };
export const NOTE_MAX = 1000;

/** What is rated: one search (a response), or a whole stored trail (the conversation). */
export interface RatingTarget {
	kind: 'search' | 'trail';
	id: string;
}

/** A rating as stored. Setting `null` clears it. */
export interface RatingValue {
	rating: Rating;
	note: string | null;
}

/** The viewer's own ratings of a trail and its steps' searches (they may rate and own it). */
export interface TrailRatings {
	/** The whole trail. */
	trail: RatingValue | null;
	/** By search id (TrailStep.search_id). */
	searches: Record<string, RatingValue>;
}

export const isRating = (v: unknown): v is Rating => RATINGS.some((r) => r === v);

/** A note as stored: one trimmed string within NOTE_MAX, or null for none. */
export const cleanNote = (v: unknown): string | null =>
	typeof v === 'string' && v.trim() ? v.trim().slice(0, NOTE_MAX) : null;
