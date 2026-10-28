import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, OrgRole } from '#lib/supabase/types.js';

/** Cookie holding the current context: an org slug, or `public`. Per device; never trusted. */
export const CONTEXT_COOKIE = 'boreal_org';
const PUBLIC = 'public';

/** An org the user belongs to. */
export interface Membership {
	id: string;
	slug: string;
	name: string;
	role: OrgRole;
}

/** Who a search runs as: one of the user's orgs, or the Public tier (no org, no seat). */
export type SearchContext = { kind: 'org'; org: Membership } | { kind: 'public' };

/** A labelled slice of the searchable set, for the picker: "<Org name>" then "Public". */
export interface DataSourceGroup {
	label: string;
	ids: string[];
}

/** What the current user may search right now. The one place that decides it. */
export interface Access {
	/** The user's orgs, by name. */
	memberships: Membership[];
	/** Contexts the user may switch between (switcher shown when there are 2+). */
	contexts: SearchContext[];
	/** The current context, from the cookie when it names one of `contexts`. */
	context: SearchContext;
	/** The searchable set, grouped; empty groups are dropped. */
	groups: DataSourceGroup[];
	/** Every id in `groups`: the current org's grants ∪ public corpora. */
	dataSourceIds: string[];
}

export const contextValue = (c: SearchContext) => (c.kind === 'org' ? c.org.slug : PUBLIC);
export const contextLabel = (c: SearchContext) => (c.kind === 'org' ? c.org.name : 'Public');

/**
 * Contexts a user may pick: their orgs by name, then Public. Public is offered when public
 * corpora exist, and is the only context for a user with no org (so they always have one).
 */
export function availableContexts(memberships: Membership[], hasPublic: boolean): SearchContext[] {
	const orgs: SearchContext[] = [...memberships]
		.sort((a, b) => a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug))
		.map((org) => ({ kind: 'org', org }));
	return hasPublic || orgs.length === 0 ? [...orgs, { kind: 'public' }] : orgs;
}

/** The context the cookie names, if it is one the user may use; else the first available. */
export function resolveContext(
	cookie: string | undefined,
	contexts: SearchContext[]
): SearchContext {
	return contexts.find((c) => contextValue(c) === cookie) ?? contexts[0];
}

/**
 * The searchable set for a context, grouped. A corpus that is both granted and public is
 * listed once, under Public.
 */
export function searchableGroups(
	context: SearchContext,
	orgGrantIds: string[],
	publicIds: string[]
): DataSourceGroup[] {
	const pub = [...new Set(publicIds)];
	const isPublic = new Set(pub);
	const own =
		context.kind === 'org' ? [...new Set(orgGrantIds)].filter((id) => !isPublic.has(id)) : [];
	const groups = context.kind === 'org' ? [{ label: context.org.name, ids: own }] : [];
	return [...groups, { label: 'Public', ids: pub }].filter((g) => g.ids.length > 0);
}

/**
 * Load the user's access for this request. `cookie` is the raw CONTEXT_COOKIE value; it only
 * selects among the user's own memberships. RLS scopes every query as well.
 */
export async function getAccess(
	supabase: SupabaseClient<Database>,
	userId: string,
	cookie: string | undefined
): Promise<Access> {
	const [members, pub] = await Promise.all([
		supabase.from('org_members').select('role, orgs(id, slug, name)').eq('user_id', userId),
		supabase.from('public_data_sources').select('data_source_id')
	]);
	if (members.error) throw members.error;
	if (pub.error) throw pub.error;

	const memberships = members.data.flatMap((m) => (m.orgs ? [{ ...m.orgs, role: m.role }] : []));
	const publicIds = pub.data.map((p) => p.data_source_id);
	const contexts = availableContexts(memberships, publicIds.length > 0);
	const context = resolveContext(cookie, contexts);

	let orgGrantIds: string[] = [];
	if (context.kind === 'org') {
		const { data, error } = await supabase
			.from('org_data_sources')
			.select('data_source_id')
			.eq('org_id', context.org.id);
		if (error) throw error;
		orgGrantIds = data.map((g) => g.data_source_id);
	}

	const groups = searchableGroups(context, orgGrantIds, publicIds);
	return { memberships, contexts, context, groups, dataSourceIds: groups.flatMap((g) => g.ids) };
}

/** Attach engine records to each group's ids, in engine order; ids the engine lacks are dropped. */
export function withDataSources<T extends { id: string }>(
	groups: DataSourceGroup[],
	list: T[]
): { label: string; dataSources: T[] }[] {
	return groups.map((g) => {
		const ids = new Set(g.ids);
		return { label: g.label, dataSources: list.filter((ds) => ids.has(ds.id)) };
	});
}

/**
 * Pure access check: returns the ids from `requested` that are not in `accessible`.
 * Empty result means the request is fully authorized.
 */
export function findForbiddenDataSources(requested: string[], accessible: string[]): string[] {
	const allowed = new Set(accessible);
	return [...new Set(requested)].filter((id) => !allowed.has(id));
}
