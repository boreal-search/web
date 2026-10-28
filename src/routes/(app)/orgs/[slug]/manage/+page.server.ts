import { fail } from '@sveltejs/kit';
import { requireOrgManager } from '#lib/server/auth.js';
import { EmailError, sendEmail } from '#lib/server/email.js';
import { engine, engineErrorMessage } from '#lib/server/engine.js';
import {
	inviteEmail,
	parseDomain,
	parseEmail,
	parseRole,
	planGrantChanges
} from '#lib/server/orgs.js';
import type { Actions, PageServerLoad } from './$types';

// Admins and owners both reach this page; RLS and add_org_member enforce the same split
// in the database, these checks just return a clear message instead of a silent no-op.

export const load: PageServerLoad = async ({ params, locals, fetch }) => {
	const { org, isAdmin } = await requireOrgManager(params.slug);
	const db = locals.supabase;

	const [members, invites] = await Promise.all([
		db
			.from('org_members')
			.select('user_id, role, profiles(email, display_name)')
			.eq('org_id', org.id)
			.order('created_at'),
		db.from('org_invites').select('email, role, created_at').eq('org_id', org.id).order('email')
	]);
	if (members.error) throw members.error;
	if (invites.error) throw invites.error;

	let admin = null;
	if (isAdmin) {
		const [grants, domains, sources] = await Promise.all([
			db.from('org_data_sources').select('data_source_id').eq('org_id', org.id),
			db.from('org_domains').select('domain').eq('org_id', org.id).order('domain'),
			engine(fetch)
				.listDataSources()
				.then((list) => ({ list, error: null }))
				.catch((e: unknown) => ({ list: [], error: engineErrorMessage(e) }))
		]);
		if (grants.error) throw grants.error;
		if (domains.error) throw domains.error;
		admin = {
			grantedIds: grants.data.map((g) => g.data_source_id),
			domains: domains.data.map((d) => d.domain),
			dataSources: sources.list.map((ds) => ({ id: ds.id, name: ds.name })),
			engineError: sources.error
		};
	}

	return {
		org,
		members: members.data.map((m) => ({
			userId: m.user_id,
			role: m.role,
			email: m.profiles?.email ?? m.user_id,
			displayName: m.profiles?.display_name ?? null
		})),
		invites: invites.data,
		admin
	};
};

const adminOnly = () => fail(403, { error: 'Only platform admins can change this.' });

