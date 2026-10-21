import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '#lib/supabase/types.js';

/**
 * Data source ids the current user may query, via org_data_sources of the orgs they belong to.
 * RLS already scopes the query to the user's orgs; the explicit user filter is belt-and-braces.
 */
export async function getAccessibleDataSourceIds(
	supabase: SupabaseClient<Database>,
	userId: string
): Promise<string[]> {
	const { data: memberships, error: mErr } = await supabase
		.from('org_members')
		.select('org_id')
		.eq('user_id', userId);
	if (mErr) throw mErr;

	const orgIds = memberships.map((m) => m.org_id);
	if (orgIds.length === 0) return [];

	const { data: links, error: lErr } = await supabase
		.from('org_data_sources')
		.select('data_source_id')
		.in('org_id', orgIds);
	if (lErr) throw lErr;

	return [...new Set(links.map((l) => l.data_source_id))];
}

/**
 * Pure access check: returns the ids from `requested` that are not in `accessible`.
 * Empty result means the request is fully authorized.
 */
export function findForbiddenDataSources(requested: string[], accessible: string[]): string[] {
	const allowed = new Set(accessible);
	return [...new Set(requested)].filter((id) => !allowed.has(id));
}
