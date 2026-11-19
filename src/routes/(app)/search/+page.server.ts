// The search page. Searching itself goes through POST /search/stream (stream/+server.ts);
// this loads the picker, the trail being reread or refined (`?trail=<id>`), and the owner's
// trail actions.
import { error, fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import {
	CONTEXT_COOKIE,
	getAccess,
	keepsHistory,
	withDataSources,
	type Access
} from '#lib/server/access.js';
import { loadAccessRequest, type OpenAccessRequest } from '#lib/server/access-requests.js';
import { requireUser } from '#lib/server/auth.js';
import { parseSplit, SPLIT_COOKIE } from '#lib/components/search/layout-prefs.js';
import type { Loaded } from '#lib/failure.js';
import type { PickerGroup } from '#lib/picker.js';
import { engine, settle } from '#lib/server/engine.js';
import { canSign } from '#lib/server/files.js';
import type { TrailRatings } from '#lib/rating.js';
import { canRate, trailRatings } from '#lib/server/ratings.js';
import {
	branchTrail,
	deleteTrail,
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
 * `permanentLinks`: page images go through `/pages/…` (web signs); else the engine's URLs.
 * `history`: the current context keeps trails (Public always; an org when it keeps search
 * history). `query`: `?q=` prefills the search box. `split`: the viewer's divider position.
 * `accessRequest`: a user in no org is offered "request access", or sees their open request.
 */
export const load: PageServerLoad = async ({
	parent,
	fetch,
	url,
	locals,
	cookies,
	untrack
}): Promise<{
	picker: Promise<Loaded<PickerGroup[]>>;
	permanentLinks: boolean;
	history: boolean;
	query: string;
	trail: PageTrail | null;
	split: number;
	accessRequest: OpenAccessRequest | null;
}> => {
	const user = requireUser();
	// Untracked: the app layout re-runs on its own (the trail list after each stored step)
	// without re-running this. A context switch invalidates everything anyway.
	const { access } = await untrack(() => parent());
	const orgId = access.context.kind === 'org' ? access.context.org.id : null;
	const trailId = url.searchParams.get('trail');

	// Good / Bad is for platform admins only for now (`canRate`): others get no ids or ratings.
	const rates = trailId ? canRate(locals.supabase) : Promise.resolve(false);
	const picker = settle(pickerGroups(access, fetch));
	const [loaded, accessRequest] = await Promise.all([
		trailId ? rates.then((r) => loadTrail(locals.supabase, trailId, user.id, r)) : null,
		access.memberships.length === 0 ? loadAccessRequest(locals.supabase, user.id) : null
	]);

	if (trailId && !loaded) {
		error(404, 'Trail not found', { failure: { kind: 'not_found', what: 'trail' } });
	}
	const ratings =
		loaded?.isOwner === true && (await rates)
			? await trailRatings(
					locals.supabase,
					user.id,
					loaded.trail.id,
					loaded.steps.flatMap((s) => (s.search_id ? [s.search_id] : []))
				)
			: null;
	const trail = loaded && {
		id: loaded.trail.id,
		title: loaded.trail.title,
		org_id: loaded.trail.org_id,
		isOwner: loaded.isOwner,
		canRefine: loaded.isOwner && loaded.trail.org_id === orgId,
		steps: loaded.steps,
		people: loaded.people,
		ratings
	};

	return {
		picker,
		permanentLinks: canSign(),
		history: keepsHistory(access.context),
		query: url.searchParams.get('q') ?? '',
		trail,
		split: parseSplit(cookies.get(SPLIT_COOKIE)),
		accessRequest
	};
};

async function pickerGroups(
	access: Access,
	fetch: typeof globalThis.fetch
): Promise<PickerGroup[]> {
	const list = access.dataSourceIds.length > 0 ? await engine(fetch).listDataSources() : [];
	return withDataSources(access.groups, list).map((g) => ({
		label: g.label,
		dataSources: g.dataSources.map((ds) => ({
			id: ds.id,
			name: ds.name,
			pages: ds.page_count,
			documents: ds.document_count,
			indexed_at: ds.indexed_at
		}))
	}));
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
	branch: async ({ request, locals, cookies }) => {
		const user = requireUser();
		const form = await request.formData();
		const { context } = await getAccess(locals.supabase, user.id, cookies.get(CONTEXT_COOKIE));
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