export const actions: Actions = {
	addMember: async ({ params, request, locals, url, fetch }) => {
		const { org } = await requireOrgManager(params.slug);
		const form = await request.formData();
		const email = parseEmail(form.get('email'));
		const role = parseRole(form.get('role'));
		if (!email || !role) return fail(400, { error: 'Enter a valid email and role.' });

		const { data: result, error } = await locals.supabase.rpc('add_org_member', {
			p_org_id: org.id,
			p_email: email,
			p_role: role
		});
		if (error) return fail(400, { error: error.message });
		if (result === 'added') return { notice: `${email} is now a ${role}.` };

		try {
			await sendEmail(inviteEmail(email, org.name, `${url.origin}/login`), fetch);
			return { notice: `Invited ${email}; they join when they sign in.` };
		} catch (e) {
			const reason = e instanceof EmailError ? e.message : String(e);
			return {
				notice: `Invite for ${email} saved, but the email was not sent (${reason}). They join when they sign in at ${url.origin}/login.`
			};
		}
	},

	setRole: async ({ params, request, locals }) => {
		const { org } = await requireOrgManager(params.slug);
		const form = await request.formData();
		const email = parseEmail(form.get('email'));
		const role = parseRole(form.get('role'));
		if (!email || !role) return fail(400, { error: 'Enter a valid email and role.' });

		// Same idempotent RPC as adding: it updates the role of a member or a pending invite.
		const { error } = await locals.supabase.rpc('add_org_member', {
			p_org_id: org.id,
			p_email: email,
			p_role: role
		});
		if (error) return fail(400, { error: error.message });
		return { notice: `${email} is now a ${role}.` };
	},

	removeMember: async ({ params, request, locals }) => {
		const { org } = await requireOrgManager(params.slug);
		const userId = String((await request.formData()).get('user_id') ?? '');
		const { error, count } = await locals.supabase
			.from('org_members')
			.delete({ count: 'exact' })
			.eq('org_id', org.id)
			.eq('user_id', userId);
		if (error) return fail(400, { error: error.message });
		if (!count) return fail(404, { error: 'No such member.' });
		return { notice: 'Member removed.' };
	},

	revokeInvite: async ({ params, request, locals }) => {
		const { org } = await requireOrgManager(params.slug);
		const email = parseEmail((await request.formData()).get('email'));
		if (!email) return fail(400, { error: 'Invalid email.' });
		const { error } = await locals.supabase
			.from('org_invites')
			.delete()
			.eq('org_id', org.id)
			.eq('email', email);
		if (error) return fail(400, { error: error.message });
		return { notice: `Invite for ${email} revoked.` };
	},

	saveGrants: async ({ params, request, locals, fetch }) => {
		const { org, isAdmin } = await requireOrgManager(params.slug);
		if (!isAdmin) return adminOnly();
		const desired = (await request.formData()).getAll('data_source_id').map(String);

		let known: string[];
		try {
			known = (await engine(fetch).listDataSources()).map((ds) => ds.id);
		} catch (e) {
			return fail(502, { error: `Could not reach the engine: ${engineErrorMessage(e)}` });
		}
		const current = await locals.supabase
			.from('org_data_sources')
			.select('data_source_id')
			.eq('org_id', org.id);
		if (current.error) return fail(400, { error: current.error.message });

		const { add, remove } = planGrantChanges(
			current.data.map((g) => g.data_source_id),
			desired,
			known
		);
		if (add.length > 0) {
			const { error } = await locals.supabase
				.from('org_data_sources')
				.insert(add.map((data_source_id) => ({ org_id: org.id, data_source_id })));
			if (error) return fail(400, { error: error.message });
		}
		if (remove.length > 0) {
			const { error } = await locals.supabase
				.from('org_data_sources')
				.delete()
				.eq('org_id', org.id)
				.in('data_source_id', remove);
			if (error) return fail(400, { error: error.message });
		}
		return { notice: 'Corpus access saved.' };
	},

	addDomain: async ({ params, request, locals }) => {
		const { org, isAdmin } = await requireOrgManager(params.slug);
		if (!isAdmin) return adminOnly();
		const domain = parseDomain((await request.formData()).get('domain'));
		if (!domain) return fail(400, { error: 'Enter a domain like acme.com.' });
		const { error } = await locals.supabase.from('org_domains').insert({ org_id: org.id, domain });
		if (error) {
			const message =
				error.code === '23505' ? `${domain} is already claimed by an org.` : error.message;
			return fail(400, { error: message });
		}
		return { notice: `New sign-ups from @${domain} will join ${org.name}.` };
	},

	removeDomain: async ({ params, request, locals }) => {
		const { org, isAdmin } = await requireOrgManager(params.slug);
		if (!isAdmin) return adminOnly();
		const domain = parseDomain((await request.formData()).get('domain'));
		if (!domain) return fail(400, { error: 'Invalid domain.' });
		const { error } = await locals.supabase
			.from('org_domains')
			.delete()
			.eq('org_id', org.id)
			.eq('domain', domain);
		if (error) return fail(400, { error: error.message });
		return { notice: `Removed @${domain}.` };
	},

	saveSettings: async ({ params, request, locals }) => {
		const { org, isAdmin } = await requireOrgManager(params.slug);
		if (!isAdmin) return adminOnly();
		const form = await request.formData();
		const defaultRole = parseRole(form.get('default_role'));
		if (!defaultRole) return fail(400, { error: 'Pick a default role.' });
		const { error } = await locals.supabase
			.from('orgs')
			.update({ log_queries: form.get('log_queries') === 'on', default_role: defaultRole })
			.eq('id', org.id);
		if (error) return fail(400, { error: error.message });
		return { notice: 'Settings saved.' };
	}
};
