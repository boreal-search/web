import { fail, redirect } from '@sveltejs/kit';
import { requirePlatformAdmin } from '#lib/server/auth.js';
import { engine, engineErrorMessage } from '#lib/server/engine.js';
import { parseSlug, planGrantChanges } from '#lib/server/orgs.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, fetch }) => {
	await requirePlatformAdmin();
	const [{ data, error }, pub, sources] = await Promise.all([
		locals.supabase
			.from('orgs')
			.select('id, slug, name, org_members(count), org_data_sources(data_source_id)')
			.order('name'),
		locals.supabase.from('public_data_sources').select('data_source_id'),
		engine(fetch)
			.listDataSources()
			.then((list) => ({ list, error: null }))
			.catch((e: unknown) => ({ list: [], error: engineErrorMessage(e) }))
	]);
	if (error) throw error;
	if (pub.error) throw pub.error;
	return {
		publicCorpora: {
			publicIds: pub.data.map((p) => p.data_source_id),
			dataSources: sources.list.map((ds) => ({ id: ds.id, name: ds.name })),
			engineError: sources.error
		},
		orgs: data.map((o) => ({
			id: o.id,
			slug: o.slug,
			name: o.name,
			memberCount: o.org_members[0]?.count ?? 0,
			dataSourceIds: o.org_data_sources.map((g) => g.data_source_id)
		}))
	};
};

export const actions: Actions = {
	savePublic: async ({ request, locals, fetch }) => {
		await requirePlatformAdmin();
		const desired = (await request.formData()).getAll('data_source_id').map(String);

		let known: string[];
		try {
			known = (await engine(fetch).listDataSources()).map((ds) => ds.id);
		} catch (e) {
			return fail(502, { publicError: `Public data sources not saved. ${engineErrorMessage(e)}` });
		}
		const current = await locals.supabase.from('public_data_sources').select('data_source_id');
		if (current.error) return fail(400, { publicError: current.error.message });

		const { add, remove } = planGrantChanges(
			current.data.map((p) => p.data_source_id),
			desired,
			known
		);
		if (add.length > 0) {
			const { error } = await locals.supabase
				.from('public_data_sources')
				.insert(add.map((data_source_id) => ({ data_source_id })));
			if (error) return fail(400, { publicError: error.message });
		}
		if (remove.length > 0) {
			const { error } = await locals.supabase
				.from('public_data_sources')
				.delete()
				.in('data_source_id', remove);
			if (error) return fail(400, { publicError: error.message });
		}
		return { publicNotice: 'Public data sources saved.' };
	},

	createOrg: async ({ request, locals }) => {
		await requirePlatformAdmin();
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const slug = parseSlug(form.get('slug'));
		if (!name || !slug) {
			return fail(400, {
				name,
				slug: String(form.get('slug') ?? ''),
				error: name
					? 'Use 2–63 lower-case letters, digits and dashes, starting with a letter or digit.'
					: 'Enter a name.'
			});
		}
		const { error } = await locals.supabase.from('orgs').insert({ name, slug });
		if (error) {
			const message =
				error.code === '23505' ? `Another org already uses the slug ${slug}.` : error.message;
			return fail(400, { name, slug, error: message });
		}
		redirect(303, `/orgs/${slug}/manage`);
	}
};
