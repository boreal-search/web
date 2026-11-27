// The search page. Searching itself goes through POST /search/stream (stream/+server.ts);
// this loads the picker, the trail being reread or refined (`?trail=<id>`), and the owner's
// trail actions.
import { error, fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getAccess, keepsHistory, withDataSources, type Access } from '#lib/server/access.js';
import { loadAccessRequest, type OpenAccessRequest } from '#lib/server/access-requests.js';
import { requireUser } from '#lib/server/auth.js';
import { parseSplit, SPLIT_COOKIE } from '#lib/components/search/layout-prefs.js';
import type { Loaded } from '#lib/failure.js';
import type { PickerGroup } from '#lib/picker.js';
import { allDataSources, settle } from '#lib/server/engine.js';
import { canSign } from '#lib/server/files.js';
import type { TrailRatings } from '#lib/rating.js';
import { canRate, trailRatings } from '#lib/server/ratings.js';
import {
	branchTrail,
	deleteTrail,
	isUuid,
	loadTrail,
	renameTrail,
	shareTrail,
	unshareTrail,
	type TrailPerson
} from '#lib/server/trails.js';
import type { TrailStep } from '#lib/trail.js';
import type { Actions, PageServerLoad } from './$types';

export interface PageTrail {
	id: string;
	title: string;
	/** null: the Public context. */
	org_id: string | null;
	isOwner: boolean;
	/** The owner, in the context the trail belongs to: new steps can be added to it. */
	canRefine: boolean;
	steps: TrailStep[];
	people: TrailPerson[];
	/** The viewer's ratings, when they may rate (`canRate`) and own the trail; else null. */
	ratings: TrailRatings | null;
}

/**
 * `picker`: the data source picker, streamed (the page shows ids until it arrives or if it fails).
 * `notices`: data source id → its notice, for the searchable set and the trail's results.
 * `permanentLinks`: page images go through `/pages/…` (web signs); else the engine's URLs.
 * `history`: the current context keeps trails (Public always; an org when it keeps search
 * history). `query`: `?q=` prefills the search box. `split`: the viewer's divider position.
 * `accessRequest`: a user in no org is offered "request access", or sees their open request.
 */
export const load: PageServerLoad = async ({
	url,
	locals,
	cookies
}): Promise<{
	picker: Promise<Loaded<PickerGroup[]>>;
	notices: Promise<Loaded<Map<string, string>>>;
	permanentLinks: boolean;
	history: boolean;
	query: string;
	trail: PageTrail | null;
	split: number;
	accessRequest: OpenAccessRequest | null;
}> => {
	const user = requireUser();
	const db = locals.supabase;
	const trailId = url.searchParams.get('trail');
	if (trailId !== null && !isUuid(trailId)) trailNotFound();

	// Access comes from the request memo, not `parent()`, so switching trails re-runs only this
	// load. Everything starts at once: RLS gates each read without waiting on access.
	const access = getAccess();
	const picker = settle(access.then(pickerGroups));
	const [{ context, dataSourceIds }, loaded, rated, accessRequest] = await Promise.all([
		access,
		trailId ? loadTrail(db, trailId, user.id) : null,
		// Good / Bad is for platform admins only for now (`canRate`): others get no ids or ratings.
		trailId ? canRate().then((r) => (r ? trailRatings(db, user.id, trailId) : null)) : null,
		access.then((a) => (a.memberships.length === 0 ? loadAccessRequest(db, user.id) : null))
	]);
	if (trailId && !loaded) trailNotFound();
	const orgId = context.kind === 'org' ? context.org.id : null;
	const own = loaded?.isOwner ? rated : null;
	const trail = loaded && {
		id: loaded.trail.id,
		title: loaded.trail.title,
		org_id: loaded.trail.org_id,
		isOwner: loaded.isOwner,
		canRefine: loaded.isOwner && loaded.trail.org_id === orgId,
		steps: loaded.steps.map((s) => ({ ...s, search_id: own?.searchIds.get(s.n) ?? null })),
		people: loaded.people,
		ratings: own?.ratings ?? null
	};

	// A trail from another context or person can cite sources outside the searchable set.
	const trailSources = loaded?.steps.flatMap((s) => s.results.map((r) => r.data_source_id)) ?? [];
	return {
		picker,
		notices: settle(sourceNotices([...dataSourceIds, ...trailSources])),
		permanentLinks: canSign(),
		history: keepsHistory(context),
		query: url.searchParams.get('q') ?? '',
		trail,
		split: parseSplit(cookies.get(SPLIT_COOKIE)),
		accessRequest
	};
};

const trailNotFound = (): never =>
	error(404, 'Trail not found', { failure: { kind: 'not_found', what: 'trail' } });

async function pickerGroups(access: Access): Promise<PickerGroup[]> {
	const list = access.dataSourceIds.length > 0 ? await allDataSources() : [];
	return withDataSources(access.groups, list).map((g) => ({
		label: g.label,
		dataSources: g.dataSources.map((ds) => ({
			id: ds.id,
			name: ds.name,
			group: ds.group ?? null,
			pages: ds.page_count,
			documents: ds.document_count,
			indexed_at: ds.indexed_at
		}))
	}));
}

async function sourceNotices(ids: string[]): Promise<Map<string, string>> {
	const wanted = new Set(ids);
	const list = wanted.size > 0 ? await allDataSources() : [];
	return new Map(
		list.flatMap((ds) => (wanted.has(ds.id) && ds.notice ? [[ds.id, ds.notice] as const] : []))
	);
}

/** Trail actions. Every form posts `trail_id`; RLS refuses anyone but the owner (branch: any reader). */
const field = (form: FormData, name: string) => String(form.get(name) ?? '').trim();

export const actions: Actions = {
	share: async ({ request, locals }) => {
		requireUser();
		const form = await request.formData();
		const problem = await shareTrail(
			locals.supabase,
			field(form, 'trail_id'),
			field(form, 'user_id')
		);
		if (problem) return fail(400, { error: problem });
		return { notice: 'Shared. They can reread and export this trail, not add to it.' };
	},

	unshare: async ({ request, locals }) => {
		requireUser();
		const form = await request.formData();
		const problem = await unshareTrail(
			locals.supabase,
			field(form, 'trail_id'),
			field(form, 'user_id')
		);
		if (problem) return fail(400, { error: problem });
		return { notice: 'No longer shared with them.' };
	},

	rename: async ({ request, locals }) => {
		requireUser();
		const form = await request.formData();
		const problem = await renameTrail(
			locals.supabase,
			field(form, 'trail_id'),
			field(form, 'title')
		);
		if (problem) return fail(400, { error: problem });
		return { notice: 'Trail renamed.' };
	},

	delete: async ({ request, locals }) => {
		requireUser();
		const problem = await deleteTrail(locals.supabase, field(await request.formData(), 'trail_id'));
		if (problem) return fail(400, { error: problem });
		redirect(303, resolve('/(app)/search'));
	},

	/** A new trail of the user's own, seeded with steps 01..n of one they can read (RLS). */
	branch: async ({ request, locals }) => {
		const user = requireUser();
		const form = await request.formData();
		const { context } = await getAccess();
		const made = await branchTrail(
			locals.supabase,
			user.id,
			field(form, 'trail_id'),
			Number(field(form, 'n')),
			context.kind === 'org' ? context.org.id : null
		);
		if ('error' in made) return fail(400, { error: made.error });
		redirect(303, `${resolve('/(app)/search')}?trail=${made.id}`);
	}
};
