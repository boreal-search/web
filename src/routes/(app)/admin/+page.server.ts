import { fail, redirect } from '@sveltejs/kit';
import { requirePlatformAdmin } from '#lib/server/auth.js';
import { parseSlug } from '#lib/server/orgs.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	await requirePlatformAdmin();
	const { data, error } = await locals.supabase
		.from('orgs')
		.select('id, slug, name, org_members(count), org_data_sources(data_source_id)')
		.order('name');
	if (error) throw error;
	return {
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
	createOrg: async ({ request, locals }) => {
		await requirePlatformAdmin();
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const slug = parseSlug(form.get('slug'));
		if (!name || !slug) {
			return fail(400, {
				name,
				slug: String(form.get('slug') ?? ''),
				error: 'Enter a name and a slug (lower-case letters, digits and dashes, 2–63 chars).'
			});
		}
		const { error } = await locals.supabase.from('orgs').insert({ name, slug });
		if (error) {
			const message = error.code === '23505' ? `The slug "${slug}" is taken.` : error.message;
			return fail(400, { name, slug, error: message });
		}
		redirect(303, `/orgs/${slug}/manage`);
	}
};
