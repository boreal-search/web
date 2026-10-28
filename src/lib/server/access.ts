import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '#lib/supabase/types.js';

/** One org → data source grant visible to the current user. */
export interface AccessGrant {
	org_id: string;
	data_source_id: string;
}

/** What the current user may search. The one place that decides it. */
export interface Access {
	/** Orgs the user belongs to (empty: show the "not in an org yet" state). */
	orgIds: string[];
	/** Every (org, data source) grant via those memberships; used to attribute searches. */
	grants: AccessGrant[];
	/** Data source ids the user may query. A public tier would add its ids here. */
	dataSourceIds: string[];
}

/**
 * Load the user's access. RLS already scopes both queries to the user's orgs; the explicit
 * user filter is belt-and-braces.
 */
export async function getAccess(
	supabase: SupabaseClient<Database>,
	userId: string
): Promise<Access> {
	const { data: memberships, error: mErr } = await supabase
		.from('org_members')
		.select('org_id')
		.eq('user_id', userId);
	if (mErr) throw mErr;

	const orgIds = memberships.map((m) => m.org_id);
	if (orgIds.length === 0) return { orgIds, grants: [], dataSourceIds: [] };

	const { data: grants, error: lErr } = await supabase
		.from('org_data_sources')
		.select('org_id, data_source_id')
		.in('org_id', orgIds);
	if (lErr) throw lErr;

	return { orgIds, grants, dataSourceIds: [...new Set(grants.map((g) => g.data_source_id))] };
}

/**
 * Pure access check: returns the ids from `requested` that are not in `accessible`.
 * Empty result means the request is fully authorized.
 */
export function findForbiddenDataSources(requested: string[], accessible: string[]): string[] {
	const allowed = new Set(accessible);
	return [...new Set(requested)].filter((id) => !allowed.has(id));
}

/**
 * Which org a search should be attributed to. Prefers an org that grants every requested
 * data source; otherwise the first org granting any of them; null if none. Users usually
 * belong to one org, so this is mostly a formality — but analytics need a single org_id.
 */
export function resolveSearchOrg(requested: string[], grants: AccessGrant[]): string | null {
	if (requested.length === 0) return null;
	const byOrg = new Map<string, Set<string>>();
	for (const g of grants) {
		byOrg.set(g.org_id, (byOrg.get(g.org_id) ?? new Set()).add(g.data_source_id));
	}
	for (const [orgId, ids] of byOrg) {
		if (requested.every((r) => ids.has(r))) return orgId;
	}
	for (const [orgId, ids] of byOrg) {
		if (requested.some((r) => ids.has(r))) return orgId;
	}
	return null;
}
