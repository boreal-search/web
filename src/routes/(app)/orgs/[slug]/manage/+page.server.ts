import { fail } from '@sveltejs/kit';
import { requireOrgAdmin } from '#lib/server/auth.js';
import { EmailError, sendEmail } from '#lib/server/email.js';
import { engine, engineErrorMessage } from '#lib/server/engine.js';
import {
	inviteEmail,
	isPublicEmailDomain,
	parseDomain,
	parseEmail,
	parseRole,
	planGrantChanges
} from '#lib/server/orgs.js';
import { ROLE_LABELS } from '#lib/roles.js';
import type { Actions, PageServerLoad } from './$types';

// The org admin page. Org admins and platform admins both reach it; platform-admin-only
// sections and actions are gated here and, authoritatively, by RLS and add_org_member.
// These checks just return a clear message instead of a silent no-op.

export const load: PageServerLoad = async ({ params, locals, fetch }) => {
	const { org, isPlatformAdmin } = await requireOrgAdmin(params.slug);
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

	let platform = null;
	if (isPlatformAdmin) {
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
		platform = {
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
		platform
	};
};

const platformAdminOnly = () => fail(403, { error: 'Only platform admins can change this.' });

export const actions: Actions = {
	addMember: async ({ params, request, locals, url, fetch }) => {
		const { org } = await requireOrgAdmin(params.slug);
		const form = await request.formData();
		const email = parseEmail(form.get('email'));
		const role = parseRole(form.get('role'));
		if (!email || !role) {
			return fail(400, { error: 'Enter an email address like name@acme.com, and pick a role.' });
		}

		const { data: result, error } = await locals.supabase.rpc('add_org_member', {
			p_org_id: org.id,
			p_email: email,
			p_role: role
		});
		if (error) return fail(400, { error: error.message });
		if (result === 'added') return { notice: `Added ${email} as ${ROLE_LABELS[role]}.` };

		try {
			await sendEmail(inviteEmail(email, org.name, `${url.origin}/login`), fetch);
			return {
				notice: `Invite sent to ${email}. They join as ${ROLE_LABELS[role]} once they sign up and confirm that address.`
			};
		} catch (e) {
			const reason = e instanceof EmailError ? e.message : String(e);
			return {
				partial: true,
				notice: `Invite for ${email} saved, but the email wasn't sent (${reason}). Send them ${url.origin}/login: they join as ${ROLE_LABELS[role]} once they sign up and confirm that address.`
			};
		}
	},

	setRole: async ({ params, request, locals }) => {
		const { org } = await requireOrgAdmin(params.slug);
		const form = await request.formData();
		const email = parseEmail(form.get('email'));
		const role = parseRole(form.get('role'));
		if (!email || !role)
			return fail(400, { error: 'That member has no valid email address or role.' });

		// Same idempotent RPC as adding: it updates the role of a member or a pending invite.
		const { error } = await locals.supabase.rpc('add_org_member', {
			p_org_id: org.id,
			p_email: email,
			p_role: role
		});
		if (error) return fail(400, { error: error.message });
		return { notice: `${email} is now ${ROLE_LABELS[role]}.` };
	},

	removeMember: async ({ params, request, locals }) => {
		const { org } = await requireOrgAdmin(params.slug);
		const userId = String((await request.formData()).get('user_id') ?? '');
		const { error, count } = await locals.supabase
			.from('org_members')
			.delete({ count: 'exact' })
			.eq('org_id', org.id)
			.eq('user_id', userId);
		if (error) return fail(400, { error: error.message });
		if (!count) return fail(404, { error: 'That person is no longer a member.' });
		return { notice: 'Member removed.' };
	},

	revokeInvite: async ({ params, request, locals }) => {
		const { org } = await requireOrgAdmin(params.slug);
		const email = parseEmail((await request.formData()).get('email'));
		if (!email) return fail(400, { error: 'That invite has no valid email address.' });
		const { error } = await locals.supabase
			.from('org_invites')
			.delete()
			.eq('org_id', org.id)
			.eq('email', email);
		if (error) return fail(400, { error: error.message });
		return { notice: `Invite for ${email} revoked.` };
	},

	saveGrants: async ({ params, request, locals, fetch }) => {
		const { org, isPlatformAdmin } = await requireOrgAdmin(params.slug);
		if (!isPlatformAdmin) return platformAdminOnly();
		const desired = (await request.formData()).getAll('data_source_id').map(String);

		let known: string[];
		try {
			known = (await engine(fetch).listDataSources()).map((ds) => ds.id);
		} catch (e) {
			return fail(502, { error: `Access not saved. ${engineErrorMessage(e)}` });
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
		return { notice: 'Data source access saved.' };
	},

	addDomain: async ({ params, request, locals }) => {
		const { org, isPlatformAdmin } = await requireOrgAdmin(params.slug);
		if (!isPlatformAdmin) return platformAdminOnly();
		const domain = parseDomain((await request.formData()).get('domain'));
		if (!domain) return fail(400, { error: 'Enter a domain like acme.com.' });
		if (isPublicEmailDomain(domain)) {
			return fail(400, {
				error: `${domain} is a public email provider: anyone with an address there would join ${org.name}. Add those people by email instead.`
			});
		}
		const { error } = await locals.supabase.from('org_domains').insert({ org_id: org.id, domain });
		if (error) {
			const message =
				error.code === '23505' ? `@${domain} already belongs to an org.` : error.message;
			return fail(400, { error: message });
		}
		return { notice: `Added @${domain}. New sign-ups from it join ${org.name}.` };
	},

	removeDomain: async ({ params, request, locals }) => {
		const { org, isPlatformAdmin } = await requireOrgAdmin(params.slug);
		if (!isPlatformAdmin) return platformAdminOnly();
		const domain = parseDomain((await request.formData()).get('domain'));
		if (!domain) return fail(400, { error: 'That domain is not valid.' });
		const { error } = await locals.supabase
			.from('org_domains')
			.delete()
			.eq('org_id', org.id)
			.eq('domain', domain);
		if (error) return fail(400, { error: error.message });
		return { notice: `Removed @${domain}. New sign-ups from it no longer join ${org.name}.` };
	},

	saveSettings: async ({ params, request, locals }) => {
		const { org, isPlatformAdmin } = await requireOrgAdmin(params.slug);
		if (!isPlatformAdmin) return platformAdminOnly();
		const form = await request.formData();
		const defaultRole = parseRole(form.get('default_role'));
		if (!defaultRole) return fail(400, { error: 'Pick a role for domain sign-ups.' });
		const { error } = await locals.supabase
			.from('orgs')
			.update({ log_queries: form.get('log_queries') === 'on', default_role: defaultRole })
			.eq('id', org.id);
		if (error) return fail(400, { error: error.message });
		return { notice: 'Settings saved.' };
	}
};
