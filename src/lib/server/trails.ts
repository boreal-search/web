// Stored search trails (supabase/migrations/*_search_trail.sql). Everything runs as the
// user's session: RLS decides who reads (owner, people it's shared with) and who writes (the
// owner, where the org keeps search history). This is the jsonb ⇄ TrailStep boundary.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json, TrailRelation } from '#lib/supabase/types.js';
import type { StepReadout, StepResult, StepScope, TrailStep } from '#lib/trail.js';
import type { Answer } from './engine.types';

type Db = SupabaseClient<Database>;
type StepRow = Database['public']['Tables']['trail_steps']['Row'];

export const TITLE_MAX = 500;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: string) => UUID.test(s);

/** A trail's title from its first query: one line, within the column's limit. */
export const trailTitle = (query: string) =>
	query.replace(/\s+/g, ' ').trim().slice(0, TITLE_MAX) || 'Untitled trail';

export interface TrailPerson {
	user_id: string;
	email: string;
	display_name: string | null;
	/** owner; shared (can read it); member (of its org, can be shared with; owner sees these only). */
	relation: TrailRelation;
}

export interface LoadedTrail {
	trail: Database['public']['Tables']['trails']['Row'];
	steps: TrailStep[];
	people: TrailPerson[];
	isOwner: boolean;
}

/** The stored readout also keeps `wants_answer`, which has no column of its own. */
type StoredReadout = StepReadout & { wants_answer?: boolean };

// jsonb columns hold what `stepRow` wrote; trusted at this boundary.
const asJson = (v: unknown) => v as Json;

function rowStep(row: StepRow): TrailStep {
	const { wants_answer, ...readout } = row.readout as unknown as StoredReadout;
	const answer = row.answer as unknown as Answer | null;
	return {
		n: row.n,
		query: row.query,
		resolved_query: row.resolved_query,
		rewrite: row.rewrite,
		scope: row.scope as unknown as StepScope,
		builds_on: row.builds_on,
		results: row.results as unknown as StepResult[],
		answer,
		wants_answer: wants_answer ?? answer !== null,
		readout,
		created_at: row.created_at
	};
}

const storedReadout = (step: TrailStep): Json =>
	asJson({ ...step.readout, wants_answer: step.wants_answer } satisfies StoredReadout);

/** A trail with its steps (in order) and people, or null if it doesn't exist or isn't readable. */
export async function loadTrail(db: Db, id: string, userId: string): Promise<LoadedTrail | null> {
	if (!isUuid(id)) return null;
	const { data: trail, error } = await db.from('trails').select('*').eq('id', id).maybeSingle();
	if (error) throw error;
	if (!trail) return null;
	const [steps, people] = await Promise.all([
		db.from('trail_steps').select('*').eq('trail_id', id).order('n'),
		db.rpc('trail_people', { p_trail_id: id })
	]);
	if (steps.error) throw steps.error;
	if (people.error) throw people.error;
	return {
		trail,
		steps: steps.data.map(rowStep),
		people: people.data,
		isOwner: trail.user_id === userId
	};
}

export interface TrailSummary {
	id: string;
	title: string;
	org_id: string | null;
	/** The org's name; null for the Public context. */
	org_name: string | null;
	steps: number;
	updated_at: string;
	/** false: shared with the user by someone else. */
	owned: boolean;
}

/** The user's trails and those shared with them, most recently added to first. */
export async function listTrails(db: Db, userId: string): Promise<TrailSummary[]> {
	const { data, error } = await db
		.from('trails')
		.select('id, title, org_id, user_id, updated_at, orgs(name), trail_steps(count)')
		.order('updated_at', { ascending: false });
	if (error) throw error;
	return data.map((t) => ({
		id: t.id,
		title: t.title,
		org_id: t.org_id,
		org_name: t.orgs?.name ?? null,
		steps: t.trail_steps[0]?.count ?? 0,
		updated_at: t.updated_at,
		owned: t.user_id === userId
	}));
}

/** Where a stored step is: its trail and the n the database gave it. */
export interface StoredAt {
	trail_id: string;
	n: number;
}

/**
 * Store a step that has its results: into `trailId`, or a new trail (titled by the query, in
 * `orgId`'s context) when null. Signed URLs must already be stripped (`storedStep`).
 */
export async function insertStep(
	db: Db,
	trailId: string | null,
	orgId: string | null,
	step: TrailStep
): Promise<StoredAt> {
	let trail_id = trailId;
	if (trail_id === null) {
		const { data, error } = await db
			.from('trails')
			.insert({ org_id: orgId, title: trailTitle(step.query) })
			.select('id')
			.single();
		if (error) throw error;
		trail_id = data.id;
	}
	const { data, error } = await db
		.from('trail_steps')
		.insert({
			trail_id,
			n: 0, // assigned by the trail_steps_insert trigger
			query: step.query,
			resolved_query: step.resolved_query,
			rewrite: step.rewrite,
			scope: asJson(step.scope),
			builds_on: step.builds_on,
			results: asJson(step.results),
			answer: null,
			readout: storedReadout(step)
		})
		.select('n')
		.single();
	if (error) throw error;
	return { trail_id, n: data.n };
}

/** Complete a stored step once: its summary (if any) and final readout. */
export async function completeStep(db: Db, at: StoredAt, step: TrailStep): Promise<void> {
	const { error } = await db
		.from('trail_steps')
		.update({ answer: step.answer ? asJson(step.answer) : null, readout: storedReadout(step) })
		.eq('trail_id', at.trail_id)
		.eq('n', at.n);
	if (error) throw error;
}

// Owner actions. Each returns an error message for the user, or null when done.

/** Share read-only with a member of the trail's org (RLS refuses anyone else). */
export async function shareTrail(db: Db, trailId: string, userId: string) {
	if (!isUuid(trailId) || !isUuid(userId)) return 'That person or trail is not valid.';
	const { error } = await db.from('trail_shares').insert({ trail_id: trailId, user_id: userId });
	if (!error || error.code === '23505') return null; // already shared: same outcome
	if (error.code === '42501') return 'Trails can be shared only with members of their org.';
	return error.message;
}

export async function unshareTrail(db: Db, trailId: string, userId: string) {
	if (!isUuid(trailId) || !isUuid(userId)) return 'That person or trail is not valid.';
	const { error } = await db
		.from('trail_shares')
		.delete()
		.eq('trail_id', trailId)
		.eq('user_id', userId);
	return error?.message ?? null;
}

export async function renameTrail(db: Db, trailId: string, title: string) {
	const t = title.replace(/\s+/g, ' ').trim();
	if (!t) return 'Enter a title.';
	if (t.length > TITLE_MAX) return `Keep the title under ${TITLE_MAX} characters.`;
	if (!isUuid(trailId)) return 'That trail is not valid.';
	const { error, count } = await db
		.from('trails')
		.update({ title: t }, { count: 'exact' })
		.eq('id', trailId);
	if (error) return error.message;
	return count ? null : 'Only the owner can rename this trail.';
}

export async function deleteTrail(db: Db, trailId: string) {
	if (!isUuid(trailId)) return 'That trail is not valid.';
	const { error, count } = await db.from('trails').delete({ count: 'exact' }).eq('id', trailId);
	if (error) return error.message;
	return count ? null : 'Only the owner can delete this trail.';
}
