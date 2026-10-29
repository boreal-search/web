// The search page. Searching itself goes through POST /search/stream (stream/+server.ts);
// this loads the picker, the trail being reread or refined (`?trail=<id>`), and the owner's
// trail actions.
import { error, fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { CONTEXT_COOKIE, getAccess, withDataSources, type Access } from '#lib/server/access.js';
import { requireUser } from '#lib/server/auth.js';
import type { EngineFailure } from '#lib/failure.js';
import { classifyEngineError, engine } from '#lib/server/engine.js';
import { canSign } from '#lib/server/files.js';
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

export interface PickerDataSource {
	id: string;
	name: string;
	/** null when the engine listing failed (ids stand in for names). */
	pages: number | null;
	documents: number | null;
	indexed_at: string | null;
}

interface PickerGroup {
	label: string;
	dataSources: PickerDataSource[];
}

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
}

/**
 * Picker groups ("<Org name>", "Public"). If the engine listing fails, ids stand in for names.
 * `permanentLinks`: page images go through `/pages/…` (web signs); else the engine's URLs.
 * `history`: the current context keeps trails (Public always; an org when it keeps search
 * history). `query`: `?q=` prefills the search box.
 */
export const load: PageServerLoad = async ({
	parent,
	fetch,
	url,
	locals
}): Promise<{
	groups: PickerGroup[];
	engineFailure: EngineFailure | null;
	permanentLinks: boolean;
	history: boolean;
	query: string;
	trail: PageTrail | null;
}> => {
	const user = requireUser();
	const { access } = await parent();
	const orgId = access.context.kind === 'org' ? access.context.org.id : null;
	const trailId = url.searchParams.get('trail');

	const [picker, history, loaded] = await Promise.all([
		pickerGroups(access, fetch),
		orgId === null
			? true
			: locals.supabase
					.from('orgs')
					.select('conversation_history')
					.eq('id', orgId)
					.single()
					.then(({ data, error: e }) => {
						if (e) throw e;
						return data.conversation_history;
					}),
		trailId ? loadTrail(locals.supabase, trailId, user.id) : null
	]);

	if (trailId && !loaded) {
		error(404, 'Trail not found', { failure: { kind: 'not_found', what: 'trail' } });
	}
	const trail = loaded && {
		id: loaded.trail.id,
		title: loaded.trail.title,
		org_id: loaded.trail.org_id,
		isOwner: loaded.isOwner,
		canRefine: loaded.isOwner && loaded.trail.org_id === orgId,
		steps: loaded.steps,
		people: loaded.people
	};

	return {
		...picker,
		permanentLinks: canSign(),
		history,
		query: url.searchParams.get('q') ?? '',
		trail
	};
};

async function pickerGroups(
	access: Access,
	fetch: typeof globalThis.fetch
): Promise<{ groups: PickerGroup[]; engineFailure: EngineFailure | null }> {
	try {
		const list = access.dataSourceIds.length > 0 ? await engine(fetch).listDataSources() : [];
		const groups = withDataSources(access.groups, list).map((g) => ({
			label: g.label,
			dataSources: g.dataSources.map((ds) => ({
				id: ds.id,
				name: ds.name,
				pages: ds.page_count,
				documents: ds.document_count,
				indexed_at: ds.indexed_at
			}))
		}));
		return { groups, engineFailure: null };
	} catch (e) {
		const groups = access.groups.map((g) => ({
			label: g.label,
			dataSources: g.ids.map((id) => ({
				id,
				name: id,
				pages: null,
				documents: null,
				indexed_at: null
			}))
		}));
		return { groups, engineFailure: classifyEngineError(e) };
	}
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
