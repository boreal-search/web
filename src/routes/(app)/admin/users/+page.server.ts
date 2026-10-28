import { requirePlatformAdmin } from '#lib/server/auth.js';
import {
	containsFilter,
	PAGE_SIZE,
	pageRange,
	pageWindow,
	parseUsersQuery
} from '#lib/server/users.js';
import type { OrgRole } from '#lib/supabase/types.js';
import type { PageServerLoad } from './$types';

/** PostgREST: offset past the last row (416), and an RPC that isn't in the schema yet. */
const RANGE_NOT_SATISFIABLE = 'PGRST103';
const FUNCTION_NOT_FOUND = 'PGRST202';

export const load: PageServerLoad = async ({ locals, url }) => {
	await requirePlatformAdmin();
	const query = parseUsersQuery(url.searchParams);
	const { from, to } = pageRange(query.page);

	// RLS ("profiles: admin read") lets a platform admin read every profile.
	const profiles = () => {
		const base = locals.supabase
			.from('profiles')
			.select('id, email, display_name, created_at', { count: 'exact' });
		return query.q ? base.or(containsFilter(['email', 'display_name'], query.q)) : base;
	};
	const pageResult = await profiles()
		.order('created_at', { ascending: false })
		.order('id')
		.range(from, to);

	let rows = pageResult.data ?? [];
	let total = pageResult.count ?? 0;
	if (pageResult.error) {
		if (pageResult.error.code !== RANGE_NOT_SATISFIABLE) throw pageResult.error;
		// Past the last page: still say how many there are, so the page can link back to page 1.
		const head = await profiles().limit(0);
		if (head.error) throw head.error;
		rows = [];
		total = head.count ?? 0;
	}

	const ids = rows.map((r) => r.id);
	const [members, admins, signIns] =
		ids.length === 0
			? [null, null, null]
			: await Promise.all([
					locals.supabase
						.from('org_members')
						.select('user_id, role, orgs(slug, name)')
						.in('user_id', ids),
					locals.supabase.from('platform_admins').select('user_id').in('user_id', ids),
					locals.supabase.rpc('admin_last_sign_ins', { p_user_ids: ids })
				]);
	if (members?.error) throw members.error;
	if (admins?.error) throw admins.error;
	// Until the admin_last_sign_ins migration is applied the column is left out.
	if (signIns?.error && signIns.error.code !== FUNCTION_NOT_FOUND) throw signIns.error;

	const orgsByUser = new Map<string, { slug: string; name: string; role: OrgRole }[]>();
	for (const m of members?.data ?? []) {
		if (!m.orgs) continue;
		const list = orgsByUser.get(m.user_id) ?? [];
		list.push({ slug: m.orgs.slug, name: m.orgs.name, role: m.role });
		orgsByUser.set(m.user_id, list);
	}
	const platformAdmins = new Set((admins?.data ?? []).map((a) => a.user_id));
	const lastSignIn = new Map((signIns?.data ?? []).map((s) => [s.user_id, s.last_sign_in_at]));

	return {
		query,
		total,
		pageSize: PAGE_SIZE,
		window: pageWindow(query.page, total),
		showLastSignIn: !signIns?.error,
		users: rows.map((r) => ({
			id: r.id,
			email: r.email,
			displayName: r.display_name,
			joinedAt: r.created_at,
			isPlatformAdmin: platformAdmins.has(r.id),
			lastSignInAt: lastSignIn.get(r.id) ?? null,
			orgs: (orgsByUser.get(r.id) ?? []).sort((a, b) => a.name.localeCompare(b.name))
		}))
	};
};
